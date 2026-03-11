"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const signup_dto_1 = require("./dto/signup.dto");
const login_dto_1 = require("./dto/login.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const auth_cookie_util_1 = require("./auth-cookie.util");
const config_1 = require("@nestjs/config");
const app_settings_service_1 = require("../app-settings/app-settings.service");
let AuthController = class AuthController {
    authService;
    configService;
    appSettingsService;
    constructor(authService, configService, appSettingsService) {
        this.authService = authService;
        this.configService = configService;
        this.appSettingsService = appSettingsService;
    }
    async signup(signupDto) {
        return this.authService.signup(signupDto);
    }
    async login(loginDto, res) {
        const data = await this.authService.login(loginDto);
        res.cookie(auth_cookie_util_1.AUTH_COOKIE_NAME, data.access_token, (0, auth_cookie_util_1.buildAuthCookieOptions)(this.configService));
        return {
            user: await this.appSettingsService.decorateUserPayload(data.user),
        };
    }
    async verify(req, res) {
        const { token } = req.params;
        const data = await this.authService.verifyEmail(token);
        res.cookie(auth_cookie_util_1.AUTH_COOKIE_NAME, data.access_token, (0, auth_cookie_util_1.buildAuthCookieOptions)(this.configService));
        return {
            user: await this.appSettingsService.decorateUserPayload(data.user),
        };
    }
    async getMe(req) {
        const { password, __v, ...user } = req.user.toObject();
        return this.appSettingsService.decorateUserPayload(user);
    }
    async logout(res) {
        res.clearCookie(auth_cookie_util_1.AUTH_COOKIE_NAME, (0, auth_cookie_util_1.buildAuthCookieOptions)(this.configService));
        return { success: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('signup'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [signup_dto_1.SignupDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signup", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('verify/:token'),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60_000 } }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verify", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getMe", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService,
        app_settings_service_1.AppSettingsService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map