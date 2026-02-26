import { Model } from 'mongoose';
import { ChatDocument } from './schemas/chat.schema';
import { MessageDocument } from './schemas/message.schema';
export declare class ChatsService {
    private chatModel;
    private messageModel;
    constructor(chatModel: Model<ChatDocument>, messageModel: Model<MessageDocument>);
    getUserChats(userId: string): Promise<ChatDocument[]>;
    createChat(userId: string, dto: {
        isGroup: boolean;
        name?: string;
        description?: string;
        avatar?: string;
        memberIds: string[];
    }): Promise<ChatDocument>;
    getChat(chatId: string, userId: string): Promise<ChatDocument>;
    getChatMessages(chatId: string, userId: string): Promise<MessageDocument[]>;
    sendMessage(chatId: string, userId: string, content: string, replayToId?: string): Promise<MessageDocument>;
    editMessage(messageId: string, userId: string, newContent: string): Promise<MessageDocument>;
    deleteMessage(messageId: string, userId: string): Promise<MessageDocument>;
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
