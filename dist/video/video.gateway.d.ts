import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class VideoGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private rooms;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleCreateRoom(client: Socket, data: {
        roomId: string;
        displayName: string;
        isPrivate?: boolean;
        title?: string;
    }): void;
    handleJoinRoom(client: Socket, data: {
        roomId: string;
        displayName: string;
    }): Promise<void>;
    private admitPeer;
    handleApproveKnock(client: Socket, data: {
        roomId: string;
        peerId: string;
    }): void;
    handleRejectKnock(client: Socket, data: {
        roomId: string;
        peerId: string;
    }): void;
    handleOffer(client: Socket, data: {
        targetId: string;
        sdp: any;
    }): void;
    handleAnswer(client: Socket, data: {
        targetId: string;
        sdp: any;
    }): void;
    handleIceCandidate(client: Socket, data: {
        targetId: string;
        candidate: any;
    }): void;
    handleLeaveRoom(client: Socket, data: {
        roomId: string;
    }): void;
    handleScreenShareStarted(client: Socket, data: {
        roomId: string;
    }): void;
    handleScreenShareStopped(client: Socket, data: {
        roomId: string;
    }): void;
    handleRecordingStarted(client: Socket, data: {
        roomId: string;
    }): void;
    handleRecordingStopped(client: Socket, data: {
        roomId: string;
    }): void;
    handleForceMuteMic(client: Socket, data: {
        roomId: string;
        peerId: string;
    }): void;
    handleForceMuteCam(client: Socket, data: {
        roomId: string;
        peerId: string;
    }): void;
    handleAllowMic(client: Socket, data: {
        roomId: string;
        peerId: string;
    }): void;
    handleAllowCam(client: Socket, data: {
        roomId: string;
        peerId: string;
    }): void;
    handleHandRaised(client: Socket, data: {
        roomId: string;
    }): void;
    handleHandLowered(client: Socket, data: {
        roomId: string;
    }): void;
    handleKickPeer(client: Socket, data: {
        roomId: string;
        peerId: string;
    }): void;
}
