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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("./schemas/user.schema");
const chats_service_1 = require("../chats/chats.service");
const r2_service_1 = require("../common/services/r2.service");
let UsersService = class UsersService {
    userModel;
    r2Service;
    chatsService;
    constructor(userModel, r2Service, chatsService) {
        this.userModel = userModel;
        this.r2Service = r2Service;
        this.chatsService = chatsService;
    }
    async create(createUserDto) {
        const createdUser = new this.userModel(createUserDto);
        return createdUser.save();
    }
    async findByEmail(email) {
        return this.userModel.findOne({ email: email.toLowerCase() }).exec();
    }
    async findById(id) {
        return this.userModel.findById(id).exec();
    }
    async findByUsername(username) {
        return this.userModel.findOne({ username: username.toLowerCase() }).exec();
    }
    async findByVerificationToken(token) {
        return this.userModel.findOne({ verificationToken: token }).exec();
    }
    async searchUsers(query, currentUserId) {
        if (!query)
            return [];
        const regex = new RegExp(query, 'i');
        const safeFields = '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen';
        return this.userModel
            .find({
            _id: { $ne: currentUserId },
            $or: [{ username: regex }, { nickname: regex }],
        })
            .select(safeFields)
            .limit(10)
            .exec();
    }
    async searchGlobal(query, currentUserId) {
        if (!query)
            return [];
        const safeFields = '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen';
        const isJammId = /^\d+$/.test(query);
        const filter = {
            _id: { $ne: currentUserId },
        };
        if (isJammId) {
            filter.jammId = Number(query);
        }
        else {
            const regex = new RegExp(query, 'i');
            filter.$or = [{ username: regex }, { nickname: regex }];
        }
        return this.userModel.find(filter).select(safeFields).limit(10).exec();
    }
    async getAllUsers(currentUserId) {
        const safeFields = '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen';
        return this.userModel
            .find({ _id: { $ne: currentUserId } })
            .select(safeFields)
            .limit(100)
            .exec();
    }
    async updateProfile(userId, data) {
        if (data.username) {
            const existingUser = await this.userModel
                .findOne({ username: data.username })
                .exec();
            if (existingUser && existingUser._id.toString() !== userId) {
                throw new common_1.BadRequestException('Ushbu username band. Iltimos, boshqa username tanlang.');
            }
        }
        return this.userModel
            .findByIdAndUpdate(userId, { $set: data }, { new: true })
            .select('-password')
            .exec();
    }
    async updateAvatar(userId, file) {
        try {
            const avatarUrl = await this.r2Service.uploadFile(file, 'avatars');
            return this.updateProfile(userId, { avatar: avatarUrl });
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Avatar yuklashda xatolik yuz berdi');
        }
    }
    async toggleFollow(currentUserId, targetUserId) {
        if (currentUserId === targetUserId) {
            throw new common_1.BadRequestException("O'zingizga obuna bo'lolmaysiz");
        }
        const currentId = new mongoose_2.Types.ObjectId(currentUserId);
        const targetId = new mongoose_2.Types.ObjectId(targetUserId);
        const target = await this.userModel.findById(targetId);
        if (!target)
            throw new common_1.BadRequestException('Foydalanuvchi topilmadi');
        const isFollowing = (target.followers || []).some((id) => id.equals(currentId));
        if (isFollowing) {
            await this.userModel.findByIdAndUpdate(targetId, {
                $pull: { followers: currentId },
            });
            await this.userModel.findByIdAndUpdate(currentId, {
                $pull: { following: targetId },
            });
        }
        else {
            await this.userModel.findByIdAndUpdate(targetId, {
                $addToSet: { followers: currentId },
            });
            await this.userModel.findByIdAndUpdate(currentId, {
                $addToSet: { following: targetId },
            });
        }
        const updated = await this.userModel.findById(targetId);
        return {
            following: !isFollowing,
            followersCount: updated?.followers?.length || 0,
        };
    }
    async getPublicProfile(identifier, currentUserId) {
        const isJammId = /^\d{5,7}$/.test(identifier);
        const user = await this.userModel
            .findOne(isJammId ? { jammId: Number(identifier) } : { _id: identifier })
            .select('-password')
            .exec();
        if (!user)
            return null;
        const obj = user.toObject();
        const currentId = currentUserId ? new mongoose_2.Types.ObjectId(currentUserId) : null;
        return {
            _id: obj._id,
            jammId: obj.jammId,
            username: obj.username,
            nickname: obj.nickname,
            avatar: obj.avatar,
            bio: obj.bio || '',
            premiumStatus: obj.premiumStatus,
            followersCount: obj.followers?.length || 0,
            followingCount: obj.following?.length || 0,
            isFollowing: currentId
                ? (obj.followers || []).some((id) => new mongoose_2.Types.ObjectId(id).equals(currentId))
                : false,
            createdAt: obj.createdAt,
        };
    }
    async completeOnboarding(userId, data) {
        const { username, gender, age, ...rest } = data;
        const updates = {
            onboardingData: rest,
            isOnboardingCompleted: true,
        };
        if (username)
            updates.username = username;
        if (gender)
            updates.gender = gender;
        if (age)
            updates.age = Number(age);
        const user = await this.userModel
            .findByIdAndUpdate(userId, { $set: updates }, { new: true })
            .select('-password')
            .exec();
        try {
            if (user) {
                const jammUser = await this.userModel
                    .findOne({ username: 'jamm' }, { _id: 1 })
                    .exec();
                if (jammUser) {
                    const jammId = jammUser._id.toString();
                    const chat = await this.chatsService.createChat(jammId, {
                        isGroup: false,
                        memberIds: [userId],
                    });
                    const nickname = user.nickname || user.username || "Do'st";
                    await this.chatsService.sendMessage(chat._id.toString(), jammId, `Xush kelibsiz ${nickname}!`);
                }
            }
        }
        catch (error) {
            console.error('Failed to send welcome message from @Jamm:', error);
        }
        return user;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => chats_service_1.ChatsService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        r2_service_1.R2Service,
        chats_service_1.ChatsService])
], UsersService);
//# sourceMappingURL=users.service.js.map