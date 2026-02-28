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
let ChatsService = class ChatsService {
    chatModel;
    messageModel;
    userModel;
    chatsGateway;
    r2Service;
    constructor(chatModel, messageModel, userModel, chatsGateway, r2Service) {
        this.chatModel = chatModel;
        this.messageModel = messageModel;
        this.userModel = userModel;
        this.chatsGateway = chatsGateway;
        this.r2Service = r2Service;
    }
    async onModuleInit() {
        await this.backfillJammIds();
        await this.backfillPrivateUrls();
        await this.backfillAdmins();
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
    async getUserChats(userId) {
        const chats = await this.chatModel
            .find({ members: new mongoose_2.Types.ObjectId(userId) })
            .populate('members', 'username nickname avatar')
            .sort({ updatedAt: -1 })
            .lean()
            .exec();
        const chatsWithUnread = await Promise.all(chats.map(async (chat) => {
            const unreadCount = await this.messageModel.countDocuments({
                chatId: chat._id,
                senderId: { $ne: new mongoose_2.Types.ObjectId(userId) },
                readBy: { $ne: new mongoose_2.Types.ObjectId(userId) },
            });
            return {
                ...chat,
                unreadCount,
            };
        }));
        return chatsWithUnread;
    }
    async createChat(userId, dto) {
        const members = [
            new mongoose_2.Types.ObjectId(userId),
            ...dto.memberIds.map((id) => new mongoose_2.Types.ObjectId(id)),
        ];
        if (!dto.isGroup && members.length === 2) {
            const existing = await this.chatModel
                .findOne({
                isGroup: false,
                members: { $all: members, $size: 2 },
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
        if (chat.createdBy?.toString() === userId)
            return true;
        if (!chat.admins)
            return false;
        const admin = chat.admins.find((a) => a.userId.toString() === userId);
        if (!admin)
            return false;
        return admin.permissions.includes(permission);
    }
    async editChat(chatId, userId, dto) {
        const chat = await this.getChat(chatId, userId);
        if (!chat.isGroup) {
            throw new common_1.BadRequestException("Faqat guruh ma'lumotlarini o'zgartirish mumkin");
        }
        const isInfoEdit = dto.name !== undefined ||
            dto.description !== undefined ||
            dto.avatar !== undefined;
        if (isInfoEdit && !this.hasPermission(chat, userId, 'edit_group_info')) {
            throw new common_1.ForbiddenException("Sizda guruh ma'lumotlarini tahrirlash huquqi yo'q");
        }
        const oldMemberIds = chat.members.map((m) => m._id ? m._id.toString() : m.toString());
        let currentMemberIds = new Set(oldMemberIds);
        if (dto.admins !== undefined) {
            if (!this.hasPermission(chat, userId, 'add_admins')) {
                throw new common_1.ForbiddenException("Sizda adminlarni boshqarish huquqi yo'q");
            }
            chat.admins = dto.admins.map((a) => ({
                userId: new mongoose_2.Types.ObjectId(a.userId),
                permissions: a.permissions,
            }));
            dto.admins.forEach((a) => currentMemberIds.add(a.userId));
        }
        if (dto.members !== undefined) {
            const newMemberIds = dto.members;
            const added = newMemberIds.filter((id) => !currentMemberIds.has(id));
            if (added.length > 0 &&
                !this.hasPermission(chat, userId, 'add_members')) {
                throw new common_1.ForbiddenException("Sizda a'zo qo'shish huquqi yo'q");
            }
            const removed = Array.from(currentMemberIds).filter((id) => !newMemberIds.includes(id));
            if (removed.length > 0) {
                const onlySelfRemoved = removed.length === 1 && removed[0] === userId;
                if (!onlySelfRemoved &&
                    !this.hasPermission(chat, userId, 'remove_members')) {
                    throw new common_1.ForbiddenException("Sizda a'zo o'chirish huquqi yo'q");
                }
            }
            currentMemberIds = new Set(newMemberIds);
            if (chat.admins) {
                chat.admins.forEach((a) => currentMemberIds.add(String(a.userId || a.id)));
            }
        }
        if (!currentMemberIds.has(userId)) {
            if (chat.createdBy?.toString() === userId) {
                currentMemberIds.add(userId);
            }
        }
        chat.members = Array.from(currentMemberIds).map((id) => new mongoose_2.Types.ObjectId(id));
        if (dto.name !== undefined)
            chat.name = dto.name;
        if (dto.description !== undefined)
            chat.description = dto.description;
        if (dto.avatar !== undefined)
            chat.avatar = dto.avatar;
        await chat.save();
        const updated = await this.getChat(chatId, userId);
        const updatedMembers = updated.members;
        const updatedAdmins = updated.admins;
        const updatedCreatedBy = updated.createdBy;
        const rooms = new Set([`chat_${chatId}`]);
        if (oldMemberIds.length > 0) {
            oldMemberIds.forEach((id) => rooms.add(`user_${id}`));
        }
        if (chat.members) {
            chat.members.forEach((m) => rooms.add(`user_${m._id ? m._id.toString() : m.toString()}`));
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
            .populate('members', 'username nickname avatar')
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
            chat.members.push(userObjectId);
            await chat.save();
        }
        return this.getChat(chat._id.toString(), userId);
    }
    async getChatMessages(chatId, userId) {
        await this.getChat(chatId, userId);
        return this.messageModel
            .find({ chatId: new mongoose_2.Types.ObjectId(chatId), isDeleted: { $ne: true } })
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
    async sendMessage(chatId, userId, content, replayToId) {
        const chat = await this.getChat(chatId, userId);
        const messageData = {
            chatId: new mongoose_2.Types.ObjectId(chatId),
            senderId: new mongoose_2.Types.ObjectId(userId),
            content,
        };
        if (replayToId) {
            messageData.replayTo = new mongoose_2.Types.ObjectId(replayToId);
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
            chat.members.forEach((m) => rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`));
        }
        this.chatsGateway.server.to(rooms).emit('message_new', populatedMessage);
        return populatedMessage;
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
            chat.members.forEach((m) => rooms.push(`user_${m._id ? m._id.toString() : m.toString()}`));
        }
        this.chatsGateway.server
            .to(rooms)
            .emit('message_updated', populatedMessage);
        return populatedMessage;
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
                populate: { path: 'senderId', select: 'username nickname avatar' },
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
        r2_service_1.R2Service])
], ChatsService);
//# sourceMappingURL=chats.service.js.map