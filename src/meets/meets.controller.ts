import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MeetsService } from './meets.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('meets')
@UseGuards(JwtAuthGuard)
export class MeetsController {
  constructor(private readonly meetsService: MeetsService) {}

  @Post()
  async createMeet(
    @Req() req,
    @Body() body: { roomId: string; title: string; isPrivate: boolean },
  ) {
    return this.meetsService.create({
      roomId: body.roomId,
      title: body.title,
      isPrivate: body.isPrivate,
      creator: req.user._id,
    });
  }

  @Get()
  async getMyMeets(@Req() req) {
    return this.meetsService.findByCreator(req.user._id);
  }

  @Delete(':roomId')
  async removeMeet(@Req() req, @Param('roomId') roomId: string) {
    await this.meetsService.remove(roomId, req.user._id);
    return { success: true };
  }
}
