import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
  ) {}

  /* ---- SANITIZATION LOGIC ---- */

  private sanitizeCourse(courseDoc: CourseDocument, userId: string): any {
    const course = courseDoc.toObject();
    const isAdmin = course.createdBy.toString() === userId;
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
          description:
            "Darsni ko'rish uchun kursga a'zo bo'ling va admin tasdiqlashini kuting.",
        };
      });
    }

    return course;
  }

  async getAllCoursesForUser(userId: string): Promise<any[]> {
    const courses = await this.courseModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
    return courses.map((c) => this.sanitizeCourse(c, userId));
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
    const course = await this.courseModel.findById(id).exec();
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
    },
  ): Promise<CourseDocument> {
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
      gradient,
      createdBy: new Types.ObjectId(userId),
    });
  }

  async delete(courseId: string, userId: string): Promise<void> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Siz bu kursni o'chira olmaysiz");
    }
    await this.courseModel.findByIdAndDelete(courseId).exec();
  }

  /* ---- LESSONS ---- */

  async addLesson(
    courseId: string,
    userId: string,
    dto: { title: string; videoUrl: string; description?: string },
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat kurs egasi dars qo'sha oladi");
    }
    course.lessons.push({
      title: dto.title,
      videoUrl: dto.videoUrl,
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
    course.lessons = course.lessons.filter(
      (l: any) => l._id.toString() !== lessonId,
    ) as any;
    return course.save();
  }

  async incrementViews(courseId: string, lessonId: string): Promise<void> {
    await this.courseModel
      .updateOne(
        { _id: courseId, 'lessons._id': lessonId },
        { $inc: { 'lessons.$.views': 1 } },
      )
      .exec();
  }

  /* ---- ENROLLMENT ---- */

  async enroll(
    courseId: string,
    user: { _id: string; nickname: string; username: string },
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    const alreadyMember = course.members.find(
      (m: any) => m.userId.toString() === user._id,
    );
    if (alreadyMember) return course;

    course.members.push({
      userId: new Types.ObjectId(user._id),
      name: user.nickname || user.username,
      avatar: (user.nickname || user.username).substring(0, 2).toUpperCase(),
      status: 'pending',
      joinedAt: new Date(),
    } as any);
    return course.save();
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
    if (member) member.status = 'approved';
    return course.save();
  }

  async removeUser(
    courseId: string,
    memberId: string,
    adminId: string,
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== adminId) {
      throw new ForbiddenException("Faqat kurs egasi o'chira oladi");
    }
    course.members = course.members.filter(
      (m: any) => m.userId.toString() !== memberId,
    ) as any;
    return course.save();
  }

  /* ---- COMMENTS ---- */

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

    lesson.comments.push({
      userId: new Types.ObjectId(user._id),
      userName: user.nickname || user.username,
      userAvatar: (user.nickname || user.username)
        .substring(0, 2)
        .toUpperCase(),
      text,
      createdAt: new Date(),
      replies: [],
    } as any);
    return course.save();
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

    comment.replies.push({
      userId: new Types.ObjectId(user._id),
      userName: user.nickname || user.username,
      userAvatar: (user.nickname || user.username)
        .substring(0, 2)
        .toUpperCase(),
      text,
      createdAt: new Date(),
    } as any);
    return course.save();
  }
}
