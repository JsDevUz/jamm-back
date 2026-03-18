import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { PremiumService } from '../premium/premium.service';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  getTierLimit,
} from '../common/limits/app-limits';
import { getAllowedOrigins } from '../common/config/cors.config';
import { verifySocketToken } from '../common/auth/ws-auth.util';
import { SocketRateLimiter } from '../common/ws/socket-rate-limiter';
import { Chat, ChatDocument } from '../chats/schemas/chat.schema';

interface KnockEntry {
  peerKey: string;
  displayName: string;
  socket: Socket;
}

interface RoomInfo {
  peers: Map<string, string>; // socketId -> displayName
  isPrivate: boolean;
  title: string;
  participantLimit: number;
  creatorSocketId: string;
  creatorUserId?: string;
  knockQueue: Map<string, KnockEntry>;
}

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{4,128}$/;

@WebSocketGateway({
  cors: { origin: getAllowedOrigins(), methods: ['GET', 'POST'], credentials: true },
  namespace: '/video',
})
export class VideoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms = new Map<string, RoomInfo>();
  private readonly rateLimiter = new SocketRateLimiter();

  constructor(
    @InjectModel(Chat.name)
    private readonly chatModel: Model<ChatDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly premiumService: PremiumService,
  ) {}

  private sanitizeDisplayName(rawValue: unknown): string {
    const value =
      typeof rawValue === 'string'
        ? rawValue
            .replace(/[\u0000-\u001F\u007F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '';

    return value.slice(0, 60) || 'Guest';
  }

  private sanitizeRoomTitle(rawValue: unknown): string {
    if (typeof rawValue !== 'string') return '';

    return rawValue
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, APP_TEXT_LIMITS.meetTitleChars);
  }

  private isSocketInRoom(room: RoomInfo | undefined, socketId: string): boolean {
    return Boolean(room?.peers.has(socketId));
  }

  private findSharedRoomForPeers(
    sourceSocketId: string,
    targetSocketId: string,
  ): {
    roomId: string;
    room: RoomInfo;
  } | null {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.peers.has(sourceSocketId) && room.peers.has(targetSocketId)) {
        return { roomId, room };
      }
    }

    return null;
  }

  private canCreatorControlPeer(
    room: RoomInfo | undefined,
    creatorSocketId: string,
    targetPeerId: string,
  ): boolean {
    return Boolean(
      room &&
        room.creatorSocketId === creatorSocketId &&
        room.peers.has(targetPeerId),
    );
  }

  private getPeerKey(client: Socket): string {
    return String(client.data?.user?._id || client.id);
  }

  private isUserChatMember(chat: ChatDocument, userId: string): boolean {
    return chat.members.some((memberId) => String(memberId) === userId);
  }

  private async rehydratePrivateRoom(
    roomId: string,
    userId: string,
  ): Promise<RoomInfo | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const chat = await this.chatModel
      .findOne({
        videoCallRoomId: roomId,
        members: new Types.ObjectId(userId),
      })
      .select('name members videoCallCreatorId')
      .exec();

    if (!chat || !chat.videoCallCreatorId || !this.isUserChatMember(chat, userId)) {
      return null;
    }

    const room: RoomInfo = {
      peers: new Map(),
      isPrivate: true,
      title: this.sanitizeRoomTitle(chat.name) || 'Private meet',
      participantLimit: 2,
      creatorSocketId: '',
      creatorUserId: String(chat.videoCallCreatorId),
      knockQueue: new Map(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  private notifyCreatorOfPendingKnocks(roomId: string, room: RoomInfo) {
    if (!room.creatorSocketId || room.knockQueue.size === 0) {
      return;
    }

    room.knockQueue.forEach((entry) => {
      this.server.to(room.creatorSocketId).emit('knock-request', {
        peerId: entry.peerKey,
        displayName: entry.displayName,
      });
    });
  }

  async handleConnection(client: Socket) {
    try {
      const payload = await verifySocketToken(
        this.jwtService,
        this.configService,
        client,
      );
      if (payload) {
        client.data.user = {
          _id: payload.sub,
          email: payload.email,
        };
      }
    } catch (err) {
      client.data.user = null;
      console.log(`[Video] auth error for ${client.id}:`, err.message);
    }
    console.log(`[Video] connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Video] disconnected: ${client.id}`);
    this.rooms.forEach((room, roomId) => {
      if (room.peers.has(client.id)) {
        room.peers.delete(client.id);
        client.to(roomId).emit('peer-left', { peerId: client.id });
        if (room.peers.size === 0) this.rooms.delete(roomId);
      }
      const knockEntries = Array.from(room.knockQueue.entries());
      const matchingKnockEntry = knockEntries.find(
        ([, entry]) => entry.socket.id === client.id,
      );

      if (matchingKnockEntry) {
        room.knockQueue.delete(matchingKnockEntry[0]);
        if (room.creatorSocketId === client.id) {
          room.knockQueue.forEach((entry) => {
            this.server
              .to(entry.socket.id)
              .emit('knock-rejected', { reason: 'Creator left' });
          });
          room.knockQueue.clear();
        }
      }
    });
  }

  // ─── Room Management ────────────────────────────────────────────────────────

  @SubscribeMessage('create-room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      displayName: string;
      isPrivate?: boolean;
      title?: string;
    },
  ) {
    this.rateLimiter.take(`video:create-room:${client.id}`, 5, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const displayName = this.sanitizeDisplayName(data?.displayName);
    const isPrivate = Boolean(data?.isPrivate);
    const title = this.sanitizeRoomTitle(data?.title);

    const userId = client.data?.user?._id;
    if (!userId) {
      client.emit('error', {
        message: 'Authentication required to create a room',
      });
      return;
    }

    if (!ROOM_ID_PATTERN.test(roomId)) {
      client.emit('error', { message: 'Room ID noto‘g‘ri' });
      return;
    }

    const existingRoom = this.rooms.get(roomId);
    if (existingRoom) {
      if (existingRoom.creatorUserId !== userId) {
        client.emit('error', {
          message: 'Bu room allaqachon mavjud. Yangisini yarating.',
        });
        return;
      }

      const previousCreatorSocketId = existingRoom.creatorSocketId;
      if (
        previousCreatorSocketId &&
        previousCreatorSocketId !== client.id &&
        existingRoom.peers.has(previousCreatorSocketId)
      ) {
        existingRoom.peers.delete(previousCreatorSocketId);
        client.to(roomId).emit('peer-left', { peerId: previousCreatorSocketId });
        const previousCreatorSocket = this.server.sockets.sockets.get(
          previousCreatorSocketId,
        );
        previousCreatorSocket?.leave(roomId);
      }

      existingRoom.creatorSocketId = client.id;
      this.admitPeer(client, roomId, displayName, existingRoom);
      client.emit('room-created', {
        roomId,
        isPrivate: existingRoom.isPrivate,
        title: existingRoom.title,
        reconnected: true,
      });
      client.emit('room-info', {
        title: existingRoom.title,
        isPrivate: existingRoom.isPrivate,
      });
      this.notifyCreatorOfPendingKnocks(roomId, existingRoom);
      return;
    }

    let activeRoomsCount = 0;
    this.rooms.forEach((room) => {
      if (room.creatorUserId === userId) {
        activeRoomsCount++;
      }
    });

    try {
      const status = await this.premiumService.getPremiumStatus(userId);

      if (activeRoomsCount >= 1) {
        client.emit('error', {
          message: "Sizda allaqachon faol meet mavjud.",
        });
        return;
      }

      if (title.length > APP_TEXT_LIMITS.meetTitleChars) {
        client.emit('error', {
          message: `Meet nomi maksimal ${APP_TEXT_LIMITS.meetTitleChars} ta belgidan oshmasligi kerak`,
        });
        return;
      }

      const participantLimit = getTierLimit(APP_LIMITS.meetParticipants, status);

      this.rooms.set(roomId, {
        peers: new Map([[client.id, displayName]]),
        isPrivate,
        title,
        participantLimit,
        creatorSocketId: client.id,
        creatorUserId: userId,
        knockQueue: new Map(),
      });

      client.join(roomId);
      client.emit('room-created', { roomId, isPrivate, title });
      console.log(
        `[Video] created room ${roomId} "${title}" (${isPrivate ? 'private' : 'open'}) by ${displayName}`,
      );
      return;
    } catch (err) {
      console.error('[Video] Premium check error:', err);
      client.emit('error', { message: 'Failed to check premium status' });
      return;
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; displayName: string },
  ) {
    this.rateLimiter.take(`video:join-room:${client.id}`, 15, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const displayName = this.sanitizeDisplayName(data?.displayName);
    const userId = String(client.data?.user?._id || '');
    let room: RoomInfo | null | undefined = this.rooms.get(roomId);
    const peerKey = this.getPeerKey(client);

    if (!room) {
      room = await this.rehydratePrivateRoom(roomId, userId);
      if (!room) {
        client.emit('error', { message: 'Room not found' });
        return;
      }
    }

    if (room.peers.has(client.id)) {
      client.emit('room-info', {
        title: room.title,
        isPrivate: room.isPrivate,
      });
      return;
    }

    if (room.peers.size >= room.participantLimit) {
      client.emit('error', {
        message: `Bu room uchun maksimal ${room.participantLimit} ta ishtirokchi ruxsat etilgan`,
      });
      return;
    }

    if (room.isPrivate) {
      if (room.knockQueue.has(peerKey)) {
        const existingEntry = room.knockQueue.get(peerKey);
        if (existingEntry) {
          existingEntry.socket = client;
          existingEntry.displayName = displayName;
        }
        client.emit('waiting-for-approval');
        client.emit('room-info', {
          title: room.title,
          isPrivate: room.isPrivate,
        });
        return;
      }

      room.knockQueue.set(peerKey, {
        peerKey,
        displayName,
        socket: client,
      });
      this.server.to(room.creatorSocketId).emit('knock-request', {
        peerId: peerKey,
        displayName,
      });
      client.emit('waiting-for-approval');
      // Send room info (title) to the waiting guest
      client.emit('room-info', {
        title: room.title,
        isPrivate: room.isPrivate,
      });
      return;
    }

    // Open room: join immediately
    this.admitPeer(client, roomId, displayName, room);
    // Send room info to newly joined peer
    client.emit('room-info', { title: room.title, isPrivate: room.isPrivate });
  }

  /** Internal: fully admit a peer into the room */
  private admitPeer(
    client: Socket,
    roomId: string,
    displayName: string,
    room: RoomInfo,
  ) {
    // Send existing peers to newcomer
    const existingPeers = Array.from(room.peers.entries()).map(
      ([id, name]) => ({
        peerId: id,
        displayName: name,
      }),
    );
    client.emit('existing-peers', { peers: existingPeers });

    // Notify existing peers
    client.to(roomId).emit('peer-joined', { peerId: client.id, displayName });

    // Add to room
    room.peers.set(client.id, displayName);
    client.join(roomId);
  }

  private emitRoomInfo(roomId: string, room: RoomInfo) {
    this.server.to(roomId).emit('room-info', {
      title: room.title,
      isPrivate: room.isPrivate,
    });
  }

  // ─── Approval Flow ──────────────────────────────────────────────────────────

  @SubscribeMessage('approve-knock')
  handleApproveKnock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:approve-knock:${client.id}`, 30, 60_000);
    const { roomId, peerId } = data;
    const room = this.rooms.get(roomId);
    if (!room || room.creatorSocketId !== client.id) return;

    const entry = room.knockQueue.get(peerId);
    if (!entry) return;

    if (room.peers.size >= room.participantLimit) {
      this.server.to(entry.socket.id).emit('knock-rejected', {
        reason: 'Room to‘lib bo‘lgan',
      });
      room.knockQueue.delete(peerId);
      return;
    }

    room.knockQueue.delete(peerId);

    // Notify the guest they're approved. Mic/cam are allowed by default.
    this.server
      .to(entry.socket.id)
      .emit('knock-approved', { roomId, title: room.title, mediaLocked: false });

    // Admit them using the stored socket reference
    this.admitPeer(entry.socket, roomId, entry.displayName, room);
  }

  @SubscribeMessage('reject-knock')
  handleRejectKnock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:reject-knock:${client.id}`, 30, 60_000);
    const { roomId, peerId } = data;
    const room = this.rooms.get(roomId);
    if (!room || room.creatorSocketId !== client.id) return;

    const entry = room.knockQueue.get(peerId);
    if (!entry) return;

    room.knockQueue.delete(peerId);
    this.server
      .to(entry.socket.id)
      .emit('knock-rejected', { reason: 'Creator rad etdi' });
  }

  @SubscribeMessage('set-room-privacy')
  handleSetRoomPrivacy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isPrivate: boolean },
  ) {
    this.rateLimiter.take(`video:set-room-privacy:${client.id}`, 30, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!room || room.creatorSocketId !== client.id) return;

    room.isPrivate = Boolean(data?.isPrivate);
    this.emitRoomInfo(roomId, room);

    if (!room.isPrivate && room.knockQueue.size > 0) {
      for (const [peerId, entry] of Array.from(room.knockQueue.entries())) {
        if (room.peers.size >= room.participantLimit) {
          this.server.to(entry.socket.id).emit('knock-rejected', {
            reason: 'Room to‘lib bo‘lgan',
          });
          room.knockQueue.delete(peerId);
          continue;
        }

        room.knockQueue.delete(peerId);
        this.server.to(entry.socket.id).emit('knock-approved', {
          roomId,
          title: room.title,
          mediaLocked: false,
        });
        this.admitPeer(entry.socket, roomId, entry.displayName, room);
        this.server.to(entry.socket.id).emit('room-info', {
          title: room.title,
          isPrivate: room.isPrivate,
        });
      }
    }
  }

  // ─── WebRTC Signaling ────────────────────────────────────────────────────────

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; sdp: any },
  ) {
    this.rateLimiter.take(`video:offer:${client.id}`, 600, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server
      .to(targetId)
      .emit('offer', { senderId: client.id, sdp: data.sdp });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; sdp: any },
  ) {
    this.rateLimiter.take(`video:answer:${client.id}`, 600, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server
      .to(targetId)
      .emit('answer', { senderId: client.id, sdp: data.sdp });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; candidate: any },
  ) {
    this.rateLimiter.take(`video:ice:${client.id}`, 4000, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server.to(targetId).emit('ice-candidate', {
      senderId: client.id,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:leave-room:${client.id}`, 30, 60_000);
    const { roomId } = data;
    const room = this.rooms.get(roomId);
    if (room?.peers.has(client.id) || room?.knockQueue.has(client.id)) {
      room.peers.delete(client.id);
      room.knockQueue.delete(client.id);
      if (room.peers.size === 0) this.rooms.delete(roomId);
    } else {
      return;
    }
    client.to(roomId).emit('peer-left', { peerId: client.id });
    client.leave(roomId);
  }

  // ─── Screen Share Relay ─────────────────────────────────────────────────────

  @SubscribeMessage('screen-share-started')
  handleScreenShareStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:screen:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('screen-share-started', { peerId: client.id });
  }

  @SubscribeMessage('screen-share-stopped')
  handleScreenShareStopped(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:screen:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('screen-share-stopped', { peerId: client.id });
  }

  // ─── Recording Relay ────────────────────────────────────────────────────────

  @SubscribeMessage('recording-started')
  handleRecordingStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:recording:${client.id}`, 60, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('recording-started', { peerId: client.id });
  }

  @SubscribeMessage('recording-stopped')
  handleRecordingStopped(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:recording:${client.id}`, 60, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('recording-stopped', { peerId: client.id });
  }

  // ─── Creator Media Controls ─────────────────────────────────────────────────

  @SubscribeMessage('force-mute-mic')
  handleForceMuteMic(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:creator-controls:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.canCreatorControlPeer(room, client.id, data.peerId)) return;
    this.server.to(data.peerId).emit('force-mute-mic');
  }

  @SubscribeMessage('force-mute-cam')
  handleForceMuteCam(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:creator-controls:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.canCreatorControlPeer(room, client.id, data.peerId)) return;
    this.server.to(data.peerId).emit('force-mute-cam');
  }

  @SubscribeMessage('allow-mic')
  handleAllowMic(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:creator-controls:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.canCreatorControlPeer(room, client.id, data.peerId)) return;
    this.server.to(data.peerId).emit('allow-mic');
  }

  @SubscribeMessage('allow-cam')
  handleAllowCam(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:creator-controls:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.canCreatorControlPeer(room, client.id, data.peerId)) return;
    this.server.to(data.peerId).emit('allow-cam');
  }

  // ─── Hand Raise ─────────────────────────────────────────────────────────────

  @SubscribeMessage('hand-raised')
  handleHandRaised(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('hand-raised', { peerId: client.id });
  }

  @SubscribeMessage('hand-lowered')
  handleHandLowered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('hand-lowered', { peerId: client.id });
  }

  // ─── Kick Peer ──────────────────────────────────────────────────────────────

  @SubscribeMessage('kick-peer')
  handleKickPeer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (
      !room ||
      room.creatorSocketId !== client.id ||
      !room.peers.has(data.peerId)
    )
      return;
    // Notify the kicked peer
    this.server.to(data.peerId).emit('kicked');
    // Notify others
    client.to(data.roomId).emit('peer-left', { peerId: data.peerId });
    // Remove from room
    room.peers.delete(data.peerId);
    // Force leave the socket from the room
    const kickedSocket = this.server.sockets.sockets.get(data.peerId);
    if (kickedSocket) kickedSocket.leave(data.roomId);
  }
}
