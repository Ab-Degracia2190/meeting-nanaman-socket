export interface User {
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

export interface Room {
  id: string;
  name: string;
  users: User[];
  createdAt: Date;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  roomId: string;
}

export interface SocketData {
  roomId?: string;
  userId?: string;
}

export interface JoinRoomData {
  roomId: string;
  userName: string;
}

export interface ToggleMediaData {
  roomId: string;
  isVideoOn?: boolean;
  isAudioOn?: boolean;
}

export interface RaiseHandData {
  roomId: string;
  isHandRaised: boolean;
}

export interface ReactionData {
  roomId: string;
  emoji: string;
}

export interface WebRTCSignalData {
  roomId: string;
  offer?: any;
  answer?: any;
  candidate?: any;
  targetUserId: string;
}