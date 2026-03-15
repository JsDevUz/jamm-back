import {
  BadRequestException,
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../common/services/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  private isAllowedAuthEmail(email: string) {
    return /^[^\s@]+@(gmail\.com|jamm\.uz)$/i.test(String(email || '').trim());
  }

  private normalizeGoogleNickname(name?: string | null, email?: string | null) {
    const trimmedName = String(name || '').trim();
    if (trimmedName) {
      return trimmedName.slice(0, 60);
    }

    const emailPrefix = String(email || '')
      .trim()
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .trim();

    return emailPrefix || "Do'st";
  }

  async signup(signupDto: SignupDto) {
    const normalizedEmail = signupDto.email.trim().toLowerCase();

    // Check if email already exists
    const existingEmail = await this.usersService.findByEmail(normalizedEmail);
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
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
    });

    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        verificationToken,
      );
    } catch (error) {
      await this.usersService.deleteById(user._id.toString());

      if (error instanceof HttpException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        "Tasdiqlash emailini yuborib bo'lmadi. Qaytadan urinib ko'ring.",
      );
    }

    return {
      message:
        "Ro'yxatdan o'tish muvaffaqiyatli! Emailingizga tasdiqlash havolasi yuborildi.",
    };
  }

  async login(loginDto: LoginDto) {
    const normalizedEmail = loginDto.email.trim().toLowerCase();

    // Find user by email
    const user = await this.usersService.findByEmail(normalizedEmail);
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

  async loginWithGoogleCode(code: string, redirectUri: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const clientSecret =
      this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Google auth hali sozlanmagan',
      );
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenResponse.json()) as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || !tokenData?.id_token) {
      throw new UnauthorizedException(
        tokenData?.error_description || 'Google auth tokenini olib bo‘lmadi',
      );
    }

    const verifyResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`,
    );
    const googleProfile = (await verifyResponse.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
    };

    if (!verifyResponse.ok) {
      throw new UnauthorizedException("Google tokenini tekshirib bo'lmadi");
    }

    if (googleProfile.aud !== clientId) {
      throw new UnauthorizedException("Google token mos kelmadi");
    }

    const normalizedEmail = String(googleProfile.email || '')
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      throw new UnauthorizedException('Google akkaunt email bermadi');
    }

    const isVerified =
      googleProfile.email_verified === true ||
      googleProfile.email_verified === 'true';

    if (!isVerified) {
      throw new UnauthorizedException('Google email tasdiqlanmagan');
    }

    if (!this.isAllowedAuthEmail(normalizedEmail)) {
      throw new UnauthorizedException(
        'Faqat gmail.com yoki jamm.uz email manzili ruxsat etiladi',
      );
    }

    let user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      const randomPassword = await bcrypt.hash(uuidv4(), 10);
      user = await this.usersService.create({
        email: normalizedEmail,
        password: randomPassword,
        nickname: this.normalizeGoogleNickname(
          googleProfile.name,
          normalizedEmail,
        ),
        isVerified: true,
        phone: '',
        username: undefined,
        ...(googleProfile.picture ? { avatar: googleProfile.picture } : {}),
      });
    } else {
      if (user.isBlocked) {
        throw new HttpException(
          "Hisobingiz bloklangan. Qo'llab-quvvatlash bilan bog'laning.",
          HttpStatus.LOCKED,
        );
      }

      let shouldSave = false;
      if (user.isVerified === false) {
        user.isVerified = true;
        user.verificationToken = null;
        shouldSave = true;
      }

      if (!String(user.nickname || '').trim()) {
        user.nickname = this.normalizeGoogleNickname(
          googleProfile.name,
          normalizedEmail,
        );
        shouldSave = true;
      }

      if (!String(user.avatar || '').trim() && googleProfile.picture) {
        user.avatar = googleProfile.picture;
        shouldSave = true;
      }

      if (shouldSave) {
        await user.save();
      }
    }

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

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const normalizedEmail = forgotPasswordDto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || user.isBlocked) {
      return {
        message:
          "Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasi yuborildi.",
      };
    }

    user.passwordResetToken = uuidv4();
    user.passwordResetExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();

    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        user.passwordResetToken,
      );
    } catch (error) {
      user.passwordResetToken = null;
      user.passwordResetExpiresAt = null;
      await user.save();

      if (error instanceof HttpException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        "Parolni tiklash emailini yuborib bo'lmadi. Keyinroq qayta urinib ko'ring.",
      );
    }

    return {
      message:
        "Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasi yuborildi.",
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.usersService.findByPasswordResetToken(
      resetPasswordDto.token,
    );

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        "Parolni tiklash havolasi noto'g'ri yoki muddati tugagan",
      );
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(resetPasswordDto.password, salt);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return {
      message: "Parolingiz muvaffaqiyatli yangilandi. Endi tizimga kiring.",
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: any) {
    const { password, __v, ...sanitized } = user.toObject();
    return {
      ...sanitized,
      appLockEnabled: Boolean(sanitized.appLockEnabled),
      selectedProfileDecorationId:
        sanitized.selectedProfileDecorationId || null,
      customProfileDecorationImage: sanitized.customProfileDecorationImage || null,
    };
  }
}
