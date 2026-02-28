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
var PremiumCronService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremiumCronService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const subscription_schema_1 = require("./schemas/subscription.schema");
let PremiumCronService = PremiumCronService_1 = class PremiumCronService {
    userModel;
    subscriptionModel;
    logger = new common_1.Logger(PremiumCronService_1.name);
    interval;
    constructor(userModel, subscriptionModel) {
        this.userModel = userModel;
        this.subscriptionModel = subscriptionModel;
    }
    onModuleInit() {
        this.handleExpiration();
        this.interval = setInterval(() => {
            this.handleExpiration();
        }, 24 * 60 * 60 * 1000);
    }
    onModuleDestroy() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
    async handleExpiration() {
        this.logger.log('Starting daily premium expiration check...');
        const now = new Date();
        try {
            const subResult = await this.subscriptionModel.updateMany({
                status: 'active',
                expiresAt: { $lt: now },
            }, { status: 'expired' });
            const userResult = await this.userModel.updateMany({
                premiumStatus: 'active',
                premiumExpiresAt: { $lt: now },
            }, { premiumStatus: 'expired' });
            this.logger.log(`Checked expirations. Subscriptions updated: ${subResult.modifiedCount}, Users updated: ${userResult.modifiedCount}`);
        }
        catch (error) {
            this.logger.error('Failed to run monthly expiration check', error);
        }
    }
};
exports.PremiumCronService = PremiumCronService;
exports.PremiumCronService = PremiumCronService = PremiumCronService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(subscription_schema_1.Subscription.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], PremiumCronService);
//# sourceMappingURL=premium-cron.service.js.map