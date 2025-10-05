import 'express-session';

declare module 'express-session' {
  interface SessionData {
    roomId?: string;
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      picture?: string; // FIXED: Changed from avatar to picture
      provider: 'google';
      googleId: string;
    }
  }
}