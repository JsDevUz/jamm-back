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
var PresenceGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const redis_presence_service_1 = require("./redis-presence.service");
const ws_jwt_guard_1 = require("./guards/ws-jwt.guard");
const user_schema_1 = require("../users/schemas/user.schema");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const app_settings_service_1 = require("../app-settings/app-settings.service");
const cors_config_1 = require("../common/config/cors.config");
const ws_auth_util_1 = require("../common/auth/ws-auth.util");
const socket_rate_limiter_1 = require("../common/ws/socket-rate-limiter");
let PresenceGateway = PresenceGateway_1 = class PresenceGateway {
    redisPresence;
    jwtService;
    configService;
    userModel;
    appSettingsService;
    server;
    logger = new common_1.Logger(PresenceGateway_1.name);
    rateLimiter = new socket_rate_limiter_1.SocketRateLimiter();
    constructor(redisPresence, jwtService, configService, userModel, appSettingsService) {
        this.redisPresence = redisPresence;
        this.jwtService = jwtService;
        this.configService = configService;
        this.userModel = userModel;
        this.appSettingsService = appSettingsService;
    }
    async afterInit() {
        this.logger.log('PresenceGateway initialized on /presence namespace');
        await this.redisPresence.subscribeToStatusChanges((event) => {
            if (event.status === 'online') {
                this.server.emit('user_online', { userId: event.userId });
            }
            else {
                this.server.emit('user_offline', {
                    userId: event.userId,
                    lastSeen: new Date(event.timestamp).toISOString(),
                });
            }
        });
    }
    async handleConnection(client) {
        try {
            const payload = await (0, ws_auth_util_1.verifySocketToken)(this.jwtService, this.configService, client);
            if (!payload) {
                this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
                client.disconnect(true);
                return;
            }
            const userId = payload.sub;
            const user = await this.userModel
                .findById(userId)
                .select('username')
                .lean()
                .exec();
            const officialProfile = await this.appSettingsService.getOfficialProfileByUsername(user?.username);
            client.data.user = { _id: userId, email: payload.email };
            client.data.isOfficialProfile = Boolean(officialProfile?.hidePresence);
            client.join(`user:${userId}`);
            if (officialProfile?.hidePresence) {
                this.logger.log(`Official profile ${userId} connected silently`);
                return;
            }
            const deviceCount = await this.redisPresence.setOnline(userId);
            this.logger.log(`User ${userId} connected (socket: ${client.id}, devices: ${deviceCount})`);
        }
        catch (err) {
            this.logger.warn(`Connection auth failed: ${client.id} — ${err.message}`);
            client.disconnect(true);
        }
    }
    async handleDisconnect(client) {
        const userId = client.data?.user?._id;
        if (!userId)
            return;
        if (client.data?.isOfficialProfile)
            return;
        try {
            const remainingDevices = await this.redisPresence.removeDevice(userId);
            if (remainingDevices === 0) {
                await this.userModel.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } });
                this.logger.log(`User ${userId} fully offline, lastSeen updated`);
            }
            else {
                this.logger.log(`User ${userId} disconnected a device (socket: ${client.id}, remaining: ${remainingDevices})`);
            }
        }
        catch (err) {
            this.logger.error(`Error handling disconnect for ${userId}`, err);
        }
    }
    async handleHeartbeat(client) {
        const userId = client.data?.user?._id;
        if (!userId)
            return;
        this.rateLimiter.take(`presence:ping:${client.id}`, 240, 60_000);
        if (client.data?.isOfficialProfile) {
            return { event: 'presence:pong', data: { status: 'ok' } };
        }
        await this.redisPresence.refreshTTL(userId);
        return { event: 'presence:pong', data: { status: 'ok' } };
    }
    async handleCallRequest(client, data) {
        this.rateLimiter.take(`presence:call-request:${client.id}`, 15, 60_000);
        const fromUserId = client.data.user._id;
        const { toUserId, roomId, callType = 'video' } = data;
        this.logger.log(`Call request from ${fromUserId} to ${toUserId} (room: ${roomId})`);
        const sender = await this.userModel
            .findById(fromUserId)
            .select('nickname username avatar')
            .lean();
        const targetUser = await this.userModel
            .findById(toUserId)
            .select('username')
            .lean()
            .exec();
        const officialProfile = await this.appSettingsService.getOfficialProfileByUsername(targetUser?.username);
        if (officialProfile?.disableCalls) {
            this.server.to(`user:${fromUserId}`).emit('call:rejected', {
                fromUserId: toUserId,
                roomId,
                reason: 'official-profile',
            });
            return;
        }
        this.server.to(`user:${toUserId}`).emit('call:incoming', {
            fromUser: {
                _id: fromUserId,
                name: sender?.nickname || sender?.username || 'Unknown',
                avatar: sender?.avatar,
            },
            roomId,
            callType,
        });
    }
    async handleCallAccept(client, data) {
        this.rateLimiter.take(`presence:call-respond:${client.id}`, 30, 60_000);
        const fromUserId = client.data.user._id;
        this.server.to(`user:${data.toUserId}`).emit('call:accepted', {
            fromUserId,
            roomId: data.roomId,
        });
    }
    async handleCallReject(client, data) {
        this.rateLimiter.take(`presence:call-respond:${client.id}`, 30, 60_000);
        const fromUserId = client.data.user._id;
        this.server.to(`user:${data.toUserId}`).emit('call:rejected', {
            fromUserId,
            roomId: data.roomId,
            reason: data.reason || 'declined',
        });
    }
    async handleCallCancel(client, data) {
        this.rateLimiter.take(`presence:call-cancel:${client.id}`, 30, 60_000);
        const fromUserId = client.data.user._id;
        this.server.to(`user:${data.toUserId}`).emit('call:cancelled', {
            fromUserId,
            roomId: data.roomId,
        });
    }
};
exports.PresenceGateway = PresenceGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], PresenceGateway.prototype, "server", void 0);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('presence:ping'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], PresenceGateway.prototype, "handleHeartbeat", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('call:request'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], PresenceGateway.prototype, "handleCallRequest", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('call:accept'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], PresenceGateway.prototype, "handleCallAccept", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('call:reject'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], PresenceGateway.prototype, "handleCallReject", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('call:cancel'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], PresenceGateway.prototype, "handleCallCancel", null);
exports.PresenceGateway = PresenceGateway = PresenceGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/presence',
        cors: {
            origin: (0, cors_config_1.getAllowedOrigins)(),
            credentials: true,
        },
    }),
    __param(3, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [redis_presence_service_1.RedisPresenceService,
        jwt_1.JwtService,
        config_1.ConfigService,
        mongoose_2.Model,
        app_settings_service_1.AppSettingsService])
], PresenceGateway);
//# sourceMappingURL=presence.gateway.js.map