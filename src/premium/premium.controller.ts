import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { PremiumService } from './premium.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('premium')
export class PremiumController {
  constructor(private readonly premiumService: PremiumService) {}

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  async redeemPromo(@Req() req: any, @Body('code') code: string) {
    return this.premiumService.redeemPromo(req.user._id, code);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any) {
    const status = await this.premiumService.getPremiumStatus(req.user._id);
    return { status };
  }

  @Get('plans')
  async getPlans() {
    return this.premiumService.getPlans();
  }
}
