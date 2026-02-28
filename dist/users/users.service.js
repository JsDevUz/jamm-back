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
const r2_service_1 = require("../common/services/r2.service");
let UsersService = class UsersService {
    userModel;
    r2Service;
    constructor(userModel, r2Service) {
        this.userModel = userModel;
        this.r2Service = r2Service;
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
        return this.userModel.findOne({ username }).exec();
    }
    async searchUsers(query, currentUserId) {
        if (!query)
            return [];
        const regex = new RegExp(query, 'i');
        return this.userModel
            .find({
            _id: { $ne: currentUserId },
            $or: [{ username: regex }, { nickname: regex }],
        })
            .select('-password')
            .limit(10)
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
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        r2_service_1.R2Service])
], UsersService);
//# sourceMappingURL=users.service.js.map