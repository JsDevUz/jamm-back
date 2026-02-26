import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    signup(signupDto: SignupDto): Promise<{
        access_token: string;
        user: any;
    }>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: any;
    }>;
    private generateToken;
    private sanitizeUser;
}
