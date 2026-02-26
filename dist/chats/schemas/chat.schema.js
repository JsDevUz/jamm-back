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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSchema = exports.Chat = exports.JoinRequest = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
class JoinRequest {
    _id;
    name;
    userId;
    status;
    createdAt;
}
exports.JoinRequest = JoinRequest;
let Chat = class Chat {
    isGroup;
    name;
    avatar;
    description;
    members;
    lastMessage;
    lastMessageAt;
    videoCallRoomId;
    videoCallCreatorId;
    joinRequests;
};
exports.Chat = Chat;
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: false }),
    __metadata("design:type", Boolean)
], Chat.prototype, "isGroup", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Chat.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Chat.prototype, "avatar", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Chat.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'User' }] }),
    __metadata("design:type", Array)
], Chat.prototype, "members", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Chat.prototype, "lastMessage", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Chat.prototype, "lastMessageAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Chat.prototype, "videoCallRoomId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Chat.prototype, "videoCallCreatorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                name: String,
                userId: String,
                status: {
                    type: String,
                    enum: ['pending', 'approved', 'rejected'],
                    default: 'pending',
                },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Chat.prototype, "joinRequests", void 0);
exports.Chat = Chat = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Chat);
exports.ChatSchema = mongoose_1.SchemaFactory.createForClass(Chat);
//# sourceMappingURL=chat.schema.js.map