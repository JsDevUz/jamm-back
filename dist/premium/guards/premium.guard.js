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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremiumGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const premium_service_1 = require("../premium.service");
const premium_feature_decorator_1 = require("../decorators/premium-feature.decorator");
let PremiumGuard = class PremiumGuard {
    reflector;
    premiumService;
    constructor(reflector, premiumService) {
        this.reflector = reflector;
        this.premiumService = premiumService;
    }
    async canActivate(context) {
        const feature = this.reflector.getAllAndOverride(premium_feature_decorator_1.PREMIUM_FEATURE_KEY, [context.getHandler(), context.getClass()]);
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user || !user.userId) {
            return false;
        }
        const premiumStatus = await this.premiumService.getPremiumStatus(user.userId);
        if (premiumStatus !== 'active') {
            throw new common_1.ForbiddenException('Ushbu amal uchun Premium obuna talab etiladi');
        }
        if (feature) {
            const hasFeature = await this.premiumService.hasFeature(user.userId, feature);
            if (!hasFeature) {
                throw new common_1.ForbiddenException(`Sizning tarifingizda "${feature}" imkoniyati mavjud emas`);
            }
        }
        return true;
    }
};
exports.PremiumGuard = PremiumGuard;
exports.PremiumGuard = PremiumGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        premium_service_1.PremiumService])
], PremiumGuard);
//# sourceMappingURL=premium.guard.js.map