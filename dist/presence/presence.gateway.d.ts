import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Model } from 'mongoose';
import { RedisPresenceService } from './redis-presence.service';
import { UserDocument } from '../users/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
export declare class PresenceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly redisPresence;
    private readonly jwtService;
    private readonly configService;
    private readonly userModel;
    server: Server;
    private readonly logger;
    constructor(redisPresence: RedisPresenceService, jwtService: JwtService, configService: ConfigService, userModel: Model<UserDocument>);
    afterInit(): Promise<void>;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleHeartbeat(client: Socket): Promise<{
        event: string;
        data: {
            status: string;
        };
    } | undefined>;
}
