import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatsService } from './chats.service';
export declare class ChatsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private readonly configService;
    private readonly chatsService;
    server: Server;
    private readonly logger;
    constructor(jwtService: JwtService, configService: ConfigService, chatsService: ChatsService);
    afterInit(): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleJoinChat(data: {
        chatId: string;
    }, client: Socket): {
        success: boolean;
        room: string;
    };
    handleLeaveChat(data: {
        chatId: string;
    }, client: Socket): {
        success: boolean;
        room: string;
    };
    handleReadMessages(data: {
        chatId: string;
        messageIds: string[];
    }, client: Socket): Promise<{
        success: boolean;
    }>;
    handleTypingStart(data: {
        chatId: string;
    }, client: Socket): void;
    handleTypingStop(data: {
        chatId: string;
    }, client: Socket): void;
}
