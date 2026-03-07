import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async signup(signupDto: SignupDto) {
    // Check if email already exists
    const existingEmail = await this.usersService.findByEmail(signupDto.email);
    if (existingEmail) {
      throw new ConflictException("Bu email allaqachon ro'yxatdan o'tgan");
    }

    // // Check if username already exists
    // const existingUsername = await this.usersService.findByUsername(
    //   signupDto.username,
    // );
    // if (existingUsername) {
    //   throw new ConflictException('Bu username allaqachon band');
    // }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(signupDto.password, salt);

    // Generate verification token
    const verificationToken = uuidv4();

    // Create user (unverified)
    const user = await this.usersService.create({
      ...signupDto,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
    );

    return {
      message:
        "Ro'yxatdan o'tish muvaffaqiyatli! Emailingizga tasdiqlash havolasi yuborildi.",
    };
  }

  async login(loginDto: LoginDto) {
    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
    }

    // Check if verified — only block users who explicitly have isVerified: false
    // (existing users from before this feature have isVerified: undefined, they should not be blocked)
    if (user.isVerified === false) {
      throw new UnauthorizedException(
        'Emailingiz tasdiqlanmagan. Iltimos, emailga kelgan havola orqali tasdiqlang.',
      );
    }

    if (user.isBlocked) {
      throw new HttpException(
        "Hisobingiz bloklangan. Qo'llab-quvvatlash bilan bog'laning.",
        HttpStatus.LOCKED,
      );
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
    }

    // Generate JWT
    const token = this.generateToken(user._id.toString(), user.email);

    return {
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByVerificationToken(token);
    if (!user) {
      throw new NotFoundException(
        "Tasdiqlash kodi noto'g'ri yoki allaqachon foydalanilgan",
      );
    }

    if (user.isBlocked) {
      throw new HttpException(
        "Hisobingiz bloklangan. Qo'llab-quvvatlash bilan bog'laning.",
        HttpStatus.LOCKED,
      );
    }

    // Mark as verified
    user.isVerified = true;
    (user as any).verificationToken = null;
    await (user as any).save();

    // Generate JWT for auto-login
    const jwt = this.generateToken(user._id.toString(), user.email);

    return {
      access_token: jwt,
      user: this.sanitizeUser(user),
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: any) {
    const { password, __v, ...sanitized } = user.toObject();
    return sanitized;
  }
}
