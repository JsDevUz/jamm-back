import { ChatsService } from './chats.service';
import { CreateChatDto, EditChatDto, EditMessageDto, RequestJoinCallDto, RespondJoinRequestDto, SendMessageDto } from './dto/chat.dto';
import { UploadValidationService } from '../common/uploads/upload-validation.service';
export declare class ChatsController {
    private readonly chatsService;
    private readonly uploadValidationService;
    constructor(chatsService: ChatsService, uploadValidationService: UploadValidationService);
    getUserChats(req: any, page?: number, limit?: number): Promise<{
        data: {
            _id: any;
            jammId: any;
            name: any;
            description: any;
            avatar: any;
            isGroup: any;
            privateurl: any;
            members: any[];
            createdBy: any;
            admins: any;
            isSavedMessages: any;
            urlSlug: any;
            lastMessage: string;
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
    createChat(req: any, dto: CreateChatDto): Promise<import("./schemas/chat.schema").ChatDocument>;
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
    searchPrivateUsers(req: any, query?: string, limit?: number): Promise<{
        id: any;
        name: any;
        username: any;
        avatar: any;
        premiumStatus: any;
        selectedProfileDecorationId: any;
        customProfileDecorationImage: any;
        isOfficialProfile: boolean;
        officialBadgeKey: any;
        officialBadgeLabel: any;
        disableCalls: boolean;
        disableGroupInvites: boolean;
    }[]>;
    searchGroups(req: any, query?: string, limit?: number): Promise<{
        id: string;
        urlSlug: string;
        name: string;
        avatar: string;
        membersCount: number;
        lastMessage: string;
        lastMessageAt: Date | null;
    }[]>;
    getChat(req: any, id: string): Promise<import("./schemas/chat.schema").ChatDocument>;
    getChatMessages(req: any, id: string, before?: string): Promise<any>;
    sendMessage(req: any, id: string, body: SendMessageDto): Promise<import("./schemas/message.schema").MessageDocument>;
    editMessage(req: any, messageId: string, body: EditMessageDto): Promise<import("./schemas/message.schema").MessageDocument>;
    deleteMessage(req: any, messageId: string): Promise<import("./schemas/message.schema").MessageDocument>;
    joinGroupByLink(req: any, id: string): Promise<import("./schemas/chat.schema").ChatDocument>;
    editChat(req: any, id: string, body: EditChatDto): Promise<import("./schemas/chat.schema").ChatDocument>;
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
    requestJoin(id: string, body: RequestJoinCallDto): Promise<{
        requestId: string;
    }>;
    getJoinRequestStatus(id: string, requestId: string): Promise<{
        status: "pending" | "approved" | "rejected";
        roomId?: string;
    }>;
    getJoinRequests(req: any, id: string): Promise<import("./schemas/chat.schema").JoinRequest[]>;
    respondToJoinRequest(req: any, id: string, requestId: string, body: RespondJoinRequestDto): Promise<void>;
    leaveChat(req: any, id: string): Promise<{
        success: boolean;
    }>;
    deleteChat(req: any, id: string): Promise<{
        success: boolean;
    }>;
}
