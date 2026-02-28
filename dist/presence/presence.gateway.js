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
let PresenceGateway = PresenceGateway_1 = class PresenceGateway {
    redisPresence;
    jwtService;
    configService;
    userModel;
    server;
    logger = new common_1.Logger(PresenceGateway_1.name);
    constructor(redisPresence, jwtService, configService, userModel) {
        this.redisPresence = redisPresence;
        this.jwtService = jwtService;
        this.configService = configService;
        this.userModel = userModel;
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
            const token = client.handshake?.auth?.token ||
                client.handshake?.query?.token;
            if (!token) {
                this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
                client.disconnect(true);
                return;
            }
            const secret = this.configService.get('JWT_SECRET') || 'fallback-secret';
            const payload = await this.jwtService.verifyAsync(token, { secret });
            const userId = payload.sub;
            client.data.user = { _id: userId, email: payload.email };
            client.join(`user:${userId}`);
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
        await this.redisPresence.refreshTTL(userId);
        return { event: 'presence:pong', data: { status: 'ok' } };
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
exports.PresenceGateway = PresenceGateway = PresenceGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/presence',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:3000'],
            credentials: true,
        },
    }),
    __param(3, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [redis_presence_service_1.RedisPresenceService,
        jwt_1.JwtService,
        config_1.ConfigService,
        mongoose_2.Model])
], PresenceGateway);
//# sourceMappingURL=presence.gateway.js.map