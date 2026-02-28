import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { ChatDocument } from './schemas/chat.schema';
import { MessageDocument } from './schemas/message.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { ChatsGateway } from './chats.gateway';
import { R2Service } from '../common/services/r2.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PremiumService } from '../premium/premium.service';
export declare class ChatsService implements OnModuleInit {
    private chatModel;
    private messageModel;
    private userModel;
    private chatsGateway;
    private r2Service;
    private encryptionService;
    private premiumService;
    constructor(chatModel: Model<ChatDocument>, messageModel: Model<MessageDocument>, userModel: Model<UserDocument>, chatsGateway: ChatsGateway, r2Service: R2Service, encryptionService: EncryptionService, premiumService: PremiumService);
    onModuleInit(): Promise<void>;
    private backfillAdmins;
    private backfillPrivateUrls;
    private generateJammId;
    private backfillJammIds;
    private getEncryptionStrategy;
    private decryptMessage;
    getUserChats(userId: string): Promise<any[]>;
    createChat(userId: string, dto: {
        isGroup: boolean;
        name?: string;
        description?: string;
        avatar?: string;
        memberIds: string[];
    }): Promise<ChatDocument>;
    hasPermission(chat: any, userId: string, permission: string): boolean;
    editChat(chatId: string, userId: string, dto: {
        name?: string;
        description?: string;
        avatar?: string;
        members?: string[];
        admins?: {
            userId: string;
            permissions: string[];
        }[];
    }): Promise<ChatDocument>;
    updateAvatar(chatId: string, userId: string, file: Express.Multer.File): Promise<string>;
    uploadGroupAvatarOnly(file: Express.Multer.File): Promise<string>;
    getChat(chatId: string, userId: string): Promise<ChatDocument>;
    previewGroup(slugOrId: string): Promise<{
        id: string;
        privateurl: string | undefined;
        name: string | undefined;
        avatar: string | undefined;
        description: string | undefined;
        memberCount: number;
        isGroup: boolean;
    }>;
    resolveSlug(slug: string, currentUserId: string): Promise<{
        jammId: number;
    }>;
    joinGroupByLink(slugOrId: string, userId: string): Promise<ChatDocument>;
    getChatMessages(chatId: string, userId: string): Promise<MessageDocument[]>;
    sendMessage(chatId: string, userId: string, content: string, replayToId?: string): Promise<MessageDocument>;
    editMessage(messageId: string, userId: string, newContent: string): Promise<MessageDocument>;
    deleteMessage(messageId: string, userId: string): Promise<MessageDocument>;
    markMessagesAsRead(chatId: string, userId: string, messageIds: string[]): Promise<void>;
    startVideoCall(chatId: string, userId: string): Promise<{
        roomId: string;
    }>;
    endVideoCall(chatId: string, userId: string): Promise<void>;
    getCallStatus(chatId: string): Promise<{
        active: boolean;
        roomId?: string;
        creatorId?: string;
    }>;
    requestJoin(chatId: string, name: string, userId?: string): Promise<{
        requestId: string;
    }>;
    getJoinRequests(chatId: string, userId: string): Promise<import("./schemas/chat.schema").JoinRequest[]>;
    respondToJoinRequest(chatId: string, requestId: string, approved: boolean, userId: string): Promise<void>;
    getJoinRequestStatus(chatId: string, requestId: string): Promise<{
        status: 'pending' | 'approved' | 'rejected';
        roomId?: string;
    }>;
}
