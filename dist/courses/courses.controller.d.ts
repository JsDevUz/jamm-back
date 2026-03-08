import { CoursesService } from './courses.service';
import { R2Service } from '../common/services/r2.service';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
export declare class CoursesController {
    private coursesService;
    private r2Service;
    private jwtService;
    constructor(coursesService: CoursesService, r2Service: R2Service, jwtService: JwtService);
    private buildUserAgentHash;
    private getMimeType;
    private getAssetFileName;
    private buildProtectedHlsKeyUrl;
    private rewriteHybridManifest;
    private transcodeVideoToHls;
    private getPlaybackCookieName;
    private readCookie;
    private buildPlaybackHeaders;
    private getAuthorizedLessonForUser;
    private resolvePlaybackUserId;
    findAll(req: any, page?: number, limit?: number): Promise<any>;
    getLikedLessons(req: any): Promise<any[]>;
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
        videoUrl?: string;
        description?: string;
        type?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        streamType?: string;
        streamAssets?: string[];
        hlsKeyAsset?: string;
    }): Promise<import("./schemas/course.schema").CourseDocument>;
    removeLesson(req: any, id: string, lessonId: string): Promise<import("./schemas/course.schema").CourseDocument>;
    incrementViews(id: string, lessonId: string): Promise<void>;
    likeLesson(req: any, id: string, lessonId: string): Promise<{
        liked: boolean;
        likes: number;
    }>;
    uploadMedia(file: Express.Multer.File): Promise<{
        streamType: "hls";
        manifestUrl: string;
        assetKeys: string[];
        hlsKeyAsset: string;
        fileName: string;
        fileSize: number;
    } | {
        streamType: string;
        url: string;
        fileName: string;
        fileSize: number;
        hlsKeyAsset: string;
    }>;
    getLessonPlaybackToken(req: any, id: string, lessonId: string, userAgent: string, res: Response): Promise<{
        expiresIn: number;
        playbackToken: string;
        streamType: string;
        streamUrl: string;
    }>;
    streamLessonHlsAsset(req: any, id: string, lessonId: string, asset: string, range: string, res: Response, playbackToken?: string): Promise<void>;
    streamLessonHlsKey(req: any, id: string, lessonId: string, res: Response, playbackToken?: string): Promise<void>;
    streamLesson(req: any, id: string, lessonId: string, range: string, res: Response, playbackToken?: string): Promise<void>;
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
