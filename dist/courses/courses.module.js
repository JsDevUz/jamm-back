"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const courses_service_1 = require("./courses.service");
const courses_controller_1 = require("./courses.controller");
const course_schema_1 = require("./schemas/course.schema");
const course_member_schema_1 = require("./schemas/course-member.schema");
const course_lesson_schema_1 = require("./schemas/course-lesson.schema");
const lesson_homework_schema_1 = require("./schemas/lesson-homework.schema");
const courses_gateway_1 = require("./courses.gateway");
const encryption_module_1 = require("../common/encryption/encryption.module");
const user_schema_1 = require("../users/schemas/user.schema");
const r2_service_1 = require("../common/services/r2.service");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const arena_module_1 = require("../arena/arena.module");
const auth_cookie_util_1 = require("../auth/auth-cookie.util");
let CoursesModule = class CoursesModule {
};
exports.CoursesModule = CoursesModule;
exports.CoursesModule = CoursesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: course_schema_1.Course.name, schema: course_schema_1.CourseSchema },
                { name: course_member_schema_1.CourseMemberRecord.name, schema: course_member_schema_1.CourseMemberRecordSchema },
                { name: course_lesson_schema_1.CourseLessonRecord.name, schema: course_lesson_schema_1.CourseLessonRecordSchema },
                { name: lesson_homework_schema_1.LessonHomeworkRecord.name, schema: lesson_homework_schema_1.LessonHomeworkRecordSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: (0, auth_cookie_util_1.getJwtSecret)(config),
                    signOptions: {
                        expiresIn: config.get('JWT_EXPIRES_IN') || '7d',
                    },
                }),
            }),
            encryption_module_1.EncryptionModule,
            config_1.ConfigModule,
            arena_module_1.ArenaModule,
        ],
        controllers: [courses_controller_1.CoursesController],
        providers: [courses_service_1.CoursesService, r2_service_1.R2Service, courses_gateway_1.CoursesGateway],
        exports: [courses_service_1.CoursesService],
    })
], CoursesModule);
//# sourceMappingURL=courses.module.js.map