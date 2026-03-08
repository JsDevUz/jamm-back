import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseSchema, CourseDocument } from './schemas/course.schema';
import { EncryptionService } from '../common/encryption/encryption.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';
import { CoursesGateway } from './courses.gateway';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  assertMaxChars,
  getTierLimit,
} from '../common/limits/app-limits';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private encryptionService: EncryptionService,
    private r2Service: R2Service,
    private coursesGateway: CoursesGateway,
  ) {}

  private decryptText(item: any): any {
    if (!item.isEncrypted) return item;
    try {
      const decrypted = this.encryptionService.decrypt({
        encryptedContent: item.text,
        iv: item.iv,
        authTag: item.authTag,
        keyVersion: item.keyVersion || 0,
      });
      return { ...item, text: decrypted };
    } catch (error) {
      console.error('Failed to decrypt course content:', error);
      return { ...item, text: '[Decryption Error]' };
    }
  }

  /* ---- SANITIZATION LOGIC ---- */

  private sanitizeCourse(courseDoc: CourseDocument, userId: string): any {
    const course = courseDoc.toObject();
    const ownerId = course.createdBy.toString();
    course.members = (course.members || []).filter(
      (m: any) => m.userId?.toString() !== ownerId,
    );
    const isAdmin = ownerId === userId;
    const isApprovedMember = course.members.some(
      (m: any) => m.userId.toString() === userId && m.status === 'approved',
    );

    if (!isAdmin && !isApprovedMember) {
      // Strip videoUrl and details from lessons except the first one (preview).
      course.lessons = course.lessons.map((lesson: any, index: number) => {
        if (index === 0) return lesson;
        return {
          ...lesson,
          videoUrl: '',
          fileUrl: '',
          streamAssets: [],
          hlsKeyAsset: '',
          description:
            "Darsni ko'rish uchun kursga a'zo bo'ling va admin tasdiqlashini kuting.",
        };
      });
    }

    // Decrypt comments and replies
    course.lessons = course.lessons.map((lesson: any) => ({
      _id: lesson._id,
      title: lesson.title,
      type: lesson.type,
      videoUrl: lesson.videoUrl,
      fileUrl: lesson.fileUrl,
      fileName: lesson.fileName,
      fileSize: lesson.fileSize,
      streamType: lesson.streamType || 'direct',
      streamAssets: lesson.streamAssets || [],
      hlsKeyAsset: '',
      urlSlug: lesson.urlSlug,
      description: lesson.description,
      views: lesson.views,
      likes: lesson.likes?.length || 0,
      liked: Array.isArray(lesson.likes)
        ? lesson.likes.some((id: any) => id.toString() === userId)
        : false,
      addedAt: lesson.addedAt,
      comments: (lesson.comments || []).map((comment: any) => {
        const decryptedComment = this.decryptText(comment);
        return {
          _id: decryptedComment._id,
          userId: decryptedComment.userId,
          userName: decryptedComment.userName,
          userAvatar: decryptedComment.userAvatar,
          text: decryptedComment.text,
          createdAt: decryptedComment.createdAt,
          replies: (decryptedComment.replies || []).map((reply: any) => {
            const dr = this.decryptText(reply);
            return {
              _id: dr._id,
              userId: dr.userId,
              userName: dr.userName,
              userAvatar: dr.userAvatar,
              text: dr.text,
              createdAt: dr.createdAt,
            };
          }),
        };
      }),
    }));

    // strip __v
    const { __v, ...safeCourse } = course;
    return safeCourse;
  }

  private canAccessLesson(
    course: CourseDocument,
    userId: string,
    lessonIndex: number,
  ) {
    const ownerId = course.createdBy.toString();
    if (ownerId === userId) return true;

    const isApprovedMember = (course.members || []).some(
      (member: any) =>
        member.userId?.toString() === userId && member.status === 'approved',
    );
    if (isApprovedMember) return true;

    return lessonIndex === 0;
  }

  async getAllCoursesForUser(
    userId: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 15 },
  ): Promise<any> {
    const skip = (pagination.page - 1) * pagination.limit;

    const [courses, total] = await Promise.all([
      this.courseModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.courseModel.countDocuments(),
    ]);

    return {
      data: courses.map((c) => this.sanitizeCourse(c, userId)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getCourseForUser(id: string, userId: string): Promise<any> {
    const course = await this.findById(id);
    return this.sanitizeCourse(course, userId);
  }

  /* ---- COURSES CRUD (Internal) ---- */

  async findAll(): Promise<CourseDocument[]> {
    return this.courseModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<CourseDocument> {
    const isObjectId =
      Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id;
    const query = isObjectId
      ? { $or: [{ _id: id }, { urlSlug: id }] }
      : { urlSlug: id };
    const course = await this.courseModel.findOne(query).exec();
    if (!course) throw new NotFoundException('Kurs topilmadi');
    return course;
  }

  async create(
    userId: string,
    dto: {
      name: string;
      description?: string;
      image?: string;
      category?: string;
      price?: number;
      accessType?: string;
      urlSlug?: string;
    },
  ): Promise<CourseDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    assertMaxChars('Kurs nomi', dto.name, APP_TEXT_LIMITS.courseNameChars);
    assertMaxChars(
      'Kurs tavsifi',
      dto.description,
      APP_TEXT_LIMITS.courseDescriptionChars,
    );
    assertMaxChars(
      'Kurs kategoriyasi',
      dto.category,
      APP_TEXT_LIMITS.courseCategoryChars,
    );

    const limit = getTierLimit(APP_LIMITS.coursesCreated, user.premiumStatus);

    const existingCoursesCount = await this.courseModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    if (existingCoursesCount >= limit) {
      throw new ForbiddenException(
        `Siz maksimal ${limit} ta kurs yarata olasiz`,
      );
    }

    // Generate urlSlug from name if not provided
    let rawSlug =
      dto.urlSlug ||
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    let finalSlug = rawSlug;
    let counter = 1;
    while (await this.courseModel.findOne({ urlSlug: finalSlug })) {
      finalSlug = `${rawSlug}-${counter}`;
      counter++;
    }
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)',
    ];
    const gradient = gradients[Math.floor(Math.random() * gradients.length)];

    return this.courseModel.create({
      ...dto,
      urlSlug: finalSlug,
      gradient,
      createdBy: new Types.ObjectId(userId),
    });
  }

  async delete(courseId: string, userId: string): Promise<void> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Siz bu kursni o'chira olmaysiz");
    }

    // Delete associated files in R2
    for (const lesson of course.lessons as any[]) {
      for (const asset of lesson.streamAssets || []) {
        await this.r2Service.deleteFile(asset);
      }
      if (lesson.hlsKeyAsset) {
        await this.r2Service.deleteFile(lesson.hlsKeyAsset);
      }
      if (lesson.fileUrl) {
        await this.r2Service.deleteFile(lesson.fileUrl);
      }
      if (
        lesson.videoUrl &&
        lesson.type === 'file' &&
        lesson.videoUrl.startsWith('http')
      ) {
        await this.r2Service.deleteFile(lesson.videoUrl);
      }
    }

    await this.courseModel.findByIdAndDelete(course._id).exec();
  }

  /* ---- LESSONS ---- */

  async addLesson(
    courseId: string,
    userId: string,
    dto: {
      title: string;
      videoUrl?: string;
      description?: string;
      type?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      streamType?: string;
      streamAssets?: string[];
      hlsKeyAsset?: string;
      urlSlug?: string;
    },
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat kurs egasi dars qo'sha oladi");
    }

    const user = await this.userModel.findById(userId);
    const limit = getTierLimit(APP_LIMITS.lessonsPerCourse, user?.premiumStatus);

    if (course.lessons.length >= limit) {
      throw new ForbiddenException(
        `Har bir kursda maksimal ${limit} ta dars bo'lishi mumkin`,
      );
    }

    assertMaxChars('Dars sarlavhasi', dto.title, APP_TEXT_LIMITS.lessonTitleChars);
    assertMaxChars(
      'Dars tavsifi',
      dto.description,
      APP_TEXT_LIMITS.lessonDescriptionChars,
    );

    if (
      !getTierLimit({ ordinary: 0, premium: 1 }, user?.premiumStatus) &&
      dto.type === 'file'
    ) {
      throw new ForbiddenException(
        'Fayl yuklash uchun Premium obuna talab qilinadi',
      );
    }

    let rawSlug =
      dto.urlSlug ||
      dto.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    let finalSlug = rawSlug;
    let counter = 1;
    while (course.lessons.some((l) => l.urlSlug === finalSlug)) {
      finalSlug = `${rawSlug}-${counter}`;
      counter++;
    }

    course.lessons.push({
      title: dto.title,
      type: dto.type || 'video',
      videoUrl: dto.videoUrl || '',
      fileUrl: dto.fileUrl || '',
      fileName: dto.fileName || '',
      fileSize: dto.fileSize || 0,
      streamType: dto.streamType || 'direct',
      streamAssets: dto.streamAssets || [],
      hlsKeyAsset: dto.hlsKeyAsset || '',
      urlSlug: finalSlug,
      description: dto.description || '',
      views: 0,
      addedAt: new Date(),
      comments: [],
    } as any);
    return course.save();
  }

  async removeLesson(
    courseId: string,
    lessonId: string,
    userId: string,
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat kurs egasi dars o'chira oladi");
    }

    const lessonObj = course.lessons.find(
      (l: any) => l._id.toString() === lessonId,
    ) as any;
    if (lessonObj) {
      for (const asset of lessonObj.streamAssets || []) {
        await this.r2Service
          .deleteFile(asset)
          .catch((e) =>
            console.error(`Failed to delete stream asset ${asset}:`, e),
          );
      }
      if (lessonObj.hlsKeyAsset) {
        await this.r2Service
          .deleteFile(lessonObj.hlsKeyAsset)
          .catch((e) =>
            console.error(
              `Failed to delete HLS key asset ${lessonObj.hlsKeyAsset}:`,
              e,
            ),
          );
      }
      if (lessonObj.fileUrl) {
        await this.r2Service
          .deleteFile(lessonObj.fileUrl)
          .catch((e) =>
            console.error(`Failed to delete fileUrl ${lessonObj.fileUrl}:`, e),
          );
      }
      if (lessonObj.videoUrl && lessonObj.type === 'file') {
        await this.r2Service
          .deleteFile(lessonObj.videoUrl)
          .catch((e) =>
            console.error(
              `Failed to delete videoUrl ${lessonObj.videoUrl}:`,
              e,
            ),
          );
      }
    }

    course.lessons = course.lessons.filter(
      (l: any) => l._id.toString() !== lessonId,
    ) as any;
    return course.save();
  }

  async incrementViews(courseId: string, lessonId: string): Promise<void> {
    const course = await this.findById(courseId);
    const lesson = course.lessons.find(
      (l: any) => l._id.toString() === lessonId || l.urlSlug === lessonId,
    );
    if (!lesson) return;

    await this.courseModel
      .updateOne(
        { _id: course._id, 'lessons._id': lesson._id },
        { $inc: { 'lessons.$.views': 1 } },
      )
      .exec();
  }

  async toggleLessonLike(
    courseId: string,
    lessonId: string,
    userId: string,
  ): Promise<{ liked: boolean; likes: number }> {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );
    if (lessonIndex === -1) throw new NotFoundException('Dars topilmadi');
    if (!this.canAccessLesson(course, userId, lessonIndex)) {
      throw new ForbiddenException("Bu darsga like bosish uchun avval kursga kiring");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const userObjectId = new Types.ObjectId(userId);
    const alreadyLiked = (lesson.likes || []).some((id: any) =>
      id.equals(userObjectId),
    );

    if (alreadyLiked) {
      lesson.likes = (lesson.likes || []).filter(
        (id: any) => !id.equals(userObjectId),
      );
    } else {
      lesson.likes = [...(lesson.likes || []), userObjectId];
    }

    await course.save();

    return {
      liked: !alreadyLiked,
      likes: lesson.likes.length,
    };
  }

  async getLikedLessons(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const courses = await this.courseModel
      .find({ 'lessons.likes': userObjectId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50)
      .exec();

    return courses.flatMap((course) => {
      const safeCourse = this.sanitizeCourse(course, userId);
      return (safeCourse.lessons || [])
        .filter((lesson: any) => lesson.liked)
        .map((lesson: any) => ({
          _id: lesson._id,
          title: lesson.title,
          description: lesson.description,
          likes: lesson.likes || 0,
          views: lesson.views || 0,
          urlSlug: lesson.urlSlug,
          addedAt: lesson.addedAt,
          course: {
            _id: safeCourse._id,
            name: safeCourse.name,
            image: safeCourse.image,
            urlSlug: safeCourse.urlSlug,
          },
        }));
    });
  }

  /* ---- ENROLLMENT ---- */

  async enroll(
    courseId: string,
    user: { _id: string; nickname: string; username: string },
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() === user._id) {
      throw new ForbiddenException(
        "Kurs egasi o'z kursiga obuna bo'la olmaydi",
      );
    }

    course.members = course.members.filter(
      (m: any) => m.userId.toString() !== course.createdBy.toString(),
    ) as any;

    const alreadyMember = course.members.find(
      (m: any) => m.userId.toString() === user._id,
    );
    if (alreadyMember) return course;

    const status = course.accessType === 'free_open' ? 'approved' : 'pending';
    course.members.push({
      userId: new Types.ObjectId(user._id),
      name: user.nickname || user.username,
      avatar: (user.nickname || user.username).substring(0, 2).toUpperCase(),
      status,
      joinedAt: new Date(),
    } as any);

    const updatedCourse = await course.save();

    // Broadcast that a new member requested to join (notify course admins/subscribers if needed)
    this.coursesGateway.notifyCourse(courseId, 'course_enrolled', {
      courseId,
      user: { _id: user._id, name: user.nickname || user.username },
    });

    return updatedCourse;
  }

  async approveUser(
    courseId: string,
    memberId: string,
    adminId: string,
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== adminId) {
      throw new ForbiddenException('Faqat kurs egasi tasdiqlashi mumkin');
    }
    const member = course.members.find(
      (m: any) => m.userId.toString() === memberId,
    );
    if (member) {
      member.status = 'approved';
    }

    const updatedCourse = await course.save();

    // Notify the approved user individually
    this.coursesGateway.notifyUser(memberId, 'member_approved', {
      courseId,
      courseName: course.name,
    });

    // Notify the room broadly
    this.coursesGateway.notifyCourse(courseId, 'member_approved_broadcast', {
      courseId,
      memberId,
    });

    return updatedCourse;
  }

  async removeUser(
    courseId: string,
    memberId: string,
    adminId: string,
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== adminId && memberId !== adminId) {
      throw new ForbiddenException(
        "Faqat kurs egasi o'chira oladi yoki foydalanuvchi o'zini o'zi o'chira oladi",
      );
    }
    course.members = course.members.filter(
      (m: any) => m.userId.toString() !== memberId,
    ) as any;

    const updatedCourse = await course.save();

    // Notify the removed user
    this.coursesGateway.notifyUser(memberId, 'member_rejected', {
      courseId,
      courseName: course.name,
    });

    // Notify the room broadly
    this.coursesGateway.notifyCourse(courseId, 'member_rejected_broadcast', {
      courseId,
      memberId,
    });

    return updatedCourse;
  }

  /* ---- COMMENTS ---- */

  async getLessonComments(
    courseId: string,
    lessonId: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 10 },
  ) {
    const course = await this.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    const lessonIndex = course.lessons.findIndex(
      (l: any) => l._id.toString() === lessonId || l.urlSlug === lessonId,
    );

    if (lessonIndex === -1) throw new NotFoundException('Lesson not found');
    const lesson = course.lessons[lessonIndex] as any;

    const skip = (pagination.page - 1) * pagination.limit;

    // Decrypt all comments for this lesson
    const decryptedComments = (lesson.comments || []).map((comment: any) => {
      const decryptedComment = this.decryptText(comment);
      return {
        _id: decryptedComment._id,
        userId: decryptedComment.userId,
        userName: decryptedComment.userName,
        userAvatar: decryptedComment.userAvatar,
        text: decryptedComment.text,
        createdAt: decryptedComment.createdAt,
        replies: (decryptedComment.replies || []).map((reply: any) => {
          const dr = this.decryptText(reply);
          return {
            _id: dr._id,
            userId: dr.userId,
            userName: dr.userName,
            userAvatar: dr.userAvatar,
            text: dr.text,
            createdAt: dr.createdAt,
          };
        }),
      };
    });

    // Sort newest first
    decryptedComments.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const paginatedComments = decryptedComments.slice(
      skip,
      skip + pagination.limit,
    );

    return {
      data: paginatedComments,
      total: decryptedComments.length,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(decryptedComments.length / pagination.limit),
    };
  }

  async addComment(
    courseId: string,
    lessonId: string,
    user: any,
    text: string,
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    const lesson = course.lessons.find(
      (l: any) => l._id.toString() === lessonId,
    );
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    assertMaxChars('Dars izohi', text, APP_TEXT_LIMITS.messageChars);

    const encrypted = this.encryptionService.encrypt(text);

    lesson.comments.push({
      userId: new Types.ObjectId(user._id),
      userName: user.nickname || user.username,
      userAvatar: (user.nickname || user.username)
        .substring(0, 2)
        .toUpperCase(),
      text: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      encryptionType: 'server',
      isEncrypted: true,
      keyVersion: encrypted.keyVersion,
      searchableText: this.encryptionService.getSearchableText(text),
      createdAt: new Date(),
      replies: [],
    } as any);
    const updatedCourse = await course.save();
    return this.sanitizeCourse(updatedCourse, user._id.toString());
  }

  async addReply(
    courseId: string,
    lessonId: string,
    commentId: string,
    user: any,
    text: string,
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    const lesson = course.lessons.find(
      (l: any) => l._id.toString() === lessonId,
    );
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const comment = lesson.comments.find(
      (c: any) => c._id.toString() === commentId,
    );
    if (!comment) throw new NotFoundException('Izoh topilmadi');

    assertMaxChars('Dars javobi', text, APP_TEXT_LIMITS.messageChars);

    const encrypted = this.encryptionService.encrypt(text);

    comment.replies.push({
      userId: new Types.ObjectId(user._id),
      userName: user.nickname || user.username,
      userAvatar: (user.nickname || user.username)
        .substring(0, 2)
        .toUpperCase(),
      text: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      encryptionType: 'server',
      isEncrypted: true,
      keyVersion: encrypted.keyVersion,
      searchableText: this.encryptionService.getSearchableText(text),
      createdAt: new Date(),
    } as any);
    const updatedCourse = await course.save();
    return this.sanitizeCourse(updatedCourse, user._id.toString());
  }
}
