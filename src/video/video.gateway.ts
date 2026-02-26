import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

interface RoomInfo {
  peers: Map<string, string>; // socketId -> displayName
  isPrivate: boolean;
  creatorSocketId: string;
  // Pending knock requests for private rooms: socketId -> displayName
  knockQueue: Map<string, string>;
}

@WebSocketGateway({
  cors: { origin: "*", methods: ["GET", "POST"] },
  namespace: "/video",
})
export class VideoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms = new Map<string, RoomInfo>();

  handleConnection(client: Socket) {
    console.log(`[Video] connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Video] disconnected: ${client.id}`);
    this.rooms.forEach((room, roomId) => {
      if (room.peers.has(client.id)) {
        room.peers.delete(client.id);
        client.to(roomId).emit("peer-left", { peerId: client.id });
        if (room.peers.size === 0) this.rooms.delete(roomId);
      }
      // Also remove from knock queue
      if (room.knockQueue.has(client.id)) {
        room.knockQueue.delete(client.id);
        // If the disconnected one was the creator, notify remaining waiters
        if (room.creatorSocketId === client.id) {
          room.knockQueue.forEach((_, sid) => {
            this.server
              .to(sid)
              .emit("knock-rejected", { reason: "Creator left" });
          });
          room.knockQueue.clear();
        }
      }
    });
  }

  // ─── Room Management ────────────────────────────────────────────────────────

  @SubscribeMessage("create-room")
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; displayName: string; isPrivate?: boolean },
  ) {
    const { roomId, displayName, isPrivate = false } = data;
    this.rooms.set(roomId, {
      peers: new Map([[client.id, displayName]]),
      isPrivate,
      creatorSocketId: client.id,
      knockQueue: new Map(),
    });
    client.join(roomId);
    client.emit("room-created", { roomId, isPrivate });
    console.log(
      `[Video] created room ${roomId} (${isPrivate ? "private" : "open"}) by ${displayName}`,
    );
  }

  @SubscribeMessage("join-room")
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; displayName: string },
  ) {
    const { roomId, displayName } = data;
    const room = this.rooms.get(roomId);

    if (!room) {
      client.emit("error", { message: "Room not found" });
      return;
    }

    if (room.isPrivate) {
      // Put guest in knock queue — don't add to room yet
      room.knockQueue.set(client.id, displayName);
      // Notify creator
      this.server.to(room.creatorSocketId).emit("knock-request", {
        peerId: client.id,
        displayName,
      });
      // Tell guest they're waiting
      client.emit("waiting-for-approval");
      return;
    }

    // Open room: join immediately
    this.admitPeer(client, roomId, displayName, room);
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
    client.emit("existing-peers", { peers: existingPeers });

    // Notify existing peers
    client.to(roomId).emit("peer-joined", { peerId: client.id, displayName });

    // Add to room
    room.peers.set(client.id, displayName);
    client.join(roomId);
  }

  // ─── Approval Flow ──────────────────────────────────────────────────────────

  @SubscribeMessage("approve-knock")
  handleApproveKnock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    const { roomId, peerId } = data;
    const room = this.rooms.get(roomId);
    if (!room || room.creatorSocketId !== client.id) return;

    const displayName = room.knockQueue.get(peerId);
    if (!displayName) return;

    room.knockQueue.delete(peerId);

    // Notify the guest they're approved
    this.server.to(peerId).emit("knock-approved", { roomId });

    // Admit them: get their socket and join them
    const guestSocket = this.server.sockets.sockets.get(peerId);
    if (guestSocket) {
      this.admitPeer(guestSocket, roomId, displayName, room);
    }
  }

  @SubscribeMessage("reject-knock")
  handleRejectKnock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    const { roomId, peerId } = data;
    const room = this.rooms.get(roomId);
    if (!room || room.creatorSocketId !== client.id) return;

    room.knockQueue.delete(peerId);
    this.server
      .to(peerId)
      .emit("knock-rejected", { reason: "Creator rad etdi" });
  }

  // ─── WebRTC Signaling ────────────────────────────────────────────────────────

  @SubscribeMessage("offer")
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; sdp: any },
  ) {
    this.server
      .to(data.targetId)
      .emit("offer", { senderId: client.id, sdp: data.sdp });
  }

  @SubscribeMessage("answer")
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; sdp: any },
  ) {
    this.server
      .to(data.targetId)
      .emit("answer", { senderId: client.id, sdp: data.sdp });
  }

  @SubscribeMessage("ice-candidate")
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; candidate: any },
  ) {
    this.server
      .to(data.targetId)
      .emit("ice-candidate", {
        senderId: client.id,
        candidate: data.candidate,
      });
  }

  @SubscribeMessage("leave-room")
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const { roomId } = data;
    const room = this.rooms.get(roomId);
    if (room) {
      room.peers.delete(client.id);
      room.knockQueue.delete(client.id);
      if (room.peers.size === 0) this.rooms.delete(roomId);
    }
    client.to(roomId).emit("peer-left", { peerId: client.id });
    client.leave(roomId);
  }
}
