import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { ChatsService } from '../chats/chats.service';
import { ProfileDecoration, ProfileDecorationDocument } from './schemas/profile-decoration.schema';
import { R2Service } from '../common/services/r2.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
export declare class UsersService {
    private userModel;
    private profileDecorationModel;
    private r2Service;
    private chatsService;
    private appSettingsService;
    private readonly defaultProfileDecorations;
    constructor(userModel: Model<UserDocument>, profileDecorationModel: Model<ProfileDecorationDocument>, r2Service: R2Service, chatsService: ChatsService, appSettingsService: AppSettingsService);
    private ensureDefaultProfileDecorations;
    getProfileDecorations(): Promise<(ProfileDecoration & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    updateProfileDecoration(userId: string, decorationId?: string | null): Promise<(User & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    updateProfileDecorationImage(userId: string, file: Express.Multer.File): Promise<(User & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    create(createUserDto: CreateUserDto): Promise<UserDocument>;
    findByEmail(email: string): Promise<UserDocument | null>;
    findById(id: string): Promise<UserDocument | null>;
    findByUsername(username: string): Promise<UserDocument | null>;
    findByVerificationToken(token: string): Promise<UserDocument | null>;
    searchUsers(query: string, currentUserId: string): Promise<any[]>;
    searchGlobal(query: string, currentUserId: string): Promise<any[]>;
    getAllUsers(currentUserId: string): Promise<any[]>;
    updateProfile(userId: string, data: {
        nickname?: string;
        username?: string;
        phone?: string;
        avatar?: string;
        bio?: string;
    }): Promise<UserDocument | null>;
    updateAvatar(userId: string, file: Express.Multer.File): Promise<UserDocument | null>;
    toggleFollow(currentUserId: string, targetUserId: string): Promise<{
        following: boolean;
        followersCount: number;
    }>;
    getPublicProfile(identifier: string, currentUserId?: string): Promise<any>;
    completeOnboarding(userId: string, data: Record<string, any>): Promise<UserDocument | null>;
}
