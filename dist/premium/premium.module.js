"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremiumModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const premium_service_1 = require("./premium.service");
const premium_controller_1 = require("./premium.controller");
const user_schema_1 = require("../users/schemas/user.schema");
const promo_code_schema_1 = require("./schemas/promo-code.schema");
const premium_plan_schema_1 = require("./schemas/premium-plan.schema");
const subscription_schema_1 = require("./schemas/subscription.schema");
const presence_module_1 = require("../presence/presence.module");
const premium_cron_service_1 = require("./premium-cron.service");
let PremiumModule = class PremiumModule {
};
exports.PremiumModule = PremiumModule;
exports.PremiumModule = PremiumModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: promo_code_schema_1.PromoCode.name, schema: promo_code_schema_1.PromoCodeSchema },
                { name: premium_plan_schema_1.PremiumPlan.name, schema: premium_plan_schema_1.PremiumPlanSchema },
                { name: subscription_schema_1.Subscription.name, schema: subscription_schema_1.SubscriptionSchema },
            ]),
            presence_module_1.PresenceModule,
        ],
        providers: [premium_service_1.PremiumService, premium_cron_service_1.PremiumCronService],
        controllers: [premium_controller_1.PremiumController],
        exports: [premium_service_1.PremiumService],
    })
], PremiumModule);
//# sourceMappingURL=premium.module.js.map