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
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateChatDto,
  EditChatDto,
  EditMessageDto,
  RequestJoinCallDto,
  RespondJoinRequestDto,
  SendMessageDto,
} from './dto/chat.dto';
import { UploadValidationService } from '../common/uploads/upload-validation.service';
import { createSafeSingleFileMulterOptions } from '../common/uploads/multer-options';
import { APP_LIMITS } from '../common/limits/app-limits';

@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly uploadValidationService: UploadValidationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getUserChats(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatsService.getUserChats(req.user._id.toString(), {
      page: Number(page) || 1,
      limit: Number(limit) || 15,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createChat(
    @Request() req,
    @Body() dto: CreateChatDto,
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
  @Get('search/users')
  searchPrivateUsers(
    @Request() req,
    @Query('q') query?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatsService.searchPrivateUsers(
      req.user._id.toString(),
      query || '',
      Number(limit) || 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('search/groups')
  searchGroups(
    @Request() req,
    @Query('q') query?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatsService.searchUserGroups(
      req.user._id.toString(),
      query || '',
      Number(limit) || 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getChat(@Request() req, @Param('id') id: string) {
    return this.chatsService.getChat(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  getChatMessages(
    @Request() req,
    @Param('id') id: string,
    @Query('before') before?: string,
  ) {
    return this.chatsService.getChatMessages(
      id,
      req.user._id.toString(),
      before,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  sendMessage(
    @Request() req,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
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
    @Body() body: EditMessageDto,
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
    @Body() body: EditChatDto,
  ) {
    return this.chatsService.editChat(id, req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(
      'file',
      createSafeSingleFileMulterOptions(APP_LIMITS.homeworkPhotoBytes),
    ),
  )
  async uploadGroupAvatarOnly(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.uploadValidationService.validateImageUpload(file, {
      label: 'Guruh rasmi',
    });
    return this.chatsService.uploadGroupAvatarOnly(file);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(
      'file',
      createSafeSingleFileMulterOptions(APP_LIMITS.homeworkPhotoBytes),
    ),
  )
  async uploadAvatar(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.uploadValidationService.validateImageUpload(file, {
      label: 'Chat rasmi',
    });
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
    @Body() body: RequestJoinCallDto,
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
    @Body() body: RespondJoinRequestDto,
  ) {
    return this.chatsService.respondToJoinRequest(
      id,
      requestId,
      body.approved,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  leaveChat(@Request() req, @Param('id') id: string) {
    return this.chatsService.leaveChat(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteChat(@Request() req, @Param('id') id: string) {
    return this.chatsService.deleteChat(id, req.user._id.toString());
  }
}
