"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const courses_module_1 = require("./courses/courses.module");
const chats_module_1 = require("./chats/chats.module");
const video_module_1 = require("./video/video.module");
const presence_module_1 = require("./presence/presence.module");
const premium_module_1 = require("./premium/premium.module");
const meets_module_1 = require("./meets/meets.module");
const posts_module_1 = require("./posts/posts.module");
const arena_module_1 = require("./arena/arena.module");
const blogs_module_1 = require("./blogs/blogs.module");
const app_settings_module_1 = require("./app-settings/app-settings.module");
const app_access_guard_1 = require("./auth/guards/app-access.guard");
const common_module_1 = require("./common/common.module");
const admin_module_1 = require("./admin/admin.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            mongoose_1.MongooseModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    uri: configService.get('MONGODB_URI'),
                }),
            }),
            common_module_1.CommonModule,
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 100,
                },
            ]),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            courses_module_1.CoursesModule,
            chats_module_1.ChatsModule,
            video_module_1.VideoModule,
            presence_module_1.PresenceModule,
            premium_module_1.PremiumModule,
            meets_module_1.MeetsModule,
            posts_module_1.PostsModule,
            arena_module_1.ArenaModule,
            blogs_module_1.BlogsModule,
            app_settings_module_1.AppSettingsModule,
            admin_module_1.AdminModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: app_access_guard_1.AppAccessGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map