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
import { EncryptionService } from '../common/encryption/encryption.service';
import { PremiumService } from '../premium/premium.service';
import {
  EncryptionType,
  PlainStrategy,
  ServerEncryptionStrategy,
  FutureE2EStrategy,
  EncryptionStrategy,
} from '../common/encryption/encryption.strategies';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  assertMaxChars,
  getTierLimit,
} from '../common/limits/app-limits';

@Injectable()
export class ChatsService implements OnModuleInit {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => ChatsGateway)) private chatsGateway: ChatsGateway,
    private r2Service: R2Service,
    private encryptionService: EncryptionService,
    private premiumService: PremiumService,
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

  private getEncryptionStrategy(chat: Chat): EncryptionStrategy {
    if (!chat.isGroup) {
      if ((chat as any).isE2EEnabled) {
        return new FutureE2EStrategy(this.encryptionService);
      }
      return new ServerEncryptionStrategy(this.encryptionService);
    }
    // Group and Course chats (assuming for now courseId logic is handled elsewhere or groups cover it)
    return new ServerEncryptionStrategy(this.encryptionService);
  }

  private decryptMessage(message: any, strategy: EncryptionStrategy): any {
    if (!message.isEncrypted) return message;

    try {
      const decrypted = strategy.decrypt({
        encryptedContent: message.content,
        iv: message.iv,
        authTag: message.authTag,
        keyVersion: message.keyVersion || 0,
      });
      return { ...message, content: decrypted };
    } catch (error) {
      console.error(`Failed to decrypt message ${message._id}:`, error);
      return { ...message, content: '[Decryption Error]' };
    }
  }

  private async ensureUsersCanJoinMoreGroups(userIds: string[]) {
    for (const userId of userIds) {
      const [user, joinedCount] = await Promise.all([
        this.userModel.findById(userId).select('premiumStatus').lean().exec(),
        this.chatModel.countDocuments({
          isGroup: true,
          createdBy: { $ne: new Types.ObjectId(userId) },
          members: new Types.ObjectId(userId),
        }),
      ]);

      const limit = getTierLimit(APP_LIMITS.groupsJoined, user?.premiumStatus);
      if (joinedCount >= limit) {
        throw new ForbiddenException(
          `Foydalanuvchi maksimal ${limit} ta guruhga qo'shila oladi`,
        );
      }
    }
  }

  async getUserChats(
    userId: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 15 },
  ) {
    const skip = (pagination.page - 1) * pagination.limit;

    const [chats, total] = await Promise.all([
      this.chatModel
        .find({ members: new Types.ObjectId(userId) })
        .populate(
          'members',
          'username nickname avatar premiumStatus bio jammId',
        )
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean()
        .exec(),
      this.chatModel.countDocuments({ members: new Types.ObjectId(userId) }),
    ]);

    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await this.messageModel.countDocuments({
          chatId: chat._id as Types.ObjectId,
          senderId: { $ne: new Types.ObjectId(userId) },
          readBy: { $ne: new Types.ObjectId(userId) },
        });

        // Decrypt lastMessage preview
        let decryptedLastMessage = chat.lastMessage;
        if (
          (chat as any).lastMessageEncryptionType !== 'none' &&
          chat.lastMessage
        ) {
          try {
            const strategy = this.getEncryptionStrategy(chat as any);
            decryptedLastMessage = strategy.decrypt({
              encryptedContent: chat.lastMessage,
              iv: (chat as any).lastMessageIv || '',
              authTag: (chat as any).lastMessageAuthTag || '',
              keyVersion: (chat as any).lastMessageKeyVersion || 0,
            });
          } catch (error) {
            console.error(
              `Failed to decrypt lastMessage for chat ${chat._id}:`,
              error,
            );
            decryptedLastMessage = '[Decryption Error]';
          }
        }

        const chatObj = (chat as any).toObject
          ? (chat as any).toObject()
          : (chat as any);
        console.log(chatObj, 'lllll');

        return {
          _id: chatObj._id,
          jammId: chatObj.jammId,
          name: chatObj.name,
          description: chatObj.description,
          avatar: chatObj.avatar,
          isGroup: chatObj.isGroup,
          privateurl: chatObj.privateurl,
          members: chatObj.members,
          createdBy: chatObj.createdBy,
          admins: chatObj.admins,
          isSavedMessages: chatObj.isSavedMessages,
          urlSlug: chatObj.urlSlug,
          lastMessage: decryptedLastMessage,
          lastMessageAt: chatObj.lastMessageAt,
          updatedAt: chatObj.updatedAt,
          createdAt: chatObj.createdAt,
          unreadCount,
        };
      }),
    );
    console.log(chatsWithUnread);

    return {
      data: chatsWithUnread,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
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
    if (dto.isGroup) {
      assertMaxChars('Guruh nomi', dto.name, APP_TEXT_LIMITS.groupNameChars);
      assertMaxChars(
        'Guruh haqida',
        dto.description,
        APP_TEXT_LIMITS.groupDescriptionChars,
      );
    }

    const members = [
      new Types.ObjectId(userId),
      ...dto.memberIds.map((id) => new Types.ObjectId(id)),
    ];

    if (dto.isGroup) {
      const groupCount = await this.chatModel.countDocuments({
        createdBy: new Types.ObjectId(userId),
        isGroup: true,
      });

      const premiumStatus = await this.premiumService.getPremiumStatus(userId);
      const limit = getTierLimit(APP_LIMITS.groupsCreated, premiumStatus);

      if (groupCount >= limit) {
        throw new ForbiddenException(
          `Siz maksimal darajadagi guruhlar soniga yetdingiz (${limit}). Ko'proq guruh ochish uchun Premium obunani faollashtiring.`,
        );
      }

      await this.ensureUsersCanJoinMoreGroups(dto.memberIds);

      if (members.length > 40) {
        throw new BadRequestException(
          "Guruh a'zolari soni 40 dan oshmasligi kerak",
        );
      }
    }

    if (!dto.isGroup && members.length === 2) {
      const existing = await this.chatModel
        .findOne({
          isGroup: false,
          $or: [
            { members: [members[0], members[1]] },
            { members: [members[1], members[0]] },
          ],
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
    console.log(chat, chat.createdBy?.toString(), userId, permission);
    if (chat.createdBy?.toString() === userId) return true;
    if (!chat.admins) return false;
    const admin = chat.admins.find((a: any) => {
      const aid = a.userId?._id || a.userId || a.id;
      return aid?.toString() === userId;
    });
    if (!admin) return false;
    if (permission === 'any') return true;
    return (
      admin.permissions.includes(permission) ||
      admin.permissions.includes('all')
    );
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

    const canEditInfo = this.hasPermission(chat, userId, 'edit_group_info');
    const canAddAdmins = this.hasPermission(chat, userId, 'add_admins');
    const canAddMembers = this.hasPermission(chat, userId, 'add_members');
    const canRemoveMembers = this.hasPermission(chat, userId, 'remove_members');
    const isOwnerOrAdmin = this.hasPermission(chat, userId, 'any');

    const isInfoEdit =
      dto.name !== undefined ||
      dto.description !== undefined ||
      dto.avatar !== undefined;

    if (isInfoEdit && !canEditInfo) {
      throw new ForbiddenException(
        "Sizda guruh ma'lumotlarini tahrirlash huquqi yo'q",
      );
    }

    /** OLD MEMBERS */
    const oldMemberIds = chat.members.map((m: any) =>
      (m._id ? m._id : m).toString(),
    );

    let currentMemberIds = new Set<string>(oldMemberIds);

    /** ADMIN UPDATE */
    if (dto.admins !== undefined) {
      if (!canAddAdmins) {
        throw new ForbiddenException("Sizda adminlarni boshqarish huquqi yo'q");
      }

      chat.set(
        'admins',
        dto.admins.map((a) => ({
          userId: new Types.ObjectId(a.userId),
          permissions: a.permissions,
        })),
      );

      dto.admins.forEach((a) => {
        currentMemberIds.add(a.userId.toString());
      });
    }

    /** MEMBERS UPDATE */
    if (dto.members !== undefined) {
      const newMemberIds = dto.members.map((id) => id.toString());

      const added = newMemberIds.filter((id) => !currentMemberIds.has(id));

      if (added.length > 0 && !canAddMembers) {
        throw new ForbiddenException("Sizda a'zo qo'shish huquqi yo'q");
      }

      const removed = Array.from(currentMemberIds).filter(
        (id) => !newMemberIds.includes(id),
      );

      if (removed.length > 0) {
        const onlySelfRemoved = removed.length === 1 && removed[0] === userId;

        if (!onlySelfRemoved && !canRemoveMembers) {
          throw new ForbiddenException("Sizda a'zo o'chirish huquqi yo'q");
        }
      }

      if (added.length > 0) {
        await this.ensureUsersCanJoinMoreGroups(added);
      }

      currentMemberIds = new Set(newMemberIds);

      /** admins member bo'lib qoladi */
      if (chat.admins) {
        chat.admins.forEach((a: any) => {
          const aid = (a.userId?._id || a.userId).toString();
          currentMemberIds.add(aid);
        });
      }
    }

    /** EDITOR O'ZINI YO'QOTIB QO'YMASIN */
    if (!currentMemberIds.has(userId) && isOwnerOrAdmin) {
      currentMemberIds.add(userId);
    }

    if (currentMemberIds.size > 40) {
      throw new BadRequestException(
        "Guruh a'zolari soni 40 dan oshmasligi kerak",
      );
    }

    /** MEMBERS SAVE */
    chat.set(
      'members',
      Array.from(currentMemberIds).map((id) => new Types.ObjectId(id)),
    );

    chat.markModified('members');
    chat.markModified('admins');

    /** GROUP INFO UPDATE */
    if (dto.name !== undefined) {
      assertMaxChars('Guruh nomi', dto.name, APP_TEXT_LIMITS.groupNameChars);
      chat.name = dto.name;
    }
    if (dto.description !== undefined) {
      assertMaxChars(
        'Guruh haqida',
        dto.description,
        APP_TEXT_LIMITS.groupDescriptionChars,
      );
      chat.description = dto.description;
    }
    if (dto.avatar !== undefined) chat.avatar = dto.avatar;

    const updated = await chat.save();

    /** SOCKET BROADCAST */
    const rooms = new Set<string>([`chat_${chatId}`]);

    oldMemberIds.forEach((id) => rooms.add(`user_${id}`));

    updated.members.forEach((m: any) => {
      const id = (m._id ? m._id : m).toString();
      rooms.add(`user_${id}`);
    });

    this.chatsGateway.server.to(Array.from(rooms)).emit('chat_updated', {
      chatId,
      name: updated.name,
      description: updated.description,
      avatar: updated.avatar,
      members: updated.members,
      createdBy: updated.createdBy,
      admins: updated.admins,
    });

    return updated;
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
      .populate('members', 'username nickname avatar premiumStatus')
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
      await this.ensureUsersCanJoinMoreGroups([userId]);
      chat.members.push(userObjectId);
      await chat.save();
    }

    return this.getChat(chat._id.toString(), userId);
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<any> {
    const chat = await this.getChat(chatId, userId);
    const strategy = this.getEncryptionStrategy(chat);

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [messagesDesc, total] = await Promise.all([
      this.messageModel
        .find({ chatId: new Types.ObjectId(chatId) })
        .populate('senderId', 'username nickname avatar premiumStatus')
        .populate({
          path: 'replayTo',
          populate: {
            path: 'senderId',
            select: 'username nickname avatar premiumStatus',
          },
        })
        .sort({ createdAt: -1 }) // newest first to skip properly
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments({ chatId: new Types.ObjectId(chatId) }),
    ]);

    // Reverse the slice back to chronological order (oldest -> newest) for the UI
    const messages = messagesDesc.reverse();

    const data = messages.map((m) => {
      const decrypted = this.decryptMessage(m.toObject(), strategy);
      return {
        _id: decrypted._id,
        chatId: decrypted.chatId,
        senderId: decrypted.senderId,
        content: decrypted.content,
        isEdited: decrypted.isEdited,
        isDeleted: decrypted.isDeleted,
        readBy: decrypted.readBy,
        replayTo: decrypted.replayTo,
        createdAt: decrypted.createdAt,
        updatedAt: decrypted.updatedAt,
      } as any as MessageDocument;
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async sendMessage(
    chatId: string,
    userId: string,
    content: string,
    replayToId?: string,
  ): Promise<MessageDocument> {
    const chat = await this.getChat(chatId, userId);
    assertMaxChars('Xabar', content, APP_TEXT_LIMITS.messageChars);
    const strategy = this.getEncryptionStrategy(chat);
    const encrypted = strategy.encrypt(content);

    const messageData: any = {
      chatId: new Types.ObjectId(chatId),
      senderId: new Types.ObjectId(userId),
      content: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      encryptionType: strategy.getType(),
      isEncrypted: strategy.getType() !== EncryptionType.NONE,
      keyVersion: encrypted.keyVersion,
      searchableText: this.encryptionService.getSearchableText(content),
    };

    if (replayToId) {
      messageData.replayTo = new Types.ObjectId(replayToId);
    }

    const message = await this.messageModel.create(messageData);

    await this.chatModel.findByIdAndUpdate(chatId, {
      lastMessage: encrypted.encryptedContent,
      lastMessageIv: encrypted.iv,
      lastMessageAuthTag: encrypted.authTag,
      lastMessageEncryptionType: strategy.getType(),
      lastMessageKeyVersion: encrypted.keyVersion,
      lastMessageAt: new Date(),
    });

    const populatedMessage = await message.populate([
      { path: 'senderId', select: 'username nickname avatar' },
      {
        path: 'replayTo',
        populate: {
          path: 'senderId',
          select: 'username nickname avatar premiumStatus',
        },
      },
    ]);

    const decryptedMessage = this.decryptMessage(
      populatedMessage.toObject(),
      strategy,
    );

    const rooms = [`chat_${chatId}`];
    if (chat && chat.members) {
      chat.members.forEach((m: any) =>
        rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`),
      );
    }

    this.chatsGateway.server.to(rooms).emit('message_new', decryptedMessage);

    return decryptedMessage;
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

    const chat = await this.getChat(message.chatId.toString(), userId);
    assertMaxChars('Xabar', newContent, APP_TEXT_LIMITS.messageChars);
    const strategy = this.getEncryptionStrategy(chat);
    const encrypted = strategy.encrypt(newContent);

    message.content = encrypted.encryptedContent;
    message.iv = encrypted.iv;
    message.authTag = encrypted.authTag;
    message.encryptionType = strategy.getType();
    message.isEncrypted = strategy.getType() !== EncryptionType.NONE;
    message.keyVersion = encrypted.keyVersion;
    message.searchableText =
      this.encryptionService.getSearchableText(newContent);
    message.isEdited = true;
    await message.save();

    const populatedMessage = await message.populate([
      { path: 'senderId', select: 'username nickname avatar' },
      {
        path: 'replayTo',
        populate: {
          path: 'senderId',
          select: 'username nickname avatar premiumStatus',
        },
      },
    ]);

    const decryptedMessage = this.decryptMessage(
      populatedMessage.toObject(),
      strategy,
    );

    const rooms = [`chat_${message.chatId}`];
    if (chat && chat.members) {
      chat.members.forEach((m: any) =>
        rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`),
      );
    }

    this.chatsGateway.server
      .to(rooms)
      .emit('message_updated', decryptedMessage);

    return decryptedMessage;
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
        populate: {
          path: 'senderId',
          select: 'username nickname avatar premiumStatus',
        },
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

  async deleteChat(chatId: string, userId: string) {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) throw new NotFoundException('Suhbat topilmadi');

    // Check if user is a member
    const isMember = chat.members.some((m: any) => m.toString() === userId);
    if (!isMember) {
      throw new ForbiddenException(
        "Sizda ushbu suhbatni o'chirish huquqi yo'q",
      );
    }

    // For groups, check if user is the creator (owner)
    if (chat.isGroup && chat.createdBy?.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat guruh yaratuvchisi guruhni o'chira oladi",
      );
    }

    const memberIds = chat.members.map((m: any) => m.toString());

    // Delete all messages
    await this.messageModel
      .deleteMany({ chatId: new Types.ObjectId(chatId) })
      .exec();

    // Delete the chat itself
    await this.chatModel.findByIdAndDelete(chatId).exec();

    // Notify all members via socket
    memberIds.forEach((mId) => {
      this.chatsGateway.server
        .to(`user_${mId}`)
        .emit('chat_deleted', { chatId });
    });

    return { success: true };
  }

  async leaveChat(chatId: string, userId: string) {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) throw new NotFoundException('Suhbat topilmadi');

    if (!chat.isGroup) {
      throw new ForbiddenException('Faqat guruhdan chiqish mumkin');
    }

    // Check if user is a member
    const isMember = chat.members.some((m: any) => m.toString() === userId);
    if (!isMember) {
      throw new ForbiddenException('Siz ushbu guruh a’zosi emassiz');
    }

    // Check if user is the creator (owner)
    if (chat.createdBy?.toString() === userId) {
      throw new ForbiddenException(
        'Guruh yaratuvchisi guruhni tark eta olmaydi, faqat o’chirishi mumkin',
      );
    }

    // Remove from members and admins
    chat.members = chat.members.filter((m: any) => m.toString() !== userId);
    chat.admins = chat.admins.filter(
      (a: any) => a.userId.toString() !== userId,
    );

    await chat.save();

    // Notify the user who left that the chat is "deleted" for them
    this.chatsGateway.server
      .to(`user_${userId}`)
      .emit('chat_deleted', { chatId });

    // Notify remaining members that the chat has changed
    const remainingMembers = chat.members.map((m: any) => m.toString());
    remainingMembers.forEach((mId) => {
      this.chatsGateway.server.to(`user_${mId}`).emit('chat_updated', {
        _id: chat._id,
        members: chat.members,
        admins: chat.admins,
      });
    });

    return { success: true };
  }
}
