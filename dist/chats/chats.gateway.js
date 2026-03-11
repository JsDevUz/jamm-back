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
var ChatsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const ws_jwt_guard_1 = require("../presence/guards/ws-jwt.guard");
const chats_service_1 = require("./chats.service");
const cors_config_1 = require("../common/config/cors.config");
const ws_auth_util_1 = require("../common/auth/ws-auth.util");
const socket_rate_limiter_1 = require("../common/ws/socket-rate-limiter");
let ChatsGateway = ChatsGateway_1 = class ChatsGateway {
    jwtService;
    configService;
    chatsService;
    server;
    logger = new common_1.Logger(ChatsGateway_1.name);
    rateLimiter = new socket_rate_limiter_1.SocketRateLimiter();
    constructor(jwtService, configService, chatsService) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.chatsService = chatsService;
    }
    afterInit() {
        this.logger.log('ChatsGateway initialized on /chats namespace');
    }
    async handleConnection(client) {
        try {
            const payload = await (0, ws_auth_util_1.verifySocketToken)(this.jwtService, this.configService, client);
            if (!payload) {
                throw new Error('Authentication token missing');
            }
            client.data.user = {
                _id: payload.sub,
                email: payload.email,
            };
            client.join(`user_${payload.sub}`);
            this.logger.debug(`Client connected to /chats: ${client.id} (User: ${payload.sub})`);
        }
        catch (err) {
            this.logger.warn(`Connection rejected: invalid token (socket ${client.id})`);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        this.logger.debug(`Client disconnected from /chats: ${client.id}`);
    }
    handleJoinChat(data, client) {
        this.rateLimiter.take(`join_chat:${client.id}`, 20, 60_000);
        const room = `chat_${data.chatId}`;
        client.join(room);
        this.logger.debug(`Client ${client.id} joined room ${room}`);
        return { success: true, room };
    }
    handleLeaveChat(data, client) {
        this.rateLimiter.take(`leave_chat:${client.id}`, 30, 60_000);
        const room = `chat_${data.chatId}`;
        client.leave(room);
        this.logger.debug(`Client ${client.id} left room ${room}`);
        return { success: true, room };
    }
    async handleReadMessages(data, client) {
        this.rateLimiter.take(`read_messages:${client.id}`, 60, 60_000);
        if (!data.chatId || !data.messageIds || data.messageIds.length === 0) {
            return { success: false };
        }
        const userId = client.data.user._id;
        await this.chatsService.markMessagesAsRead(data.chatId, userId, data.messageIds);
        return { success: true };
    }
    handleTypingStart(data, client) {
        this.rateLimiter.take(`typing:${client.id}`, 120, 60_000);
        const userId = client.data.user._id;
        client.to(`chat_${data.chatId}`).emit('user_typing', {
            chatId: data.chatId,
            userId,
            isTyping: true,
        });
    }
    handleTypingStop(data, client) {
        this.rateLimiter.take(`typing:${client.id}`, 120, 60_000);
        const userId = client.data.user._id;
        client.to(`chat_${data.chatId}`).emit('user_typing', {
            chatId: data.chatId,
            userId,
            isTyping: false,
        });
    }
};
exports.ChatsGateway = ChatsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatsGateway.prototype, "server", void 0);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('join_chat'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleJoinChat", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('leave_chat'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleLeaveChat", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('read_messages'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatsGateway.prototype, "handleReadMessages", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('typing_start'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleTypingStart", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('typing_stop'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleTypingStop", null);
exports.ChatsGateway = ChatsGateway = ChatsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/chats',
        cors: { origin: (0, cors_config_1.getAllowedOrigins)(), credentials: true },
    }),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => chats_service_1.ChatsService))),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        chats_service_1.ChatsService])
], ChatsGateway);
//# sourceMappingURL=chats.gateway.js.map