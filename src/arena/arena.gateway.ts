import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ArenaService, BattleRoom } from './arena.service';

// Gateway for real-time Arena Battle Room communication

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/arena',
})
export class ArenaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private arenaService: ArenaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (token) {
        const payload = this.jwtService.verify(token);
        const user = await this.usersService.findById(payload.sub);
        if (user) {
          client.data.user = user;
          console.log(
            `Arena Client connected: ${client.id} (User: ${user._id})`,
          );
          return;
        }
      }

      // Guest Mode: No token or invalid token, but guestName provided
      const guestName = client.handshake.auth.guestName;
      if (guestName) {
        client.data.user = {
          _id: `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          nickname: guestName,
          isGuest: true,
        };
        console.log(`Arena Guest connected: ${client.id} (Name: ${guestName})`);
      } else {
        throw new Error('Unauthenticated');
      }
    } catch (error) {
      console.error('Arena Socket Connection Error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Arena Client disconnected: ${client.id}`);
    // If client was in a waiting lobby, remove them.
    for (const [roomId, room] of this.arenaService
      .getAllActiveBattlesRaw()
      .entries()) {
      const idx = room.participants.findIndex((p) => p.socketId === client.id);
      if (idx !== -1) {
        room.participants.splice(idx, 1);
        this.server.to(roomId).emit('battle_update', room); // notify others
        break;
      }
    }
  }

  @SubscribeMessage('create_battle')
  handleCreateBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      testId: string;
      roomName: string;
      mode: 'solo' | 'team';
      visibility?: 'public' | 'unlisted';
    },
  ) {
    const roomId = `battle_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const user = client.data.user;

    const newBattle: BattleRoom = {
      roomId,
      roomName: payload.roomName || 'Yangi Bellashuv',
      testId: payload.testId,
      hostId: user._id.toString(),
      mode: payload.mode,
      status: 'waiting',
      visibility: payload.visibility || 'public',
      currentQuestionIndex: 0,
      participants: [
        {
          socketId: client.id,
          userId: user._id.toString(),
          nickname: user.nickname || user.username,
          score: 0,
          hasAnsweredCurrent: false,
        },
      ],
    };

    this.arenaService.createActiveBattle(newBattle);
    client.join(roomId);

    client.emit('battle_created', { roomId });
    this.server.to(roomId).emit('battle_update', newBattle);
  }

  @SubscribeMessage('join_battle')
  handleJoinBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const room = this.arenaService.getActiveBattle(payload.roomId);
    if (!room) {
      return client.emit('error', 'Bellashuv topilmadi');
    }
    if (room.status !== 'waiting') {
      return client.emit('error', 'Bellashuv allaqachon boshlangan');
    }

    const user = client.data.user;
    const guestName = client.handshake.auth.guestName;
    const userIdStr = user?._id?.toString() || `guest_${client.id}`;
    const nickname = user?.nickname || user?.username || guestName || 'Mehmon';

    // Prevent duplicate joining
    if (!room.participants.find((p) => p.userId === userIdStr)) {
      room.participants.push({
        socketId: client.id,
        userId: userIdStr,
        nickname: nickname,
        score: 0,
        hasAnsweredCurrent: false,
      });
    }

    client.join(payload.roomId);
    this.server.to(payload.roomId).emit('battle_update', room);
  }

  @SubscribeMessage('leave_battle')
  handleLeaveBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const room = this.arenaService.getActiveBattle(payload.roomId);
    if (room) {
      const idx = room.participants.findIndex((p) => p.socketId === client.id);
      if (idx !== -1) {
        room.participants.splice(idx, 1);
        client.leave(payload.roomId);
        console.log(`User ${client.id} left room ${payload.roomId}`);
        this.server.to(payload.roomId).emit('battle_update', room);
      }
    }
  }

  @SubscribeMessage('start_battle')
  handleStartBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const room = this.arenaService.getActiveBattle(payload.roomId);
    const user = client.data.user;

    console.log('--- START BATTLE REQUEST ---');
    console.log('Room ID:', payload.roomId);
    console.log('Room Status:', room?.status);
    console.log('Room Host ID:', room?.hostId);
    console.log('Requested User ID:', user?._id?.toString());
    console.log('----------------------------');

    if (
      room &&
      String(room.hostId) === user._id.toString() &&
      room.status === 'waiting'
    ) {
      room.status = 'playing';
      this.server.to(payload.roomId).emit('battle_started', room);
    } else {
      console.log('Start Battle condition failed!');
    }
  }

  @SubscribeMessage('submit_answer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { roomId: string; answerIndex: number },
  ) {
    const room = this.arenaService.getActiveBattle(payload.roomId);
    if (!room || room.status !== 'playing') return;

    const participant = room.participants.find((p) => p.socketId === client.id);
    if (!participant || participant.hasAnsweredCurrent) return;

    participant.hasAnsweredCurrent = true;

    // Server-side answer validation
    try {
      const test = await this.arenaService.getTestByIdInternal(room.testId);
      const currentQuestion = test.questions[room.currentQuestionIndex];

      if (
        currentQuestion &&
        payload.answerIndex === currentQuestion.correctOptionIndex
      ) {
        participant.score += 10;
      }

      const isLastQuestion =
        room.currentQuestionIndex >= test.questions.length - 1;

      if (isLastQuestion) {
        this.handleEndBattle(client, { roomId: payload.roomId });
      } else {
        room.currentQuestionIndex += 1;
        room.participants.forEach((p) => (p.hasAnsweredCurrent = false));
        this.server.to(payload.roomId).emit('next_question_started', room);
      }
    } catch (err) {
      console.error('Submit Answer Error:', err.message);
    }
  }

  @SubscribeMessage('next_question')
  handleNextQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const room = this.arenaService.getActiveBattle(payload.roomId);
    const user = client.data.user;

    if (
      room &&
      room.hostId === user._id.toString() &&
      room.status === 'playing'
    ) {
      room.currentQuestionIndex += 1;
      room.participants.forEach((p) => (p.hasAnsweredCurrent = false));
      this.server.to(payload.roomId).emit('next_question_started', room);
    }
  }

  @SubscribeMessage('end_battle')
  handleEndBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const room = this.arenaService.getActiveBattle(payload.roomId);
    const user = client.data.user;

    // Allow host OR auto-finish
    if (
      room &&
      (room.hostId === user._id.toString() || room.status === 'playing')
    ) {
      if (room.status === 'finished') return; // DUPLICATE GUARD
      room.status = 'finished';

      // Sort leaderboard
      room.participants.sort((a, b) => b.score - a.score);

      // Save to database
      this.arenaService.saveBattleHistory(room).catch((err) => {
        console.error('Failed to save battle history:', err.message);
      });

      this.server.to(payload.roomId).emit('battle_finished', room);

      // Optionally clean up memory after a delay
      setTimeout(
        () => {
          this.arenaService.removeActiveBattle(payload.roomId);
        },
        5 * 60 * 1000,
      ); // 5 mins
    }
  }
}
