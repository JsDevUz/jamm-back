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
const uuid_1 = require("uuid");
let ChatsService = class ChatsService {
    chatModel;
    messageModel;
    constructor(chatModel, messageModel) {
        this.chatModel = chatModel;
        this.messageModel = messageModel;
    }
    async getUserChats(userId) {
        return this.chatModel
            .find({ members: new mongoose_2.Types.ObjectId(userId) })
            .populate('members', 'username nickname avatar')
            .sort({ updatedAt: -1 })
            .exec();
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
            members,
        });
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
    async getChatMessages(chatId, userId) {
        await this.getChat(chatId, userId);
        return this.messageModel
            .find({ chatId: new mongoose_2.Types.ObjectId(chatId) })
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
        await this.getChat(chatId, userId);
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
        return message.populate([
            { path: 'senderId', select: 'username nickname avatar' },
            {
                path: 'replayTo',
                populate: { path: 'senderId', select: 'username nickname avatar' },
            },
        ]);
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
        return message.populate([
            { path: 'senderId', select: 'username nickname avatar' },
            {
                path: 'replayTo',
                populate: { path: 'senderId', select: 'username nickname avatar' },
            },
        ]);
    }
    async deleteMessage(messageId, userId) {
        const message = await this.messageModel.findById(messageId);
        if (!message)
            throw new common_1.NotFoundException('Xabar topilmadi');
        if (message.senderId.toString() !== userId) {
            throw new common_1.ForbiddenException("Siz faqat o'z xabarlaringizni o'chira olasiz");
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
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], ChatsService);
//# sourceMappingURL=chats.service.js.map