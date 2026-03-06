import { CoursesService } from './courses.service';
import { R2Service } from '../common/services/r2.service';
import type { Response } from 'express';
export declare class CoursesController {
    private coursesService;
    private r2Service;
    constructor(coursesService: CoursesService, r2Service: R2Service);
    findAll(req: any, page?: number, limit?: number): Promise<any>;
    findOne(req: any, id: string): Promise<any>;
    create(req: any, body: {
        name: string;
        description?: string;
        image?: string;
        category?: string;
        price?: number;
    }): Promise<import("./schemas/course.schema").CourseDocument>;
    delete(req: any, id: string): Promise<void>;
    addLesson(req: any, id: string, body: {
        title: string;
        videoUrl: string;
        description?: string;
    }): Promise<import("./schemas/course.schema").CourseDocument>;
    removeLesson(req: any, id: string, lessonId: string): Promise<import("./schemas/course.schema").CourseDocument>;
    incrementViews(id: string, lessonId: string): Promise<void>;
    uploadMedia(file: Express.Multer.File): Promise<{
        url: string;
        fileName: string;
        fileSize: number;
    }>;
    streamLesson(req: any, id: string, lessonId: string, range: string, res: Response): Promise<void>;
    enroll(req: any, id: string): Promise<import("./schemas/course.schema").CourseDocument>;
    approveUser(req: any, id: string, memberId: string): Promise<import("./schemas/course.schema").CourseDocument>;
    removeUser(req: any, id: string, memberId: string): Promise<import("./schemas/course.schema").CourseDocument>;
    getComments(req: any, id: string, lessonId: string, page?: number, limit?: number): Promise<{
        data: any;
        total: any;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    addComment(req: any, id: string, lessonId: string, body: {
        text: string;
    }): Promise<import("./schemas/course.schema").CourseDocument>;
    addReply(req: any, id: string, lessonId: string, commentId: string, body: {
        text: string;
    }): Promise<import("./schemas/course.schema").CourseDocument>;
}
