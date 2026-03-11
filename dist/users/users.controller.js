"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const users_service_1 = require("./users.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const platform_express_1 = require("@nestjs/platform-express");
const complete_onboarding_dto_1 = require("./dto/complete-onboarding.dto");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const app_settings_service_1 = require("../app-settings/app-settings.service");
const profile_decoration_dto_1 = require("./dto/profile-decoration.dto");
const upload_validation_service_1 = require("../common/uploads/upload-validation.service");
const multer_options_1 = require("../common/uploads/multer-options");
const app_limits_1 = require("../common/limits/app-limits");
let UsersController = class UsersController {
    usersService;
    appSettingsService;
    uploadValidationService;
    constructor(usersService, appSettingsService, uploadValidationService) {
        this.usersService = usersService;
        this.appSettingsService = appSettingsService;
        this.uploadValidationService = uploadValidationService;
    }
    async sanitizeUser(user) {
        if (!user)
            return null;
        const obj = typeof user.toObject === 'function' ? user.toObject() : user;
        return this.appSettingsService.decorateUserPayload({
            _id: obj._id,
            jammId: obj.jammId,
            username: obj.username,
            nickname: obj.nickname,
            avatar: obj.avatar,
            phone: obj.phone,
            bio: obj.bio,
            gender: obj.gender,
            age: obj.age,
            selectedProfileDecorationId: obj.selectedProfileDecorationId || null,
            customProfileDecorationImage: obj.customProfileDecorationImage || null,
            interests: obj.interests || [],
            goals: obj.goals || [],
            level: obj.level,
            premiumStatus: obj.premiumStatus,
            premiumExpiresAt: obj.premiumExpiresAt,
            isOnboardingCompleted: obj.isOnboardingCompleted,
            isVerified: obj.isVerified,
            createdAt: obj.createdAt,
        });
    }
    async uploadAvatar(req, file) {
        await this.uploadValidationService.validateImageUpload(file, {
            label: 'Avatar',
        });
        const user = await this.usersService.updateAvatar(req.user._id.toString(), file);
        return this.sanitizeUser(user);
    }
    async getMe(req) {
        const user = await this.usersService.findById(req.user._id.toString());
        return this.sanitizeUser(user);
    }
    async updateMe(req, body) {
        const user = await this.usersService.updateProfile(req.user._id.toString(), body);
        return this.sanitizeUser(user);
    }
    async getProfileDecorations() {
        return this.usersService.getProfileDecorations();
    }
    async updateProfileDecoration(req, body) {
        const user = await this.usersService.updateProfileDecoration(req.user._id.toString(), body?.decorationId ?? null);
        return this.sanitizeUser(user);
    }
    async uploadProfileDecorationImage(req, file) {
        await this.uploadValidationService.validateImageUpload(file, {
            label: 'Profil bezagi rasmi',
        });
        const user = await this.usersService.updateProfileDecorationImage(req.user._id.toString(), file);
        return this.sanitizeUser(user);
    }
    async getAllUsers(req) {
        return this.usersService.getAllUsers(req.user._id.toString());
    }
    async searchUsers(query, req) {
        if (!query)
            return [];
        return this.usersService.searchUsers(query, req.user._id);
    }
    async searchGlobal(query, req) {
        if (!query)
            return [];
        const users = await this.usersService.searchGlobal(query, req.user._id);
        return Promise.all(users.map((u) => this.sanitizeUser(u)));
    }
    async getUserByUsername(username) {
        const user = await this.usersService.findByUsername(username);
        if (!user)
            throw new common_1.NotFoundException('Foydalanuvchi topilmadi');
        const { password, ...safe } = user.toObject();
        return this.appSettingsService.decorateUserPayload(safe);
    }
    async toggleFollow(req, id) {
        return this.usersService.toggleFollow(req.user._id.toString(), id);
    }
    async getPublicProfile(req, id) {
        return this.usersService.getPublicProfile(id, req.user._id.toString());
    }
    async checkUsername(req, username) {
        const existing = await this.usersService.findByUsername(username);
        const isAvailable = !existing || existing._id.toString() === req.user._id.toString();
        return { available: isAvailable };
    }
    async completeOnboarding(req, body) {
        const existingUsername = await this.usersService.findByUsername(body.username);
        if (existingUsername &&
            existingUsername._id.toString() !== req.user._id.toString()) {
            throw new common_1.BadRequestException('Bu username allaqachon band');
        }
        const user = await this.usersService.completeOnboarding(req.user._id.toString(), body);
        return this.sanitizeUser(user);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Post)('avatar'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.createSafeSingleFileMulterOptions)(app_limits_1.APP_LIMITS.homeworkPhotoBytes))),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "uploadAvatar", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMe", null);
__decorate([
    (0, common_1.Patch)('me'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Get)('profile-decorations'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getProfileDecorations", null);
__decorate([
    (0, common_1.Patch)('me/profile-decoration'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, profile_decoration_dto_1.UpdateProfileDecorationDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateProfileDecoration", null);
__decorate([
    (0, common_1.Patch)('me/profile-decoration-image'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.createSafeSingleFileMulterOptions)(app_limits_1.APP_LIMITS.homeworkPhotoBytes))),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "uploadProfileDecorationImage", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAllUsers", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "searchUsers", null);
__decorate([
    (0, common_1.Get)('global-search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "searchGlobal", null);
__decorate([
    (0, common_1.Get)('by-username/:username'),
    __param(0, (0, common_1.Param)('username')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUserByUsername", null);
__decorate([
    (0, common_1.Post)(':id/follow'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "toggleFollow", null);
__decorate([
    (0, common_1.Get)(':id/profile'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getPublicProfile", null);
__decorate([
    (0, common_1.Get)('check-username/:username'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('username')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "checkUsername", null);
__decorate([
    (0, common_1.Post)('complete-onboarding'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, complete_onboarding_dto_1.CompleteOnboardingDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "completeOnboarding", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        app_settings_service_1.AppSettingsService,
        upload_validation_service_1.UploadValidationService])
], UsersController);
//# sourceMappingURL=users.controller.js.map