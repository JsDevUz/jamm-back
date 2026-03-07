import { Model } from 'mongoose';
import { CourseDocument } from './schemas/course.schema';
import { EncryptionService } from '../common/encryption/encryption.service';
import { UserDocument } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';
import { CoursesGateway } from './courses.gateway';
export declare class CoursesService {
    private courseModel;
    private userModel;
    private encryptionService;
    private r2Service;
    private coursesGateway;
    constructor(courseModel: Model<CourseDocument>, userModel: Model<UserDocument>, encryptionService: EncryptionService, r2Service: R2Service, coursesGateway: CoursesGateway);
    private decryptText;
    private sanitizeCourse;
    private canAccessLesson;
    getAllCoursesForUser(userId: string, pagination?: {
        page: number;
        limit: number;
    }): Promise<any>;
    getCourseForUser(id: string, userId: string): Promise<any>;
    findAll(): Promise<CourseDocument[]>;
    findById(id: string): Promise<CourseDocument>;
    create(userId: string, dto: {
        name: string;
        description?: string;
        image?: string;
        category?: string;
        price?: number;
        accessType?: string;
        urlSlug?: string;
    }): Promise<CourseDocument>;
    delete(courseId: string, userId: string): Promise<void>;
    addLesson(courseId: string, userId: string, dto: {
        title: string;
        videoUrl?: string;
        description?: string;
        type?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        streamType?: string;
        streamAssets?: string[];
        urlSlug?: string;
    }): Promise<CourseDocument>;
    removeLesson(courseId: string, lessonId: string, userId: string): Promise<CourseDocument>;
    incrementViews(courseId: string, lessonId: string): Promise<void>;
    toggleLessonLike(courseId: string, lessonId: string, userId: string): Promise<{
        liked: boolean;
        likes: number;
    }>;
    getLikedLessons(userId: string): Promise<any[]>;
    enroll(courseId: string, user: {
        _id: string;
        nickname: string;
        username: string;
    }): Promise<CourseDocument>;
    approveUser(courseId: string, memberId: string, adminId: string): Promise<CourseDocument>;
    removeUser(courseId: string, memberId: string, adminId: string): Promise<CourseDocument>;
    getLessonComments(courseId: string, lessonId: string, pagination?: {
        page: number;
        limit: number;
    }): Promise<{
        data: any;
        total: any;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    addComment(courseId: string, lessonId: string, user: any, text: string): Promise<CourseDocument>;
    addReply(courseId: string, lessonId: string, commentId: string, user: any, text: string): Promise<CourseDocument>;
}
