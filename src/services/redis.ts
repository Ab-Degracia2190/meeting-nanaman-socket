import Redis from 'ioredis';
import { config } from '../config';
import { Room, ChatMessage } from '../types';

export class RedisService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.redisUrl);
  }

  // Room operations
  async createRoom(room: Room): Promise<void> {
    await this.redis.setex(`room:${room.id}`, 24 * 60 * 60, JSON.stringify(room));
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const roomData = await this.redis.get(`room:${roomId}`);
    return roomData ? JSON.parse(roomData) : null;
  }

  async updateRoom(room: Room): Promise<void> {
    await this.redis.setex(`room:${room.id}`, 24 * 60 * 60, JSON.stringify(room));
  }

  async roomExists(roomId: string): Promise<boolean> {
    const exists = await this.redis.exists(`room:${roomId}`);
    return exists === 1;
  }

  async getAllRoomKeys(): Promise<string[]> {
    return await this.redis.keys('room:*');
  }

  // Chat message operations
  async storeChatMessage(message: ChatMessage): Promise<void> {
    const messagesKey = `room:${message.roomId}:messages`;
    await this.redis.lpush(messagesKey, JSON.stringify(message));
    await this.redis.ltrim(messagesKey, 0, 99); // Keep only last 100 messages
    await this.redis.expire(messagesKey, 24 * 60 * 60); // 24 hour expiry
  }

  async getChatMessages(roomId: string): Promise<ChatMessage[]> {
    const messagesKey = `room:${roomId}:messages`;
    const messages = await this.redis.lrange(messagesKey, 0, -1);
    return messages.map(msg => JSON.parse(msg));
  }

  // Cleanup
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const redisService = new RedisService();