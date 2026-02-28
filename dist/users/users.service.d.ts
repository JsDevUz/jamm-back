import { Model } from 'mongoose';
import { UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { R2Service } from '../common/services/r2.service';
export declare class UsersService {
    private userModel;
    private r2Service;
    constructor(userModel: Model<UserDocument>, r2Service: R2Service);
    create(createUserDto: CreateUserDto): Promise<UserDocument>;
    findByEmail(email: string): Promise<UserDocument | null>;
    findById(id: string): Promise<UserDocument | null>;
    findByUsername(username: string): Promise<UserDocument | null>;
    searchUsers(query: string, currentUserId: string): Promise<UserDocument[]>;
    updateProfile(userId: string, data: {
        nickname?: string;
        username?: string;
        phone?: string;
        avatar?: string;
    }): Promise<UserDocument | null>;
    updateAvatar(userId: string, file: Express.Multer.File): Promise<UserDocument | null>;
}
