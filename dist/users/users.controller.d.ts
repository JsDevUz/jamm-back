import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(req: any): Promise<any>;
    updateMe(req: any, body: {
        nickname?: string;
        username?: string;
        phone?: string;
        avatar?: string;
    }): Promise<import("./schemas/user.schema").UserDocument | null>;
    searchUsers(query: string, req: any): Promise<import("./schemas/user.schema").UserDocument[]>;
}
