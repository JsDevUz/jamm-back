import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  Inject,
  forwardRef,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { v4 as uuidv4 } from 'uuid';
import { ChatsGateway } from './chats.gateway';
import { R2Service } from '../common/services/r2.service';

@Injectable()
export class ChatsService implements OnModuleInit {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => ChatsGateway)) private chatsGateway: ChatsGateway,
    private r2Service: R2Service,
  ) {}

  async onModuleInit() {
    await this.backfillJammIds();
    await this.backfillPrivateUrls();
    await this.backfillAdmins();
  }

  private async backfillAdmins() {
    const groupsWithoutOwner = await this.chatModel
      .find({ isGroup: true, createdBy: { $exists: false } })
      .exec();
    if (groupsWithoutOwner.length > 0) {
      console.log(
        `Backfilling createdBy for ${groupsWithoutOwner.length} groups...`,
      );
      for (const group of groupsWithoutOwner) {
        if (group.members && group.members.length > 0) {
          group.createdBy = group.members[0];
          await group.save();
        }
      }
      console.log('Finished backfilling createdBy.');
    }
  }

  private async backfillPrivateUrls() {
    const groupsWithoutUrl = await this.chatModel
      .find({ isGroup: true, privateurl: { $exists: false } })
      .exec();
    if (groupsWithoutUrl.length > 0) {
      console.log(
        `Backfilling privateurl for ${groupsWithoutUrl.length} groups...`,
      );
      for (const group of groupsWithoutUrl) {
        group.privateurl =
          Math.random().toString(36).substring(2, 10) +
          Math.random().toString(36).substring(2, 10);
        await group.save();
      }
      console.log('Finished backfilling privateurls.');
    }
  }

  private async generateJammId(): Promise<number> {
    let isUnique = false;
    let newId = 0;
    while (!isUnique) {
      newId = Math.floor(100000 + Math.random() * 900000);
      const exists = await this.chatModel.exists({ jammId: newId });
      if (!exists) {
        isUnique = true;
      }
    }
    return newId;
  }

  private async backfillJammIds() {
    const chatsWithoutId = await this.chatModel
      .find({ jammId: { $exists: false } })
      .exec();
    if (chatsWithoutId.length > 0) {
      console.log(`Backfilling jammId for ${chatsWithoutId.length} chats...`);
      for (const chat of chatsWithoutId) {
        chat.jammId = await this.generateJammId();
        await chat.save();
      }
      console.log('Finished backfilling jammIds.');
    }
  }

  async getUserChats(userId: string): Promise<any[]> {
    const chats = await this.chatModel
      .find({ members: new Types.ObjectId(userId) })
      .populate('members', 'username nickname avatar')
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await this.messageModel.countDocuments({
          chatId: chat._id as Types.ObjectId,
          senderId: { $ne: new Types.ObjectId(userId) },
          readBy: { $ne: new Types.ObjectId(userId) },
        });

        return {
          ...chat,
          unreadCount,
        };
      }),
    );

    return chatsWithUnread;
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
      createdBy: dto.isGroup ? new Types.ObjectId(userId) : undefined,
      jammId: await this.generateJammId(),
      privateurl: dto.isGroup
        ? Math.random().toString(36).substring(2, 10) +
          Math.random().toString(36).substring(2, 10)
        : undefined,
      members,
    });
  }

  hasPermission(chat: any, userId: string, permission: string): boolean {
    if (chat.createdBy?.toString() === userId) return true;
    if (!chat.admins) return false;
    const admin = chat.admins.find((a: any) => a.userId.toString() === userId);
    if (!admin) return false;
    return admin.permissions.includes(permission);
  }

  async editChat(
    chatId: string,
    userId: string,
    dto: {
      name?: string;
      description?: string;
      avatar?: string;
      members?: string[];
      admins?: { userId: string; permissions: string[] }[];
    },
  ): Promise<ChatDocument> {
    const chat = await this.getChat(chatId, userId);

    if (!chat.isGroup) {
      throw new BadRequestException(
        "Faqat guruh ma'lumotlarini o'zgartirish mumkin",
      );
    }

    const isInfoEdit =
      dto.name !== undefined ||
      dto.description !== undefined ||
      dto.avatar !== undefined;
    if (isInfoEdit && !this.hasPermission(chat, userId, 'edit_group_info')) {
      throw new ForbiddenException(
        "Sizda guruh ma'lumotlarini tahrirlash huquqi yo'q",
      );
    }

    // 0. Track old members for broadcasting later
    const oldMemberIds = chat.members.map((m: any) =>
      m._id ? m._id.toString() : m.toString(),
    );

    // 1. Manage members and admins state
    let currentMemberIds = new Set<string>(oldMemberIds);

    // Update admins if provided
    if (dto.admins !== undefined) {
      if (!this.hasPermission(chat, userId, 'add_admins')) {
        throw new ForbiddenException("Sizda adminlarni boshqarish huquqi yo'q");
      }
      chat.admins = dto.admins.map((a) => ({
        userId: new Types.ObjectId(a.userId),
        permissions: a.permissions,
      })) as any;

      // Ensure all current admins are in the members set
      dto.admins.forEach((a) => currentMemberIds.add(a.userId));
    }

    // Update members explicitly if provided
    if (dto.members !== undefined) {
      const newMemberIds = dto.members;

      const added = newMemberIds.filter((id) => !currentMemberIds.has(id));
      if (
        added.length > 0 &&
        !this.hasPermission(chat, userId, 'add_members')
      ) {
        throw new ForbiddenException("Sizda a'zo qo'shish huquqi yo'q");
      }

      const removed = Array.from(currentMemberIds).filter(
        (id) => !newMemberIds.includes(id),
      );
      if (removed.length > 0) {
        const onlySelfRemoved = removed.length === 1 && removed[0] === userId;
        if (
          !onlySelfRemoved &&
          !this.hasPermission(chat, userId, 'remove_members')
        ) {
          throw new ForbiddenException("Sizda a'zo o'chirish huquqi yo'q");
        }
      }

      // Re-apply members list
      currentMemberIds = new Set(newMemberIds);

      // Re-ensure current admins stay in members even if not in dto.members (sync safety)
      if (chat.admins) {
        chat.admins.forEach((a: any) =>
          currentMemberIds.add(String(a.userId || a.id)),
        );
      }
    }

    // Ensure the editor (if they were already a member) is not removed accidentally
    // Unless they explicitly tried to remove themselves (handled above)
    if (!currentMemberIds.has(userId)) {
      // If the editor is the owner, they must be in members
      if (chat.createdBy?.toString() === userId) {
        currentMemberIds.add(userId);
      }
    }

    chat.members = Array.from(currentMemberIds).map(
      (id) => new Types.ObjectId(id),
    ) as any;

    if (dto.name !== undefined) chat.name = dto.name;
    if (dto.description !== undefined) chat.description = dto.description;
    if (dto.avatar !== undefined) chat.avatar = dto.avatar;

    await chat.save();
    // Use a clean refetch to avoid population caching issues
    const updated = await this.getChat(chatId, userId);
    const updatedMembers = updated.members;
    const updatedAdmins = updated.admins;
    const updatedCreatedBy = updated.createdBy;

    // Broadcast chat update to members
    const rooms = new Set([`chat_${chatId}`]);
    if (oldMemberIds.length > 0) {
      oldMemberIds.forEach((id) => rooms.add(`user_${id}`));
    }
    if (chat.members) {
      chat.members.forEach((m: any) =>
        rooms.add(`user_${m._id ? m._id.toString() : m.toString()}`),
      );
    }
    this.chatsGateway.server.to(Array.from(rooms)).emit('chat_updated', {
      chatId,
      name: chat.name,
      description: chat.description,
      avatar: chat.avatar,
      members: updatedMembers,
      createdBy: updatedCreatedBy,
      admins: updatedAdmins,
    });

    return updated as any;
  }

  async updateAvatar(
    chatId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    try {
      const avatarUrl = await this.r2Service.uploadFile(file, 'group-avatars');
      await this.editChat(chatId, userId, { avatar: avatarUrl });
      return avatarUrl;
    } catch (error) {
      throw new InternalServerErrorException(
        'Guruh rasmini yuklashda xatolik yuz berdi',
      );
    }
  }

  async uploadGroupAvatarOnly(file: Express.Multer.File): Promise<string> {
    try {
      return await this.r2Service.uploadFile(file, 'group-avatars');
    } catch (error) {
      throw new InternalServerErrorException(
        'Guruh rasmini yuklashda xatolik yuz berdi',
      );
    }
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

  async previewGroup(slugOrId: string) {
    const isJammId = /^\d{6}$/.test(slugOrId);
    let query: any = { privateurl: slugOrId };

    if (isJammId) {
      query = {
        $or: [{ privateurl: slugOrId }, { jammId: parseInt(slugOrId, 10) }],
      };
    }

    const chat = await this.chatModel.findOne(query).exec();
    if (!chat) throw new NotFoundException('Guruh topilmadi');
    if (!chat.isGroup) throw new BadRequestException('Bu guruh emas');

    return {
      id: chat._id.toString(),
      privateurl: chat.privateurl,
      name: chat.name,
      avatar: chat.avatar,
      description: chat.description,
      memberCount: chat.members ? chat.members.length : 0,
      isGroup: true,
    };
  }

  async resolveSlug(
    slug: string,
    currentUserId: string,
  ): Promise<{ jammId: number }> {
    const isJammId = /^\d{6}$/.test(slug);
    let groupQuery: any = { privateurl: slug, isGroup: true };

    if (isJammId) {
      groupQuery = {
        $or: [
          { privateurl: slug, isGroup: true },
          { jammId: parseInt(slug, 10), isGroup: true },
        ],
      };
    }

    // 1. Check if slug matches a group privateurl or jammId
    const groupChat = await this.chatModel.findOne(groupQuery).exec();
    if (groupChat && groupChat.jammId) {
      return { jammId: groupChat.jammId };
    }

    // 2. Check if slug matches a username
    const targetUser = await this.userModel.findOne({ username: slug }).exec();
    if (targetUser) {
      const targetUserId = targetUser._id.toString();
      // Don't let users start a chat with themselves mapped this way (optional logic)
      if (targetUserId === currentUserId) {
        throw new BadRequestException("O'zingiz bilan chat tuza olmaysiz");
      }

      // Look for an existing private chat
      const members = [new Types.ObjectId(currentUserId), targetUser._id];
      const existingPrivateChat = await this.chatModel
        .findOne({
          isGroup: false,
          members: { $all: members, $size: 2 },
        })
        .exec();

      if (existingPrivateChat && existingPrivateChat.jammId) {
        return { jammId: existingPrivateChat.jammId };
      }

      // If it doesn't exist, create it on the fly
      const newPrivateChat = await this.createChat(currentUserId, {
        isGroup: false,
        memberIds: [targetUserId],
      });

      return { jammId: newPrivateChat.jammId! };
    }

    throw new NotFoundException('Bunday havola topilmadi');
  }

  async joinGroupByLink(
    slugOrId: string,
    userId: string,
  ): Promise<ChatDocument> {
    const isJammId = /^\d{6}$/.test(slugOrId);
    let query: any = { privateurl: slugOrId };

    if (isJammId) {
      query = {
        $or: [{ privateurl: slugOrId }, { jammId: parseInt(slugOrId, 10) }],
      };
    }

    const chat = await this.chatModel.findOne(query).exec();

    if (!chat) throw new NotFoundException('Chat topilmadi');
    if (!chat.isGroup)
      throw new BadRequestException(
        "Bu guruh emas, shaxsiy suhbatga to'g'ridan-to'g'ri qo'shilib bo'lmaydi",
      );

    const userObjectId = new Types.ObjectId(userId);

    // Check if user is already a member
    const isMember = chat.members.some((memberId) =>
      memberId.equals(userObjectId),
    );

    if (!isMember) {
      chat.members.push(userObjectId);
      await chat.save();
    }

    return this.getChat(chat._id.toString(), userId);
  }

  async getChatMessages(
    chatId: string,
    userId: string,
  ): Promise<MessageDocument[]> {
    await this.getChat(chatId, userId);

    return this.messageModel
      .find({ chatId: new Types.ObjectId(chatId), isDeleted: { $ne: true } })
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
    // Get chat to ensure user access. We store it for member IDs.
    const chat = await this.getChat(chatId, userId);

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

    const populatedMessage = await message.populate([
      { path: 'senderId', select: 'username nickname avatar' },
      {
        path: 'replayTo',
        populate: { path: 'senderId', select: 'username nickname avatar' },
      },
    ]);

    const rooms = [`chat_${chatId}`];
    if (chat && chat.members) {
      chat.members.forEach((m: any) =>
        rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`),
      );
    }

    this.chatsGateway.server.to(rooms).emit('message_new', populatedMessage);

    return populatedMessage;
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

    const populatedMessage = await message.populate([
      { path: 'senderId', select: 'username nickname avatar' },
      {
        path: 'replayTo',
        populate: { path: 'senderId', select: 'username nickname avatar' },
      },
    ]);

    const chat = await this.chatModel.findById(message.chatId);
    const rooms = [`chat_${message.chatId}`];
    if (chat && chat.members) {
      chat.members.forEach((m: any) =>
        rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`),
      );
    }

    this.chatsGateway.server
      .to(rooms)
      .emit('message_updated', populatedMessage);

    return populatedMessage;
  }

  async deleteMessage(
    messageId: string,
    userId: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Xabar topilmadi');

    if (message.senderId.toString() !== userId) {
      const chat = await this.getChat(message.chatId.toString(), userId);
      if (!this.hasPermission(chat, userId, 'delete_others_messages')) {
        throw new ForbiddenException(
          "Siz faqat o'z xabarlaringizni o'chira olasiz",
        );
      }
    }

    message.isDeleted = true;
    message.content = "Bu xabar o'chirildi";
    await message.save();

    const populatedMessage = await message.populate([
      { path: 'senderId', select: 'username nickname avatar' },
      {
        path: 'replayTo',
        populate: { path: 'senderId', select: 'username nickname avatar' },
      },
    ]);

    const chat = await this.chatModel.findById(message.chatId);
    const rooms = [`chat_${message.chatId}`];
    if (chat && chat.members) {
      chat.members.forEach((m: any) =>
        rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`),
      );
    }

    this.chatsGateway.server
      .to(rooms)
      .emit('message_deleted', populatedMessage);

    return populatedMessage;
  }

  async markMessagesAsRead(
    chatId: string,
    userId: string,
    messageIds: string[],
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const unreadMessages = await this.messageModel.updateMany(
      {
        chatId: new Types.ObjectId(chatId),
        _id: { $in: messageIds.map((id) => new Types.ObjectId(id)) },
        senderId: { $ne: new Types.ObjectId(userId) },
        readBy: { $ne: new Types.ObjectId(userId) },
      },
      {
        $addToSet: { readBy: new Types.ObjectId(userId) },
      },
    );

    // We broadcast even if modifiedCount is 0, just to confirm to the clients that these IDs are read.
    const chat = await this.chatModel.findById(chatId);
    if (!chat) return;

    const rooms = [`chat_${chatId}`];
    if (chat.members) {
      chat.members.forEach((m: any) =>
        rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`),
      );
    }

    this.chatsGateway.server.to(rooms).emit('messages_read', {
      chatId,
      readByUserId: userId,
      messageIds,
    });
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
