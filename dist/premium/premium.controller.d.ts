import { PremiumService } from './premium.service';
export declare class PremiumController {
    private readonly premiumService;
    constructor(premiumService: PremiumService);
    redeemPromo(req: any, code: string): Promise<{
        success: boolean;
        expiresAt: Date;
    }>;
    getStatus(req: any): Promise<{
        status: string;
    }>;
    getPlans(): Promise<import("./schemas/premium-plan.schema").PremiumPlan[]>;
}
