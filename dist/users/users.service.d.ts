import { Model } from 'mongoose';
import { UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
    private userModel;
    constructor(userModel: Model<UserDocument>);
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
}
