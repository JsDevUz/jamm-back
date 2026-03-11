import { CoursesService } from './courses.service';
import { R2Service } from '../common/services/r2.service';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { LessonCommentDto, MarkAttendanceDto, SubmitLessonLinkedTestAttemptDto, ReviewLessonHomeworkDto, SetAttendanceStatusDto, SetLessonOralAssessmentDto, SubmitLessonHomeworkDto, UpsertLessonHomeworkDto, UpsertLessonLinkedTestDto, UpsertLessonMaterialDto } from './dto/course-interactions.dto';
import { CreateCourseDto, CreateLessonDto, UpdateLessonDto } from './dto/course.dto';
import { UploadValidationService } from '../common/uploads/upload-validation.service';
export declare class CoursesController {
    private coursesService;
    private r2Service;
    private jwtService;
    private uploadValidationService;
    constructor(coursesService: CoursesService, r2Service: R2Service, jwtService: JwtService, uploadValidationService: UploadValidationService);
    private buildUserAgentHash;
    private getMimeType;
    private getAssetFileName;
    private buildProtectedHlsKeyUrl;
    private buildProtectedHomeworkHlsKeyUrl;
    private rewriteHybridManifestContent;
    private rewriteHybridManifest;
    private getManifestDurationSeconds;
    private getVideoDurationSeconds;
    private transcodeVideoToHls;
    private getPlaybackCookieName;
    private readCookie;
    private buildPlaybackHeaders;
    private getAuthorizedLessonForUser;
    private getAuthorizedHomeworkSubmissionForUser;
    private resolvePlaybackUserId;
    private resolveHomeworkPlaybackUserId;
    findAll(req: any, page?: number, limit?: number): Promise<any>;
    getLikedLessons(req: any): Promise<({
        _id: any;
        title: any;
        description: any;
        likes: any;
        views: number;
        urlSlug: any;
        addedAt: any;
        course: {
            _id: any;
            name: any;
            image: any;
            urlSlug: any;
        };
    } | null)[]>;
    findOne(req: any, id: string): Promise<any>;
    create(req: any, body: CreateCourseDto): Promise<import("./schemas/course.schema").CourseDocument>;
    delete(req: any, id: string): Promise<void>;
    addLesson(req: any, id: string, body: CreateLessonDto): Promise<import("./schemas/course.schema").CourseDocument>;
    updateLesson(req: any, id: string, lessonId: string, body: UpdateLessonDto): Promise<import("./schemas/course.schema").CourseDocument>;
    publishLesson(req: any, id: string, lessonId: string): Promise<import("./schemas/course.schema").CourseDocument>;
    removeLesson(req: any, id: string, lessonId: string): Promise<import("./schemas/course.schema").CourseDocument>;
    incrementViews(id: string, lessonId: string): Promise<void>;
    likeLesson(req: any, id: string, lessonId: string): Promise<{
        liked: boolean;
        likes: number;
    }>;
    getLessonAttendance(req: any, id: string, lessonId: string): Promise<{
        lessonId: any;
        self: {
            userId: any;
            userName: any;
            userAvatar: any;
            status: any;
            progressPercent: any;
            source: any;
            markedAt: any;
        } | null;
        summary?: undefined;
        members?: undefined;
    } | {
        lessonId: any;
        summary: {
            present: number;
            late: number;
            absent: number;
        };
        members: {
            userId: any;
            userName: any;
            userAvatar: any;
            status: any;
            progressPercent: any;
            source: any;
            markedAt: any;
        }[];
        self?: undefined;
    }>;
    markOwnAttendance(req: any, id: string, lessonId: string, body: MarkAttendanceDto): Promise<{
        status: any;
        progressPercent: any;
    }>;
    setAttendanceStatus(req: any, id: string, lessonId: string, userId: string, body: SetAttendanceStatusDto): Promise<{
        lessonId: any;
        self: {
            userId: any;
            userName: any;
            userAvatar: any;
            status: any;
            progressPercent: any;
            source: any;
            markedAt: any;
        } | null;
        summary?: undefined;
        members?: undefined;
    } | {
        lessonId: any;
        summary: {
            present: number;
            late: number;
            absent: number;
        };
        members: {
            userId: any;
            userName: any;
            userAvatar: any;
            status: any;
            progressPercent: any;
            source: any;
            markedAt: any;
        }[];
        self?: undefined;
    }>;
    getLessonHomework(req: any, id: string, lessonId: string): Promise<{
        assignments: {
            assignmentId: any;
            enabled: boolean;
            title: any;
            description: any;
            type: any;
            deadline: any;
            maxScore: any;
            submissionCount: any;
            selfSubmission: {
                userId: any;
                userName: any;
                userAvatar: any;
                text: any;
                link: any;
                fileUrl: any;
                fileName: any;
                fileSize: any;
                streamType: any;
                streamAssets: any;
                hlsKeyAsset: string;
                status: any;
                score: any;
                feedback: any;
                submittedAt: any;
                reviewedAt: any;
            } | null;
            submissions: any;
        }[];
    }>;
    getLessonLinkedTests(req: any, id: string, lessonId: string): Promise<{
        items: any;
    }>;
    upsertLessonLinkedTest(req: any, id: string, lessonId: string, body: UpsertLessonLinkedTestDto): Promise<{
        items: any;
    }>;
    deleteLessonLinkedTest(req: any, id: string, lessonId: string, linkedTestId: string): Promise<{
        items: any;
    }>;
    submitLessonLinkedTestAttempt(req: any, id: string, lessonId: string, linkedTestId: string, body: SubmitLessonLinkedTestAttemptDto): Promise<{
        score: number;
        total: number;
        percent: number;
        passed: boolean;
        resourceType: string;
        minimumScore: number;
        showResults: boolean;
        results: any[];
        linkedTest: {
            linkedTestId: any;
            title: any;
            url: any;
            testId: any;
            resourceType: string;
            resourceId: any;
            shareShortCode: any;
            minimumScore: number;
            timeLimit: number;
            showResults: boolean;
            requiredToUnlock: boolean;
            selfProgress: {
                userId: any;
                userName: any;
                userAvatar: any;
                score: number;
                total: number;
                percent: number;
                bestPercent: number;
                passed: boolean;
                attemptsCount: number;
                completedAt: any;
            } | null;
            attemptsCount: number | undefined;
            passedCount: any;
        };
        nextLessonUnlocked: boolean;
    }>;
    getLessonMaterials(req: any, id: string, lessonId: string): Promise<{
        items: any;
    }>;
    upsertLessonMaterial(req: any, id: string, lessonId: string, body: UpsertLessonMaterialDto): Promise<{
        items: any;
    }>;
    deleteLessonMaterial(req: any, id: string, lessonId: string, materialId: string): Promise<{
        items: any;
    }>;
    upsertLessonHomework(req: any, id: string, lessonId: string, body: UpsertLessonHomeworkDto): Promise<{
        assignments: {
            assignmentId: any;
            enabled: boolean;
            title: any;
            description: any;
            type: any;
            deadline: any;
            maxScore: any;
            submissionCount: any;
            selfSubmission: {
                userId: any;
                userName: any;
                userAvatar: any;
                text: any;
                link: any;
                fileUrl: any;
                fileName: any;
                fileSize: any;
                streamType: any;
                streamAssets: any;
                hlsKeyAsset: string;
                status: any;
                score: any;
                feedback: any;
                submittedAt: any;
                reviewedAt: any;
            } | null;
            submissions: any;
        }[];
    }>;
    deleteLessonHomework(req: any, id: string, lessonId: string, assignmentId: string): Promise<{
        assignments: {
            assignmentId: any;
            enabled: boolean;
            title: any;
            description: any;
            type: any;
            deadline: any;
            maxScore: any;
            submissionCount: any;
            selfSubmission: {
                userId: any;
                userName: any;
                userAvatar: any;
                text: any;
                link: any;
                fileUrl: any;
                fileName: any;
                fileSize: any;
                streamType: any;
                streamAssets: any;
                hlsKeyAsset: string;
                status: any;
                score: any;
                feedback: any;
                submittedAt: any;
                reviewedAt: any;
            } | null;
            submissions: any;
        }[];
    }>;
    submitLessonHomework(req: any, id: string, lessonId: string, assignmentId: string, body: SubmitLessonHomeworkDto): Promise<{
        assignments: {
            assignmentId: any;
            enabled: boolean;
            title: any;
            description: any;
            type: any;
            deadline: any;
            maxScore: any;
            submissionCount: any;
            selfSubmission: {
                userId: any;
                userName: any;
                userAvatar: any;
                text: any;
                link: any;
                fileUrl: any;
                fileName: any;
                fileSize: any;
                streamType: any;
                streamAssets: any;
                hlsKeyAsset: string;
                status: any;
                score: any;
                feedback: any;
                submittedAt: any;
                reviewedAt: any;
            } | null;
            submissions: any;
        }[];
    }>;
    reviewLessonHomework(req: any, id: string, lessonId: string, assignmentId: string, userId: string, body: ReviewLessonHomeworkDto): Promise<{
        assignments: {
            assignmentId: any;
            enabled: boolean;
            title: any;
            description: any;
            type: any;
            deadline: any;
            maxScore: any;
            submissionCount: any;
            selfSubmission: {
                userId: any;
                userName: any;
                userAvatar: any;
                text: any;
                link: any;
                fileUrl: any;
                fileName: any;
                fileSize: any;
                streamType: any;
                streamAssets: any;
                hlsKeyAsset: string;
                status: any;
                score: any;
                feedback: any;
                submittedAt: any;
                reviewedAt: any;
            } | null;
            submissions: any;
        }[];
    }>;
    setLessonOralAssessment(req: any, id: string, lessonId: string, userId: string, body: SetLessonOralAssessmentDto): Promise<{
        lesson: {
            lessonId: any;
            title: any;
            summary: {
                averageScore: number;
                excellentCount: number;
                completedHomeworkCount: number;
                attendanceMarkedCount: number;
            };
            self: {
                userId: any;
                userName: any;
                userAvatar: any;
                attendanceStatus: any;
                attendanceProgress: any;
                attendanceScore: number;
                homeworkEnabled: boolean;
                homeworkStatus: string;
                homeworkSubmitted: boolean;
                homeworkAssignments: number;
                homeworkSubmittedCount: number;
                homeworkReviewedCount: number;
                homeworkScore: null;
                homeworkPercent: number | null;
                oralScore: number | null;
                oralNote: any;
                oralUpdatedAt: any;
                feedback: string;
                lessonScore: number;
                performance: string;
            } | {
                userId: string;
                attendanceStatus: string;
                attendanceProgress: number;
                attendanceScore: number;
                homeworkEnabled: boolean;
                homeworkStatus: string;
                homeworkSubmitted: false;
                homeworkScore: null;
                homeworkPercent: number | null;
                feedback: string;
                lessonScore: number;
                performance: string;
            };
            students?: undefined;
        };
        overview: {
            students: undefined;
            self: {
                userId: any;
                userName: any;
                userAvatar: any;
                averageScore: number;
                oralAverage: number | null;
                performance: string;
                attendanceRate: number;
                presentCount: number;
                lateCount: number;
                absentCount: number;
                homeworkCompleted: number;
                reviewedHomework: number;
                totalLessons: number;
            } | {
                userId: string;
                averageScore: number;
                performance: string;
                attendanceRate: number;
                presentCount: number;
                lateCount: number;
                absentCount: number;
                homeworkCompleted: number;
                reviewedHomework: number;
                totalLessons: number;
            };
            totalStudents: number;
            totalLessons: number;
            averageScore: number;
            activeStudents: number;
            attentionCount: number;
        };
    } | {
        lesson: {
            lessonId: any;
            title: any;
            summary: {
                averageScore: number;
                excellentCount: number;
                completedHomeworkCount: number;
                attendanceMarkedCount: number;
            };
            students: {
                userId: any;
                userName: any;
                userAvatar: any;
                attendanceStatus: any;
                attendanceProgress: any;
                attendanceScore: number;
                homeworkEnabled: boolean;
                homeworkStatus: string;
                homeworkSubmitted: boolean;
                homeworkAssignments: number;
                homeworkSubmittedCount: number;
                homeworkReviewedCount: number;
                homeworkScore: null;
                homeworkPercent: number | null;
                oralScore: number | null;
                oralNote: any;
                oralUpdatedAt: any;
                feedback: string;
                lessonScore: number;
                performance: string;
            }[];
            self?: undefined;
        };
        overview: {
            totalStudents: number;
            totalLessons: number;
            averageScore: number;
            activeStudents: number;
            attentionCount: number;
            students: {
                userId: any;
                userName: any;
                userAvatar: any;
                averageScore: number;
                oralAverage: number | null;
                performance: string;
                attendanceRate: number;
                presentCount: number;
                lateCount: number;
                absentCount: number;
                homeworkCompleted: number;
                reviewedHomework: number;
                totalLessons: number;
            }[];
        };
    }>;
    getLessonGrading(req: any, id: string, lessonId: string): Promise<{
        lesson: {
            lessonId: any;
            title: any;
            summary: {
                averageScore: number;
                excellentCount: number;
                completedHomeworkCount: number;
                attendanceMarkedCount: number;
            };
            self: {
                userId: any;
                userName: any;
                userAvatar: any;
                attendanceStatus: any;
                attendanceProgress: any;
                attendanceScore: number;
                homeworkEnabled: boolean;
                homeworkStatus: string;
                homeworkSubmitted: boolean;
                homeworkAssignments: number;
                homeworkSubmittedCount: number;
                homeworkReviewedCount: number;
                homeworkScore: null;
                homeworkPercent: number | null;
                oralScore: number | null;
                oralNote: any;
                oralUpdatedAt: any;
                feedback: string;
                lessonScore: number;
                performance: string;
            } | {
                userId: string;
                attendanceStatus: string;
                attendanceProgress: number;
                attendanceScore: number;
                homeworkEnabled: boolean;
                homeworkStatus: string;
                homeworkSubmitted: false;
                homeworkScore: null;
                homeworkPercent: number | null;
                feedback: string;
                lessonScore: number;
                performance: string;
            };
            students?: undefined;
        };
        overview: {
            students: undefined;
            self: {
                userId: any;
                userName: any;
                userAvatar: any;
                averageScore: number;
                oralAverage: number | null;
                performance: string;
                attendanceRate: number;
                presentCount: number;
                lateCount: number;
                absentCount: number;
                homeworkCompleted: number;
                reviewedHomework: number;
                totalLessons: number;
            } | {
                userId: string;
                averageScore: number;
                performance: string;
                attendanceRate: number;
                presentCount: number;
                lateCount: number;
                absentCount: number;
                homeworkCompleted: number;
                reviewedHomework: number;
                totalLessons: number;
            };
            totalStudents: number;
            totalLessons: number;
            averageScore: number;
            activeStudents: number;
            attentionCount: number;
        };
    } | {
        lesson: {
            lessonId: any;
            title: any;
            summary: {
                averageScore: number;
                excellentCount: number;
                completedHomeworkCount: number;
                attendanceMarkedCount: number;
            };
            students: {
                userId: any;
                userName: any;
                userAvatar: any;
                attendanceStatus: any;
                attendanceProgress: any;
                attendanceScore: number;
                homeworkEnabled: boolean;
                homeworkStatus: string;
                homeworkSubmitted: boolean;
                homeworkAssignments: number;
                homeworkSubmittedCount: number;
                homeworkReviewedCount: number;
                homeworkScore: null;
                homeworkPercent: number | null;
                oralScore: number | null;
                oralNote: any;
                oralUpdatedAt: any;
                feedback: string;
                lessonScore: number;
                performance: string;
            }[];
            self?: undefined;
        };
        overview: {
            totalStudents: number;
            totalLessons: number;
            averageScore: number;
            activeStudents: number;
            attentionCount: number;
            students: {
                userId: any;
                userName: any;
                userAvatar: any;
                averageScore: number;
                oralAverage: number | null;
                performance: string;
                attendanceRate: number;
                presentCount: number;
                lateCount: number;
                absentCount: number;
                homeworkCompleted: number;
                reviewedHomework: number;
                totalLessons: number;
            }[];
        };
    }>;
    uploadMedia(file: Express.Multer.File): Promise<{
        streamType: "hls";
        fileUrl: string;
        manifestUrl: string;
        assetKeys: string[];
        hlsKeyAsset: string;
        fileName: string;
        fileSize: number;
        durationSeconds: number;
    } | {
        streamType: string;
        fileUrl: string;
        url: string;
        fileName: string;
        fileSize: number;
        durationSeconds: number;
        hlsKeyAsset: string;
    }>;
    getLessonPlaybackToken(req: any, id: string, lessonId: string, userAgent: string, res: Response, mediaId?: string): Promise<{
        expiresIn: number;
        playbackToken: string;
        streamType: string;
        streamUrl: string;
    }>;
    streamLessonHlsAsset(req: any, id: string, lessonId: string, asset: string, range: string, res: Response, playbackToken?: string, mediaId?: string): Promise<void>;
    streamLessonHlsKey(req: any, id: string, lessonId: string, res: Response, playbackToken?: string, mediaId?: string): Promise<void>;
    getHomeworkSubmissionPlaybackToken(req: any, id: string, lessonId: string, assignmentId: string, submissionUserId: string): Promise<{
        streamType: string;
        streamUrl: string;
        playbackToken: string;
    }>;
    streamHomeworkSubmissionHlsAsset(req: any, id: string, lessonId: string, assignmentId: string, submissionUserId: string, asset: string, range: string, res: Response, playbackToken?: string): Promise<void>;
    streamHomeworkSubmissionHlsKey(req: any, id: string, lessonId: string, assignmentId: string, submissionUserId: string, res: Response, playbackToken?: string): Promise<void>;
    streamHomeworkSubmission(req: any, id: string, lessonId: string, assignmentId: string, submissionUserId: string, range: string, res: Response, playbackToken?: string): Promise<void>;
    streamLesson(req: any, id: string, lessonId: string, range: string, res: Response, playbackToken?: string, mediaId?: string): Promise<void>;
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
    addComment(req: any, id: string, lessonId: string, body: LessonCommentDto): Promise<import("./schemas/course.schema").CourseDocument>;
    addReply(req: any, id: string, lessonId: string, commentId: string, body: LessonCommentDto): Promise<import("./schemas/course.schema").CourseDocument>;
}
