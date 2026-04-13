import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MeetsService } from './meets.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateMeetDto, UpdateMeetPrivacyDto } from './dto/create-meet.dto';

@Controller('meets')
export class MeetsController {
  constructor(private readonly meetsService: MeetsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createMeet(
    @Req() req,
    @Body() body: CreateMeetDto,
  ) {
    return this.meetsService.create({
      roomId: body.roomId,
      title: body.title,
      isPrivate: body.isPrivate,
      creator: req.user._id,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyMeets(@Req() req) {
    return this.meetsService.findByCreator(req.user._id);
  }

  @Get('public/:roomId')
  async getMeetPublic(@Param('roomId') roomId: string) {
    return this.meetsService.findPublicByRoomId(roomId);
  }

  @Delete(':roomId')
  @UseGuards(JwtAuthGuard)
  async removeMeet(@Req() req, @Param('roomId') roomId: string) {
    await this.meetsService.remove(roomId, req.user._id);
    return { success: true };
  }

  @Patch(':roomId/privacy')
  @UseGuards(JwtAuthGuard)
  async updateMeetPrivacy(
    @Req() req,
    @Param('roomId') roomId: string,
    @Body() body: UpdateMeetPrivacyDto,
  ) {
    return this.meetsService.updatePrivacy(
      roomId,
      req.user._id,
      body.isPrivate,
    );
  }
}
