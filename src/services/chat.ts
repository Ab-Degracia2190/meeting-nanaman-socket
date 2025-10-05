import { ChatMessage } from '../types';
import { redisService } from './redis';
import { roomService } from './room';

export class ChatService {
  async sendMessage(messageData: ChatMessage, socketId: string): Promise<ChatMessage | null> {
    const { roomId, userId, userName, message, timestamp, id } = messageData;
    
    // Verify user is in the room
    const room = await roomService.getRoom(roomId);
    if (!room) return null;
    
    const userExists = room.users.some(user => user.socketId === socketId && user.id === userId);
    if (!userExists) return null;

    const chatMessage: ChatMessage = {
      id,
      userId,
      userName,
      message: message.substring(0, 500), // Limit message length
      timestamp,
      roomId
    };

    // Store message in Redis
    await redisService.storeChatMessage(chatMessage);
    
    return chatMessage;
  }

  async getChatHistory(roomId: string): Promise<ChatMessage[]> {
    return await redisService.getChatMessages(roomId);
  }
}

export const chatService = new ChatService();