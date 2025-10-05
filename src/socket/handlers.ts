// socket/src/socket/handlers.ts
import { Socket, Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, 
  JoinRoomData, 
  ToggleMediaData, 
  RaiseHandData, 
  ReactionData, 
  ChatMessage, 
  WebRTCSignalData 
} from '../types';
import { roomService } from '../services/room';
import { chatService } from '../services/chat';

export class SocketHandlers {
  constructor(private io: Server) {}

  handleConnection = (socket: Socket) => {
    console.log('User connected:', socket.id);

    // Room handlers
    socket.on('join-room', this.handleJoinRoom(socket));
    socket.on('toggle-video', this.handleToggleVideo(socket));
    socket.on('toggle-audio', this.handleToggleAudio(socket));
    socket.on('raise-hand', this.handleRaiseHand(socket));
    socket.on('send-reaction', this.handleSendReaction(socket));
    socket.on('chat-message', this.handleChatMessage(socket));
    
    // WebRTC handlers
    socket.on('offer', this.handleWebRTCOffer(socket));
    socket.on('answer', this.handleWebRTCAnswer(socket));
    socket.on('ice-candidate', this.handleIceCandidate(socket));
    
    socket.on('disconnect', this.handleDisconnect(socket));
  };

  private handleJoinRoom = (socket: Socket) => async (data: JoinRoomData) => {
    try {
      const { roomId, userName } = data;
      const room = await roomService.getRoom(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const user: User = {
        id: uuidv4(),
        name: userName,
        isVideoOn: true,
        isAudioOn: true,
        socketId: socket.id,
        isHandRaised: false
      };

      const updatedRoom = await roomService.addUserToRoom(roomId, user);
      if (!updatedRoom) {
        socket.emit('error', { message: 'Failed to join room' });
        return;
      }

      // Join socket room
      socket.join(roomId);
      
      // Notify user of successful join
      socket.emit('joined-room', { room: updatedRoom, user });
      
      // Notify other users
      socket.to(roomId).emit('user-joined', { user, room: updatedRoom });
      
      // Send current users list to new user
      socket.emit('users-list', { users: updatedRoom.users });

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  };

  private handleToggleVideo = (socket: Socket) => async (data: ToggleMediaData) => {
    try {
      const { roomId, isVideoOn } = data;
      if (isVideoOn === undefined) return;

      const room = await roomService.updateUserInRoom(roomId, socket.id, { isVideoOn });
      if (!room) return;

      const user = room.users.find(u => u.socketId === socket.id);
      if (!user) return;

      // Notify all users in room
      this.io.to(roomId).emit('user-video-toggled', { 
        userId: user.id, 
        isVideoOn 
      });
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  private handleToggleAudio = (socket: Socket) => async (data: ToggleMediaData) => {
    try {
      const { roomId, isAudioOn } = data;
      if (isAudioOn === undefined) return;

      const room = await roomService.updateUserInRoom(roomId, socket.id, { isAudioOn });
      if (!room) return;

      const user = room.users.find(u => u.socketId === socket.id);
      if (!user) return;

      // Notify all users in room
      this.io.to(roomId).emit('user-audio-toggled', { 
        userId: user.id, 
        isAudioOn 
      });
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  };

  private handleRaiseHand = (socket: Socket) => async (data: RaiseHandData) => {
    try {
      const { roomId, isHandRaised } = data;

      const room = await roomService.updateUserInRoom(roomId, socket.id, { isHandRaised });
      if (!room) return;

      const user = room.users.find(u => u.socketId === socket.id);
      if (!user) return;

      // Notify all users in room
      this.io.to(roomId).emit('user-hand-raised', { 
        userId: user.id, 
        isHandRaised 
      });
    } catch (error) {
      console.error('Error toggling hand raise:', error);
    }
  };

  private handleSendReaction = (socket: Socket) => async (data: ReactionData) => {
    try {
      const { roomId, emoji } = data;
      const user = await roomService.getUserFromRoom(roomId, socket.id);
      
      if (user) {
        const timestamp = new Date().toISOString();
        
        // Broadcast reaction to all users in room (including sender)
        this.io.to(roomId).emit('user-reaction', {
          userId: user.id,
          userName: user.name,
          emoji,
          timestamp
        });
      }
    } catch (error) {
      console.error('Error sending reaction:', error);
    }
  };

  private handleChatMessage = (socket: Socket) => async (data: ChatMessage) => {
    try {
      const chatMessage = await chatService.sendMessage(data, socket.id);
      if (!chatMessage) return;

      // Broadcast message to all users in room except sender
      socket.to(data.roomId).emit('chat-message', chatMessage);
      
    } catch (error) {
      console.error('Error handling chat message:', error);
    }
  };

  private handleWebRTCOffer = (socket: Socket) => (data: WebRTCSignalData) => {
    console.log('Relaying offer to room:', data.roomId, 'target:', data.targetUserId);
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      fromUserId: socket.id,
      targetUserId: data.targetUserId
    });
  };

  private handleWebRTCAnswer = (socket: Socket) => (data: WebRTCSignalData) => {
    console.log('Relaying answer to room:', data.roomId, 'target:', data.targetUserId);
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      fromUserId: socket.id,
      targetUserId: data.targetUserId
    });
  };

  private handleIceCandidate = (socket: Socket) => (data: WebRTCSignalData) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      fromUserId: socket.id,
      targetUserId: data.targetUserId
    });
  };

  private handleDisconnect = (socket: Socket) => async () => {
    console.log('User disconnected:', socket.id);
    
    try {
      const result = await roomService.findUserInAllRooms(socket.id);
      if (!result) return;

      const { room, user } = result;
      const updateResult = await roomService.removeUserFromRoom(room.id, socket.id);
      
      if (updateResult) {
        // Notify other users
        socket.to(room.id).emit('user-left', { 
          userId: user.id, 
          room: updateResult.room 
        });
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  };
}