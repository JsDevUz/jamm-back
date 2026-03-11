"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_schema_1 = require("./schemas/chat.schema");
const message_schema_1 = require("./schemas/message.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const uuid_1 = require("uuid");
const chats_gateway_1 = require("./chats.gateway");
const r2_service_1 = require("../common/services/r2.service");
const encryption_service_1 = require("../common/encryption/encryption.service");
const premium_service_1 = require("../premium/premium.service");
const encryption_strategies_1 = require("../common/encryption/encryption.strategies");
const app_limits_1 = require("../common/limits/app-limits");
const app_settings_service_1 = require("../app-settings/app-settings.service");
let ChatsService = class ChatsService {
    chatModel;
    messageModel;
    userModel;
    chatsGateway;
    r2Service;
    encryptionService;
    premiumService;
    appSettingsService;
    constructor(chatModel, messageModel, userModel, chatsGateway, r2Service, encryptionService, premiumService, appSettingsService) {
        this.chatModel = chatModel;
        this.messageModel = messageModel;
        this.userModel = userModel;
        this.chatsGateway = chatsGateway;
        this.r2Service = r2Service;
        this.encryptionService = encryptionService;
        this.premiumService = premiumService;
        this.appSettingsService = appSettingsService;
    }
    async onModuleInit() {
        await this.backfillJammIds();
        await this.backfillPrivateUrls();
        await this.backfillAdmins();
    }
    buildSearchRegex(query) {
        const value = String(query || '').trim();
        if (!value) {
            throw new common_1.BadRequestException('Qidiruv so\'rovini kiriting');
        }
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'i');
    }
    async backfillAdmins() {
        const groupsWithoutOwner = await this.chatModel
            .find({ isGroup: true, createdBy: { $exists: false } })
            .exec();
        if (groupsWithoutOwner.length > 0) {
            console.log(`Backfilling createdBy for ${groupsWithoutOwner.length} groups...`);
            for (const group of groupsWithoutOwner) {
                if (group.members && group.members.length > 0) {
                    group.createdBy = group.members[0];
                    await group.save();
                }
            }
            console.log('Finished backfilling createdBy.');
        }
    }
    async backfillPrivateUrls() {
        const groupsWithoutUrl = await this.chatModel
            .find({ isGroup: true, privateurl: { $exists: false } })
            .exec();
        if (groupsWithoutUrl.length > 0) {
            console.log(`Backfilling privateurl for ${groupsWithoutUrl.length} groups...`);
            for (const group of groupsWithoutUrl) {
                group.privateurl =
                    Math.random().toString(36).substring(2, 10) +
                        Math.random().toString(36).substring(2, 10);
                await group.save();
            }
            console.log('Finished backfilling privateurls.');
        }
    }
    async generateJammId() {
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
    async backfillJammIds() {
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
    getEncryptionStrategy(chat) {
        if (!chat.isGroup) {
            if (chat.isE2EEnabled) {
                return new encryption_strategies_1.FutureE2EStrategy(this.encryptionService);
            }
            return new encryption_strategies_1.ServerEncryptionStrategy(this.encryptionService);
        }
        return new encryption_strategies_1.ServerEncryptionStrategy(this.encryptionService);
    }
    decryptMessage(message, strategy) {
        const nextMessage = { ...message };
        if (nextMessage.replayTo?.isEncrypted) {
            nextMessage.replayTo = this.decryptMessage(nextMessage.replayTo, strategy);
        }
        if (!nextMessage.isEncrypted)
            return nextMessage;
        try {
            const decrypted = strategy.decrypt({
                encryptedContent: nextMessage.content,
                iv: nextMessage.iv,
                authTag: nextMessage.authTag,
                keyVersion: nextMessage.keyVersion || 0,
            });
            return { ...nextMessage, content: decrypted };
        }
        catch (error) {
            console.error(`Failed to decrypt message ${nextMessage._id}:`, error);
            return { ...nextMessage, content: '[Decryption Error]' };
        }
    }
    decryptLastMessagePreview(chat) {
        if (!chat?.lastMessage)
            return '';
        if (chat.lastMessageEncryptionType === 'none') {
            return chat.lastMessage;
        }
        const iv = chat.lastMessageIv || '';
        const authTag = chat.lastMessageAuthTag || '';
        if (!iv || !authTag) {
            return '';
        }
        try {
            const strategy = this.getEncryptionStrategy(chat);
            return strategy.decrypt({
                encryptedContent: chat.lastMessage,
                iv,
                authTag,
                keyVersion: chat.lastMessageKeyVersion || 0,
            });
        }
        catch (error) {
            console.error(`Failed to decrypt lastMessage preview for chat ${chat._id}:`, error);
            return '';
        }
    }
    async ensureUsersCanJoinMoreGroups(userIds) {
        const users = await this.userModel
            .find({ _id: { $in: userIds.map((id) => new mongoose_2.Types.ObjectId(id)) } })
            .select('_id username premiumStatus')
            .lean()
            .exec();
        const usersById = new Map(users.map((user) => [String(user._id), user]));
        for (const userId of userIds) {
            const targetUser = usersById.get(String(userId));
            const officialProfile = await this.appSettingsService.getOfficialProfileByUsername(targetUser?.username);
            if (officialProfile?.disableGroupInvites) {
                throw new common_1.ForbiddenException(`${targetUser?.username || 'Rasmiy profil'} guruhga qo'shilmaydi`);
            }
            const [userRecord, joinedCount] = await Promise.all([
                this.userModel.findById(userId).select('premiumStatus').lean().exec(),
                this.chatModel.countDocuments({
                    isGroup: true,
                    createdBy: { $ne: new mongoose_2.Types.ObjectId(userId) },
                    members: new mongoose_2.Types.ObjectId(userId),
                }),
            ]);
            const limit = (0, app_limits_1.getTierLimit)(app_limits_1.APP_LIMITS.groupsJoined, userRecord?.premiumStatus);
            if (joinedCount >= limit) {
                throw new common_1.ForbiddenException(`Foydalanuvchi maksimal ${limit} ta guruhga qo'shila oladi`);
            }
        }
    }
    async decorateChatMembers(members = []) {
        return this.appSettingsService.decorateUsersPayload(members.map((member) => typeof member?.toObject === 'function' ? member.toObject() : member));
    }
    async decorateChatMessageUser(user) {
        if (!user)
            return user;
        const normalized = typeof user.toObject === 'function' ? user.toObject() : user;
        return this.appSettingsService.decorateUserPayload(normalized);
    }
    async getUserChats(userId, pagination = { page: 1, limit: 15 }) {
        const skip = (pagination.page - 1) * pagination.limit;
        const [chats, total] = await Promise.all([
            this.chatModel
                .find({ members: new mongoose_2.Types.ObjectId(userId) })
                .populate('members', 'username nickname avatar premiumStatus bio jammId selectedProfileDecorationId customProfileDecorationImage')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(pagination.limit)
                .lean()
                .exec(),
            this.chatModel.countDocuments({ members: new mongoose_2.Types.ObjectId(userId) }),
        ]);
        const chatsWithUnread = await Promise.all(chats.map(async (chat) => {
            const unreadCount = await this.messageModel.countDocuments({
                chatId: chat._id,
                senderId: { $ne: new mongoose_2.Types.ObjectId(userId) },
                readBy: { $ne: new mongoose_2.Types.ObjectId(userId) },
            });
            const decryptedLastMessage = this.decryptLastMessagePreview(chat);
            const chatObj = chat.toObject
                ? chat.toObject()
                : chat;
            return {
                _id: chatObj._id,
                jammId: chatObj.jammId,
                name: chatObj.name,
                description: chatObj.description,
                avatar: chatObj.avatar,
                isGroup: chatObj.isGroup,
                privateurl: chatObj.privateurl,
                members: await this.decorateChatMembers(chatObj.members || []),
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
        }));
        return {
            data: chatsWithUnread,
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(total / pagination.limit),
        };
    }
    async searchPrivateUsers(userId, query, limit = 10) {
        const regex = this.buildSearchRegex(query);
        const users = await this.userModel
            .find({
            _id: { $ne: new mongoose_2.Types.ObjectId(userId) },
            $or: [{ username: regex }, { nickname: regex }],
        })
            .select('username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage')
            .limit(Math.max(1, Math.min(10, Number(limit) || 10)))
            .lean()
            .exec();
        const decoratedUsers = await this.appSettingsService.decorateUsersPayload(users);
        return decoratedUsers.map((user) => ({
            id: user._id.toString(),
            name: user.nickname || user.username,
            username: user.username,
            avatar: user.avatar || '',
            premiumStatus: user.premiumStatus || 'inactive',
            selectedProfileDecorationId: user.selectedProfileDecorationId || null,
            customProfileDecorationImage: user.customProfileDecorationImage || null,
            isOfficialProfile: Boolean(user.isOfficialProfile),
            officialBadgeKey: user.officialBadgeKey || null,
            officialBadgeLabel: user.officialBadgeLabel || null,
            disableCalls: Boolean(user.disableCalls),
            disableGroupInvites: Boolean(user.disableGroupInvites),
        }));
    }
    async searchUserGroups(userId, query, limit = 10) {
        const regex = this.buildSearchRegex(query);
        const groups = await this.chatModel
            .find({
            isGroup: true,
            members: new mongoose_2.Types.ObjectId(userId),
            name: regex,
        })
            .select('name avatar jammId members lastMessage lastMessageIv lastMessageAuthTag lastMessageEncryptionType lastMessageKeyVersion lastMessageAt updatedAt privateurl')
            .sort({ updatedAt: -1 })
            .limit(Math.max(1, Math.min(10, Number(limit) || 10)))
            .lean()
            .exec();
        return groups.map((group) => {
            return {
                id: group._id.toString(),
                urlSlug: group.jammId ? String(group.jammId) : group._id.toString(),
                name: group.name || 'Group',
                avatar: group.avatar || '',
                membersCount: Array.isArray(group.members) ? group.members.length : 0,
                lastMessage: this.decryptLastMessagePreview(group),
                lastMessageAt: group.lastMessageAt || null,
            };
        });
    }
    async createChat(userId, dto) {
        if (dto.isGroup) {
            (0, app_limits_1.assertMaxChars)('Guruh nomi', dto.name, app_limits_1.APP_TEXT_LIMITS.groupNameChars);
            (0, app_limits_1.assertMaxChars)('Guruh haqida', dto.description, app_limits_1.APP_TEXT_LIMITS.groupDescriptionChars);
        }
        const members = [
            new mongoose_2.Types.ObjectId(userId),
            ...dto.memberIds.map((id) => new mongoose_2.Types.ObjectId(id)),
        ];
        if (dto.isGroup) {
            const groupCount = await this.chatModel.countDocuments({
                createdBy: new mongoose_2.Types.ObjectId(userId),
                isGroup: true,
            });
            const premiumStatus = await this.premiumService.getPremiumStatus(userId);
            const limit = (0, app_limits_1.getTierLimit)(app_limits_1.APP_LIMITS.groupsCreated, premiumStatus);
            if (groupCount >= limit) {
                throw new common_1.ForbiddenException(`Siz maksimal darajadagi guruhlar soniga yetdingiz (${limit}). Ko'proq guruh ochish uchun Premium obunani faollashtiring.`);
            }
            await this.ensureUsersCanJoinMoreGroups(dto.memberIds);
            if (members.length > 40) {
                throw new common_1.BadRequestException("Guruh a'zolari soni 40 dan oshmasligi kerak");
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
            if (existing)
                return existing;
        }
        return this.chatModel.create({
            ...dto,
            createdBy: dto.isGroup ? new mongoose_2.Types.ObjectId(userId) : undefined,
            jammId: await this.generateJammId(),
            privateurl: dto.isGroup
                ? Math.random().toString(36).substring(2, 10) +
                    Math.random().toString(36).substring(2, 10)
                : undefined,
            members,
        });
    }
    hasPermission(chat, userId, permission) {
        console.log(chat, chat.createdBy?.toString(), userId, permission);
        if (chat.createdBy?.toString() === userId)
            return true;
        if (!chat.admins)
            return false;
        const admin = chat.admins.find((a) => {
            const aid = a.userId?._id || a.userId || a.id;
            return aid?.toString() === userId;
        });
        if (!admin)
            return false;
        if (permission === 'any')
            return true;
        return (admin.permissions.includes(permission) ||
            admin.permissions.includes('all'));
    }
    async editChat(chatId, userId, dto) {
        const chat = await this.getChat(chatId, userId);
        if (!chat.isGroup) {
            throw new common_1.BadRequestException("Faqat guruh ma'lumotlarini o'zgartirish mumkin");
        }
        const canEditInfo = this.hasPermission(chat, userId, 'edit_group_info');
        const canAddAdmins = this.hasPermission(chat, userId, 'add_admins');
        const canAddMembers = this.hasPermission(chat, userId, 'add_members');
        const canRemoveMembers = this.hasPermission(chat, userId, 'remove_members');
        const isOwnerOrAdmin = this.hasPermission(chat, userId, 'any');
        const isInfoEdit = dto.name !== undefined ||
            dto.description !== undefined ||
            dto.avatar !== undefined;
        if (isInfoEdit && !canEditInfo) {
            throw new common_1.ForbiddenException("Sizda guruh ma'lumotlarini tahrirlash huquqi yo'q");
        }
        const oldMemberIds = chat.members.map((m) => (m._id ? m._id : m).toString());
        let currentMemberIds = new Set(oldMemberIds);
        if (dto.admins !== undefined) {
            if (!canAddAdmins) {
                throw new common_1.ForbiddenException("Sizda adminlarni boshqarish huquqi yo'q");
            }
            chat.set('admins', dto.admins.map((a) => ({
                userId: new mongoose_2.Types.ObjectId(a.userId),
                permissions: a.permissions,
            })));
            dto.admins.forEach((a) => {
                currentMemberIds.add(a.userId.toString());
            });
        }
        if (dto.members !== undefined) {
            const newMemberIds = dto.members.map((id) => id.toString());
            const added = newMemberIds.filter((id) => !currentMemberIds.has(id));
            if (added.length > 0 && !canAddMembers) {
                throw new common_1.ForbiddenException("Sizda a'zo qo'shish huquqi yo'q");
            }
            const removed = Array.from(currentMemberIds).filter((id) => !newMemberIds.includes(id));
            if (removed.length > 0) {
                const onlySelfRemoved = removed.length === 1 && removed[0] === userId;
                if (!onlySelfRemoved && !canRemoveMembers) {
                    throw new common_1.ForbiddenException("Sizda a'zo o'chirish huquqi yo'q");
                }
            }
            if (added.length > 0) {
                await this.ensureUsersCanJoinMoreGroups(added);
            }
            currentMemberIds = new Set(newMemberIds);
            if (chat.admins) {
                chat.admins.forEach((a) => {
                    const aid = (a.userId?._id || a.userId).toString();
                    currentMemberIds.add(aid);
                });
            }
        }
        if (!currentMemberIds.has(userId) && isOwnerOrAdmin) {
            currentMemberIds.add(userId);
        }
        if (currentMemberIds.size > 40) {
            throw new common_1.BadRequestException("Guruh a'zolari soni 40 dan oshmasligi kerak");
        }
        chat.set('members', Array.from(currentMemberIds).map((id) => new mongoose_2.Types.ObjectId(id)));
        chat.markModified('members');
        chat.markModified('admins');
        if (dto.name !== undefined) {
            (0, app_limits_1.assertMaxChars)('Guruh nomi', dto.name, app_limits_1.APP_TEXT_LIMITS.groupNameChars);
            chat.name = dto.name;
        }
        if (dto.description !== undefined) {
            (0, app_limits_1.assertMaxChars)('Guruh haqida', dto.description, app_limits_1.APP_TEXT_LIMITS.groupDescriptionChars);
            chat.description = dto.description;
        }
        if (dto.avatar !== undefined)
            chat.avatar = dto.avatar;
        const updated = await chat.save();
        const rooms = new Set([`chat_${chatId}`]);
        oldMemberIds.forEach((id) => rooms.add(`user_${id}`));
        updated.members.forEach((m) => {
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
    async updateAvatar(chatId, userId, file) {
        try {
            const avatarUrl = await this.r2Service.uploadFile(file, 'group-avatars');
            await this.editChat(chatId, userId, { avatar: avatarUrl });
            return avatarUrl;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Guruh rasmini yuklashda xatolik yuz berdi');
        }
    }
    async uploadGroupAvatarOnly(file) {
        try {
            return await this.r2Service.uploadFile(file, 'group-avatars');
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Guruh rasmini yuklashda xatolik yuz berdi');
        }
    }
    async getChat(chatId, userId) {
        const chat = await this.chatModel
            .findOne({
            _id: chatId,
            members: new mongoose_2.Types.ObjectId(userId),
        })
            .populate('members', 'username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage')
            .exec();
        if (!chat)
            throw new common_1.NotFoundException("Chat topilmadi yoki huquq yo'q");
        return chat;
    }
    async previewGroup(slugOrId) {
        const isJammId = /^\d{6}$/.test(slugOrId);
        let query = { privateurl: slugOrId };
        if (isJammId) {
            query = {
                $or: [{ privateurl: slugOrId }, { jammId: parseInt(slugOrId, 10) }],
            };
        }
        const chat = await this.chatModel.findOne(query).exec();
        if (!chat)
            throw new common_1.NotFoundException('Guruh topilmadi');
        if (!chat.isGroup)
            throw new common_1.BadRequestException('Bu guruh emas');
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
    async resolveSlug(slug, currentUserId) {
        const isJammId = /^\d{6}$/.test(slug);
        let groupQuery = { privateurl: slug, isGroup: true };
        if (isJammId) {
            groupQuery = {
                $or: [
                    { privateurl: slug, isGroup: true },
                    { jammId: parseInt(slug, 10), isGroup: true },
                ],
            };
        }
        const groupChat = await this.chatModel.findOne(groupQuery).exec();
        if (groupChat && groupChat.jammId) {
            return { jammId: groupChat.jammId };
        }
        const targetUser = await this.userModel.findOne({ username: slug }).exec();
        if (targetUser) {
            const targetUserId = targetUser._id.toString();
            if (targetUserId === currentUserId) {
                throw new common_1.BadRequestException("O'zingiz bilan chat tuza olmaysiz");
            }
            const members = [new mongoose_2.Types.ObjectId(currentUserId), targetUser._id];
            const existingPrivateChat = await this.chatModel
                .findOne({
                isGroup: false,
                members: { $all: members, $size: 2 },
            })
                .exec();
            if (existingPrivateChat && existingPrivateChat.jammId) {
                return { jammId: existingPrivateChat.jammId };
            }
            const newPrivateChat = await this.createChat(currentUserId, {
                isGroup: false,
                memberIds: [targetUserId],
            });
            return { jammId: newPrivateChat.jammId };
        }
        throw new common_1.NotFoundException('Bunday havola topilmadi');
    }
    async joinGroupByLink(slugOrId, userId) {
        const isJammId = /^\d{6}$/.test(slugOrId);
        let query = { privateurl: slugOrId };
        if (isJammId) {
            query = {
                $or: [{ privateurl: slugOrId }, { jammId: parseInt(slugOrId, 10) }],
            };
        }
        const chat = await this.chatModel.findOne(query).exec();
        if (!chat)
            throw new common_1.NotFoundException('Chat topilmadi');
        if (!chat.isGroup)
            throw new common_1.BadRequestException("Bu guruh emas, shaxsiy suhbatga to'g'ridan-to'g'ri qo'shilib bo'lmaydi");
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const isMember = chat.members.some((memberId) => memberId.equals(userObjectId));
        if (!isMember) {
            const joiningUser = await this.userModel
                .findById(userId)
                .select('username')
                .lean()
                .exec();
            const officialProfile = await this.appSettingsService.getOfficialProfileByUsername(joiningUser?.username);
            if (officialProfile?.disableGroupInvites) {
                throw new common_1.ForbiddenException('Rasmiy profillar guruhga qo‘shilmaydi');
            }
            await this.ensureUsersCanJoinMoreGroups([userId]);
            chat.members.push(userObjectId);
            await chat.save();
        }
        return this.getChat(chat._id.toString(), userId);
    }
    async getChatMessages(chatId, userId, before) {
        const chat = await this.getChat(chatId, userId);
        const strategy = this.getEncryptionStrategy(chat);
        const chatObjectId = new mongoose_2.Types.ObjectId(chatId);
        const cursorDate = before && !Number.isNaN(new Date(before).getTime()) ? new Date(before) : null;
        const latestMessage = await this.messageModel
            .findOne(cursorDate
            ? {
                chatId: chatObjectId,
                createdAt: { $lt: cursorDate },
            }
            : { chatId: chatObjectId })
            .sort({ createdAt: -1 })
            .select('_id createdAt')
            .lean();
        if (!latestMessage) {
            return {
                data: [],
                hasMore: false,
                nextCursor: null,
            };
        }
        const dayStart = new Date(latestMessage.createdAt);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const [messages, hasOlderMessage] = await Promise.all([
            this.messageModel
                .find({
                chatId: chatObjectId,
                createdAt: {
                    $gte: dayStart,
                    $lt: dayEnd,
                },
            })
                .populate('senderId', 'username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage')
                .populate({
                path: 'replayTo',
                populate: {
                    path: 'senderId',
                    select: 'username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage',
                },
            })
                .sort({ createdAt: 1 })
                .exec(),
            this.messageModel.exists({
                chatId: chatObjectId,
                createdAt: { $lt: dayStart },
            }),
        ]);
        const data = await Promise.all(messages.map(async (m) => {
            const decrypted = this.decryptMessage(m.toObject(), strategy);
            return {
                _id: decrypted._id,
                chatId: decrypted.chatId,
                senderId: await this.decorateChatMessageUser(decrypted.senderId),
                content: decrypted.content,
                isEdited: decrypted.isEdited,
                isDeleted: decrypted.isDeleted,
                readBy: decrypted.readBy,
                replayTo: decrypted.replayTo
                    ? {
                        ...decrypted.replayTo,
                        senderId: await this.decorateChatMessageUser(decrypted.replayTo.senderId),
                    }
                    : null,
                createdAt: decrypted.createdAt,
                updatedAt: decrypted.updatedAt,
            };
        }));
        return {
            data,
            hasMore: Boolean(hasOlderMessage),
            nextCursor: hasOlderMessage ? dayStart.toISOString() : null,
        };
    }
    async sendMessage(chatId, userId, content, replayToId) {
        const chat = await this.getChat(chatId, userId);
        (0, app_limits_1.assertMaxChars)('Xabar', content, app_limits_1.APP_TEXT_LIMITS.messageChars);
        const strategy = this.getEncryptionStrategy(chat);
        const encrypted = strategy.encrypt(content);
        const messageData = {
            chatId: new mongoose_2.Types.ObjectId(chatId),
            senderId: new mongoose_2.Types.ObjectId(userId),
            content: encrypted.encryptedContent,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            encryptionType: strategy.getType(),
            isEncrypted: strategy.getType() !== encryption_strategies_1.EncryptionType.NONE,
            keyVersion: encrypted.keyVersion,
            searchableText: this.encryptionService.getSearchableText(content),
        };
        if (replayToId) {
            messageData.replayTo = new mongoose_2.Types.ObjectId(replayToId);
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
                    select: 'username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage',
                },
            },
        ]);
        const decryptedMessage = this.decryptMessage(populatedMessage.toObject(), strategy);
        decryptedMessage.senderId = await this.decorateChatMessageUser(decryptedMessage.senderId);
        if (decryptedMessage.replayTo?.senderId) {
            decryptedMessage.replayTo.senderId = await this.decorateChatMessageUser(decryptedMessage.replayTo.senderId);
        }
        const rooms = [`chat_${chatId}`];
        if (chat && chat.members) {
            chat.members.forEach((m) => rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`));
        }
        this.chatsGateway.server.to(rooms).emit('message_new', decryptedMessage);
        return decryptedMessage;
    }
    async editMessage(messageId, userId, newContent) {
        const message = await this.messageModel.findById(messageId);
        if (!message)
            throw new common_1.NotFoundException('Xabar topilmadi');
        if (message.senderId.toString() !== userId) {
            throw new common_1.ForbiddenException("Siz faqat o'z xabarlaringizni tahrirlay olasiz");
        }
        if (message.isDeleted) {
            throw new common_1.ForbiddenException("O'chirilgan xabarni tahrirlab bo'lmaydi");
        }
        const chat = await this.getChat(message.chatId.toString(), userId);
        (0, app_limits_1.assertMaxChars)('Xabar', newContent, app_limits_1.APP_TEXT_LIMITS.messageChars);
        const strategy = this.getEncryptionStrategy(chat);
        const encrypted = strategy.encrypt(newContent);
        message.content = encrypted.encryptedContent;
        message.iv = encrypted.iv;
        message.authTag = encrypted.authTag;
        message.encryptionType = strategy.getType();
        message.isEncrypted = strategy.getType() !== encryption_strategies_1.EncryptionType.NONE;
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
                    select: 'username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage',
                },
            },
        ]);
        const decryptedMessage = this.decryptMessage(populatedMessage.toObject(), strategy);
        decryptedMessage.senderId = await this.decorateChatMessageUser(decryptedMessage.senderId);
        if (decryptedMessage.replayTo?.senderId) {
            decryptedMessage.replayTo.senderId = await this.decorateChatMessageUser(decryptedMessage.replayTo.senderId);
        }
        const rooms = [`chat_${message.chatId}`];
        if (chat && chat.members) {
            chat.members.forEach((m) => rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`));
        }
        this.chatsGateway.server
            .to(rooms)
            .emit('message_updated', decryptedMessage);
        return decryptedMessage;
    }
    async deleteMessage(messageId, userId) {
        const message = await this.messageModel.findById(messageId);
        if (!message)
            throw new common_1.NotFoundException('Xabar topilmadi');
        if (message.senderId.toString() !== userId) {
            const chat = await this.getChat(message.chatId.toString(), userId);
            if (!this.hasPermission(chat, userId, 'delete_others_messages')) {
                throw new common_1.ForbiddenException("Siz faqat o'z xabarlaringizni o'chira olasiz");
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
                    select: 'username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage',
                },
            },
        ]);
        const chat = await this.chatModel.findById(message.chatId);
        const rooms = [`chat_${message.chatId}`];
        if (chat && chat.members) {
            chat.members.forEach((m) => rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`));
        }
        this.chatsGateway.server
            .to(rooms)
            .emit('message_deleted', populatedMessage);
        return populatedMessage;
    }
    async markMessagesAsRead(chatId, userId, messageIds) {
        if (!messageIds || messageIds.length === 0)
            return;
        const unreadMessages = await this.messageModel.updateMany({
            chatId: new mongoose_2.Types.ObjectId(chatId),
            _id: { $in: messageIds.map((id) => new mongoose_2.Types.ObjectId(id)) },
            senderId: { $ne: new mongoose_2.Types.ObjectId(userId) },
            readBy: { $ne: new mongoose_2.Types.ObjectId(userId) },
        }, {
            $addToSet: { readBy: new mongoose_2.Types.ObjectId(userId) },
        });
        const chat = await this.chatModel.findById(chatId);
        if (!chat)
            return;
        const rooms = [`chat_${chatId}`];
        if (chat.members) {
            chat.members.forEach((m) => rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`));
        }
        this.chatsGateway.server.to(rooms).emit('messages_read', {
            chatId,
            readByUserId: userId,
            messageIds,
        });
    }
    async startVideoCall(chatId, userId) {
        if (!mongoose_2.Types.ObjectId.isValid(chatId)) {
            throw new common_1.BadRequestException(`Noto'g'ri chat ID: ${chatId}`);
        }
        await this.getChat(chatId, userId);
        const roomId = `jamm-${(0, uuid_1.v4)().slice(0, 8)}`;
        await this.chatModel.findByIdAndUpdate(chatId, {
            videoCallRoomId: roomId,
            videoCallCreatorId: new mongoose_2.Types.ObjectId(userId),
            joinRequests: [],
        });
        return { roomId };
    }
    async endVideoCall(chatId, userId) {
        if (!mongoose_2.Types.ObjectId.isValid(chatId))
            throw new common_1.BadRequestException("Noto'g'ri chat ID");
        const chat = await this.chatModel.findById(chatId);
        if (!chat)
            throw new common_1.NotFoundException('Chat topilmadi');
        if (chat.videoCallCreatorId?.toString() !== userId) {
            throw new common_1.ForbiddenException('Faqat creator callni tugatishi mumkin');
        }
        await this.chatModel.findByIdAndUpdate(chatId, {
            $unset: { videoCallRoomId: '', videoCallCreatorId: '' },
            $set: { joinRequests: [] },
        });
    }
    async getCallStatus(chatId) {
        if (!mongoose_2.Types.ObjectId.isValid(chatId))
            return { active: false };
        const chat = await this.chatModel.findById(chatId).exec();
        if (!chat)
            throw new common_1.NotFoundException('Chat topilmadi');
        return {
            active: !!chat.videoCallRoomId,
            roomId: chat.videoCallRoomId,
            creatorId: chat.videoCallCreatorId?.toString(),
        };
    }
    async requestJoin(chatId, name, userId) {
        const chat = await this.chatModel.findById(chatId).exec();
        if (!chat)
            throw new common_1.NotFoundException('Chat topilmadi');
        if (!chat.videoCallRoomId) {
            throw new common_1.NotFoundException('Hech qanday faol call mavjud emas');
        }
        const requestId = new mongoose_2.Types.ObjectId();
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
    async getJoinRequests(chatId, userId) {
        const chat = await this.chatModel.findById(chatId).exec();
        if (!chat)
            throw new common_1.NotFoundException('Chat topilmadi');
        if (chat.videoCallCreatorId?.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat creator join so'rovlarini ko'rishi mumkin");
        }
        return chat.joinRequests.filter((r) => r.status === 'pending');
    }
    async respondToJoinRequest(chatId, requestId, approved, userId) {
        const chat = await this.chatModel.findById(chatId).exec();
        if (!chat)
            throw new common_1.NotFoundException('Chat topilmadi');
        if (chat.videoCallCreatorId?.toString() !== userId) {
            throw new common_1.ForbiddenException('Faqat creator ruxsat bera oladi');
        }
        await this.chatModel.updateOne({ _id: chatId, 'joinRequests._id': new mongoose_2.Types.ObjectId(requestId) }, {
            $set: { 'joinRequests.$.status': approved ? 'approved' : 'rejected' },
        });
    }
    async getJoinRequestStatus(chatId, requestId) {
        const chat = await this.chatModel.findById(chatId).exec();
        if (!chat)
            throw new common_1.NotFoundException('Chat topilmadi');
        const request = chat.joinRequests.find((r) => r._id.toString() === requestId);
        if (!request)
            throw new common_1.NotFoundException("So'rov topilmadi");
        return {
            status: request.status,
            roomId: request.status === 'approved' ? chat.videoCallRoomId : undefined,
        };
    }
    async deleteChat(chatId, userId) {
        const chat = await this.chatModel.findById(chatId).exec();
        if (!chat)
            throw new common_1.NotFoundException('Suhbat topilmadi');
        const isMember = chat.members.some((m) => m.toString() === userId);
        if (!isMember) {
            throw new common_1.ForbiddenException("Sizda ushbu suhbatni o'chirish huquqi yo'q");
        }
        if (chat.isGroup && chat.createdBy?.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat guruh yaratuvchisi guruhni o'chira oladi");
        }
        const memberIds = chat.members.map((m) => m.toString());
        await this.messageModel
            .deleteMany({ chatId: new mongoose_2.Types.ObjectId(chatId) })
            .exec();
        await this.chatModel.findByIdAndDelete(chatId).exec();
        memberIds.forEach((mId) => {
            this.chatsGateway.server
                .to(`user_${mId}`)
                .emit('chat_deleted', { chatId });
        });
        return { success: true };
    }
    async leaveChat(chatId, userId) {
        const chat = await this.chatModel.findById(chatId).exec();
        if (!chat)
            throw new common_1.NotFoundException('Suhbat topilmadi');
        if (!chat.isGroup) {
            throw new common_1.ForbiddenException('Faqat guruhdan chiqish mumkin');
        }
        const isMember = chat.members.some((m) => m.toString() === userId);
        if (!isMember) {
            throw new common_1.ForbiddenException('Siz ushbu guruh a’zosi emassiz');
        }
        if (chat.createdBy?.toString() === userId) {
            throw new common_1.ForbiddenException('Guruh yaratuvchisi guruhni tark eta olmaydi, faqat o’chirishi mumkin');
        }
        chat.members = chat.members.filter((m) => m.toString() !== userId);
        chat.admins = chat.admins.filter((a) => a.userId.toString() !== userId);
        await chat.save();
        this.chatsGateway.server
            .to(`user_${userId}`)
            .emit('chat_deleted', { chatId });
        const remainingMembers = chat.members.map((m) => m.toString());
        remainingMembers.forEach((mId) => {
            this.chatsGateway.server.to(`user_${mId}`).emit('chat_updated', {
                _id: chat._id,
                members: chat.members,
                admins: chat.admins,
            });
        });
        return { success: true };
    }
};
exports.ChatsService = ChatsService;
exports.ChatsService = ChatsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_schema_1.Chat.name)),
    __param(1, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => chats_gateway_1.ChatsGateway))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        chats_gateway_1.ChatsGateway,
        r2_service_1.R2Service,
        encryption_service_1.EncryptionService,
        premium_service_1.PremiumService,
        app_settings_service_1.AppSettingsService])
], ChatsService);
//# sourceMappingURL=chats.service.js.map