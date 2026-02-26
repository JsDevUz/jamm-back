import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async getUserChats(userId: string): Promise<ChatDocument[]> {
    return this.chatModel
      .find({ members: new Types.ObjectId(userId) })
      .populate('members', 'username nickname avatar')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async createChat(
    userId: string,
    dto: {
      isGroup: boolean;
      name?: string;
      description?: string;
      avatar?: string;
      memberIds: string[];
    },
  ): Promise<ChatDocument> {
    const members = [
      new Types.ObjectId(userId),
      ...dto.memberIds.map((id) => new Types.ObjectId(id)),
    ];

    if (!dto.isGroup && members.length === 2) {
      const existing = await this.chatModel
        .findOne({
          isGroup: false,
          members: { $all: members, $size: 2 },
        })
        .exec();

      if (existing) return existing;
    }

    return this.chatModel.create({
      ...dto,
      members,
    });
  }

  async getChat(chatId: string, userId: string): Promise<ChatDocument> {
    const chat = await this.chatModel
      .findOne({
        _id: chatId,
        members: new Types.ObjectId(userId),
      })
      .populate('members', 'username nickname avatar')
      .exec();

    if (!chat) throw new NotFoundException("Chat topilmadi yoki huquq yo'q");
    return chat;
  }

  async getChatMessages(
    chatId: string,
    userId: string,
  ): Promise<MessageDocument[]> {
    await this.getChat(chatId, userId);

    return this.messageModel
      .find({ chatId: new Types.ObjectId(chatId) })
      .populate('senderId', 'username nickname avatar')
      .populate({
        path: 'replayTo',
        populate: {
          path: 'senderId',
          select: 'username nickname avatar',
        },
      })
      .sort({ createdAt: 1 })
      .exec();
  }

  async sendMessage(
    chatId: string,
    userId: string,
    content: string,
    replayToId?: string,
  ): Promise<MessageDocument> {
    await this.getChat(chatId, userId);

    const messageData: any = {
      chatId: new Types.ObjectId(chatId),
      senderId: new Types.ObjectId(userId),
      content,
    };

    if (replayToId) {
      messageData.replayTo = new Types.ObjectId(replayToId);
    }

    const message = await this.messageModel.create(messageData);

    await this.chatModel.findByIdAndUpdate(chatId, {
      lastMessage: content,
      lastMessageAt: new Date(),
    });

    return message.populate([
      { path: 'senderId', select: 'username nickname avatar' },
      {
        path: 'replayTo',
        populate: { path: 'senderId', select: 'username nickname avatar' },
      },
    ]);
  }

  async editMessage(
    messageId: string,
    userId: string,
    newContent: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Xabar topilmadi');

    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException(
        "Siz faqat o'z xabarlaringizni tahrirlay olasiz",
      );
    }

    if (message.isDeleted) {
      throw new ForbiddenException("O'chirilgan xabarni tahrirlab bo'lmaydi");
    }

    message.content = newContent;
    message.isEdited = true;
    await message.save();

    return message.populate([
      { path: 'senderId', select: 'username nickname avatar' },
      {
        path: 'replayTo',
        populate: { path: 'senderId', select: 'username nickname avatar' },
      },
    ]);
  }

  async deleteMessage(
    messageId: string,
    userId: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Xabar topilmadi');

    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException(
        "Siz faqat o'z xabarlaringizni o'chira olasiz",
      );
    }

    message.isDeleted = true;
    message.content = "Bu xabar o'chirildi";
    await message.save();

    return message.populate([
      { path: 'senderId', select: 'username nickname avatar' },
      {
        path: 'replayTo',
        populate: { path: 'senderId', select: 'username nickname avatar' },
      },
    ]);
  }

  // ─── Video Call Methods ─────────────────────────────────────────────────────

  async startVideoCall(
    chatId: string,
    userId: string,
  ): Promise<{ roomId: string }> {
    if (!Types.ObjectId.isValid(chatId)) {
      throw new BadRequestException(`Noto'g'ri chat ID: ${chatId}`);
    }
    // Verify user is a member of the chat
    await this.getChat(chatId, userId);

    // Generate a unique, URL-safe room ID
    const roomId = `jamm-${uuidv4().slice(0, 8)}`;

    await this.chatModel.findByIdAndUpdate(chatId, {
      videoCallRoomId: roomId,
      videoCallCreatorId: new Types.ObjectId(userId),
      joinRequests: [],
    });

    return { roomId };
  }

  async endVideoCall(chatId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(chatId))
      throw new BadRequestException("Noto'g'ri chat ID");
    const chat = await this.chatModel.findById(chatId);
    if (!chat) throw new NotFoundException('Chat topilmadi');

    if (chat.videoCallCreatorId?.toString() !== userId) {
      throw new ForbiddenException('Faqat creator callni tugatishi mumkin');
    }

    await this.chatModel.findByIdAndUpdate(chatId, {
      $unset: { videoCallRoomId: '', videoCallCreatorId: '' },
      $set: { joinRequests: [] },
    });
  }

  async getCallStatus(chatId: string): Promise<{
    active: boolean;
    roomId?: string;
    creatorId?: string;
  }> {
    if (!Types.ObjectId.isValid(chatId)) return { active: false };
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) throw new NotFoundException('Chat topilmadi');

    return {
      active: !!chat.videoCallRoomId,
      roomId: chat.videoCallRoomId,
      creatorId: chat.videoCallCreatorId?.toString(),
    };
  }

  async requestJoin(
    chatId: string,
    name: string,
    userId?: string,
  ): Promise<{ requestId: string }> {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) throw new NotFoundException('Chat topilmadi');
    if (!chat.videoCallRoomId) {
      throw new NotFoundException('Hech qanday faol call mavjud emas');
    }

    const requestId = new Types.ObjectId();

    await this.chatModel.findByIdAndUpdate(chatId, {
      $push: {
        joinRequests: {
          _id: requestId,
          name,
          userId: userId || null,
          status: 'pending',
          createdAt: new Date(),
        },
      },
    });

    return { requestId: requestId.toString() };
  }

  async getJoinRequests(chatId: string, userId: string) {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) throw new NotFoundException('Chat topilmadi');

    if (chat.videoCallCreatorId?.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat creator join so'rovlarini ko'rishi mumkin",
      );
    }

    return chat.joinRequests.filter((r) => r.status === 'pending');
  }

  async respondToJoinRequest(
    chatId: string,
    requestId: string,
    approved: boolean,
    userId: string,
  ): Promise<void> {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) throw new NotFoundException('Chat topilmadi');

    if (chat.videoCallCreatorId?.toString() !== userId) {
      throw new ForbiddenException('Faqat creator ruxsat bera oladi');
    }

    await this.chatModel.updateOne(
      { _id: chatId, 'joinRequests._id': new Types.ObjectId(requestId) },
      {
        $set: { 'joinRequests.$.status': approved ? 'approved' : 'rejected' },
      },
    );
  }

  async getJoinRequestStatus(
    chatId: string,
    requestId: string,
  ): Promise<{ status: 'pending' | 'approved' | 'rejected'; roomId?: string }> {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) throw new NotFoundException('Chat topilmadi');

    const request = chat.joinRequests.find(
      (r) => r._id.toString() === requestId,
    );
    if (!request) throw new NotFoundException("So'rov topilmadi");

    return {
      status: request.status,
      roomId: request.status === 'approved' ? chat.videoCallRoomId : undefined,
    };
  }
}
