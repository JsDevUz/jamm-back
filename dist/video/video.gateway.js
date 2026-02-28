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
exports.VideoGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let VideoGateway = class VideoGateway {
    server;
    rooms = new Map();
    handleConnection(client) {
        console.log(`[Video] connected: ${client.id}`);
    }
    handleDisconnect(client) {
        console.log(`[Video] disconnected: ${client.id}`);
        this.rooms.forEach((room, roomId) => {
            if (room.peers.has(client.id)) {
                room.peers.delete(client.id);
                client.to(roomId).emit('peer-left', { peerId: client.id });
                if (room.peers.size === 0)
                    this.rooms.delete(roomId);
            }
            if (room.knockQueue.has(client.id)) {
                room.knockQueue.delete(client.id);
                if (room.creatorSocketId === client.id) {
                    room.knockQueue.forEach((entry, sid) => {
                        this.server
                            .to(sid)
                            .emit('knock-rejected', { reason: 'Creator left' });
                    });
                    room.knockQueue.clear();
                }
            }
        });
    }
    handleCreateRoom(client, data) {
        const { roomId, displayName, isPrivate = false, title = '' } = data;
        this.rooms.set(roomId, {
            peers: new Map([[client.id, displayName]]),
            isPrivate,
            title,
            creatorSocketId: client.id,
            knockQueue: new Map(),
        });
        client.join(roomId);
        client.emit('room-created', { roomId, isPrivate, title });
        console.log(`[Video] created room ${roomId} "${title}" (${isPrivate ? 'private' : 'open'}) by ${displayName}`);
    }
    async handleJoinRoom(client, data) {
        const { roomId, displayName } = data;
        const room = this.rooms.get(roomId);
        if (!room) {
            client.emit('error', { message: 'Room not found' });
            return;
        }
        if (room.isPrivate) {
            room.knockQueue.set(client.id, { displayName, socket: client });
            this.server.to(room.creatorSocketId).emit('knock-request', {
                peerId: client.id,
                displayName,
            });
            client.emit('waiting-for-approval');
            client.emit('room-info', {
                title: room.title,
                isPrivate: room.isPrivate,
            });
            return;
        }
        this.admitPeer(client, roomId, displayName, room);
        client.emit('room-info', { title: room.title, isPrivate: room.isPrivate });
    }
    admitPeer(client, roomId, displayName, room) {
        const existingPeers = Array.from(room.peers.entries()).map(([id, name]) => ({
            peerId: id,
            displayName: name,
        }));
        client.emit('existing-peers', { peers: existingPeers });
        client.to(roomId).emit('peer-joined', { peerId: client.id, displayName });
        room.peers.set(client.id, displayName);
        client.join(roomId);
    }
    handleApproveKnock(client, data) {
        const { roomId, peerId } = data;
        const room = this.rooms.get(roomId);
        if (!room || room.creatorSocketId !== client.id)
            return;
        const entry = room.knockQueue.get(peerId);
        if (!entry)
            return;
        room.knockQueue.delete(peerId);
        this.server
            .to(peerId)
            .emit('knock-approved', { roomId, title: room.title, mediaLocked: true });
        this.admitPeer(entry.socket, roomId, entry.displayName, room);
    }
    handleRejectKnock(client, data) {
        const { roomId, peerId } = data;
        const room = this.rooms.get(roomId);
        if (!room || room.creatorSocketId !== client.id)
            return;
        room.knockQueue.delete(peerId);
        this.server
            .to(peerId)
            .emit('knock-rejected', { reason: 'Creator rad etdi' });
    }
    handleOffer(client, data) {
        this.server
            .to(data.targetId)
            .emit('offer', { senderId: client.id, sdp: data.sdp });
    }
    handleAnswer(client, data) {
        this.server
            .to(data.targetId)
            .emit('answer', { senderId: client.id, sdp: data.sdp });
    }
    handleIceCandidate(client, data) {
        this.server.to(data.targetId).emit('ice-candidate', {
            senderId: client.id,
            candidate: data.candidate,
        });
    }
    handleLeaveRoom(client, data) {
        const { roomId } = data;
        const room = this.rooms.get(roomId);
        if (room) {
            room.peers.delete(client.id);
            room.knockQueue.delete(client.id);
            if (room.peers.size === 0)
                this.rooms.delete(roomId);
        }
        client.to(roomId).emit('peer-left', { peerId: client.id });
        client.leave(roomId);
    }
    handleScreenShareStarted(client, data) {
        client.to(data.roomId).emit('screen-share-started', { peerId: client.id });
    }
    handleScreenShareStopped(client, data) {
        client.to(data.roomId).emit('screen-share-stopped', { peerId: client.id });
    }
    handleRecordingStarted(client, data) {
        client.to(data.roomId).emit('recording-started', { peerId: client.id });
    }
    handleRecordingStopped(client, data) {
        client.to(data.roomId).emit('recording-stopped', { peerId: client.id });
    }
    handleForceMuteMic(client, data) {
        const room = this.rooms.get(data.roomId);
        if (!room || room.creatorSocketId !== client.id)
            return;
        this.server.to(data.peerId).emit('force-mute-mic');
    }
    handleForceMuteCam(client, data) {
        const room = this.rooms.get(data.roomId);
        if (!room || room.creatorSocketId !== client.id)
            return;
        this.server.to(data.peerId).emit('force-mute-cam');
    }
    handleAllowMic(client, data) {
        const room = this.rooms.get(data.roomId);
        if (!room || room.creatorSocketId !== client.id)
            return;
        this.server.to(data.peerId).emit('allow-mic');
    }
    handleAllowCam(client, data) {
        const room = this.rooms.get(data.roomId);
        if (!room || room.creatorSocketId !== client.id)
            return;
        this.server.to(data.peerId).emit('allow-cam');
    }
    handleHandRaised(client, data) {
        client.to(data.roomId).emit('hand-raised', { peerId: client.id });
    }
    handleHandLowered(client, data) {
        client.to(data.roomId).emit('hand-lowered', { peerId: client.id });
    }
    handleKickPeer(client, data) {
        const room = this.rooms.get(data.roomId);
        if (!room || room.creatorSocketId !== client.id)
            return;
        this.server.to(data.peerId).emit('kicked');
        client.to(data.roomId).emit('peer-left', { peerId: data.peerId });
        room.peers.delete(data.peerId);
        const kickedSocket = this.server.sockets.sockets.get(data.peerId);
        if (kickedSocket)
            kickedSocket.leave(data.roomId);
    }
};
exports.VideoGateway = VideoGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], VideoGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('create-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VideoGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('approve-knock'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleApproveKnock", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('reject-knock'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleRejectKnock", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('offer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleOffer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('answer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('ice-candidate'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleIceCandidate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('screen-share-started'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleScreenShareStarted", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('screen-share-stopped'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleScreenShareStopped", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('recording-started'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleRecordingStarted", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('recording-stopped'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleRecordingStopped", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('force-mute-mic'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleForceMuteMic", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('force-mute-cam'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleForceMuteCam", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('allow-mic'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleAllowMic", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('allow-cam'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleAllowCam", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('hand-raised'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleHandRaised", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('hand-lowered'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleHandLowered", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('kick-peer'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VideoGateway.prototype, "handleKickPeer", null);
exports.VideoGateway = VideoGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*', methods: ['GET', 'POST'] },
        namespace: '/video',
    })
], VideoGateway);
//# sourceMappingURL=video.gateway.js.map