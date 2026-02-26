import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    signup(signupDto: SignupDto): Promise<{
        access_token: string;
        user: any;
    }>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: any;
    }>;
    getMe(req: any): Promise<any>;
}
