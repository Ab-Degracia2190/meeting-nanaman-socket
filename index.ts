import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const server = createServer(app);
const CLIENT = process.env.APP_CLIENT_URL;

const io = new Server(server, {
  cors: {
    origin: CLIENT,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ['x-api-key'],
  }
});

// Redis setup
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(cors({
  origin: CLIENT || true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

app.use(express.json());

// Serve static files from the src/home directory
app.use('/static', express.static(path.join(__dirname, 'home')));

interface User {
  id: string;
  name: string;
  isVideoOn: boolean;
  isAudioOn: boolean;
  socketId: string;
  isHandRaised?: boolean;
  lastReaction?: {
    emoji: string;
    timestamp: Date;
  };
}

interface Room {
  id: string;
  name: string;
  users: User[];
  createdAt: Date;
  isActive: boolean;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  roomId: string;
}

// Home route - serve the HTML file
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'src/home', 'index.html'));
});

// API Routes (unchanged)
app.post('/api/rooms', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== process.env.APP_API_KEY) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const roomId = uuidv4();
    const room: Room = {
      id: roomId,
      name: req.body.name || `Meeting Room ${roomId.substring(0, 8)}`,
      users: [],
      createdAt: new Date(),
      isActive: true
    };

    await redis.setex(`room:${roomId}`, 24 * 60 * 60, JSON.stringify(room));

    res.json({ roomId, room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/api/rooms/:roomId', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== process.env.APP_API_KEY) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { roomId } = req.params;
    const roomData = await redis.get(`room:${roomId}`);
    
    if (!roomData) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const room: Room = JSON.parse(roomData);
    res.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

app.get('/api/rooms/:roomId/exists', async (req: Request<{ roomId: string }>, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== process.env.APP_API_KEY) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { roomId } = req.params;
    const exists = await redis.exists(`room:${roomId}`);
    res.json({ exists: exists === 1 });
  } catch (error) {
    console.error('Error checking room existence:', error);
    res.status(500).json({ error: 'Failed to check room' });
  }
});

// Socket.IO handling with new events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async (data: { roomId: string; userName: string }) => {
    try {
      const { roomId, userName } = data;
      const roomData = await redis.get(`room:${roomId}`);
      
      if (!roomData) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const room: Room = JSON.parse(roomData);
      
      // Check if user already exists in room
      const existingUserIndex = room.users.findIndex(user => user.socketId === socket.id);
      
      const user: User = {
        id: uuidv4(),
        name: userName,
        isVideoOn: true,
        isAudioOn: true,
        socketId: socket.id,
        isHandRaised: false
      };

      if (existingUserIndex >= 0) {
        room.users[existingUserIndex] = user;
      } else {
        room.users.push(user);
      }

      // Join socket room
      socket.join(roomId);
      
      // Update room in Redis
      await redis.setex(`room:${roomId}`, 24 * 60 * 60, JSON.stringify(room));
      
      // Notify user of successful join
      socket.emit('joined-room', { room, user });
      
      // Notify other users
      socket.to(roomId).emit('user-joined', { user, room });
      
      // Send current users list to new user
      socket.emit('users-list', { users: room.users });

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('toggle-video', async (data: { roomId: string; isVideoOn: boolean }) => {
    try {
      const { roomId, isVideoOn } = data;
      const roomData = await redis.get(`room:${roomId}`);
      
      if (!roomData) return;
      
      const room: Room = JSON.parse(roomData);
      const userIndex = room.users.findIndex(user => user.socketId === socket.id);
      
      if (userIndex >= 0) {
        room.users[userIndex].isVideoOn = isVideoOn;
        await redis.setex(`room:${roomId}`, 24 * 60 * 60, JSON.stringify(room));
        
        // Notify all users in room
        io.to(roomId).emit('user-video-toggled', { 
          userId: room.users[userIndex].id, 
          isVideoOn 
        });
      }
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  });

  socket.on('toggle-audio', async (data: { roomId: string; isAudioOn: boolean }) => {
    try {
      const { roomId, isAudioOn } = data;
      const roomData = await redis.get(`room:${roomId}`);
      
      if (!roomData) return;
      
      const room: Room = JSON.parse(roomData);
      const userIndex = room.users.findIndex(user => user.socketId === socket.id);
      
      if (userIndex >= 0) {
        room.users[userIndex].isAudioOn = isAudioOn;
        await redis.setex(`room:${roomId}`, 24 * 60 * 60, JSON.stringify(room));
        
        // Notify all users in room
        io.to(roomId).emit('user-audio-toggled', { 
          userId: room.users[userIndex].id, 
          isAudioOn 
        });
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  });

  // NEW: Raise hand functionality
  socket.on('raise-hand', async (data: { roomId: string; isHandRaised: boolean }) => {
    try {
      const { roomId, isHandRaised } = data;
      const roomData = await redis.get(`room:${roomId}`);
      
      if (!roomData) return;
      
      const room: Room = JSON.parse(roomData);
      const userIndex = room.users.findIndex(user => user.socketId === socket.id);
      
      if (userIndex >= 0) {
        room.users[userIndex].isHandRaised = isHandRaised;
        await redis.setex(`room:${roomId}`, 24 * 60 * 60, JSON.stringify(room));
        
        // Notify all users in room
        io.to(roomId).emit('user-hand-raised', { 
          userId: room.users[userIndex].id, 
          isHandRaised 
        });
      }
    } catch (error) {
      console.error('Error toggling hand raise:', error);
    }
  });

  // NEW: Emoji reactions
  socket.on('send-reaction', async (data: { roomId: string; emoji: string }) => {
    try {
      const { roomId, emoji } = data;
      const roomData = await redis.get(`room:${roomId}`);
      
      if (!roomData) return;
      
      const room: Room = JSON.parse(roomData);
      const user = room.users.find(user => user.socketId === socket.id);
      
      if (user) {
        const timestamp = new Date().toISOString();
        
        // Broadcast reaction to all users in room (including sender for local display)
        io.to(roomId).emit('user-reaction', {
          userId: user.id,
          userName: user.name,
          emoji,
          timestamp
        });
      }
    } catch (error) {
      console.error('Error sending reaction:', error);
    }
  });

  // Chat functionality (unchanged)
  socket.on('chat-message', async (data: {
    id: string;
    roomId: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: string;
  }) => {
    try {
      const { roomId, id, userId, userName, message, timestamp } = data;
      
      // Verify user is in the room
      const roomData = await redis.get(`room:${roomId}`);
      if (!roomData) return;
      
      const room: Room = JSON.parse(roomData);
      const userExists = room.users.some(user => user.socketId === socket.id && user.id === userId);
      
      if (!userExists) return;

      const chatMessage: ChatMessage = {
        id,
        userId,
        userName,
        message: message.substring(0, 500), // Limit message length
        timestamp,
        roomId
      };

      // Store message in Redis (keep last 100 messages per room)
      const messagesKey = `room:${roomId}:messages`;
      await redis.lpush(messagesKey, JSON.stringify(chatMessage));
      await redis.ltrim(messagesKey, 0, 99); // Keep only last 100 messages
      await redis.expire(messagesKey, 24 * 60 * 60); // 24 hour expiry

      // Broadcast message to all users in room except sender
      socket.to(roomId).emit('chat-message', chatMessage);
      
    } catch (error) {
      console.error('Error handling chat message:', error);
    }
  });

  // WebRTC signaling (unchanged)
  socket.on('offer', (data: { roomId: string; offer: any; targetUserId: string }) => {
    console.log('Relaying offer to room:', data.roomId, 'target:', data.targetUserId);
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      fromUserId: socket.id,
      targetUserId: data.targetUserId
    });
  });

  socket.on('answer', (data: { roomId: string; answer: any; targetUserId: string }) => {
    console.log('Relaying answer to room:', data.roomId, 'target:', data.targetUserId);
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      fromUserId: socket.id,
      targetUserId: data.targetUserId
    });
  });

  socket.on('ice-candidate', (data: { roomId: string; candidate: any; targetUserId: string }) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      fromUserId: socket.id,
      targetUserId: data.targetUserId
    });
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from all rooms
    try {
      const rooms = await redis.keys('room:*');
      
      for (const roomKey of rooms) {
        // Skip message keys
        if (roomKey.includes(':messages')) continue;
        
        const roomData = await redis.get(roomKey);
        if (!roomData) continue;
        
        const room: Room = JSON.parse(roomData);
        const userIndex = room.users.findIndex(user => user.socketId === socket.id);
        
        if (userIndex >= 0) {
          const removedUser = room.users[userIndex];
          room.users.splice(userIndex, 1);
          
          await redis.setex(roomKey, 24 * 60 * 60, JSON.stringify(room));
          
          // Notify other users
          socket.to(room.id).emit('user-left', { 
            userId: removedUser.id, 
            room 
          });
          
          break;
        }
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

const PORT = process.env.APP_CHAT_SOCKET_PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});