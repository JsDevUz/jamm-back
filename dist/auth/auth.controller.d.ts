import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { AppSettingsService } from '../app-settings/app-settings.service';
export declare class AuthController {
    private authService;
    private configService;
    private appSettingsService;
    constructor(authService: AuthService, configService: ConfigService, appSettingsService: AppSettingsService);
    signup(signupDto: SignupDto): Promise<{
        message: string;
    }>;
    login(loginDto: LoginDto, res: Response): Promise<{
        user: any;
    }>;
    verify(req: any, res: Response): Promise<{
        user: any;
    }>;
    getMe(req: any): Promise<any>;
    logout(res: Response): Promise<{
        success: boolean;
    }>;
}
