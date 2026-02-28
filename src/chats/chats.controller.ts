import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Optional,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getUserChats(@Request() req) {
    return this.chatsService.getUserChats(req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createChat(
    @Request() req,
    @Body()
    dto: {
      isGroup: boolean;
      name?: string;
      description?: string;
      avatar?: string;
      memberIds: string[];
    },
  ) {
    return this.chatsService.createChat(req.user._id.toString(), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('preview/:privateurl')
  previewGroup(@Param('privateurl') privateurl: string) {
    return this.chatsService.previewGroup(privateurl);
  }

  @UseGuards(JwtAuthGuard)
  @Get('resolve/:slug')
  resolveSlug(@Request() req, @Param('slug') slug: string) {
    return this.chatsService.resolveSlug(slug, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getChat(@Request() req, @Param('id') id: string) {
    return this.chatsService.getChat(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  getChatMessages(@Request() req, @Param('id') id: string) {
    return this.chatsService.getChatMessages(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  sendMessage(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { content: string; replayToId?: string },
  ) {
    return this.chatsService.sendMessage(
      id,
      req.user._id.toString(),
      body.content,
      body.replayToId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('messages/:messageId')
  editMessage(
    @Request() req,
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
  ) {
    return this.chatsService.editMessage(
      messageId,
      req.user._id.toString(),
      body.content,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('messages/:messageId')
  deleteMessage(@Request() req, @Param('messageId') messageId: string) {
    return this.chatsService.deleteMessage(messageId, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join-link')
  joinGroupByLink(@Request() req, @Param('id') id: string) {
    return this.chatsService.joinGroupByLink(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  editChat(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      avatar?: string;
      members?: string[];
      admins?: { userId: string; permissions: string[] }[];
    },
  ) {
    return this.chatsService.editChat(id, req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGroupAvatarOnly(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.chatsService.uploadGroupAvatarOnly(file);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.chatsService.updateAvatar(id, req.user._id.toString(), file);
  }

  // ─── Video Call Endpoints ──────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post(':id/call/start')
  startVideoCall(@Request() req, @Param('id') id: string) {
    return this.chatsService.startVideoCall(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/call')
  endVideoCall(@Request() req, @Param('id') id: string) {
    return this.chatsService.endVideoCall(id, req.user._id.toString());
  }

  // Public - anyone with chat ID can check status (needed for guest join link)
  @Get(':id/call/status')
  getCallStatus(@Param('id') id: string) {
    return this.chatsService.getCallStatus(id);
  }

  // Public - guests can request to join. Optional auth.
  @Post(':id/call/join')
  requestJoin(
    @Param('id') id: string,
    @Body() body: { name: string; userId?: string },
  ) {
    return this.chatsService.requestJoin(id, body.name, body.userId);
  }

  // Guest polls for their request status
  @Get(':id/call/join/:requestId/status')
  getJoinRequestStatus(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.chatsService.getJoinRequestStatus(id, requestId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/call/requests')
  getJoinRequests(@Request() req, @Param('id') id: string) {
    return this.chatsService.getJoinRequests(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/call/requests/:requestId')
  respondToJoinRequest(
    @Request() req,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() body: { approved: boolean },
  ) {
    return this.chatsService.respondToJoinRequest(
      id,
      requestId,
      body.approved,
      req.user._id.toString(),
    );
  }
}
