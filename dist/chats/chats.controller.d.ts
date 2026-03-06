import { ChatsService } from './chats.service';
export declare class ChatsController {
    private readonly chatsService;
    constructor(chatsService: ChatsService);
    getUserChats(req: any, page?: number, limit?: number): Promise<{
        data: {
            _id: any;
            jammId: any;
            name: any;
            description: any;
            avatar: any;
            isGroup: any;
            privateurl: any;
            members: any;
            createdBy: any;
            admins: any;
            isSavedMessages: any;
            urlSlug: any;
            lastMessage: string | undefined;
            lastMessageAt: any;
            updatedAt: any;
            createdAt: any;
            unreadCount: number;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    createChat(req: any, dto: {
        isGroup: boolean;
        name?: string;
        description?: string;
        avatar?: string;
        memberIds: string[];
    }): Promise<import("./schemas/chat.schema").ChatDocument>;
    previewGroup(privateurl: string): Promise<{
        id: string;
        privateurl: string | undefined;
        name: string | undefined;
        avatar: string | undefined;
        description: string | undefined;
        memberCount: number;
        isGroup: boolean;
    }>;
    resolveSlug(req: any, slug: string): Promise<{
        jammId: number;
    }>;
    getChat(req: any, id: string): Promise<import("./schemas/chat.schema").ChatDocument>;
    getChatMessages(req: any, id: string, page?: number, limit?: number): Promise<any>;
    sendMessage(req: any, id: string, body: {
        content: string;
        replayToId?: string;
    }): Promise<import("./schemas/message.schema").MessageDocument>;
    editMessage(req: any, messageId: string, body: {
        content: string;
    }): Promise<import("./schemas/message.schema").MessageDocument>;
    deleteMessage(req: any, messageId: string): Promise<import("./schemas/message.schema").MessageDocument>;
    joinGroupByLink(req: any, id: string): Promise<import("./schemas/chat.schema").ChatDocument>;
    editChat(req: any, id: string, body: {
        name?: string;
        description?: string;
        avatar?: string;
        members?: string[];
        admins?: {
            userId: string;
            permissions: string[];
        }[];
    }): Promise<import("./schemas/chat.schema").ChatDocument>;
    uploadGroupAvatarOnly(req: any, file: Express.Multer.File): Promise<string>;
    uploadAvatar(req: any, id: string, file: Express.Multer.File): Promise<string>;
    startVideoCall(req: any, id: string): Promise<{
        roomId: string;
    }>;
    endVideoCall(req: any, id: string): Promise<void>;
    getCallStatus(id: string): Promise<{
        active: boolean;
        roomId?: string;
        creatorId?: string;
    }>;
    requestJoin(id: string, body: {
        name: string;
        userId?: string;
    }): Promise<{
        requestId: string;
    }>;
    getJoinRequestStatus(id: string, requestId: string): Promise<{
        status: "pending" | "approved" | "rejected";
        roomId?: string;
    }>;
    getJoinRequests(req: any, id: string): Promise<import("./schemas/chat.schema").JoinRequest[]>;
    respondToJoinRequest(req: any, id: string, requestId: string, body: {
        approved: boolean;
    }): Promise<void>;
    leaveChat(req: any, id: string): Promise<{
        success: boolean;
    }>;
    deleteChat(req: any, id: string): Promise<{
        success: boolean;
    }>;
}
