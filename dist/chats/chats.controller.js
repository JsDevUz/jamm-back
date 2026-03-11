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
exports.ChatsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const platform_express_1 = require("@nestjs/platform-express");
const chats_service_1 = require("./chats.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const chat_dto_1 = require("./dto/chat.dto");
const upload_validation_service_1 = require("../common/uploads/upload-validation.service");
const multer_options_1 = require("../common/uploads/multer-options");
const app_limits_1 = require("../common/limits/app-limits");
let ChatsController = class ChatsController {
    chatsService;
    uploadValidationService;
    constructor(chatsService, uploadValidationService) {
        this.chatsService = chatsService;
        this.uploadValidationService = uploadValidationService;
    }
    getUserChats(req, page, limit) {
        return this.chatsService.getUserChats(req.user._id.toString(), {
            page: Number(page) || 1,
            limit: Number(limit) || 15,
        });
    }
    createChat(req, dto) {
        return this.chatsService.createChat(req.user._id.toString(), dto);
    }
    previewGroup(privateurl) {
        return this.chatsService.previewGroup(privateurl);
    }
    resolveSlug(req, slug) {
        return this.chatsService.resolveSlug(slug, req.user._id.toString());
    }
    searchPrivateUsers(req, query, limit) {
        return this.chatsService.searchPrivateUsers(req.user._id.toString(), query || '', Number(limit) || 10);
    }
    searchGroups(req, query, limit) {
        return this.chatsService.searchUserGroups(req.user._id.toString(), query || '', Number(limit) || 10);
    }
    getChat(req, id) {
        return this.chatsService.getChat(id, req.user._id.toString());
    }
    getChatMessages(req, id, before) {
        return this.chatsService.getChatMessages(id, req.user._id.toString(), before);
    }
    sendMessage(req, id, body) {
        return this.chatsService.sendMessage(id, req.user._id.toString(), body.content, body.replayToId);
    }
    editMessage(req, messageId, body) {
        return this.chatsService.editMessage(messageId, req.user._id.toString(), body.content);
    }
    deleteMessage(req, messageId) {
        return this.chatsService.deleteMessage(messageId, req.user._id.toString());
    }
    joinGroupByLink(req, id) {
        return this.chatsService.joinGroupByLink(id, req.user._id.toString());
    }
    editChat(req, id, body) {
        return this.chatsService.editChat(id, req.user._id.toString(), body);
    }
    async uploadGroupAvatarOnly(req, file) {
        await this.uploadValidationService.validateImageUpload(file, {
            label: 'Guruh rasmi',
        });
        return this.chatsService.uploadGroupAvatarOnly(file);
    }
    async uploadAvatar(req, id, file) {
        await this.uploadValidationService.validateImageUpload(file, {
            label: 'Chat rasmi',
        });
        return this.chatsService.updateAvatar(id, req.user._id.toString(), file);
    }
    startVideoCall(req, id) {
        return this.chatsService.startVideoCall(id, req.user._id.toString());
    }
    endVideoCall(req, id) {
        return this.chatsService.endVideoCall(id, req.user._id.toString());
    }
    getCallStatus(id) {
        return this.chatsService.getCallStatus(id);
    }
    requestJoin(id, body) {
        return this.chatsService.requestJoin(id, body.name, body.userId);
    }
    getJoinRequestStatus(id, requestId) {
        return this.chatsService.getJoinRequestStatus(id, requestId);
    }
    getJoinRequests(req, id) {
        return this.chatsService.getJoinRequests(id, req.user._id.toString());
    }
    respondToJoinRequest(req, id, requestId, body) {
        return this.chatsService.respondToJoinRequest(id, requestId, body.approved, req.user._id.toString());
    }
    leaveChat(req, id) {
        return this.chatsService.leaveChat(id, req.user._id.toString());
    }
    deleteChat(req, id) {
        return this.chatsService.deleteChat(id, req.user._id.toString());
    }
};
exports.ChatsController = ChatsController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "getUserChats", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chat_dto_1.CreateChatDto]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "createChat", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('preview/:privateurl'),
    __param(0, (0, common_1.Param)('privateurl')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "previewGroup", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('resolve/:slug'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "resolveSlug", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('search/users'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "searchPrivateUsers", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('search/groups'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "searchGroups", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "getChat", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/messages'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "getChatMessages", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/messages'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, chat_dto_1.SendMessageDto]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Put)('messages/:messageId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, chat_dto_1.EditMessageDto]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "editMessage", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('messages/:messageId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "deleteMessage", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/join-link'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "joinGroupByLink", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, chat_dto_1.EditChatDto]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "editChat", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('upload-avatar'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.createSafeSingleFileMulterOptions)(app_limits_1.APP_LIMITS.homeworkPhotoBytes))),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "uploadGroupAvatarOnly", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/avatar'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.createSafeSingleFileMulterOptions)(app_limits_1.APP_LIMITS.homeworkPhotoBytes))),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "uploadAvatar", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/call/start'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "startVideoCall", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id/call'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "endVideoCall", null);
__decorate([
    (0, common_1.Get)(':id/call/status'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "getCallStatus", null);
__decorate([
    (0, common_1.Post)(':id/call/join'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, chat_dto_1.RequestJoinCallDto]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "requestJoin", null);
__decorate([
    (0, common_1.Get)(':id/call/join/:requestId/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('requestId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "getJoinRequestStatus", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/call/requests'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "getJoinRequests", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/call/requests/:requestId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('requestId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, chat_dto_1.RespondJoinRequestDto]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "respondToJoinRequest", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/leave'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "leaveChat", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "deleteChat", null);
exports.ChatsController = ChatsController = __decorate([
    (0, common_1.Controller)('chats'),
    __metadata("design:paramtypes", [chats_service_1.ChatsService,
        upload_validation_service_1.UploadValidationService])
], ChatsController);
//# sourceMappingURL=chats.controller.js.map