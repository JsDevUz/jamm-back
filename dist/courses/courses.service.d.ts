import { Model } from 'mongoose';
import { CourseDocument } from './schemas/course.schema';
export declare class CoursesService {
    private courseModel;
    constructor(courseModel: Model<CourseDocument>);
    private sanitizeCourse;
    getAllCoursesForUser(userId: string): Promise<any[]>;
    getCourseForUser(id: string, userId: string): Promise<any>;
    findAll(): Promise<CourseDocument[]>;
    findById(id: string): Promise<CourseDocument>;
    create(userId: string, dto: {
        name: string;
        description?: string;
        image?: string;
        category?: string;
        price?: number;
    }): Promise<CourseDocument>;
    delete(courseId: string, userId: string): Promise<void>;
    addLesson(courseId: string, userId: string, dto: {
        title: string;
        videoUrl: string;
        description?: string;
    }): Promise<CourseDocument>;
    removeLesson(courseId: string, lessonId: string, userId: string): Promise<CourseDocument>;
    incrementViews(courseId: string, lessonId: string): Promise<void>;
    enroll(courseId: string, user: {
        _id: string;
        nickname: string;
        username: string;
    }): Promise<CourseDocument>;
    approveUser(courseId: string, memberId: string, adminId: string): Promise<CourseDocument>;
    removeUser(courseId: string, memberId: string, adminId: string): Promise<CourseDocument>;
    addComment(courseId: string, lessonId: string, user: any, text: string): Promise<CourseDocument>;
    addReply(courseId: string, lessonId: string, commentId: string, user: any, text: string): Promise<CourseDocument>;
}
