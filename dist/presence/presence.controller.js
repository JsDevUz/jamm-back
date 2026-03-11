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
exports.PresenceController = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const redis_presence_service_1 = require("./redis-presence.service");
const user_schema_1 = require("../users/schemas/user.schema");
const app_settings_service_1 = require("../app-settings/app-settings.service");
const bulk_status_dto_1 = require("./dto/bulk-status.dto");
let PresenceController = class PresenceController {
    redisPresence;
    userModel;
    appSettingsService;
    constructor(redisPresence, userModel, appSettingsService) {
        this.redisPresence = redisPresence;
        this.userModel = userModel;
        this.appSettingsService = appSettingsService;
    }
    async getUserStatus(userId) {
        const user = await this.userModel
            .findById(userId)
            .select('username')
            .lean()
            .exec();
        const officialProfile = await this.appSettingsService.getOfficialProfileByUsername(user?.username);
        if (officialProfile?.hidePresence) {
            return { userId, online: false };
        }
        const online = await this.redisPresence.isOnline(userId);
        return { userId, online };
    }
    async getBulkStatus(body) {
        const userIds = Array.isArray(body.userIds) ? body.userIds : [];
        const users = await this.userModel
            .find({
            _id: {
                $in: userIds
                    .filter((id) => mongoose_2.Types.ObjectId.isValid(id))
                    .map((id) => new mongoose_2.Types.ObjectId(id)),
            },
        })
            .select('_id username')
            .lean()
            .exec();
        const decoratedUsers = await this.appSettingsService.decorateUsersPayload(users);
        const hiddenPresenceIds = new Set(decoratedUsers
            .filter((user) => user.hidePresence)
            .map((user) => String(user._id)));
        const visibleUserIds = userIds.filter((id) => !hiddenPresenceIds.has(String(id)));
        const statuses = await this.redisPresence.getOnlineStatuses(visibleUserIds);
        hiddenPresenceIds.forEach((id) => {
            statuses[id] = false;
        });
        return { statuses };
    }
};
exports.PresenceController = PresenceController;
__decorate([
    (0, common_1.Get)('status/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "getUserStatus", null);
__decorate([
    (0, common_1.Post)('status/bulk'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_status_dto_1.BulkStatusDto]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "getBulkStatus", null);
exports.PresenceController = PresenceController = __decorate([
    (0, common_1.Controller)('presence'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [redis_presence_service_1.RedisPresenceService,
        mongoose_2.Model,
        app_settings_service_1.AppSettingsService])
], PresenceController);
//# sourceMappingURL=presence.controller.js.map