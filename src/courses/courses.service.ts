import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseSchema, CourseDocument } from './schemas/course.schema';
import {
  CourseMemberRecord,
  CourseMemberRecordDocument,
} from './schemas/course-member.schema';
import {
  CourseLessonRecord,
  CourseLessonRecordDocument,
} from './schemas/course-lesson.schema';
import {
  LessonHomeworkRecord,
  LessonHomeworkRecordDocument,
} from './schemas/lesson-homework.schema';
import { EncryptionService } from '../common/encryption/encryption.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';
import { CoursesGateway } from './courses.gateway';
import { ArenaService } from '../arena/arena.service';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  assertMaxChars,
  getTierLimit,
} from '../common/limits/app-limits';
import {
  generateShortSlug,
  sanitizeCustomSlug,
} from '../common/utils/generate-short-slug';
import {
  generatePrefixedShortSlug,
  isPrefixedShortSlug,
  sanitizePrefixedSlug,
} from '../common/utils/prefixed-slug';

@Injectable()
export class CoursesService implements OnModuleInit {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(CourseMemberRecord.name)
    private courseMemberRecordModel: Model<CourseMemberRecordDocument>,
    @InjectModel(CourseLessonRecord.name)
    private courseLessonRecordModel: Model<CourseLessonRecordDocument>,
    @InjectModel(LessonHomeworkRecord.name)
    private lessonHomeworkRecordModel: Model<LessonHomeworkRecordDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private encryptionService: EncryptionService,
    private r2Service: R2Service,
    private coursesGateway: CoursesGateway,
    private arenaService: ArenaService,
  ) {}

  async onModuleInit() {
    const courses = await this.courseModel
      .find()
      .select('_id urlSlug')
      .lean()
      .exec();
    for (const course of courses) {
      const courseId = course._id?.toString?.() || '';
      if (!courseId) continue;

      if (!this.isShortSlug(course.urlSlug)) {
        await this.courseModel
          .updateOne(
            { _id: course._id },
            { $set: { urlSlug: await this.generateUniqueCourseSlug() } },
          )
          .exec();
      }

      const lessonRows = await this.courseLessonRecordModel
        .find({ courseId: course._id })
        .sort({ order: 1, createdAt: 1 })
        .lean()
        .exec();
      const usedLessonSlugs = new Set<string>();

      for (const lesson of lessonRows) {
        const currentSlug = String(lesson?.urlSlug || '').trim();
        if (
          !this.isShortSlug(currentSlug) ||
          usedLessonSlugs.has(currentSlug)
        ) {
          const nextSlug = this.generateUniqueLessonSlug(
            { lessons: Array.from(usedLessonSlugs).map((urlSlug) => ({ urlSlug })) },
            undefined,
          );
          await this.courseLessonRecordModel
            .updateOne({ _id: lesson._id }, { $set: { urlSlug: nextSlug } })
            .exec();
          usedLessonSlugs.add(nextSlug);
          continue;
        }
        usedLessonSlugs.add(currentSlug);
      }
    }
  }

  private isShortSlug(value?: string | null) {
    return isPrefixedShortSlug(value, '+');
  }

  private countTimedLessonNotes(text?: string | null) {
    return String(text || '')
      .split(/\r?\n/)
      .filter((line) =>
        /^\s*(?:\[\d{1,2}:\d{2}(?::\d{2})?\]|\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-:|]\s*)?/u.test(
          line,
        ),
      ).length;
  }

  private countUntimedLessonNoteLines(text?: string | null) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean)
      .filter(
        (line) =>
          !/^\s*(?:\[\d{1,2}:\d{2}(?::\d{2})?\]|\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-:|]\s*)?/u.test(
            line,
          ),
      ).length;
  }

  private async generateUniqueCourseSlug(preferredSlug?: string) {
    const baseSlug = sanitizePrefixedSlug(preferredSlug, '+');

    if (baseSlug) {
      const existingCourse = await this.courseModel.exists({ urlSlug: baseSlug });
      if (!existingCourse) return baseSlug;
    }

    let slug = generatePrefixedShortSlug('+', 8);
    while (await this.courseModel.exists({ urlSlug: slug })) {
      slug = generatePrefixedShortSlug('+', 8);
    }

    return slug;
  }

  private generateUniqueLessonSlug(course: any, preferredSlug?: string) {
    const baseSlug = sanitizeCustomSlug(preferredSlug);
    const lessonSlugs = new Set(
      (Array.isArray(course?.lessons) ? course.lessons : [])
        .map((lesson: any) => String(lesson?.urlSlug || '').trim())
        .filter(Boolean),
    );

    if (baseSlug && !lessonSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let slug = generateShortSlug(8);
    while (lessonSlugs.has(slug)) {
      slug = generateShortSlug(8);
    }

    return slug;
  }

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

  private async getUserPremiumStatus(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('premiumStatus')
      .lean();
    return user?.premiumStatus || null;
  }

  private async syncCourseMirrorCollections(course: any) {
    return this.persistCourseCollections(course);
  }

  private attachCourseRuntimeHelpers(course: any) {
    if (!course || typeof course !== 'object') {
      return course;
    }

    if (!Array.isArray(course.members)) {
      course.members = [];
    }

    if (!Array.isArray(course.lessons)) {
      course.lessons = [];
    }

    if (typeof course.save !== 'function') {
      Object.defineProperty(course, 'save', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: async () => course,
      });
    }

    if (typeof course.toObject !== 'function') {
      Object.defineProperty(course, 'toObject', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: () => course,
      });
    }

    return course;
  }

  private pickPersistedCourseFields(course: any) {
    return {
      name: String(course?.name || '').trim(),
      description: String(course?.description || '').trim(),
      image: String(course?.image || '').trim(),
      gradient: String(course?.gradient || '').trim(),
      category: String(course?.category || 'IT').trim() || 'IT',
      lessonLanguage: String(course?.lessonLanguage || '').trim(),
      previewLearn: Array.isArray(course?.previewLearn)
        ? course.previewLearn
            .map((item: any) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 8)
        : [],
      previewRequirements: Array.isArray(course?.previewRequirements)
        ? course.previewRequirements
            .map((item: any) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 8)
        : [],
      deliveryType:
        String(course?.deliveryType || 'recorded').trim() === 'ongoing'
          ? 'ongoing'
          : 'recorded',
      urlSlug: String(course?.urlSlug || '').trim(),
      accessType: course?.accessType || 'free_request',
      price: Number(course?.price || 0),
      rating: Number(course?.rating || 0),
      ratingCount: Number(course?.ratingCount || 0),
      reviews: Array.isArray(course?.reviews) ? course.reviews : [],
      createdBy: course?.createdBy,
    };
  }

  private getNormalizedMemberRows(course: any, courseId: Types.ObjectId) {
    const ownerId = course?.createdBy?.toString?.() || '';
    return (Array.isArray(course?.members) ? course.members : [])
      .filter((member: any) => {
        const memberId = member?.userId?.toString?.() || '';
        return memberId && memberId !== ownerId;
      })
      .map((member: any) => ({
        courseId,
        userId: member.userId,
        userName: member.userName || member.name || '',
        userAvatar: member.userAvatar || member.avatar || '',
        status: member.status || 'pending',
        requestedAt: member.requestedAt || null,
        joinedAt: member.joinedAt || null,
        isAdmin: Boolean(member.isAdmin),
        permissions: Array.isArray(member.permissions) ? member.permissions : [],
      }));
  }

  private getNormalizedLessonRows(course: any, courseId: Types.ObjectId) {
    return (Array.isArray(course?.lessons) ? course.lessons : []).map(
      (lesson: any, index: number) => ({
        courseId,
        lessonId: lesson._id || new Types.ObjectId(),
        title: lesson.title || '',
        type: lesson.type || 'video',
        description: lesson.description || '',
        urlSlug:
          lesson.urlSlug || this.generateUniqueLessonSlug(course, lesson.urlSlug),
        status: lesson.status || 'published',
        publishedAt: lesson.publishedAt || null,
        order: index,
        videoUrl: lesson.videoUrl || '',
        fileUrl: lesson.fileUrl || '',
        fileName: lesson.fileName || '',
        fileSize: Number(lesson.fileSize || 0),
        durationSeconds: Number(lesson.durationSeconds || 0),
        streamType: lesson.streamType || 'direct',
        streamAssets: Array.isArray(lesson.streamAssets) ? lesson.streamAssets : [],
        hlsKeyAsset: lesson.hlsKeyAsset || '',
        addedAt: lesson.addedAt || null,
        views: Number(lesson.views || 0),
        likes: Array.isArray(lesson.likes) ? lesson.likes : [],
        comments: Array.isArray(lesson.comments) ? lesson.comments : [],
        attendance: Array.isArray(lesson.attendance) ? lesson.attendance : [],
        oralAssessments: Array.isArray(lesson.oralAssessments)
          ? lesson.oralAssessments
          : [],
        content: lesson.content || {},
        notionUrl: lesson.notionUrl || '',
        mediaItems: Array.isArray(lesson.mediaItems) ? lesson.mediaItems : [],
        materials: Array.isArray(lesson.materials) ? lesson.materials : [],
        linkedTests: Array.isArray(lesson.linkedTests) ? lesson.linkedTests : [],
        notes: Array.isArray(lesson.notes) ? lesson.notes : [],
      }),
    );
  }

  private getNormalizedHomeworkRows(course: any, courseId: Types.ObjectId) {
    return (Array.isArray(course?.lessons) ? course.lessons : []).flatMap(
      (lesson: any) =>
        (Array.isArray(lesson?.homework) ? lesson.homework : []).map(
          (assignment: any) => ({
            courseId,
            lessonId: lesson._id,
            assignmentId: assignment._id || new Types.ObjectId(),
            enabled: Boolean(assignment.enabled),
            title: assignment.title || '',
            description: assignment.description || '',
            type: assignment.type || 'text',
            deadline: assignment.deadline || null,
            maxScore: assignment.maxScore || 100,
            submissions: Array.isArray(assignment.submissions)
              ? assignment.submissions
              : [],
          }),
        ),
    );
  }

  private async persistCourseCollections(course: any) {
    const courseId = new Types.ObjectId(course._id);
    const lessonRows = this.getNormalizedLessonRows(course, courseId);
    const memberRows = this.getNormalizedMemberRows(course, courseId);
    const homeworkRows = this.getNormalizedHomeworkRows(course, courseId);

    await this.courseModel
      .updateOne({ _id: courseId }, { $set: this.pickPersistedCourseFields(course) })
      .exec();

    const currentMemberUserIds = memberRows.map((r: any) => r.userId);
    const currentLessonIds = lessonRows.map((r: any) => r.lessonId);
    const currentHomeworkIds = homeworkRows.map((r: any) => r.assignmentId);

    await Promise.all([
      // Remove stale member records not in the current set
      currentMemberUserIds.length
        ? this.courseMemberRecordModel.deleteMany({
            courseId,
            userId: { $nin: currentMemberUserIds },
          })
        : this.courseMemberRecordModel.deleteMany({ courseId }),
      // Remove stale lesson records not in the current set
      currentLessonIds.length
        ? this.courseLessonRecordModel.deleteMany({
            courseId,
            lessonId: { $nin: currentLessonIds },
          })
        : this.courseLessonRecordModel.deleteMany({ courseId }),
      // Remove stale homework records not in the current set
      currentHomeworkIds.length
        ? this.lessonHomeworkRecordModel.deleteMany({
            courseId,
            assignmentId: { $nin: currentHomeworkIds },
          })
        : this.lessonHomeworkRecordModel.deleteMany({ courseId }),
    ]);

    await Promise.all([
      memberRows.length
        ? this.courseMemberRecordModel.bulkWrite(
            memberRows.map((row: any) => ({
              updateOne: {
                filter: { courseId: row.courseId, userId: row.userId },
                update: { $set: row },
                upsert: true,
              },
            })),
          )
        : Promise.resolve(),
      lessonRows.length
        ? this.courseLessonRecordModel.bulkWrite(
            lessonRows.map((row: any) => ({
              updateOne: {
                filter: { courseId: row.courseId, lessonId: row.lessonId },
                update: { $set: row },
                upsert: true,
              },
            })),
          )
        : Promise.resolve(),
      homeworkRows.length
        ? this.lessonHomeworkRecordModel.bulkWrite(
            homeworkRows.map((row: any) => ({
              updateOne: {
                filter: { courseId: row.courseId, assignmentId: row.assignmentId },
                update: { $set: row },
                upsert: true,
              },
            })),
          )
        : Promise.resolve(),
    ]);
  }

  private async hydrateCourseCollections(course: any) {
    if (!course?._id) {
      return course;
    }

    const courseId = new Types.ObjectId(course._id);
    const [memberRows, lessonRows, homeworkRows] = await Promise.all([
      this.courseMemberRecordModel
        .find({ courseId })
        .sort({ createdAt: 1, joinedAt: 1, requestedAt: 1 })
        .lean()
        .exec(),
      this.courseLessonRecordModel
        .find({ courseId })
        .sort({ order: 1, createdAt: 1 })
        .lean()
        .exec(),
      this.lessonHomeworkRecordModel
        .find({ courseId })
        .sort({ createdAt: 1, deadline: 1 })
        .lean()
        .exec(),
    ]);

    const homeworkByLessonId = new Map<string, any[]>();
    for (const row of homeworkRows) {
      const lessonKey = row.lessonId?.toString?.() || '';
      if (!lessonKey) continue;
      const normalizedRow = {
        _id: row.assignmentId,
        enabled: Boolean(row.enabled),
        title: row.title || '',
        description: row.description || '',
        type: row.type || 'text',
        deadline: row.deadline || null,
        maxScore: Number(row.maxScore || 100),
        submissions: Array.isArray(row.submissions) ? row.submissions : [],
      };
      const bucket = homeworkByLessonId.get(lessonKey) || [];
      bucket.push(normalizedRow);
      homeworkByLessonId.set(lessonKey, bucket);
    }

    course.members = memberRows.map((row: any) => ({
      userId: row.userId,
      name: row.userName || '',
      avatar: row.userAvatar || '',
      status: row.status || 'pending',
      requestedAt: row.requestedAt || null,
      joinedAt: row.joinedAt || null,
      isAdmin: Boolean(row.isAdmin),
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
    }));

    course.lessons = lessonRows.map((row: any) => {
      const lessonKey = row.lessonId?.toString?.() || '';
      return {
        _id: row.lessonId,
        title: row.title || '',
        type: row.type || 'video',
        description: row.description || '',
        urlSlug: row.urlSlug || '',
        status: row.status || 'published',
        publishedAt: row.publishedAt || null,
        videoUrl: row.videoUrl || '',
        fileUrl: row.fileUrl || '',
        fileName: row.fileName || '',
        fileSize: Number(row.fileSize || 0),
        durationSeconds: Number(row.durationSeconds || 0),
        streamType: row.streamType || 'direct',
        streamAssets: Array.isArray(row.streamAssets) ? row.streamAssets : [],
        hlsKeyAsset: row.hlsKeyAsset || '',
        addedAt: row.addedAt || null,
        views: Number(row.views || 0),
        likes: Array.isArray(row.likes) ? row.likes : [],
        comments: Array.isArray(row.comments) ? row.comments : [],
        attendance: Array.isArray(row.attendance) ? row.attendance : [],
        oralAssessments: Array.isArray(row.oralAssessments)
          ? row.oralAssessments
          : [],
        content: row.content || {},
        notionUrl: row.notionUrl || '',
        mediaItems: Array.isArray(row.mediaItems) ? row.mediaItems : [],
        materials: Array.isArray(row.materials) ? row.materials : [],
        linkedTests: Array.isArray(row.linkedTests) ? row.linkedTests : [],
        notes: Array.isArray(row.notes) ? row.notes : [],
        homework: homeworkByLessonId.get(lessonKey) || [],
      };
    });

    return this.attachCourseRuntimeHelpers(course);
  }

  private getHomeworkFileSizeLimit(type: string) {
    switch (type) {
      case 'photo':
        return APP_LIMITS.homeworkPhotoBytes;
      case 'audio':
        return APP_LIMITS.homeworkAudioBytes;
      case 'video':
        return APP_LIMITS.homeworkVideoBytes;
      case 'pdf':
        return APP_LIMITS.homeworkPdfBytes;
      default:
        return 0;
    }
  }

  private assertHomeworkSubmissionFileIsAllowed(
    type: string,
    fileName: string,
    fileSize: number,
  ) {
    const normalizedName = String(fileName || '').trim().toLowerCase();
    const normalizedType = String(type || 'text');
    const allowedExtensions =
      normalizedType === 'photo'
        ? ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        : normalizedType === 'audio'
          ? ['.mp3', '.wav', '.m4a', '.aac', '.ogg']
          : normalizedType === 'video'
            ? ['.mp4', '.mov', '.webm', '.mkv', '.m4v']
            : normalizedType === 'pdf'
              ? ['.pdf']
              : [];

    if (
      allowedExtensions.length &&
      normalizedName &&
      !allowedExtensions.some((extension) => normalizedName.endsWith(extension))
    ) {
      throw new BadRequestException(
        `${normalizedType} uyga vazifasi uchun fayl turi noto'g'ri`,
      );
    }

    const maxBytes = this.getHomeworkFileSizeLimit(normalizedType);
    if (maxBytes && Number(fileSize || 0) > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      throw new BadRequestException(
        `${normalizedType} uyga vazifasi maksimal ${maxMb}MB bo'lishi kerak`,
      );
    }
  }

  /* ---- SANITIZATION LOGIC ---- */

  private sanitizeCourse(
    courseDoc: CourseDocument | Record<string, any>,
    userId: string,
  ): any {
    const sourceCourse =
      typeof (courseDoc as any)?.toObject === 'function'
        ? (courseDoc as any).toObject()
        : { ...(courseDoc as any) };
    const course = sourceCourse;
    const ownerId = course.createdBy.toString();
    const memberItems = (course.members || []).filter(
      (m: any) => m.userId?.toString() !== ownerId,
    );
    const isAdmin = ownerId === userId;
    const isApprovedMember = memberItems.some(
      (m: any) => m.userId.toString() === userId && m.status === 'approved',
    );
    const approvedMembers = memberItems.filter(
      (member: any) => member?.status === 'approved',
    );
    const pendingMembers = memberItems.filter(
      (member: any) => member?.status === 'pending',
    );
    const reviews = Array.isArray(course.reviews) ? course.reviews : [];
    const selfReview = reviews.find(
      (review: any) => review?.userId?.toString?.() === userId,
    );

    if (!isAdmin) {
      course.lessons = (course.lessons || []).filter(
        (lesson: any) => lesson.status !== 'draft',
      );
    }

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

    course.members = memberItems.map((member: any) => ({
      userId: member.userId,
      name: member.name || '',
      avatar: member.avatar || '',
      status: member.status || 'pending',
      joinedAt: member.joinedAt || null,
    }));
    course.membersCount = approvedMembers.length;
    course.pendingMembersCount = pendingMembers.length;
    course.totalMembersCount = memberItems.length;
    course.rating = Number(course.rating || 0);
    course.ratingCount = Number(course.ratingCount || reviews.length || 0);
    course.selfReview = selfReview
      ? {
          reviewId: selfReview._id?.toString?.() || '',
          rating: Number(selfReview.rating || 0),
          text: selfReview.text || '',
          createdAt: selfReview.createdAt || null,
          updatedAt: selfReview.updatedAt || null,
        }
      : null;
    course.reviews = reviews.map((review: any) => ({
      reviewId: review._id?.toString?.() || '',
      userId: review.userId,
      userName: review.userName || '',
      userAvatar: review.userAvatar || '',
      rating: Number(review.rating || 0),
      text: review.text || '',
      createdAt: review.createdAt || null,
      updatedAt: review.updatedAt || null,
    }));
    course.lessonCount = (course.lessons || []).length;
    course.publishedLessonsCount = (course.lessons || []).filter(
      (lesson: any) => (lesson.status || 'published') !== 'draft',
    ).length;
    course.draftLessonsCount = (course.lessons || []).filter(
      (lesson: any) => (lesson.status || 'published') === 'draft',
    ).length;

    course.lessons = course.lessons.map((lesson: any, index: number) => {
      const commentsCount = Array.isArray(lesson.comments)
        ? lesson.comments.length
        : 0;
      const selfNote = (lesson.notes || []).find(
        (item: any) => item?.userId?.toString?.() === userId,
      );

      return {
        _id: lesson._id,
        title: lesson.title,
        type: lesson.type,
        videoUrl: lesson.videoUrl,
        fileUrl: lesson.fileUrl,
        fileName: lesson.fileName,
        fileSize: lesson.fileSize,
        durationSeconds: lesson.durationSeconds || 0,
        mediaItems: this.normalizeLessonMediaItems(lesson).map((item: any) =>
          this.getLessonMediaPayload(item),
        ),
        streamType: lesson.streamType || 'direct',
        streamAssets: lesson.streamAssets || [],
        hlsKeyAsset: '',
        urlSlug: lesson.urlSlug,
        description: lesson.description,
        notionUrl: lesson.notionUrl || '',
        status: lesson.status || 'published',
        publishedAt: lesson.publishedAt || null,
        views: lesson.views,
        likes: lesson.likes?.length || 0,
        liked: Array.isArray(lesson.likes)
          ? lesson.likes.some((id: any) => id.toString() === userId)
          : false,
        addedAt: lesson.addedAt,
        commentsCount,
        accessLockedByTests:
          !isAdmin && isApprovedMember
            ? this.getIncompleteRequiredTestsBeforeLesson(sourceCourse as any, userId, index)
            : [],
        isUnlocked: this.canAccessLesson(sourceCourse as any, userId, index),
        linkedTests: this.normalizeLessonLinkedTests(lesson).map((linkedTest: any) =>
          this.serializeLinkedTest(linkedTest, userId, isAdmin),
        ),
        materials: this.normalizeLessonMaterials(lesson).map((item: any) => ({
          materialId: item?._id?.toString?.() || '',
          title: item?.title || '',
          fileUrl: item?.fileUrl || '',
          fileName: item?.fileName || '',
          fileSize: item?.fileSize || 0,
        })),
        homework: {
          assignments: this.ensureHomeworkAssignments(lesson).map((assignment: any) =>
            this.serializeHomeworkAssignment(assignment, userId, isAdmin, false),
          ),
        },
        selfNote: selfNote
          ? {
              text: selfNote.text || '',
              updatedAt: selfNote.updatedAt || null,
            }
          : null,
        attendanceSummary: {
          present: (lesson.attendance || []).filter(
            (item: any) => item.status === 'present',
          ).length,
          late: (lesson.attendance || []).filter(
            (item: any) => item.status === 'late',
          ).length,
          absent: (lesson.attendance || []).filter(
            (item: any) => item.status === 'absent',
          ).length,
        },
        // Full attendance array only for course owner (admin) — needed for teacher dashboard.
        attendance: isAdmin
          ? (lesson.attendance || []).map((item: any) => ({
              userId: item.userId,
              progressPercent: Math.min(100, Math.max(0, Number(item.progressPercent || 0))),
              status: item.status || null,
              watchCount: Number(item.watchCount || 0),
              lastPositionSeconds: Number(item.lastPositionSeconds || 0),
              maxPositionSeconds: Number(item.maxPositionSeconds || 0),
              lessonDurationSeconds: Number(item.lessonDurationSeconds || 0),
              lastWatchedAt: item.lastWatchedAt || item.markedAt || null,
              firstWatchedAt: item.firstWatchedAt || null,
            }))
          : [],
        oralAssessments: isAdmin
          ? (lesson.oralAssessments || []).map((item: any) => ({
              userId: item.userId,
              score:
                item.score === null || item.score === undefined
                  ? null
                  : Number(item.score),
              note: item.note || "",
              createdAt: item.createdAt || null,
              updatedAt: item.updatedAt || item.createdAt || null,
            }))
          : [],
        selfAttendance: (() => {
          const record = (lesson.attendance || []).find(
            (item: any) => item.userId?.toString() === userId,
          );
          if (!record) return null;
          return {
            progressPercent: Math.min(100, Math.max(0, Number(record.progressPercent || 0))),
            status: record.status || null,
          };
        })(),
      };
    });

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

    const lesson = (course.lessons || [])[lessonIndex] as any;
    if (!lesson || lesson.status === 'draft') return false;

    const isApprovedMember = (course.members || []).some(
      (member: any) =>
        member.userId?.toString() === userId && member.status === 'approved',
    );
    if (!isApprovedMember) {
      return lessonIndex === 0;
    }

    if (lessonIndex === 0) {
      return true;
    }

    return this.getIncompleteRequiredTestsBeforeLesson(course, userId, lessonIndex)
      .length === 0;
  }

  canUserAccessLessonByIdentifier(
    course: CourseDocument,
    userId: string,
    lessonId: string,
  ) {
    const lessonIndex = (course.lessons || []).findIndex(
      (item: any) =>
        item._id?.toString?.() === lessonId || item.urlSlug === lessonId,
    );

    if (lessonIndex < 0) {
      return false;
    }

    return this.canAccessLesson(course, userId, lessonIndex);
  }

  private findLessonByIdentifier(course: CourseDocument, lessonId: string) {
    return (course.lessons || []).find(
      (item: any) =>
        item._id.toString() === lessonId || item.urlSlug === lessonId,
    ) as any;
  }

  private getAttendanceRecord(lesson: any, userId: string) {
    return (lesson.attendance || []).find(
      (item: any) => item.userId?.toString() === userId,
    );
  }

  private sanitizePlaybackSecond(value: any, lessonDurationSeconds = 0) {
    const normalized = Math.max(0, Number(value || 0));
    if (!lessonDurationSeconds) {
      return Number(normalized.toFixed(2));
    }

    return Number(Math.min(normalized, lessonDurationSeconds).toFixed(2));
  }

  private resolveAttendanceStatus(currentStatus: string, progressPercent: number) {
    if (progressPercent >= 70) return 'present';
    if (progressPercent > 0) return 'late';
    return currentStatus || 'absent';
  }

  private normalizeHomeworkAssignments(lesson: any) {
    const rawHomework = lesson?.homework;
    if (Array.isArray(rawHomework)) {
      return rawHomework;
    }

    if (rawHomework && typeof rawHomework === 'object') {
      return [rawHomework];
    }

    return [];
  }

  private ensureHomeworkAssignments(lesson: any) {
    const normalized = this.normalizeHomeworkAssignments(lesson);
    lesson.homework = normalized;
    return normalized;
  }

  private serializeHomeworkSubmission(submission: any) {
    if (!submission) return null;
    return {
      userId: submission.userId,
      userName: submission.userName,
      userAvatar: submission.userAvatar,
      text: submission.text || '',
      link: submission.link || '',
      fileUrl: submission.fileUrl || '',
      fileName: submission.fileName || '',
      fileSize: submission.fileSize || 0,
      streamType: submission.streamType || 'direct',
      streamAssets: submission.streamAssets || [],
      hlsKeyAsset: '',
      status: submission.status || 'submitted',
      score: submission.score ?? null,
      feedback: submission.feedback || '',
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt || null,
    };
  }

  private serializeHomeworkAssignment(
    assignment: any,
    userId: string,
    isOwner: boolean,
    includeOwnerSubmissions = true,
  ) {
    const selfSubmission = this.getHomeworkSubmission(assignment, userId);
    return {
      assignmentId: assignment._id?.toString?.() || assignment.id || '',
      enabled: Boolean(assignment.enabled),
      title: assignment.title || '',
      description: assignment.description || '',
      type: assignment.type || 'text',
      deadline: assignment.deadline || null,
      maxScore: assignment.maxScore || 100,
      submissionCount: (assignment.submissions || []).length,
      selfSubmission: this.serializeHomeworkSubmission(selfSubmission),
      submissions: isOwner && includeOwnerSubmissions
        ? (assignment.submissions || []).map((submission: any) =>
            this.serializeHomeworkSubmission(submission),
          )
        : undefined,
    };
  }

  private findHomeworkAssignment(lesson: any, assignmentId?: string | null) {
    const assignments = this.normalizeHomeworkAssignments(lesson);
    if (!assignmentId) {
      return assignments[0] || null;
    }

    return (
      assignments.find(
        (assignment: any) =>
          assignment?._id?.toString() === assignmentId ||
          String(assignment?.id || '') === assignmentId,
      ) || null
    );
  }

  private getHomeworkSubmission(assignment: any, userId: string) {
    return (assignment?.submissions || []).find(
      (item: any) => item.userId?.toString() === userId,
    );
  }

  private getOralAssessment(lesson: any, userId: string) {
    return (lesson?.oralAssessments || []).find(
      (item: any) => item.userId?.toString() === userId,
    );
  }

  private getPublishedLessons(course: CourseDocument) {
    return (course.lessons || []).filter(
      (lesson: any) => (lesson.status || 'published') !== 'draft',
    ) as any[];
  }

  private normalizeLessonLinkedTests(lesson: any) {
    return Array.isArray(lesson?.linkedTests) ? lesson.linkedTests : [];
  }

  private normalizeLessonMediaItems(lesson: any) {
    if (Array.isArray(lesson?.mediaItems) && lesson.mediaItems.length) {
      return lesson.mediaItems;
    }

    if (lesson?.videoUrl || lesson?.fileUrl) {
      return [
        {
          _id: new Types.ObjectId(),
          title: lesson.title || '',
          videoUrl: lesson.videoUrl || '',
          fileUrl: lesson.fileUrl || '',
          fileName: lesson.fileName || '',
          fileSize: lesson.fileSize || 0,
          durationSeconds: lesson.durationSeconds || 0,
          streamType: lesson.streamType || 'direct',
          streamAssets: lesson.streamAssets || [],
          hlsKeyAsset: lesson.hlsKeyAsset || '',
        },
      ];
    }

    return [];
  }

  private normalizeLessonMaterials(lesson: any) {
    return Array.isArray(lesson?.materials) ? lesson.materials : [];
  }

  private ensureLessonMaterials(lesson: any) {
    const normalized = this.normalizeLessonMaterials(lesson);
    let changed = false;
    const materials = normalized.map((item: any) => {
      if (item?._id?.toString?.()) {
        return item;
      }

      changed = true;
      return {
        ...(item || {}),
        _id: new Types.ObjectId(),
      };
    });

    lesson.materials = materials;
    return {
      materials,
      changed,
    };
  }

  private getLessonMediaPayload(item: any) {
    return {
      mediaId: item?._id?.toString?.() || '',
      title: item?.title || '',
      videoUrl: item?.videoUrl || '',
      fileUrl: item?.fileUrl || '',
      fileName: item?.fileName || '',
      fileSize: item?.fileSize || 0,
      durationSeconds: item?.durationSeconds || 0,
      streamType: item?.streamType || 'direct',
      streamAssets: item?.streamAssets || [],
    };
  }

  private getLinkedTestProgress(linkedTest: any, userId: string) {
    return (linkedTest?.progress || []).find(
      (item: any) => item?.userId?.toString?.() === userId,
    );
  }

  private serializeLinkedTestProgress(progress: any) {
    if (!progress) return null;
    return {
      userId: progress.userId,
      userName: progress.userName,
      userAvatar: progress.userAvatar,
      score: Number(progress.score || 0),
      total: Number(progress.total || 0),
      percent: Number(progress.percent || 0),
      bestPercent: Number(progress.bestPercent || 0),
      passed: Boolean(progress.passed),
      attemptsCount: Number(progress.attemptsCount || 0),
      completedAt: progress.completedAt || null,
    };
  }

  private serializeLinkedTest(linkedTest: any, userId: string, isOwner: boolean) {
    const selfProgress = this.getLinkedTestProgress(linkedTest, userId);
    const resourceType =
      linkedTest?.resourceType === 'sentenceBuilder' ? 'sentenceBuilder' : 'test';
    const resourceId = linkedTest?.resourceId || linkedTest?.testId || '';

    return {
      linkedTestId: linkedTest?._id?.toString?.() || '',
      title: linkedTest?.title || '',
      url: linkedTest?.url || '',
      testId: resourceType === 'test' ? resourceId : '',
      resourceType,
      resourceId,
      shareShortCode: linkedTest?.shareShortCode || '',
      minimumScore: Math.max(0, Math.min(100, Number(linkedTest?.minimumScore || 0))),
      timeLimit: Math.max(0, Number(linkedTest?.timeLimit || 0)),
      showResults: linkedTest?.showResults !== false,
      requiredToUnlock: linkedTest?.requiredToUnlock !== false,
      selfProgress: this.serializeLinkedTestProgress(selfProgress),
      progress: isOwner
        ? (linkedTest?.progress || []).map((item: any) =>
            this.serializeLinkedTestProgress(item),
          )
        : undefined,
      attemptsCount: isOwner ? Number((linkedTest?.progress || []).length) : undefined,
      passedCount: isOwner
        ? (linkedTest?.progress || []).filter((item: any) => item?.passed).length
        : undefined,
    };
  }

  private getIncompleteRequiredTestsBeforeLesson(
    course: CourseDocument,
    userId: string,
    lessonIndex: number,
  ) {
    const blockedBy: { lessonId: string; lessonTitle: string; testTitle: string }[] = [];

    for (let index = 0; index < lessonIndex; index += 1) {
      const previousLesson = (course.lessons || [])[index] as any;
      if (!previousLesson || (previousLesson.status || 'published') === 'draft') {
        continue;
      }

      for (const linkedTest of this.normalizeLessonLinkedTests(previousLesson)) {
        if (Number(linkedTest?.minimumScore || 0) <= 0) {
          continue;
        }

        const selfProgress = this.getLinkedTestProgress(linkedTest, userId);
        if (!selfProgress?.passed) {
          blockedBy.push({
            lessonId: previousLesson._id?.toString?.() || previousLesson.urlSlug || '',
            lessonTitle: previousLesson.title || '',
            testTitle: linkedTest?.title || '',
          });
        }
      }
    }

    return blockedBy;
  }

  private parseLessonTestUrl(rawUrl: string) {
    const value = String(rawUrl || '').trim();
    if (!value) {
      throw new BadRequestException('Test havolasini kiriting');
    }

    let pathname = value;
    try {
      pathname = new URL(value, 'http://localhost').pathname;
    } catch (error) {
      pathname = value;
    }

    const normalizedPath = pathname.replace(/\/+$/, '');
    const shareMatch = normalizedPath.match(/\/arena\/quiz-link\/([^/?#]+)/i);
    if (shareMatch?.[1]) {
      return {
        url: value,
        resourceType: 'test' as const,
        identifier: String(shareMatch[1]).trim().toLowerCase(),
        isShared: true,
      };
    }

    const directMatch = normalizedPath.match(/\/arena\/quiz\/([^/?#]+)/i);
    if (directMatch?.[1]) {
      return {
        url: value,
        resourceType: 'test' as const,
        identifier: String(directMatch[1]).trim(),
        isShared: false,
      };
    }

    const sentenceBuilderMatch = normalizedPath.match(
      /\/arena\/sentence-builder(?:s)?\/([^/?#]+)/i,
    );
    if (sentenceBuilderMatch?.[1]) {
      return {
        url: value,
        resourceType: 'sentenceBuilder' as const,
        identifier: String(sentenceBuilderMatch[1]).trim(),
        isShared: false,
      };
    }

    throw new BadRequestException(
      "Faqat arena test yoki gap tuzish havolasi qo'llab-quvvatlanadi",
    );
  }

  private async resolveLessonLinkedTest(rawUrl: string, requestUserId: string) {
    const parsed = this.parseLessonTestUrl(rawUrl);

    if (parsed.resourceType === 'test' && parsed.isShared) {
      const shared = await this.arenaService.getSharedTestByShortCode(
        parsed.identifier,
        requestUserId,
      );
      return {
        title: shared?.test?.title || '',
        url: parsed.url,
        resourceType: 'test' as const,
        resourceId: String(shared?.test?._id || ''),
        shareShortCode: parsed.identifier,
        timeLimit: Math.max(0, Number(shared?.shareLink?.timeLimit || 0)),
        showResults: shared?.shareLink?.showResults !== false,
      };
    }

    if (parsed.resourceType === 'test') {
      const test = await this.arenaService.getTestById(
        parsed.identifier,
        requestUserId,
      );
      return {
        title: test?.title || '',
        url: parsed.url,
        resourceType: 'test' as const,
        resourceId: String(test?._id || parsed.identifier),
        shareShortCode: '',
        timeLimit: null,
        showResults: null,
      };
    }

    const canBeSentenceBuilderId =
      Types.ObjectId.isValid(parsed.identifier) &&
      String(new Types.ObjectId(parsed.identifier)) === parsed.identifier;

    if (canBeSentenceBuilderId) {
      try {
        const deck = await this.arenaService.getSentenceBuilderDeckById(
          parsed.identifier,
          requestUserId,
        );
        if (deck?.isPublic === false) {
          throw new ForbiddenException(
            'Yopiq gap tuzish to‘plami uchun share havolasidan foydalaning',
          );
        }
        return {
          title: deck?.title || '',
          url: parsed.url,
          resourceType: 'sentenceBuilder' as const,
          resourceId: String(deck?._id || parsed.identifier),
          shareShortCode: '',
          timeLimit: Math.max(0, Number(deck?.timeLimit || 0)),
          showResults: deck?.showResults !== false,
        };
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    const sharedDeck = await this.arenaService.getSentenceBuilderDeckByShortCode(
      parsed.identifier,
      requestUserId,
    );
    return {
      title: sharedDeck?.deck?.title || '',
      url: parsed.url,
      resourceType: 'sentenceBuilder' as const,
      resourceId: String(sharedDeck?.deck?._id || ''),
      shareShortCode: parsed.identifier,
      timeLimit: Math.max(0, Number(sharedDeck?.shareLink?.timeLimit || 0)),
      showResults: sharedDeck?.shareLink?.showResults !== false,
    };
  }

  private normalizeSentenceBuilderLessonAnswers(items: any[]) {
    if (!Array.isArray(items)) return [];

    return items
      .map((item: any) => ({
        questionIndex: Number(item?.questionIndex),
        selectedTokens: Array.isArray(item?.selectedTokens)
          ? item.selectedTokens
              .map((token: any) => String(token || '').trim())
              .filter(Boolean)
          : [],
      }))
      .filter(
        (item) =>
          Number.isInteger(item.questionIndex) && item.questionIndex >= 0,
      );
  }

  private getAttendanceScore(record: any) {
    if (!record) return 0;
    const progress = Math.max(0, Math.min(100, Number(record.progressPercent || 0)));
    if (record.status === 'present') return Math.max(progress, 100);
    if (record.status === 'late') return Math.max(progress, 60);
    return 0;
  }

  private getHomeworkPercent(assignment: any, submission: any) {
    if (!assignment?.enabled) return null;
    const maxScore = Math.max(1, Number(assignment?.maxScore || 100));
    if (submission?.score !== null && submission?.score !== undefined) {
      return Math.max(
        0,
        Math.min(100, Math.round((Number(submission.score) / maxScore) * 100)),
      );
    }
    if (submission?.status === 'submitted') return 50;
    if (submission?.status === 'needs_revision') return 35;
    return 0;
  }

  private getPerformanceLabel(score: number) {
    if (score >= 86) return 'excellent';
    if (score >= 71) return 'good';
    if (score >= 51) return 'average';
    if (score > 0) return 'needs_attention';
    return 'no_activity';
  }

  private buildLessonGradeRow(lesson: any, member: any) {
    const attendance = this.getAttendanceRecord(lesson, member.userId.toString());
    const oralAssessment = this.getOralAssessment(lesson, member.userId.toString());
    const assignments = this.normalizeHomeworkAssignments(lesson).filter(
      (assignment: any) => assignment?.enabled,
    );
    const homeworkPercents = assignments
      .map((assignment: any) =>
        this.getHomeworkPercent(
          assignment,
          this.getHomeworkSubmission(assignment, member.userId.toString()),
        ),
      )
      .filter((value: any) => value !== null) as number[];
    const reviewedCount = assignments.filter((assignment: any) => {
      const submission = this.getHomeworkSubmission(
        assignment,
        member.userId.toString(),
      );
      return submission?.status === 'reviewed';
    }).length;
    const submittedCount = assignments.filter((assignment: any) =>
      Boolean(this.getHomeworkSubmission(assignment, member.userId.toString())),
    ).length;
    const attendanceScore = this.getAttendanceScore(attendance);
    const oralScore =
      oralAssessment?.score === null || oralAssessment?.score === undefined
        ? null
        : Math.max(0, Math.min(100, Number(oralAssessment.score || 0)));
    const homeworkPercent = homeworkPercents.length
      ? Math.round(
          homeworkPercents.reduce((sum: number, value: number) => sum + value, 0) /
            homeworkPercents.length,
        )
      : null;
    let lessonScore = attendanceScore;
    if (homeworkPercent !== null && oralScore !== null) {
      lessonScore = Math.round(
        attendanceScore * 0.25 + homeworkPercent * 0.45 + oralScore * 0.3,
      );
    } else if (homeworkPercent !== null) {
      lessonScore = Math.round(attendanceScore * 0.4 + homeworkPercent * 0.6);
    } else if (oralScore !== null) {
      lessonScore = Math.round(attendanceScore * 0.35 + oralScore * 0.65);
    }

    return {
      userId: member.userId,
      userName: member.name,
      userAvatar: member.avatar,
      attendanceStatus: attendance?.status || 'absent',
      attendanceProgress: attendance?.progressPercent || 0,
      attendanceScore,
      homeworkEnabled: assignments.length > 0,
      homeworkStatus:
        reviewedCount === assignments.length && assignments.length > 0
          ? 'reviewed'
          : submittedCount > 0
            ? 'submitted'
            : 'missing',
      homeworkSubmitted: submittedCount > 0,
      homeworkAssignments: assignments.length,
      homeworkSubmittedCount: submittedCount,
      homeworkReviewedCount: reviewedCount,
      homeworkScore: null,
      homeworkPercent,
      oralScore,
      oralNote: oralAssessment?.note || '',
      oralUpdatedAt: oralAssessment?.updatedAt || null,
      feedback: '',
      lessonScore,
      performance: this.getPerformanceLabel(lessonScore),
    };
  }

  private buildCourseOverview(course: CourseDocument, members: any[]) {
    const lessons = this.getPublishedLessons(course);
    const totalLessons = lessons.length;

    const students = members.map((member: any) => {
      const lessonRows = lessons.map((lesson: any) =>
        this.buildLessonGradeRow(lesson, member),
      );
      const oralScores = lessonRows
        .map((row: any) => row.oralScore)
        .filter((value: any) => value !== null && value !== undefined) as number[];
      const averageScore = lessonRows.length
        ? Math.round(
            lessonRows.reduce((sum: number, row: any) => sum + row.lessonScore, 0) /
              lessonRows.length,
          )
        : 0;
      const oralAverage = oralScores.length
        ? Math.round(
            oralScores.reduce((sum: number, score: number) => sum + score, 0) /
              oralScores.length,
          )
        : null;
      const presentCount = lessonRows.filter(
        (row: any) => row.attendanceStatus === 'present',
      ).length;
      const lateCount = lessonRows.filter(
        (row: any) => row.attendanceStatus === 'late',
      ).length;
      const homeworkCompleted = lessonRows.filter(
        (row: any) => row.homeworkSubmitted,
      ).length;
      const reviewedHomework = lessonRows.filter(
        (row: any) => row.homeworkStatus === 'reviewed',
      ).length;

      return {
        userId: member.userId,
        userName: member.name,
        userAvatar: member.avatar,
        averageScore,
        oralAverage,
        performance: this.getPerformanceLabel(averageScore),
        attendanceRate:
          totalLessons > 0
            ? Math.round(((presentCount + lateCount * 0.5) / totalLessons) * 100)
            : 0,
        presentCount,
        lateCount,
        absentCount: Math.max(totalLessons - presentCount - lateCount, 0),
        homeworkCompleted,
        reviewedHomework,
        totalLessons,
      };
    });

    const averageScore = students.length
      ? Math.round(
          students.reduce((sum: number, student: any) => sum + student.averageScore, 0) /
            students.length,
        )
      : 0;

    return {
      totalStudents: students.length,
      totalLessons,
      averageScore,
      activeStudents: students.filter((student: any) => student.averageScore > 0).length,
      attentionCount: students.filter(
        (student: any) =>
          student.performance === 'needs_attention' ||
          student.performance === 'no_activity',
      ).length,
      students,
    };
  }

  private async cleanupHomeworkSubmissionAssets(submission: any) {
    for (const asset of submission?.streamAssets || []) {
      await this.r2Service
        .deleteFile(asset)
        .catch((error) =>
          console.error(`Failed to delete homework stream asset ${asset}:`, error),
        );
    }

    if (submission?.hlsKeyAsset) {
      await this.r2Service
        .deleteFile(submission.hlsKeyAsset)
        .catch((error) =>
          console.error(
            `Failed to delete homework HLS key ${submission.hlsKeyAsset}:`,
            error,
          ),
        );
    }

    if (submission?.fileUrl) {
      await this.r2Service
        .deleteFile(submission.fileUrl)
        .catch((error) =>
          console.error(
            `Failed to delete homework file ${submission.fileUrl}:`,
            error,
          ),
        );
    }
  }

  private async cleanupLessonMediaItemAssets(item: any) {
    for (const asset of item?.streamAssets || []) {
      await this.r2Service.deleteFile(asset).catch((error) =>
        console.error(`Failed to delete lesson stream asset ${asset}:`, error),
      );
    }

    if (item?.hlsKeyAsset) {
      await this.r2Service.deleteFile(item.hlsKeyAsset).catch((error) =>
        console.error(`Failed to delete lesson hls key ${item.hlsKeyAsset}:`, error),
      );
    }

    if (item?.fileUrl) {
      await this.r2Service.deleteFile(item.fileUrl).catch((error) =>
        console.error(`Failed to delete lesson file ${item.fileUrl}:`, error),
      );
    }

    if (item?.videoUrl && item?.videoUrl !== item?.fileUrl) {
      await this.r2Service.deleteFile(item.videoUrl).catch((error) =>
        console.error(`Failed to delete lesson video ${item.videoUrl}:`, error),
      );
    }
  }

  private async cleanupLessonMaterialAssets(item: any) {
    if (!item?.fileUrl) return;
    await this.r2Service.deleteFile(item.fileUrl).catch((error) =>
      console.error(`Failed to delete lesson material ${item.fileUrl}:`, error),
    );
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
        .lean()
        .exec(),
      this.courseModel.countDocuments(),
    ]);

    const hydratedCourses = await Promise.all(
      courses.map((course) => this.hydrateCourseCollections(course)),
    );

    return {
      data: hydratedCourses.map((c) => this.sanitizeCourse(c, userId)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async searchCoursesForUser(
    query: string,
    userId: string,
    limit = 20,
  ): Promise<any[]> {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
      return [];
    }

    const regex = new RegExp(normalizedQuery, 'i');
    const cappedLimit = Math.max(1, Math.min(50, Number(limit) || 20));

    const matchingOwnerIds = await this.userModel
      .find({
        $or: [{ username: regex }, { nickname: regex }],
      })
      .select('_id')
      .limit(50)
      .lean()
      .exec();

    const ownerIds = matchingOwnerIds.map((user) => user._id);

    const courses = await this.courseModel
      .find({
        $or: [
          { name: regex },
          { description: regex },
          ...(ownerIds.length > 0 ? [{ createdBy: { $in: ownerIds } }] : []),
        ],
      })
      .sort({ createdAt: -1 })
      .limit(cappedLimit)
      .lean()
      .exec();

    const hydratedCourses = await Promise.all(
      courses.map((course) => this.hydrateCourseCollections(course)),
    );

    return hydratedCourses.map((course) => this.sanitizeCourse(course, userId));
  }

  async getCourseForUser(id: string, userId: string): Promise<any> {
    const isObjectId =
      Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id;
    const query = isObjectId
      ? { $or: [{ _id: id }, { urlSlug: id }] }
      : { urlSlug: id };
    const course = await this.courseModel.findOne(query).lean().exec();
    if (!course) throw new NotFoundException('Kurs topilmadi');
    const hydratedCourse = await this.hydrateCourseCollections(course);
    return this.sanitizeCourse(hydratedCourse, userId);
  }

  /* ---- COURSES CRUD (Internal) ---- */

  async findAll(): Promise<CourseDocument[]> {
    const courses = await this.courseModel.find().sort({ createdAt: -1 }).lean().exec();
    return Promise.all(courses.map((course) => this.hydrateCourseCollections(course))) as any;
  }

  async findById(id: string): Promise<CourseDocument> {
    const isObjectId =
      Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id;
    const query = isObjectId
      ? { $or: [{ _id: id }, { urlSlug: id }] }
      : { urlSlug: id };
    const course = await this.courseModel.findOne(query).lean().exec();
    if (!course) throw new NotFoundException('Kurs topilmadi');
    return (await this.hydrateCourseCollections(course)) as any;
  }

  async create(
    userId: string,
    dto: {
      name: string;
      description?: string;
      image?: string;
      category?: string;
      lessonLanguage?: string;
      previewLearn?: string[];
      previewRequirements?: string[];
      deliveryType?: 'ongoing' | 'recorded';
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
    assertMaxChars('Dars tili', dto.lessonLanguage, 40);
    for (const item of dto.previewLearn || []) {
      assertMaxChars("Kursda o'rganiladigan bo'lim", item, 160);
    }
    for (const item of dto.previewRequirements || []) {
      assertMaxChars('Kurs talabi', item, 160);
    }

    const limit = getTierLimit(APP_LIMITS.coursesCreated, user.premiumStatus);

    const existingCoursesCount = await this.courseModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    if (existingCoursesCount >= limit) {
      throw new ForbiddenException(
        `Siz maksimal ${limit} ta kurs yarata olasiz`,
      );
    }

    const finalSlug = await this.generateUniqueCourseSlug(dto.urlSlug);
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

    const createdCourse = await this.courseModel.create({
      ...dto,
      lessonLanguage: String(dto.lessonLanguage || '').trim(),
      previewLearn: (dto.previewLearn || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 8),
      previewRequirements: (dto.previewRequirements || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 8),
      deliveryType: dto.deliveryType === 'ongoing' ? 'ongoing' : 'recorded',
      urlSlug: finalSlug,
      gradient,
      createdBy: new Types.ObjectId(userId),
    });
    await this.persistCourseCollections({
      ...createdCourse.toObject(),
      members: [],
      lessons: [],
    });
    return this.findById(createdCourse._id.toString()) as any;
  }

  async update(
    courseId: string,
    userId: string,
    dto: {
      name?: string;
      description?: string;
      image?: string;
      category?: string;
      lessonLanguage?: string;
      previewLearn?: string[];
      previewRequirements?: string[];
      deliveryType?: 'ongoing' | 'recorded';
      price?: number;
      accessType?: string;
    },
  ): Promise<CourseDocument> {
    const course = this.attachCourseRuntimeHelpers(await this.findById(courseId));
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Siz bu kursni tahrirlay olmaysiz");
    }

    const nextName =
      dto.name !== undefined ? String(dto.name || '').trim() : String(course.name || '').trim();
    const nextDescription =
      dto.description !== undefined
        ? String(dto.description || '').trim()
        : String(course.description || '').trim();
    const nextImage =
      dto.image !== undefined ? String(dto.image || '').trim() : String(course.image || '').trim();
    const nextCategory =
      dto.category !== undefined
        ? String(dto.category || '').trim()
        : String(course.category || 'IT').trim();
    const nextLessonLanguage =
      dto.lessonLanguage !== undefined
        ? String(dto.lessonLanguage || '').trim()
        : String(course.lessonLanguage || '').trim();
    const nextPreviewLearn =
      dto.previewLearn !== undefined ? dto.previewLearn : course.previewLearn || [];
    const nextPreviewRequirements =
      dto.previewRequirements !== undefined
        ? dto.previewRequirements
        : course.previewRequirements || [];
    const nextDeliveryType =
      dto.deliveryType !== undefined ? dto.deliveryType : course.deliveryType;
    const nextAccessType =
      dto.accessType !== undefined ? dto.accessType : course.accessType || 'free_request';
    const nextPrice =
      dto.price !== undefined ? Number(dto.price || 0) : Number(course.price || 0);

    assertMaxChars('Kurs nomi', nextName, APP_TEXT_LIMITS.courseNameChars);
    assertMaxChars(
      'Kurs tavsifi',
      nextDescription,
      APP_TEXT_LIMITS.courseDescriptionChars,
    );
    assertMaxChars('Kurs kategoriyasi', nextCategory, APP_TEXT_LIMITS.courseCategoryChars);
    assertMaxChars('Dars tili', nextLessonLanguage, 40);
    for (const item of nextPreviewLearn || []) {
      assertMaxChars("Kursda o'rganiladigan bo'lim", item, 160);
    }
    for (const item of nextPreviewRequirements || []) {
      assertMaxChars('Kurs talabi', item, 160);
    }

    course.name = nextName;
    course.description = nextDescription;
    course.image = nextImage;
    course.category = nextCategory || 'IT';
    course.lessonLanguage = nextLessonLanguage;
    course.previewLearn = (nextPreviewLearn || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 8);
    course.previewRequirements = (nextPreviewRequirements || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 8);
    course.deliveryType = nextDeliveryType === 'ongoing' ? 'ongoing' : 'recorded';
    course.accessType =
      nextAccessType === 'paid' || nextAccessType === 'free_open'
        ? nextAccessType
        : 'free_request';
    course.price = course.accessType === 'paid' ? Math.max(0, nextPrice) : 0;

    await this.persistCourseCollections(course);
    return this.findById(courseId) as any;
  }

  async delete(courseId: string, userId: string): Promise<void> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Siz bu kursni o'chira olmaysiz");
    }

    // Delete course image from R2
    if (course.image) {
      await this.r2Service
        .deleteFile(course.image)
        .catch((error) =>
          console.error(`Failed to delete course image ${course.image}:`, error),
        );
    }

    // Delete associated files in R2
    for (const lesson of course.lessons as any[]) {
      for (const item of this.normalizeLessonMediaItems(lesson)) {
        await this.cleanupLessonMediaItemAssets(item);
      }
      for (const material of this.normalizeLessonMaterials(lesson)) {
        await this.cleanupLessonMaterialAssets(material);
      }
      for (const assignment of this.normalizeHomeworkAssignments(lesson)) {
        for (const submission of assignment?.submissions || []) {
          await this.cleanupHomeworkSubmissionAssets(submission);
        }
      }
    }

    await Promise.all([
      this.courseModel.findByIdAndDelete(course._id).exec(),
      this.courseMemberRecordModel.deleteMany({ courseId: course._id }),
      this.courseLessonRecordModel.deleteMany({ courseId: course._id }),
      this.lessonHomeworkRecordModel.deleteMany({ courseId: course._id }),
    ]);
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
      durationSeconds?: number;
      streamType?: string;
      streamAssets?: string[];
      hlsKeyAsset?: string;
      mediaItems?: {
        title?: string;
        videoUrl?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        durationSeconds?: number;
        streamType?: string;
        streamAssets?: string[];
        hlsKeyAsset?: string;
      }[];
      urlSlug?: string;
      status?: string;
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

    const normalizedMediaItems = Array.isArray(dto.mediaItems)
      ? dto.mediaItems
          .map((item) => ({
            _id: new Types.ObjectId(),
            title: String(item?.title || dto.title || '').trim(),
            videoUrl: String(item?.videoUrl || '').trim(),
            fileUrl: String(item?.fileUrl || '').trim(),
            fileName: String(item?.fileName || '').trim(),
            fileSize: Math.max(0, Number(item?.fileSize || 0)),
            durationSeconds: Math.max(0, Number(item?.durationSeconds || 0)),
            streamType: item?.streamType === 'hls' ? 'hls' : 'direct',
            streamAssets: Array.isArray(item?.streamAssets) ? item.streamAssets : [],
            hlsKeyAsset: String(item?.hlsKeyAsset || '').trim(),
          }))
          .filter((item) => item.videoUrl || item.fileUrl)
      : [];

    const totalMediaBytes = normalizedMediaItems.reduce(
      (sum, item) => sum + Number(item.fileSize || 0),
      0,
    );
    const lessonVideosLimit = getTierLimit(
      APP_LIMITS.lessonVideosPerLesson,
      user?.premiumStatus,
    );
    if (normalizedMediaItems.length > lessonVideosLimit) {
      throw new ForbiddenException(
        `Bu tarifda bitta darsga maksimal ${lessonVideosLimit} ta video yuklash mumkin`,
      );
    }
    if (totalMediaBytes > APP_LIMITS.lessonMediaBytes) {
      throw new ForbiddenException('Bitta darsga yuklanadigan videolar jami 200MB dan oshmasligi kerak');
    }

    const primaryMedia = normalizedMediaItems[0] || null;

    const finalSlug = this.generateUniqueLessonSlug(course, dto.urlSlug);

    course.lessons.push({
      title: dto.title,
      type: normalizedMediaItems.length ? 'file' : dto.type || 'video',
      videoUrl: primaryMedia?.videoUrl || dto.videoUrl || '',
      fileUrl: primaryMedia?.fileUrl || dto.fileUrl || '',
      fileName: primaryMedia?.fileName || dto.fileName || '',
      fileSize: primaryMedia?.fileSize || dto.fileSize || 0,
      durationSeconds:
        primaryMedia?.durationSeconds || Math.max(0, Number(dto.durationSeconds || 0)),
      mediaItems: normalizedMediaItems,
      streamType: primaryMedia?.streamType || dto.streamType || 'direct',
      streamAssets: primaryMedia?.streamAssets || dto.streamAssets || [],
      hlsKeyAsset: primaryMedia?.hlsKeyAsset || dto.hlsKeyAsset || '',
      urlSlug: finalSlug,
      description: dto.description || '',
      status: dto.status === 'published' ? 'published' : 'draft',
      publishedAt: dto.status === 'published' ? new Date() : null,
      views: 0,
      addedAt: new Date(),
      comments: [],
    } as any);
    const savedCourse = await course.save();
    await this.syncCourseMirrorCollections(savedCourse.toObject());
    return savedCourse;
  }

  async updateLesson(
    courseId: string,
    lessonId: string,
    userId: string,
    dto: {
      title?: string;
      videoUrl?: string;
      description?: string;
      type?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      durationSeconds?: number;
      streamType?: string;
      streamAssets?: string[];
      hlsKeyAsset?: string;
      notionUrl?: string;
      mediaItems?: {
        mediaId?: string;
        title?: string;
        videoUrl?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        durationSeconds?: number;
        streamType?: string;
        streamAssets?: string[];
        hlsKeyAsset?: string;
      }[];
    },
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat kurs egasi darsni tahrirlay oladi");
    }
    const user = await this.userModel.findById(userId);

    const lesson = course.lessons.find(
      (item: any) =>
        item._id.toString() === lessonId || item.urlSlug === lessonId,
    ) as any;

    if (!lesson) {
      throw new NotFoundException('Dars topilmadi');
    }

    const previousLessonState = {
      type: lesson.type || 'video',
      videoUrl: lesson.videoUrl || '',
      fileUrl: lesson.fileUrl || '',
      mediaItems: this.normalizeLessonMediaItems(lesson).map((item: any) => ({
        mediaId: item?._id?.toString?.() || '',
        videoUrl: item.videoUrl || '',
        fileUrl: item.fileUrl || '',
        durationSeconds: Number(item.durationSeconds || 0),
        streamAssets: Array.isArray(item.streamAssets) ? [...item.streamAssets] : [],
        hlsKeyAsset: item.hlsKeyAsset || '',
      })),
      streamAssets: Array.isArray(lesson.streamAssets)
        ? [...lesson.streamAssets]
        : [],
      hlsKeyAsset: lesson.hlsKeyAsset || '',
    };

    if (dto.title !== undefined) {
      assertMaxChars('Dars sarlavhasi', dto.title, APP_TEXT_LIMITS.lessonTitleChars);
      lesson.title = dto.title || lesson.title;
    }

    if (dto.description !== undefined) {
      assertMaxChars(
        'Dars tavsifi',
        dto.description,
        APP_TEXT_LIMITS.lessonDescriptionChars,
      );
      lesson.description = dto.description || '';
    }

    if (dto.notionUrl !== undefined) {
      lesson.notionUrl = String(dto.notionUrl || '').trim();
    }

    if (dto.mediaItems !== undefined) {
      const existingMediaById = new Map(
        this.normalizeLessonMediaItems(lesson).map((item: any) => [
          item?._id?.toString?.() || '',
          item,
        ]),
      );
      const normalizedMediaItems = Array.isArray(dto.mediaItems)
        ? dto.mediaItems
            .map((item) => {
              const mediaId = String(item?.mediaId || '').trim();
              const existingItem = mediaId ? (existingMediaById.get(mediaId) as any) : null;
              return {
                _id:
                  mediaId && Types.ObjectId.isValid(mediaId)
                    ? new Types.ObjectId(mediaId)
                    : new Types.ObjectId(),
                title: String(item?.title || dto.title || lesson.title || '').trim(),
                videoUrl: String(item?.videoUrl || '').trim(),
                fileUrl: String(item?.fileUrl || '').trim(),
                fileName: String(item?.fileName || '').trim(),
                fileSize: Math.max(0, Number(item?.fileSize || 0)),
                durationSeconds: Math.max(0, Number(item?.durationSeconds || 0)),
                streamType: item?.streamType === 'hls' ? 'hls' : 'direct',
                streamAssets: Array.isArray(item?.streamAssets) ? item.streamAssets : [],
                hlsKeyAsset:
                  String(item?.hlsKeyAsset || '').trim() ||
                  String(existingItem?.hlsKeyAsset || '').trim(),
              };
            })
            .filter((item) => item.videoUrl || item.fileUrl)
        : [];

      const totalMediaBytes = normalizedMediaItems.reduce(
        (sum, item) => sum + Number(item.fileSize || 0),
        0,
      );
      const lessonVideosLimit = getTierLimit(
        APP_LIMITS.lessonVideosPerLesson,
        user?.premiumStatus,
      );
      if (normalizedMediaItems.length > lessonVideosLimit) {
        throw new ForbiddenException(
          `Bu tarifda bitta darsga maksimal ${lessonVideosLimit} ta video yuklash mumkin`,
        );
      }
      if (totalMediaBytes > APP_LIMITS.lessonMediaBytes) {
        throw new ForbiddenException('Bitta darsga yuklanadigan videolar jami 200MB dan oshmasligi kerak');
      }

      lesson.mediaItems = normalizedMediaItems;
      const primaryMedia = normalizedMediaItems[0] || null;
      lesson.type = normalizedMediaItems.length ? 'file' : lesson.type;
      lesson.videoUrl = primaryMedia?.videoUrl || '';
      lesson.fileUrl = primaryMedia?.fileUrl || '';
      lesson.fileName = primaryMedia?.fileName || '';
      lesson.fileSize = primaryMedia?.fileSize || 0;
      lesson.durationSeconds = primaryMedia?.durationSeconds || 0;
      lesson.streamType = primaryMedia?.streamType || 'direct';
      lesson.streamAssets = primaryMedia?.streamAssets || [];
      lesson.hlsKeyAsset = primaryMedia?.hlsKeyAsset || '';
    }

    if (dto.type !== undefined) lesson.type = dto.type || lesson.type;
    if (dto.videoUrl !== undefined) lesson.videoUrl = dto.videoUrl || '';
    if (dto.fileUrl !== undefined) lesson.fileUrl = dto.fileUrl || '';
    if (dto.fileName !== undefined) lesson.fileName = dto.fileName || '';
    if (dto.fileSize !== undefined) lesson.fileSize = dto.fileSize || 0;
    if (dto.durationSeconds !== undefined) {
      lesson.durationSeconds = Math.max(0, Number(dto.durationSeconds || 0));
    }
    if (dto.streamType !== undefined) lesson.streamType = dto.streamType || 'direct';
    if (dto.streamAssets !== undefined) lesson.streamAssets = dto.streamAssets || [];
    if (dto.hlsKeyAsset !== undefined) lesson.hlsKeyAsset = dto.hlsKeyAsset || '';

    const streamAssetsChanged =
      dto.streamAssets !== undefined &&
      JSON.stringify(previousLessonState.streamAssets) !==
        JSON.stringify(lesson.streamAssets || []);
    const keyAssetChanged =
      dto.hlsKeyAsset !== undefined &&
      previousLessonState.hlsKeyAsset !== (lesson.hlsKeyAsset || '');
    const fileUrlChanged =
      dto.fileUrl !== undefined &&
      previousLessonState.fileUrl !== (lesson.fileUrl || '');
    const videoUrlChanged =
      dto.videoUrl !== undefined &&
      previousLessonState.videoUrl !== (lesson.videoUrl || '');
    const typeChanged =
      dto.type !== undefined && previousLessonState.type !== lesson.type;

    if (streamAssetsChanged) {
      for (const asset of previousLessonState.streamAssets) {
        if (!(lesson.streamAssets || []).includes(asset)) {
          await this.r2Service
            .deleteFile(asset)
            .catch((error) =>
              console.error(`Failed to delete replaced stream asset ${asset}:`, error),
            );
        }
      }
    }

    if (keyAssetChanged && previousLessonState.hlsKeyAsset) {
      await this.r2Service
        .deleteFile(previousLessonState.hlsKeyAsset)
        .catch((error) =>
          console.error(
            `Failed to delete replaced HLS key ${previousLessonState.hlsKeyAsset}:`,
            error,
          ),
        );
    }

    if (fileUrlChanged && previousLessonState.fileUrl) {
      await this.r2Service
        .deleteFile(previousLessonState.fileUrl)
        .catch((error) =>
          console.error(
            `Failed to delete replaced lesson file ${previousLessonState.fileUrl}:`,
            error,
          ),
        );
    }

    if (
      (videoUrlChanged || typeChanged) &&
      previousLessonState.type === 'file' &&
      previousLessonState.videoUrl &&
      previousLessonState.videoUrl !== lesson.videoUrl
    ) {
      await this.r2Service
        .deleteFile(previousLessonState.videoUrl)
        .catch((error) =>
          console.error(
            `Failed to delete replaced lesson media ${previousLessonState.videoUrl}:`,
            error,
          ),
        );
    }

    if (dto.mediaItems !== undefined) {
      for (const oldItem of previousLessonState.mediaItems || []) {
        const stillExists = (lesson.mediaItems || []).some(
          (item: any) =>
            item?.videoUrl === oldItem.videoUrl &&
            item?.fileUrl === oldItem.fileUrl &&
            JSON.stringify(item?.streamAssets || []) ===
              JSON.stringify(oldItem.streamAssets || []),
        );
        if (!stillExists) {
          await this.cleanupLessonMediaItemAssets(oldItem);
        }
      }
    }

    if (!lesson.videoUrl && !lesson.fileUrl) {
      lesson.status = 'draft';
      lesson.publishedAt = null;
    }

    const savedCourse = await course.save();
    await this.syncCourseMirrorCollections(savedCourse.toObject());
    return savedCourse;
  }

  async publishLesson(
    courseId: string,
    lessonId: string,
    userId: string,
  ): Promise<CourseDocument> {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat kurs egasi darsni e'lon qila oladi");
    }

    const lesson = course.lessons.find(
      (item: any) =>
        item._id.toString() === lessonId || item.urlSlug === lessonId,
    ) as any;

    if (!lesson) {
      throw new NotFoundException('Dars topilmadi');
    }

    const hasMedia = this.normalizeLessonMediaItems(lesson).length > 0;
    const hasNotionUrl = typeof lesson.notionUrl === 'string' && lesson.notionUrl.trim().length > 0;
    if (!hasMedia && !hasNotionUrl) {
      throw new ForbiddenException(
        "Darsni e'lon qilish uchun avval video yoki Notion havola qo'shing",
      );
    }

    lesson.status = 'published';
    lesson.publishedAt = new Date();
    const savedCourse = await course.save();
    await this.syncCourseMirrorCollections(savedCourse.toObject());
    return savedCourse;
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

    const lessonObj = this.findLessonByIdentifier(course, lessonId);
    if (lessonObj) {
      for (const item of this.normalizeLessonMediaItems(lessonObj)) {
        await this.cleanupLessonMediaItemAssets(item);
      }
      for (const material of this.normalizeLessonMaterials(lessonObj)) {
        await this.cleanupLessonMaterialAssets(material);
      }
      for (const assignment of this.normalizeHomeworkAssignments(lessonObj)) {
        for (const submission of assignment?.submissions || []) {
          await this.cleanupHomeworkSubmissionAssets(submission);
        }
      }
    }

    const targetId = lessonObj?._id?.toString() || lessonId;
    course.lessons = course.lessons.filter(
      (l: any) => l._id.toString() !== targetId,
    ) as any;
    const savedCourse = await course.save();
    await this.syncCourseMirrorCollections(savedCourse.toObject());
    return savedCourse;
  }

  async incrementViews(courseId: string, lessonId: string): Promise<void> {
    const course = await this.findById(courseId);
    const lesson = course.lessons.find(
      (l: any) => l._id.toString() === lessonId || l.urlSlug === lessonId,
    );
    if (!lesson) return;

    await this.courseLessonRecordModel
      .updateOne(
        { courseId: course._id, lessonId: lesson._id },
        { $inc: { views: 1 } },
      )
      .exec();
    lesson.views = Number(lesson.views || 0) + 1;
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
    await this.syncCourseMirrorCollections(course.toObject());

    return {
      liked: !alreadyLiked,
      likes: lesson.likes.length,
    };
  }

  async upsertLessonNote(
    courseId: string,
    lessonId: string,
    user: any,
    dto: { text?: string },
  ) {
    const userId = user?._id?.toString?.() || user?.id?.toString?.() || '';
    if (!userId) throw new ForbiddenException('Foydalanuvchi topilmadi');

    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );
    if (lessonIndex === -1) throw new NotFoundException('Dars topilmadi');
    if (!this.canAccessLesson(course, userId, lessonIndex)) {
      throw new ForbiddenException("Bu darsga eslatma yozish huquqi yo'q");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const text = String(dto?.text || '').slice(0, APP_TEXT_LIMITS.homeworkAnswerChars);
    const notes = Array.isArray(lesson.notes) ? lesson.notes : [];
    const userObjectId = new Types.ObjectId(userId);
    const existingIndex = notes.findIndex(
      (item: any) => item?.userId?.toString?.() === userId,
    );
    const limit = getTierLimit(
      APP_LIMITS.lessonTimedNotesPerLesson,
      user?.premiumStatus,
    );
    const existingText =
      existingIndex >= 0 ? String(notes[existingIndex]?.text || '') : '';
    const existingTimedNotesCount = this.countTimedLessonNotes(existingText);
    const nextTimedNotesCount = this.countTimedLessonNotes(text);
    const existingUntimedLinesCount =
      this.countUntimedLessonNoteLines(existingText);
    const nextUntimedLinesCount = this.countUntimedLessonNoteLines(text);

    if (
      nextTimedNotesCount > limit &&
      nextTimedNotesCount > existingTimedNotesCount
    ) {
      throw new BadRequestException(
        `Bu tarifda bir dars uchun maksimal ${limit} ta eslatma qo'sha olasiz`,
      );
    }

    if (nextUntimedLinesCount > existingUntimedLinesCount) {
      throw new BadRequestException(
        "Eslatma faqat vaqt bilan qo'shilishi kerak",
      );
    }

    const updatedAt = new Date();

    if (existingIndex >= 0) {
      notes[existingIndex] = {
        ...notes[existingIndex],
        text,
        updatedAt,
      };
    } else {
      notes.push({
        userId: userObjectId,
        text,
        updatedAt,
      });
    }

    lesson.notes = notes;
    await this.courseLessonRecordModel
      .updateOne(
        { courseId: course._id, lessonId: lesson._id },
        { $set: { notes } },
      )
      .exec();

    return { text, updatedAt };
  }

  async upsertCourseReview(
    courseId: string,
    user: any,
    dto: { rating?: number; text?: string },
  ) {
    const userId = user?._id?.toString?.() || user?.id?.toString?.() || '';
    if (!userId) throw new ForbiddenException('Foydalanuvchi topilmadi');

    const course = await this.findById(courseId);
    const ownerId = course.createdBy?.toString?.() || '';
    if (ownerId === userId) {
      throw new ForbiddenException("O'z kursingizga rating qoldirib bo'lmaydi");
    }

    const isApprovedMember = (course.members || []).some(
      (member: any) =>
        member.userId?.toString?.() === userId && member.status === 'approved',
    );
    if (!isApprovedMember) {
      throw new ForbiddenException("Rating qoldirish uchun kursga a'zo bo'ling");
    }

    const rating = Math.max(1, Math.min(5, Math.round(Number(dto?.rating || 0))));
    const text = String(dto?.text || '').trim().slice(0, 800);
    const reviews = Array.isArray((course as any).reviews)
      ? [...(course as any).reviews]
      : [];
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const existingIndex = reviews.findIndex(
      (review: any) => review?.userId?.toString?.() === userId,
    );
    const userName =
      user?.nickname || user?.username || user?.name || user?.email || 'User';
    const userAvatar = user?.avatar || '';

    if (existingIndex >= 0) {
      reviews[existingIndex] = {
        ...reviews[existingIndex],
        rating,
        text,
        userName,
        userAvatar,
        updatedAt: now,
      };
    } else {
      reviews.push({
        userId: userObjectId,
        userName,
        userAvatar,
        rating,
        text,
        createdAt: now,
        updatedAt: now,
      });
    }

    const ratingCount = reviews.length;
    const average =
      ratingCount > 0
        ? Number(
            (
              reviews.reduce(
                (sum: number, review: any) => sum + Number(review?.rating || 0),
                0,
              ) / ratingCount
            ).toFixed(1),
          )
        : 0;

    await this.courseModel
      .updateOne(
        { _id: course._id },
        {
          $set: {
            reviews,
            rating: average,
            ratingCount,
          },
        },
      )
      .exec();

    return this.getCourseForUser(courseId, userId);
  }

  async getLikedLessons(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const lessonRows = await this.courseLessonRecordModel
      .find({ likes: userObjectId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
    const courseIds = Array.from(
      new Set(lessonRows.map((item: any) => item.courseId?.toString?.()).filter(Boolean)),
    );
    const courses = await this.courseModel
      .find({ _id: { $in: courseIds.map((id) => new Types.ObjectId(id)) } })
      .lean()
      .exec();
    const courseMap = new Map(
      courses.map((course: any) => [course._id.toString(), course]),
    );

    return lessonRows
      .map((lesson: any) => {
        const course = courseMap.get(lesson.courseId?.toString?.() || '');
        if (!course) return null;
        return {
          _id: lesson.lessonId,
          title: lesson.title,
          description: lesson.description,
          likes: Array.isArray(lesson.likes) ? lesson.likes.length : 0,
          views: Number(lesson.views || 0),
          urlSlug: lesson.urlSlug,
          addedAt: lesson.addedAt,
          course: {
            _id: course._id,
            name: course.name,
            image: course.image,
            urlSlug: course.urlSlug,
          },
        };
      })
      .filter(Boolean);
  }

  async getLessonAttendance(
    courseId: string,
    lessonId: string,
    userId: string,
  ) {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );

    if (lessonIndex === -1) {
      throw new NotFoundException('Dars topilmadi');
    }

    if (!this.canAccessLesson(course, userId, lessonIndex)) {
      throw new ForbiddenException("Bu dars davomatini ko'rish huquqi yo'q");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const isOwner = course.createdBy.toString() === userId;
    const selfRecord = this.getAttendanceRecord(lesson, userId);

    if (!isOwner) {
      return {
        lessonId: lesson._id.toString(),
        self: selfRecord
          ? {
              userId: selfRecord.userId,
              userName: selfRecord.userName,
              userAvatar: selfRecord.userAvatar,
              status: selfRecord.status,
              progressPercent: selfRecord.progressPercent || 0,
              watchCount: selfRecord.watchCount || 0,
              lastPositionSeconds: selfRecord.lastPositionSeconds || 0,
              maxPositionSeconds: selfRecord.maxPositionSeconds || 0,
              lessonDurationSeconds:
                selfRecord.lessonDurationSeconds ||
                lesson.durationSeconds ||
                0,
              source: selfRecord.source || 'auto',
              markedAt: selfRecord.markedAt,
              firstWatchedAt: selfRecord.firstWatchedAt || null,
              lastWatchedAt: selfRecord.lastWatchedAt || null,
            }
          : null,
      };
    }

    const approvedMembers = (course.members || []).filter(
      (member: any) => member.status === 'approved',
    );
    const recordMap = new Map(
      (lesson.attendance || []).map((record: any) => [
        record.userId.toString(),
        record,
      ]),
    );

    const members = approvedMembers.map((member: any) => {
      const record = recordMap.get(member.userId.toString()) as any;
      return {
        userId: member.userId,
        userName: member.name,
        userAvatar: member.avatar,
        status: record?.status || 'absent',
        progressPercent: record?.progressPercent || 0,
        watchCount: record?.watchCount || 0,
        lastPositionSeconds: record?.lastPositionSeconds || 0,
        maxPositionSeconds: record?.maxPositionSeconds || 0,
        lessonDurationSeconds:
          record?.lessonDurationSeconds || lesson.durationSeconds || 0,
        source: record?.source || 'manual',
        markedAt: record?.markedAt || null,
        firstWatchedAt: record?.firstWatchedAt || null,
        lastWatchedAt: record?.lastWatchedAt || null,
      };
    });

    return {
      lessonId: lesson._id.toString(),
      summary: {
        present: members.filter((member: any) => member.status === 'present')
          .length,
        late: members.filter((member: any) => member.status === 'late').length,
        absent: members.filter((member: any) => member.status === 'absent')
          .length,
      },
      members,
    };
  }

  async markOwnAttendance(
    courseId: string,
    lessonId: string,
    user: any,
    dto: {
      progressPercent?: number;
      lastPositionSeconds?: number;
      lessonDurationSeconds?: number;
      watchIncrement?: number;
    },
  ) {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );

    if (lessonIndex === -1) throw new NotFoundException('Dars topilmadi');
    if (!this.canAccessLesson(course, user._id.toString(), lessonIndex)) {
      throw new ForbiddenException("Bu darsga davomat belgilab bo'lmaydi");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const progressDelta = Math.max(0, Number(dto.progressPercent || 0));
    const lessonDurationSeconds = Math.max(
      Number(lesson?.durationSeconds || 0),
      Number(dto.lessonDurationSeconds || 0),
    );
    const hasPositionUpdate = dto.lastPositionSeconds !== undefined;
    const nextLastPositionSeconds = hasPositionUpdate
      ? this.sanitizePlaybackSecond(dto.lastPositionSeconds, lessonDurationSeconds)
      : null;
    const watchIncrement = Math.max(
      0,
      Math.min(1, Number(dto.watchIncrement || 0)),
    );
    const existingRecord = this.getAttendanceRecord(lesson, user._id.toString());
    const now = new Date();

    if (existingRecord) {
      const nextProgressPercent = Math.min(
        100,
        Math.max(Number(existingRecord.progressPercent || 0), progressDelta),
      );

      existingRecord.status = this.resolveAttendanceStatus(
        existingRecord.status,
        nextProgressPercent,
      );
      existingRecord.progressPercent = Number(nextProgressPercent.toFixed(2));
      existingRecord.watchCount = Math.max(
        0,
        Number(existingRecord.watchCount || 0) + watchIncrement,
      );
      existingRecord.lessonDurationSeconds = Math.max(
        Number(existingRecord.lessonDurationSeconds || 0),
        lessonDurationSeconds,
      );
      if (hasPositionUpdate && nextLastPositionSeconds !== null) {
        existingRecord.lastPositionSeconds = nextLastPositionSeconds;
        existingRecord.maxPositionSeconds = Math.max(
          Number(existingRecord.maxPositionSeconds || 0),
          nextLastPositionSeconds,
        );
      }
      if (
        !existingRecord.firstWatchedAt &&
        (watchIncrement > 0 ||
          progressDelta > 0 ||
          Number(nextLastPositionSeconds || 0) > 0)
      ) {
        existingRecord.firstWatchedAt = now;
      }
      if (
        watchIncrement > 0 ||
        progressDelta > 0 ||
        Number(nextLastPositionSeconds || 0) > 0
      ) {
        existingRecord.lastWatchedAt = now;
      }
      existingRecord.source = 'auto';
      existingRecord.markedAt = now;
    } else {
      const nextProgressPercent = Math.min(100, progressDelta);
      const inferredWatchCount =
        watchIncrement > 0 ||
        nextProgressPercent > 0 ||
        Number(nextLastPositionSeconds || 0) > 0
          ? Math.max(1, watchIncrement)
          : 0;
      lesson.attendance.push({
        userId: new Types.ObjectId(user._id),
        userName: user.nickname || user.username,
        userAvatar:
          user.avatar ||
          (user.nickname || user.username || '').substring(0, 2).toUpperCase(),
        status: this.resolveAttendanceStatus('absent', nextProgressPercent),
        progressPercent: Number(nextProgressPercent.toFixed(2)),
        watchCount: inferredWatchCount,
        lastPositionSeconds: Number(nextLastPositionSeconds || 0),
        maxPositionSeconds: Number(nextLastPositionSeconds || 0),
        lessonDurationSeconds,
        source: 'auto',
        markedAt: now,
        firstWatchedAt:
          inferredWatchCount > 0 || nextProgressPercent > 0 ? now : null,
        lastWatchedAt:
          inferredWatchCount > 0 ||
          nextProgressPercent > 0 ||
          Number(nextLastPositionSeconds || 0) > 0
            ? now
            : null,
      } as any);
    }

    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    this.coursesGateway.notifyCourse(courseId, 'lesson_attendance_updated', {
      courseId,
      lessonId: lesson._id.toString(),
      userId: user._id.toString(),
    });
    const record = this.getAttendanceRecord(lesson, user._id.toString());
    return {
      status:
        record?.status ||
        this.resolveAttendanceStatus('absent', Math.min(100, progressDelta)),
      progressPercent: record?.progressPercent || progressDelta,
      watchCount: record?.watchCount || 0,
      lastPositionSeconds: record?.lastPositionSeconds || 0,
      maxPositionSeconds: record?.maxPositionSeconds || 0,
      lessonDurationSeconds: record?.lessonDurationSeconds || lessonDurationSeconds,
      firstWatchedAt: record?.firstWatchedAt || null,
      lastWatchedAt: record?.lastWatchedAt || null,
    };
  }

  async setAttendanceStatus(
    courseId: string,
    lessonId: string,
    targetUserId: string,
    adminId: string,
    status: string,
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== adminId) {
      throw new ForbiddenException(
        "Faqat kurs egasi davomatni o'zgartira oladi",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const member = (course.members || []).find(
      (item: any) =>
        item.userId.toString() === targetUserId && item.status === 'approved',
    );
    if (!member) {
      throw new NotFoundException("Kurs a'zosi topilmadi");
    }

    const normalizedStatus = ['present', 'late', 'absent'].includes(status)
      ? status
      : 'absent';
    const existingRecord = this.getAttendanceRecord(lesson, targetUserId);

    if (existingRecord) {
      existingRecord.status = normalizedStatus;
      existingRecord.source = 'manual';
      existingRecord.markedAt = new Date();
    } else {
      lesson.attendance.push({
        userId: member.userId,
        userName: member.name,
        userAvatar: member.avatar,
        status: normalizedStatus,
        progressPercent: 0,
        watchCount: 0,
        lastPositionSeconds: 0,
        maxPositionSeconds: 0,
        lessonDurationSeconds: Number(lesson?.durationSeconds || 0),
        source: 'manual',
        markedAt: new Date(),
        firstWatchedAt: null,
        lastWatchedAt: null,
      } as any);
    }

    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    this.coursesGateway.notifyCourse(courseId, 'lesson_attendance_updated', {
      courseId,
      lessonId: lesson._id.toString(),
      userId: targetUserId,
    });
    return this.getLessonAttendance(courseId, lessonId, adminId);
  }

  async getLessonHomework(
    courseId: string,
    lessonId: string,
    userId: string,
  ) {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );

    if (lessonIndex === -1) {
      throw new NotFoundException('Dars topilmadi');
    }

    if (!this.canAccessLesson(course, userId, lessonIndex)) {
      throw new ForbiddenException("Bu dars uyga vazifasini ko'rish huquqi yo'q");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const homeworkAssignments = this.ensureHomeworkAssignments(lesson);
    const isOwner = course.createdBy.toString() === userId;

    if (!homeworkAssignments.length) {
      return {
        assignments: [],
      };
    }

    return {
      assignments: homeworkAssignments.map((assignment: any) =>
        this.serializeHomeworkAssignment(assignment, userId, isOwner),
      ),
    };
  }

  async upsertLessonHomework(
    courseId: string,
    lessonId: string,
    userId: string,
    dto: {
      assignmentId?: string;
      enabled?: boolean;
      title?: string;
      description?: string;
      type?: string;
      deadline?: string | null;
      maxScore?: number;
    },
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat kurs egasi uyga vazifani boshqarishi mumkin",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const assignments = this.ensureHomeworkAssignments(lesson);
    const existingAssignment = this.findHomeworkAssignment(lesson, dto.assignmentId);
    if (!existingAssignment) {
      const premiumStatus = await this.getUserPremiumStatus(userId);
      const assignmentLimit = getTierLimit(
        APP_LIMITS.lessonHomeworkPerLesson,
        premiumStatus,
      );
      if (assignments.length >= assignmentLimit) {
        throw new ForbiddenException(
          `Bu tarifda bitta dars uchun maksimal ${assignmentLimit} ta uyga vazifa qo'shish mumkin`,
        );
      }
    }

    const homework =
      existingAssignment ||
      ({
        enabled: true,
        title: '',
        description: '',
        type: 'text',
        deadline: null,
        maxScore: 100,
        submissions: [],
      } as any);

    if (dto.title !== undefined) {
      assertMaxChars(
        'Uyga vazifa sarlavhasi',
        dto.title,
        APP_TEXT_LIMITS.lessonTitleChars,
      );
      homework.title = dto.title || '';
    }

    if (dto.description !== undefined) {
      assertMaxChars(
        'Uyga vazifa tavsifi',
        dto.description,
        APP_TEXT_LIMITS.lessonDescriptionChars,
      );
      homework.description = dto.description || '';
    }

    if (dto.type !== undefined) {
      homework.type = ['text', 'audio', 'video', 'pdf', 'photo'].includes(dto.type)
        ? dto.type
        : 'text';
    }

    if (dto.enabled !== undefined) {
      homework.enabled = Boolean(dto.enabled);
    }

    if (dto.deadline !== undefined) {
      homework.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }

    if (dto.maxScore !== undefined) {
      homework.maxScore = Math.max(1, Math.min(100, Number(dto.maxScore || 100)));
    }

    if (!homework.enabled) {
      homework.enabled = false;
      if (!assignments.some((item: any) => item === homework)) {
        assignments.push(homework);
      }
      lesson.homework = assignments;
      await course.save();
      await this.syncCourseMirrorCollections(course.toObject());
      return this.getLessonHomework(courseId, lessonId, userId);
    }

    const nextHomework = {
      ...homework,
      enabled: true,
      type: homework.type || 'text',
      submissions: Array.isArray(homework.submissions) ? homework.submissions : [],
    };
    const persistedAssignmentId = nextHomework?._id?.toString?.();
    const existingIndex = persistedAssignmentId
      ? assignments.findIndex(
          (item: any) => item?._id?.toString?.() === persistedAssignmentId,
        )
      : -1;
    if (existingIndex === -1) {
      assignments.push(nextHomework);
    } else {
      assignments[existingIndex] = nextHomework;
    }
    lesson.homework = assignments;
    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonHomework(courseId, lessonId, userId);
  }

  async deleteLessonHomework(
    courseId: string,
    lessonId: string,
    assignmentId: string,
    userId: string,
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat kurs egasi uyga vazifani boshqarishi mumkin",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const assignments = this.ensureHomeworkAssignments(lesson);
    const assignment = this.findHomeworkAssignment(lesson, assignmentId);
    if (!assignment) {
      throw new NotFoundException('Uyga vazifa topilmadi');
    }

    for (const submission of assignment.submissions || []) {
      await this.cleanupHomeworkSubmissionAssets(submission);
    }

    lesson.homework = assignments.filter(
      (item: any) => item?._id?.toString?.() !== assignmentId,
    );
    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonHomework(courseId, lessonId, userId);
  }

  async getLessonMaterials(
    courseId: string,
    lessonId: string,
    userId: string,
  ) {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );

    if (lessonIndex === -1) {
      throw new NotFoundException('Dars topilmadi');
    }

    if (!this.canAccessLesson(course, userId, lessonIndex)) {
      throw new ForbiddenException("Bu dars materiallarini ko'rish huquqi yo'q");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const { materials, changed } = this.ensureLessonMaterials(lesson);
    if (changed) {
      await course.save();
      await this.syncCourseMirrorCollections(course.toObject());
    }

    return {
      items: materials.map((item: any) => ({
        materialId: item?._id?.toString?.() || '',
        title: item?.title || '',
        fileUrl: item?.fileUrl || '',
        fileName: item?.fileName || '',
        fileSize: Number(item?.fileSize || 0),
      })),
    };
  }

  async getCourseMaterialLibrary(courseId: string, userId: string) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat kurs egasi materiallar kutubxonasini ko'ra oladi",
      );
    }

    const seen = new Set<string>();
    const items: Array<{
      materialId: string;
      title: string;
      fileUrl: string;
      fileName: string;
      fileSize: number;
      lessonId: string;
      lessonTitle: string;
    }> = [];
    let courseChanged = false;

    for (const lesson of Array.isArray(course.lessons) ? course.lessons : []) {
      const lessonTitle = String(lesson?.title || '');
      const { materials: normalizedMaterials, changed } =
        this.ensureLessonMaterials(lesson);
      if (changed) {
        courseChanged = true;
      }

      for (const item of normalizedMaterials) {
        const fileUrl = String(item?.fileUrl || '').trim();
        const fileName = String(item?.fileName || '').trim();
        if (!fileUrl || !fileName.toLowerCase().endsWith('.pdf')) continue;
        if (seen.has(fileUrl)) continue;
        seen.add(fileUrl);
        items.push({
          materialId: item?._id?.toString?.() || '',
          title: String(item?.title || fileName.replace(/\.pdf$/i, '')),
          fileUrl,
          fileName,
          fileSize: Math.max(0, Number(item?.fileSize || 0)),
          lessonId:
            lesson?._id?.toString?.() || String(lesson?.urlSlug || ''),
          lessonTitle,
        });
      }
    }

    if (courseChanged) {
      await course.save();
      await this.syncCourseMirrorCollections(course.toObject());
    }

    return { items };
  }

  async upsertLessonMaterial(
    courseId: string,
    lessonId: string,
    userId: string,
    dto: {
      materialId?: string;
      title?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
    },
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat kurs egasi dars materiallarini boshqarishi mumkin",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const { materials } = this.ensureLessonMaterials(lesson);
    const existingMaterial = dto.materialId
      ? materials.find(
          (item: any) => item?._id?.toString?.() === dto.materialId,
        ) || null
      : null;
    if (!existingMaterial && materials.length >= 3) {
      throw new ForbiddenException(
        "Bitta darsga maksimal 3 ta PDF material yuklash mumkin",
      );
    }
    const material =
      existingMaterial ||
      ({
        title: '',
        fileUrl: '',
        fileName: '',
        fileSize: 0,
      } as any);

    if (dto.title !== undefined) {
      assertMaxChars(
        'Dars materiali sarlavhasi',
        dto.title,
        APP_TEXT_LIMITS.lessonTitleChars,
      );
      material.title = dto.title || '';
    }

    if (dto.fileUrl !== undefined) {
      material.fileUrl = String(dto.fileUrl || '').trim();
    }

    if (dto.fileName !== undefined) {
      material.fileName = String(dto.fileName || '').trim();
    }

    if (dto.fileSize !== undefined) {
      material.fileSize = Math.max(0, Number(dto.fileSize || 0));
    }

    if (!material.fileUrl) {
      throw new BadRequestException("Material uchun PDF fayl biriktirish kerak");
    }

    if (
      material.fileName &&
      !String(material.fileName).toLowerCase().endsWith('.pdf')
    ) {
      throw new BadRequestException("Dars materiali faqat PDF bo'lishi mumkin");
    }

    const persistedMaterialId = material?._id?.toString?.();
    const existingIndex = persistedMaterialId
      ? materials.findIndex(
          (item: any) => item?._id?.toString?.() === persistedMaterialId,
        )
      : -1;

    if (existingIndex === -1) {
      materials.push(material);
    } else {
      materials[existingIndex] = material;
    }

    lesson.materials = materials;
    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonMaterials(courseId, lessonId, userId);
  }

  async deleteLessonMaterial(
    courseId: string,
    lessonId: string,
    materialId: string,
    userId: string,
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat kurs egasi dars materiallarini boshqarishi mumkin",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const { materials } = this.ensureLessonMaterials(lesson);
    const material = materials.find(
      (item: any) => item?._id?.toString?.() === materialId,
    );
    if (!material) {
      throw new NotFoundException('Material topilmadi');
    }

    await this.cleanupLessonMaterialAssets(material);
    lesson.materials = materials.filter(
      (item: any) => item?._id?.toString?.() !== materialId,
    );
    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonMaterials(courseId, lessonId, userId);
  }

  async getLessonLinkedTests(
    courseId: string,
    lessonId: string,
    userId: string,
  ) {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );

    if (lessonIndex === -1) {
      throw new NotFoundException('Dars topilmadi');
    }

    if (!this.canAccessLesson(course, userId, lessonIndex)) {
      throw new ForbiddenException("Bu dars testlarini ko'rish huquqi yo'q");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const isOwner = course.createdBy.toString() === userId;
    return {
      items: this.normalizeLessonLinkedTests(lesson).map((item: any) =>
        this.serializeLinkedTest(item, userId, isOwner),
      ),
    };
  }

  async upsertLessonLinkedTest(
    courseId: string,
    lessonId: string,
    userId: string,
    dto: {
      linkedTestId?: string;
      url?: string;
      minimumScore?: number;
      timeLimit?: number;
      showResults?: boolean;
      requiredToUnlock?: boolean;
    },
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat kurs egasi lesson testini boshqarishi mumkin",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const linkedTests = this.normalizeLessonLinkedTests(lesson);
    const existing =
      linkedTests.find(
        (item: any) =>
          item?._id?.toString?.() === dto.linkedTestId ||
          String(item?.id || '') === dto.linkedTestId,
      ) || null;

    if (!existing) {
      const linkedTestLimit = 3;
      if (linkedTests.length >= linkedTestLimit) {
        throw new ForbiddenException(
          `Bu tarifda bitta dars uchun maksimal ${linkedTestLimit} ta test biriktirish mumkin`,
        );
      }
    }

    const resolved = await this.resolveLessonLinkedTest(
      dto.url || existing?.url || '',
      userId,
    );

    const nextLinkedTest = existing || ({
      _id: new Types.ObjectId(),
      progress: [],
    } as any);

    nextLinkedTest.title = resolved.title;
    nextLinkedTest.url = resolved.url;
    nextLinkedTest.resourceType = resolved.resourceType;
    nextLinkedTest.resourceId = resolved.resourceId;
    nextLinkedTest.testId =
      resolved.resourceType === 'test' ? resolved.resourceId : '';
    nextLinkedTest.shareShortCode = resolved.shareShortCode;
    nextLinkedTest.minimumScore = Math.max(
      0,
      Math.min(100, Number(dto.minimumScore ?? existing?.minimumScore ?? 0)),
    );
    nextLinkedTest.timeLimit = resolved.shareShortCode
      ? Math.max(0, Number(resolved.timeLimit || 0))
      : Math.max(0, Number(existing?.timeLimit ?? 0));
    nextLinkedTest.showResults = resolved.shareShortCode
      ? resolved.showResults !== false
      : existing?.showResults !== false;
    nextLinkedTest.requiredToUnlock =
      true;
    const existingResourceType =
      existing?.resourceType === 'sentenceBuilder' ? 'sentenceBuilder' : 'test';
    const existingResourceId = existing?.resourceId || existing?.testId || '';
    const isSameTest =
      existingResourceType === resolved.resourceType &&
      existingResourceId === resolved.resourceId;
    nextLinkedTest.progress =
      isSameTest && Array.isArray(existing?.progress) ? existing.progress : [];
    nextLinkedTest.progress = nextLinkedTest.progress.map((item: any) => ({
      ...item,
      passed:
        Math.max(
          Number(item?.bestPercent || 0),
          Number(item?.percent || 0),
        ) >= Number(nextLinkedTest.minimumScore || 0),
    }));

    if (!existing) {
      linkedTests.push(nextLinkedTest);
    }

    lesson.linkedTests = linkedTests;
    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonLinkedTests(courseId, lessonId, userId);
  }

  async deleteLessonLinkedTest(
    courseId: string,
    lessonId: string,
    linkedTestId: string,
    userId: string,
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat kurs egasi lesson testini o'chira oladi",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    lesson.linkedTests = this.normalizeLessonLinkedTests(lesson).filter(
      (item: any) =>
        item?._id?.toString?.() !== linkedTestId &&
        String(item?.id || '') !== linkedTestId,
    );

    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonLinkedTests(courseId, lessonId, userId);
  }

  async submitLessonLinkedTestAttempt(
    courseId: string,
    lessonId: string,
    linkedTestId: string,
    user: any,
    dto: {
      answers?: number[];
      sentenceBuilderAnswers?: { questionIndex: number; selectedTokens: string[] }[];
    },
  ) {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );

    if (lessonIndex === -1) {
      throw new NotFoundException('Dars topilmadi');
    }

    if (!this.canAccessLesson(course, user._id.toString(), lessonIndex)) {
      throw new ForbiddenException("Bu lesson testini ishlash huquqi yo'q");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const linkedTest = this.normalizeLessonLinkedTests(lesson).find(
      (item: any) =>
        item?._id?.toString?.() === linkedTestId ||
        String(item?.id || '') === linkedTestId,
    );
    if (!linkedTest) {
      throw new NotFoundException('Lesson testi topilmadi');
    }

    const resourceType =
      linkedTest?.resourceType === 'sentenceBuilder' ? 'sentenceBuilder' : 'test';
    const resourceId = linkedTest?.resourceId || linkedTest?.testId || '';

    let score = 0;
    let total = 0;
    let percent = 0;
    let rawResults: any[] = [];

    if (resourceType === 'sentenceBuilder') {
      const result = await this.arenaService.submitSentenceBuilderAttempt(
        resourceId,
        {
          answers: this.normalizeSentenceBuilderLessonAnswers(
            dto?.sentenceBuilderAnswers || [],
          ),
          requestUserId: user._id.toString(),
          requestUserName: user.nickname || user.username,
          shareShortCode: linkedTest?.shareShortCode || null,
        },
      );

      score = Number(result?.score || 0);
      total = Number(result?.total || 0);
      percent = Number(result?.accuracy || 0);
      rawResults = Array.isArray(result?.items) ? result.items : [];
    } else {
      const answers = Array.isArray(dto?.answers)
        ? dto.answers.map((value) => Number(value))
        : [];

      const result = await this.arenaService.submitAnswers(
        resourceId,
        user._id.toString(),
        answers,
        undefined,
        { includeHiddenResults: true },
      );

      score = Number(result?.score || 0);
      total = Number(result?.total || 0);
      percent = total ? Math.round((score / Math.max(total, 1)) * 100) : 0;
      rawResults = Array.isArray(result?.results) ? result.results : [];
    }

    const passed = percent >= Number(linkedTest.minimumScore || 0);

    const progressList = Array.isArray(linkedTest.progress) ? linkedTest.progress : [];
    const existingProgress =
      progressList.find(
        (item: any) => item?.userId?.toString?.() === user._id.toString(),
      ) || null;

    if (existingProgress) {
      existingProgress.userName = user.nickname || user.username;
      existingProgress.userAvatar =
        user.avatar ||
        (user.nickname || user.username || '').substring(0, 2).toUpperCase();
      existingProgress.score = score;
      existingProgress.total = total;
      existingProgress.percent = percent;
      existingProgress.bestPercent = Math.max(
        Number(existingProgress.bestPercent || 0),
        percent,
      );
      existingProgress.passed = Boolean(existingProgress.passed || passed);
      existingProgress.attemptsCount = Number(existingProgress.attemptsCount || 0) + 1;
      existingProgress.completedAt = new Date();
    } else {
      progressList.push({
        userId: new Types.ObjectId(user._id),
        userName: user.nickname || user.username,
        userAvatar:
        user.avatar ||
        (user.nickname || user.username || '').substring(0, 2).toUpperCase(),
        score,
        total,
        percent,
        bestPercent: percent,
        passed,
        attemptsCount: 1,
        completedAt: new Date(),
      } as any);
    }

    linkedTest.progress = progressList;
    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());

    return {
      score,
      total,
      percent,
      passed,
      resourceType,
      minimumScore: Number(linkedTest.minimumScore || 0),
      showResults: linkedTest.showResults !== false,
      results: linkedTest.showResults !== false ? rawResults : [],
      linkedTest: this.serializeLinkedTest(
        linkedTest,
        user._id.toString(),
        course.createdBy.toString() === user._id.toString(),
      ),
      nextLessonUnlocked:
        this.getIncompleteRequiredTestsBeforeLesson(
          course,
          user._id.toString(),
          lessonIndex + 1,
        ).length === 0,
    };
  }

  async submitLessonHomework(
    courseId: string,
    lessonId: string,
    assignmentId: string,
    user: any,
    dto: {
      text?: string;
      link?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      streamType?: string;
      streamAssets?: string[];
      hlsKeyAsset?: string;
    },
  ) {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );

    if (lessonIndex === -1) throw new NotFoundException('Dars topilmadi');
    if (!this.canAccessLesson(course, user._id.toString(), lessonIndex)) {
      throw new ForbiddenException("Bu darsga uyga vazifa topshirib bo'lmaydi");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const assignment = this.findHomeworkAssignment(lesson, assignmentId);
    if (!assignment || !assignment.enabled) {
      throw new ForbiddenException('Bu dars uchun uyga vazifa yoqilmagan');
    }

    assertMaxChars(
      'Uyga vazifa matni',
      dto.text,
      APP_TEXT_LIMITS.homeworkAnswerChars,
    );
    assertMaxChars(
      'Uyga vazifa havolasi',
      dto.link,
      APP_TEXT_LIMITS.homeworkLinkChars,
    );

    const text = String(dto.text || '').trim();
    const link = String(dto.link || '').trim();
    const rawFileUrl = String(dto.fileUrl || '').trim();
    const fileName = String(dto.fileName || '').trim();
    const fileSize = Number(dto.fileSize || 0);
    const streamType = dto.streamType === 'hls' ? 'hls' : 'direct';
    const streamAssets = Array.isArray(dto.streamAssets) ? dto.streamAssets : [];
    const hlsKeyAsset = String(dto.hlsKeyAsset || '').trim();
    const homeworkType = assignment?.type || 'text';
    const derivedHlsFileUrl =
      streamType === 'hls'
        ? streamAssets.find((asset) => String(asset).endsWith('.m3u8')) || ''
        : '';
    const fileUrl = rawFileUrl || derivedHlsFileUrl;

    const hasTypedPayload =
      homeworkType === 'text'
        ? Boolean(text || link)
        : Boolean(fileUrl || link || (streamType === 'hls' && streamAssets.length));

    if (!hasTypedPayload) {
      throw new ForbiddenException(
        homeworkType === 'text'
          ? "Uyga vazifa uchun matn yoki havola kiritish kerak"
          : "Uyga vazifa uchun fayl yoki havola kiritish kerak",
      );
    }

    if (homeworkType !== 'text' && fileUrl) {
      try {
        this.assertHomeworkSubmissionFileIsAllowed(
          homeworkType,
          fileName,
          fileSize,
        );
      } catch (error) {
        await this.cleanupHomeworkSubmissionAssets({
          fileUrl,
          fileName,
          fileSize,
          streamType,
          streamAssets,
          hlsKeyAsset,
        });
        throw error;
      }
    }

    const existingSubmission = this.getHomeworkSubmission(
      assignment,
      user._id.toString(),
    );

    if (existingSubmission && existingSubmission.status !== 'needs_revision') {
      throw new ForbiddenException('Uyga vazifa allaqachon topshirilgan');
    }

    if (existingSubmission) {
      const shouldCleanupPreviousAssets =
        (existingSubmission.fileUrl || existingSubmission.streamAssets?.length) &&
        (existingSubmission.fileUrl !== fileUrl ||
          JSON.stringify(existingSubmission.streamAssets || []) !==
            JSON.stringify(streamAssets) ||
          existingSubmission.hlsKeyAsset !== hlsKeyAsset);

      if (shouldCleanupPreviousAssets) {
        await this.cleanupHomeworkSubmissionAssets(existingSubmission);
      }

      existingSubmission.text = text;
      existingSubmission.link = link;
      existingSubmission.fileUrl = fileUrl;
      existingSubmission.fileName = fileName;
      existingSubmission.fileSize = fileSize;
      existingSubmission.streamType = streamType;
      existingSubmission.streamAssets = streamAssets;
      existingSubmission.hlsKeyAsset = hlsKeyAsset;
      existingSubmission.status = 'submitted';
      existingSubmission.submittedAt = new Date();
      existingSubmission.reviewedAt = null;
      existingSubmission.feedback = '';
      existingSubmission.score = null;
    } else {
      assignment.submissions.push({
        userId: new Types.ObjectId(user._id),
        userName: user.nickname || user.username,
        userAvatar:
          user.avatar ||
          (user.nickname || user.username || '').substring(0, 2).toUpperCase(),
        text,
        link,
        fileUrl,
        fileName,
        fileSize,
        streamType,
        streamAssets,
        hlsKeyAsset,
        status: 'submitted',
        score: null,
        feedback: '',
        submittedAt: new Date(),
        reviewedAt: null,
      } as any);
    }

    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonHomework(courseId, lessonId, user._id.toString());
  }

  async reviewLessonHomework(
    courseId: string,
    lessonId: string,
    assignmentId: string,
    submissionUserId: string,
    adminId: string,
    dto: { status?: string; score?: number | null; feedback?: string },
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== adminId) {
      throw new ForbiddenException(
        "Faqat kurs egasi uyga vazifani tekshirishi mumkin",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const assignment = this.findHomeworkAssignment(lesson, assignmentId);
    if (!assignment || !assignment.enabled) {
      throw new ForbiddenException('Bu dars uchun uyga vazifa yoqilmagan');
    }

    const submission = this.getHomeworkSubmission(assignment, submissionUserId);
    if (!submission) {
      throw new NotFoundException('Topshiriq topilmadi');
    }

    if (dto.feedback !== undefined) {
      assertMaxChars(
        'Uyga vazifa feedback',
        dto.feedback,
        APP_TEXT_LIMITS.lessonDescriptionChars,
      );
      submission.feedback = dto.feedback || '';
    }

    if (dto.status !== undefined) {
      submission.status = ['submitted', 'reviewed', 'needs_revision'].includes(
        dto.status,
      )
        ? dto.status
        : 'reviewed';
    }

    if (dto.score !== undefined) {
      submission.score =
        dto.score === null
          ? null
          : Math.max(
              0,
              Math.min(
                Number(assignment.maxScore || 100),
                Number(dto.score || 0),
              ),
            );
    }

    submission.reviewedAt = new Date();
    if (!dto.status) {
      submission.status = 'reviewed';
    }

    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonHomework(courseId, lessonId, adminId);
  }

  async setLessonOralAssessment(
    courseId: string,
    lessonId: string,
    targetUserId: string,
    adminId: string,
    dto: { score?: number | null; note?: string },
  ) {
    const course = await this.findById(courseId);
    if (course.createdBy.toString() !== adminId) {
      throw new ForbiddenException(
        "Faqat kurs egasi og'zaki baholashni kiritishi mumkin",
      );
    }

    const lesson = this.findLessonByIdentifier(course, lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const member = (course.members || []).find(
      (item: any) =>
        item.userId.toString() === targetUserId && item.status === 'approved',
    );
    if (!member) {
      throw new NotFoundException("Kurs a'zosi topilmadi");
    }

    if (dto.note !== undefined) {
      assertMaxChars(
        "Og'zaki baholash izohi",
        dto.note,
        APP_TEXT_LIMITS.lessonDescriptionChars,
      );
    }

    lesson.oralAssessments = Array.isArray(lesson.oralAssessments)
      ? lesson.oralAssessments
      : [];

    let assessment = this.getOralAssessment(lesson, targetUserId);
    if (!assessment) {
      assessment = {
        userId: member.userId,
        userName: member.name,
        userAvatar: member.avatar,
        score: null,
        note: '',
        updatedAt: null,
      } as any;
      lesson.oralAssessments.push(assessment);
    }

    if (dto.score !== undefined) {
      assessment.score =
        dto.score === null
          ? null
          : Math.max(0, Math.min(100, Number(dto.score || 0)));
    }

    if (dto.note !== undefined) {
      assessment.note = dto.note || '';
    }

    assessment.updatedAt = new Date();

    await course.save();
    await this.syncCourseMirrorCollections(course.toObject());
    return this.getLessonGrading(courseId, lessonId, adminId);
  }

  async getLessonGrading(
    courseId: string,
    lessonId: string,
    userId: string,
  ) {
    const course = await this.findById(courseId);
    const lessonIndex = course.lessons.findIndex(
      (lesson: any) =>
        lesson._id.toString() === lessonId || lesson.urlSlug === lessonId,
    );

    if (lessonIndex === -1) {
      throw new NotFoundException('Dars topilmadi');
    }

    if (!this.canAccessLesson(course, userId, lessonIndex)) {
      throw new ForbiddenException("Bu dars baholashini ko'rish huquqi yo'q");
    }

    const lesson = course.lessons[lessonIndex] as any;
    const isOwner = course.createdBy.toString() === userId;
    const approvedMembers = (course.members || []).filter(
      (member: any) => member.status === 'approved',
    );
    const lessonRows = approvedMembers.map((member: any) =>
      this.buildLessonGradeRow(lesson, member),
    );
    const lessonSummary = {
      averageScore: lessonRows.length
        ? Math.round(
            lessonRows.reduce((sum: number, row: any) => sum + row.lessonScore, 0) /
              lessonRows.length,
          )
        : 0,
      excellentCount: lessonRows.filter((row: any) => row.performance === 'excellent')
        .length,
      completedHomeworkCount: lessonRows.filter((row: any) => row.homeworkSubmitted)
        .length,
      attendanceMarkedCount: lessonRows.filter(
        (row: any) => row.attendanceStatus !== 'absent' || row.attendanceProgress > 0,
      ).length,
    };

    const overview = this.buildCourseOverview(course, approvedMembers);

    if (!isOwner) {
      const selfLesson = lessonRows.find(
        (row: any) => row.userId?.toString() === userId,
      ) || {
        userId,
        attendanceStatus: 'absent',
        attendanceProgress: 0,
        attendanceScore: 0,
        homeworkEnabled:
          this.normalizeHomeworkAssignments(lesson).filter(
            (assignment: any) => assignment?.enabled,
          ).length > 0,
        homeworkStatus: 'missing',
        homeworkSubmitted: false,
        homeworkScore: null,
        homeworkPercent:
          this.normalizeHomeworkAssignments(lesson).filter(
            (assignment: any) => assignment?.enabled,
          ).length > 0
            ? 0
            : null,
        feedback: '',
        lessonScore: 0,
        performance: 'no_activity',
      };
      const selfOverall = overview.students.find(
        (student: any) => student.userId?.toString() === userId,
      ) || {
        userId,
        averageScore: 0,
        performance: 'no_activity',
        attendanceRate: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: overview.totalLessons,
        homeworkCompleted: 0,
        reviewedHomework: 0,
        totalLessons: overview.totalLessons,
      };

      return {
        lesson: {
          lessonId: lesson._id.toString(),
          title: lesson.title,
          summary: lessonSummary,
          self: selfLesson,
        },
        overview: {
          ...overview,
          students: undefined,
          self: selfOverall,
        },
      };
    }

    return {
      lesson: {
        lessonId: lesson._id.toString(),
        title: lesson.title,
        summary: lessonSummary,
        students: lessonRows,
      },
      overview,
    };
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
    await this.syncCourseMirrorCollections(updatedCourse.toObject());

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
    await this.syncCourseMirrorCollections(updatedCourse.toObject());

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
    await this.syncCourseMirrorCollections(updatedCourse.toObject());

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
    await this.syncCourseMirrorCollections(updatedCourse.toObject());
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
    await this.syncCourseMirrorCollections(updatedCourse.toObject());
    return this.sanitizeCourse(updatedCourse, user._id.toString());
  }
}
