"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const uuid_1 = require("uuid");
const users_service_1 = require("../users/users.service");
const email_service_1 = require("../common/services/email.service");
let AuthService = class AuthService {
    usersService;
    jwtService;
    emailService;
    constructor(usersService, jwtService, emailService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.emailService = emailService;
    }
    async signup(signupDto) {
        const existingEmail = await this.usersService.findByEmail(signupDto.email);
        if (existingEmail) {
            throw new common_1.ConflictException("Bu email allaqachon ro'yxatdan o'tgan");
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(signupDto.password, salt);
        const verificationToken = (0, uuid_1.v4)();
        const user = await this.usersService.create({
            ...signupDto,
            password: hashedPassword,
            isVerified: false,
            verificationToken,
        });
        await this.emailService.sendVerificationEmail(user.email, verificationToken);
        return {
            message: "Ro'yxatdan o'tish muvaffaqiyatli! Emailingizga tasdiqlash havolasi yuborildi.",
        };
    }
    async login(loginDto) {
        const user = await this.usersService.findByEmail(loginDto.email);
        if (!user) {
            throw new common_1.UnauthorizedException("Email yoki parol noto'g'ri");
        }
        if (user.isVerified === false) {
            throw new common_1.UnauthorizedException('Emailingiz tasdiqlanmagan. Iltimos, emailga kelgan havola orqali tasdiqlang.');
        }
        if (user.isBlocked) {
            throw new common_1.HttpException("Hisobingiz bloklangan. Qo'llab-quvvatlash bilan bog'laning.", common_1.HttpStatus.LOCKED);
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException("Email yoki parol noto'g'ri");
        }
        const token = this.generateToken(user._id.toString(), user.email);
        return {
            access_token: token,
            user: this.sanitizeUser(user),
        };
    }
    async verifyEmail(token) {
        const user = await this.usersService.findByVerificationToken(token);
        if (!user) {
            throw new common_1.NotFoundException("Tasdiqlash kodi noto'g'ri yoki allaqachon foydalanilgan");
        }
        if (user.isBlocked) {
            throw new common_1.HttpException("Hisobingiz bloklangan. Qo'llab-quvvatlash bilan bog'laning.", common_1.HttpStatus.LOCKED);
        }
        user.isVerified = true;
        user.verificationToken = null;
        await user.save();
        const jwt = this.generateToken(user._id.toString(), user.email);
        return {
            access_token: jwt,
            user: this.sanitizeUser(user),
        };
    }
    generateToken(userId, email) {
        const payload = { sub: userId, email };
        return this.jwtService.sign(payload);
    }
    sanitizeUser(user) {
        const { password, __v, ...sanitized } = user.toObject();
        return sanitized;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        email_service_1.EmailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map