import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Model } from 'mongoose';
import { RedisPresenceService } from './redis-presence.service';
import { UserDocument } from '../users/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppSettingsService } from '../app-settings/app-settings.service';
export declare class PresenceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly redisPresence;
    private readonly jwtService;
    private readonly configService;
    private readonly userModel;
    private readonly appSettingsService;
    server: Server;
    private readonly logger;
    private readonly rateLimiter;
    constructor(redisPresence: RedisPresenceService, jwtService: JwtService, configService: ConfigService, userModel: Model<UserDocument>, appSettingsService: AppSettingsService);
    afterInit(): Promise<void>;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleHeartbeat(client: Socket): Promise<{
        event: string;
        data: {
            status: string;
        };
    } | undefined>;
    handleCallRequest(client: Socket, data: {
        toUserId: string;
        roomId: string;
        callType?: string;
    }): Promise<void>;
    handleCallAccept(client: Socket, data: {
        toUserId: string;
        roomId: string;
    }): Promise<void>;
    handleCallReject(client: Socket, data: {
        toUserId: string;
        roomId: string;
        reason?: string;
    }): Promise<void>;
    handleCallCancel(client: Socket, data: {
        toUserId: string;
        roomId: string;
    }): Promise<void>;
}
