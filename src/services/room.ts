import { v4 as uuidv4 } from 'uuid';
import { Room, User } from '../types';
import { redisService } from './redis';

export class RoomService {
  async createRoom(name?: string): Promise<Room> {
    const roomId = uuidv4();
    const room: Room = {
      id: roomId,
      name: name || `Meeting Room ${roomId.substring(0, 8)}`,
      users: [],
      createdAt: new Date(),
      isActive: true
    };

    await redisService.createRoom(room);
    return room;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return await redisService.getRoom(roomId);
  }

  async roomExists(roomId: string): Promise<boolean> {
    return await redisService.roomExists(roomId);
  }

  async addUserToRoom(roomId: string, user: User): Promise<Room | null> {
    const room = await redisService.getRoom(roomId);
    if (!room) return null;

    // Check if user already exists in room
    const existingUserIndex = room.users.findIndex(u => u.socketId === user.socketId);
    
    if (existingUserIndex >= 0) {
      room.users[existingUserIndex] = user;
    } else {
      room.users.push(user);
    }

    await redisService.updateRoom(room);
    return room;
  }

  async removeUserFromRoom(roomId: string, socketId: string): Promise<{ room: Room; removedUser: User } | null> {
    const room = await redisService.getRoom(roomId);
    if (!room) return null;

    const userIndex = room.users.findIndex(u => u.socketId === socketId);
    if (userIndex < 0) return null;

    const removedUser = room.users[userIndex];
    room.users.splice(userIndex, 1);

    await redisService.updateRoom(room);
    return { room, removedUser };
  }

  async updateUserInRoom(roomId: string, socketId: string, updates: Partial<User>): Promise<Room | null> {
    const room = await redisService.getRoom(roomId);
    if (!room) return null;

    const userIndex = room.users.findIndex(u => u.socketId === socketId);
    if (userIndex < 0) return null;

    room.users[userIndex] = { ...room.users[userIndex], ...updates };
    await redisService.updateRoom(room);
    return room;
  }

  async getUserFromRoom(roomId: string, socketId: string): Promise<User | null> {
    const room = await redisService.getRoom(roomId);
    if (!room) return null;

    return room.users.find(u => u.socketId === socketId) || null;
  }

  async findUserInAllRooms(socketId: string): Promise<{ room: Room; user: User } | null> {
    const roomKeys = await redisService.getAllRoomKeys();
    
    for (const roomKey of roomKeys) {
      // Skip message keys
      if (roomKey.includes(':messages')) continue;
      
      const roomData = await redisService.getRoom(roomKey.replace('room:', ''));
      if (!roomData) continue;
      
      const user = roomData.users.find(u => u.socketId === socketId);
      if (user) {
        return { room: roomData, user };
      }
    }
    
    return null;
  }
}

export const roomService = new RoomService();