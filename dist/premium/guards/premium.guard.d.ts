import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PremiumService } from '../premium.service';
export declare class PremiumGuard implements CanActivate {
    private reflector;
    private premiumService;
    constructor(reflector: Reflector, premiumService: PremiumService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
