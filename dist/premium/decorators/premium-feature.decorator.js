"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremiumFeature = exports.PREMIUM_FEATURE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PREMIUM_FEATURE_KEY = 'premium_feature';
const PremiumFeature = (feature) => (0, common_1.SetMetadata)(exports.PREMIUM_FEATURE_KEY, feature);
exports.PremiumFeature = PremiumFeature;
//# sourceMappingURL=premium-feature.decorator.js.map