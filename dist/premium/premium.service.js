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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PremiumService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremiumService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto = __importStar(require("crypto"));
const config_1 = require("@nestjs/config");
const user_schema_1 = require("../users/schemas/user.schema");
const promo_code_schema_1 = require("./schemas/promo-code.schema");
const premium_plan_schema_1 = require("./schemas/premium-plan.schema");
const subscription_schema_1 = require("./schemas/subscription.schema");
const redis_presence_service_1 = require("../presence/redis-presence.service");
let PremiumService = PremiumService_1 = class PremiumService {
    userModel;
    promoCodeModel;
    premiumPlanModel;
    subscriptionModel;
    configService;
    redisPresence;
    logger = new common_1.Logger(PremiumService_1.name);
    PREMIUM_CACHE_PREFIX = 'premium_status:';
    constructor(userModel, promoCodeModel, premiumPlanModel, subscriptionModel, configService, redisPresence) {
        this.userModel = userModel;
        this.promoCodeModel = promoCodeModel;
        this.premiumPlanModel = premiumPlanModel;
        this.subscriptionModel = subscriptionModel;
        this.configService = configService;
        this.redisPresence = redisPresence;
    }
    async onModuleInit() {
        await this.seedPlans();
    }
    async seedPlans() {
        const plansCount = await this.premiumPlanModel.countDocuments();
        if (plansCount === 0) {
            const defaultPlans = [
                {
                    name: '1 Oy',
                    durationInDays: 30,
                    price: 5,
                    features: ['group_limit_10', 'priority_support'],
                },
                {
                    name: '3 Oy',
                    durationInDays: 90,
                    price: 12,
                    features: ['group_limit_10', 'priority_support'],
                },
                {
                    name: '6 Oy',
                    durationInDays: 180,
                    price: 20,
                    features: ['group_limit_10', 'priority_support'],
                },
                {
                    name: '12 Oy',
                    durationInDays: 365,
                    price: 35,
                    features: ['group_limit_10', 'priority_support'],
                },
            ];
            await this.premiumPlanModel.create(defaultPlans);
            this.logger.log('Default premium plans seeded');
        }
    }
    hashPromoCode(code) {
        const salt = this.configService.get('PROMO_SALT') || 'default-promo-salt-!!';
        return crypto.createHmac('sha256', salt).update(code).digest('hex');
    }
    async redeemPromo(userId, code) {
        const hashedCode = this.hashPromoCode(code);
        const now = new Date();
        const user = await this.userModel.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (user.hasUsedPromo) {
            throw new common_1.BadRequestException('Siz allaqachon promo-koddan foydalangansiz');
        }
        const promo = await this.promoCodeModel.findOne({
            code: hashedCode,
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now },
        });
        if (!promo) {
            throw new common_1.BadRequestException("Promo-kod yaroqsiz yoki muddati o'tgan");
        }
        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
            throw new common_1.BadRequestException('Promo-kod foydalanish limiti tugagan');
        }
        const promoUpdate = await this.promoCodeModel.findOneAndUpdate({ _id: promo._id, usedCount: promo.usedCount }, { $inc: { usedCount: 1 } }, { new: true });
        if (!promoUpdate) {
            throw new common_1.BadRequestException('Afsuski, promo-kod hozirgina tugadi');
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await this.userModel.findByIdAndUpdate(userId, {
            premiumStatus: 'active',
            premiumExpiresAt: expiresAt,
            hasUsedPromo: true,
        });
        await this.subscriptionModel.create({
            userId: new mongoose_2.Types.ObjectId(userId),
            startedAt: now,
            expiresAt: expiresAt,
            status: 'active',
            paymentProvider: 'promo',
        });
        const redis = this.redisPresence.getInternalClient();
        await redis.set(`${this.PREMIUM_CACHE_PREFIX}${userId}`, 'active', 'EX', 3600);
        this.logger.log(`User ${userId} redeemed promo code`);
        return { success: true, expiresAt };
    }
    async getPremiumStatus(userId) {
        const redis = this.redisPresence.getInternalClient();
        const cached = await redis.get(`${this.PREMIUM_CACHE_PREFIX}${userId}`);
        if (cached)
            return cached;
        const user = await this.userModel
            .findById(userId)
            .select('premiumStatus premiumExpiresAt');
        if (!user)
            return 'none';
        const now = new Date();
        if (user.premiumStatus === 'active' &&
            user.premiumExpiresAt &&
            user.premiumExpiresAt > now) {
            await redis.set(`${this.PREMIUM_CACHE_PREFIX}${userId}`, 'active', 'EX', 3600);
            return 'active';
        }
        if (user.premiumStatus === 'active') {
            await this.userModel.findByIdAndUpdate(userId, {
                premiumStatus: 'expired',
            });
        }
        await redis.set(`${this.PREMIUM_CACHE_PREFIX}${userId}`, 'none', 'EX', 3600);
        return 'none';
    }
    async hasFeature(userId, feature) {
        const status = await this.getPremiumStatus(userId);
        if (status !== 'active')
            return false;
        return true;
    }
    async getPlans() {
        return this.premiumPlanModel.find().exec();
    }
};
exports.PremiumService = PremiumService;
exports.PremiumService = PremiumService = PremiumService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(promo_code_schema_1.PromoCode.name)),
    __param(2, (0, mongoose_1.InjectModel)(premium_plan_schema_1.PremiumPlan.name)),
    __param(3, (0, mongoose_1.InjectModel)(subscription_schema_1.Subscription.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        config_1.ConfigService,
        redis_presence_service_1.RedisPresenceService])
], PremiumService);
//# sourceMappingURL=premium.service.js.map