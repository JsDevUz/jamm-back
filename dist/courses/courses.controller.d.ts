import { CoursesService } from './courses.service';
export declare class CoursesController {
    private coursesService;
    constructor(coursesService: CoursesService);
    findAll(req: any): Promise<any[]>;
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
    enroll(req: any, id: string): Promise<import("./schemas/course.schema").CourseDocument>;
    approveUser(req: any, id: string, memberId: string): Promise<import("./schemas/course.schema").CourseDocument>;
    removeUser(req: any, id: string, memberId: string): Promise<import("./schemas/course.schema").CourseDocument>;
    addComment(req: any, id: string, lessonId: string, body: {
        text: string;
    }): Promise<import("./schemas/course.schema").CourseDocument>;
    addReply(req: any, id: string, lessonId: string, commentId: string, body: {
        text: string;
    }): Promise<import("./schemas/course.schema").CourseDocument>;
}
