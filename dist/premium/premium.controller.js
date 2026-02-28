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
exports.PremiumController = void 0;
const common_1 = require("@nestjs/common");
const premium_service_1 = require("./premium.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let PremiumController = class PremiumController {
    premiumService;
    constructor(premiumService) {
        this.premiumService = premiumService;
    }
    async redeemPromo(req, code) {
        return this.premiumService.redeemPromo(req.user._id, code);
    }
    async getStatus(req) {
        const status = await this.premiumService.getPremiumStatus(req.user._id);
        return { status };
    }
    async getPlans() {
        return this.premiumService.getPlans();
    }
};
exports.PremiumController = PremiumController;
__decorate([
    (0, common_1.Post)('redeem'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PremiumController.prototype, "redeemPromo", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PremiumController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('plans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PremiumController.prototype, "getPlans", null);
exports.PremiumController = PremiumController = __decorate([
    (0, common_1.Controller)('premium'),
    __metadata("design:paramtypes", [premium_service_1.PremiumService])
], PremiumController);
//# sourceMappingURL=premium.controller.js.map