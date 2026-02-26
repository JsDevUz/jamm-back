import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    // Check if email already exists
    const existingEmail = await this.usersService.findByEmail(signupDto.email);
    if (existingEmail) {
      throw new ConflictException("Bu email allaqachon ro'yxatdan o'tgan");
    }

    // Check if username already exists
    const existingUsername = await this.usersService.findByUsername(
      signupDto.username,
    );
    if (existingUsername) {
      throw new ConflictException('Bu username allaqachon band');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(signupDto.password, salt);

    // Create user
    const user = await this.usersService.create({
      ...signupDto,
      password: hashedPassword,
    });

    // Generate JWT
    const token = this.generateToken(user._id.toString(), user.email);

    return {
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto) {
    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
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

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: any) {
    const { password, __v, ...sanitized } = user.toObject();
    return sanitized;
  }
}
