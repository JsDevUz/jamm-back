import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { CourseDocument } from './schemas/course.schema';
import { CourseMemberRecordDocument } from './schemas/course-member.schema';
import { CourseLessonRecordDocument } from './schemas/course-lesson.schema';
import { LessonHomeworkRecordDocument } from './schemas/lesson-homework.schema';
import { EncryptionService } from '../common/encryption/encryption.service';
import { UserDocument } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';
import { CoursesGateway } from './courses.gateway';
import { ArenaService } from '../arena/arena.service';
export declare class CoursesService implements OnModuleInit {
    private courseModel;
    private courseMemberRecordModel;
    private courseLessonRecordModel;
    private lessonHomeworkRecordModel;
    private userModel;
    private encryptionService;
    private r2Service;
    private coursesGateway;
    private arenaService;
    constructor(courseModel: Model<CourseDocument>, courseMemberRecordModel: Model<CourseMemberRecordDocument>, courseLessonRecordModel: Model<CourseLessonRecordDocument>, lessonHomeworkRecordModel: Model<LessonHomeworkRecordDocument>, userModel: Model<UserDocument>, encryptionService: EncryptionService, r2Service: R2Service, coursesGateway: CoursesGateway, arenaService: ArenaService);
    onModuleInit(): Promise<void>;
    private isShortSlug;
    private generateUniqueCourseSlug;
    private generateUniqueLessonSlug;
    private decryptText;
    private getUserPremiumStatus;
    private syncCourseMirrorCollections;
    private attachCourseRuntimeHelpers;
    private pickPersistedCourseFields;
    private getNormalizedMemberRows;
    private getNormalizedLessonRows;
    private getNormalizedHomeworkRows;
    private persistCourseCollections;
    private hydrateCourseCollections;
    private getHomeworkFileSizeLimit;
    private assertHomeworkSubmissionFileIsAllowed;
    private sanitizeCourse;
    private canAccessLesson;
    canUserAccessLessonByIdentifier(course: CourseDocument, userId: string, lessonId: string): boolean;
    private findLessonByIdentifier;
    private getAttendanceRecord;
    private normalizeHomeworkAssignments;
    private ensureHomeworkAssignments;
    private serializeHomeworkSubmission;
    private serializeHomeworkAssignment;
    private findHomeworkAssignment;
    private getHomeworkSubmission;
    private getOralAssessment;
    private getPublishedLessons;
    private normalizeLessonLinkedTests;
    private normalizeLessonMediaItems;
    private normalizeLessonMaterials;
    private ensureLessonMaterials;
    private getLessonMediaPayload;
    private getLinkedTestProgress;
    private serializeLinkedTestProgress;
    private serializeLinkedTest;
    private getIncompleteRequiredTestsBeforeLesson;
    private parseLessonTestUrl;
    private resolveLessonLinkedTest;
    private normalizeSentenceBuilderLessonAnswers;
    private getAttendanceScore;
    private getHomeworkPercent;
    private getPerformanceLabel;
    private buildLessonGradeRow;
    private buildCourseOverview;
    private cleanupHomeworkSubmissionAssets;
    private cleanupLessonMediaItemAssets;
    private cleanupLessonMaterialAssets;
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
    }): Promise<CourseDocument>;
    updateLesson(courseId: string, lessonId: string, userId: string, dto: {
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
    }): Promise<CourseDocument>;
    publishLesson(courseId: string, lessonId: string, userId: string): Promise<CourseDocument>;
    removeLesson(courseId: string, lessonId: string, userId: string): Promise<CourseDocument>;
    incrementViews(courseId: string, lessonId: string): Promise<void>;
    toggleLessonLike(courseId: string, lessonId: string, userId: string): Promise<{
        liked: boolean;
        likes: number;
    }>;
    getLikedLessons(userId: string): Promise<({
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
    getLessonAttendance(courseId: string, lessonId: string, userId: string): Promise<{
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
    markOwnAttendance(courseId: string, lessonId: string, user: any, dto: {
        progressPercent?: number;
    }): Promise<{
        status: any;
        progressPercent: any;
    }>;
    setAttendanceStatus(courseId: string, lessonId: string, targetUserId: string, adminId: string, status: string): Promise<{
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
    getLessonHomework(courseId: string, lessonId: string, userId: string): Promise<{
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
    upsertLessonHomework(courseId: string, lessonId: string, userId: string, dto: {
        assignmentId?: string;
        enabled?: boolean;
        title?: string;
        description?: string;
        type?: string;
        deadline?: string | null;
        maxScore?: number;
    }): Promise<{
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
    deleteLessonHomework(courseId: string, lessonId: string, assignmentId: string, userId: string): Promise<{
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
    getLessonMaterials(courseId: string, lessonId: string, userId: string): Promise<{
        items: any;
    }>;
    upsertLessonMaterial(courseId: string, lessonId: string, userId: string, dto: {
        materialId?: string;
        title?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
    }): Promise<{
        items: any;
    }>;
    deleteLessonMaterial(courseId: string, lessonId: string, materialId: string, userId: string): Promise<{
        items: any;
    }>;
    getLessonLinkedTests(courseId: string, lessonId: string, userId: string): Promise<{
        items: any;
    }>;
    upsertLessonLinkedTest(courseId: string, lessonId: string, userId: string, dto: {
        linkedTestId?: string;
        url?: string;
        minimumScore?: number;
        timeLimit?: number;
        showResults?: boolean;
        requiredToUnlock?: boolean;
    }): Promise<{
        items: any;
    }>;
    deleteLessonLinkedTest(courseId: string, lessonId: string, linkedTestId: string, userId: string): Promise<{
        items: any;
    }>;
    submitLessonLinkedTestAttempt(courseId: string, lessonId: string, linkedTestId: string, user: any, dto: {
        answers?: number[];
        sentenceBuilderAnswers?: {
            questionIndex: number;
            selectedTokens: string[];
        }[];
    }): Promise<{
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
    submitLessonHomework(courseId: string, lessonId: string, assignmentId: string, user: any, dto: {
        text?: string;
        link?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        streamType?: string;
        streamAssets?: string[];
        hlsKeyAsset?: string;
    }): Promise<{
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
    reviewLessonHomework(courseId: string, lessonId: string, assignmentId: string, submissionUserId: string, adminId: string, dto: {
        status?: string;
        score?: number | null;
        feedback?: string;
    }): Promise<{
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
    setLessonOralAssessment(courseId: string, lessonId: string, targetUserId: string, adminId: string, dto: {
        score?: number | null;
        note?: string;
    }): Promise<{
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
    getLessonGrading(courseId: string, lessonId: string, userId: string): Promise<{
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
