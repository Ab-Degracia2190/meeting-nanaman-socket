import { Router, Request, Response, RequestHandler } from 'express';
import { roomService } from '../services/room';
import { authenticateApiKey } from '../middleware/auth';

const router = Router();

// Auth status endpoint (no API key required)
const getAuthStatus: RequestHandler = (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    // FIXED: Return user data in format expected by frontend
    const user = req.user as any;
    res.json({
      authenticated: true,
      user: {
        sub: user.googleId || user.id,
        name: user.name,
        given_name: user.name.split(' ')[0] || user.name,
        family_name: user.name.split(' ').slice(1).join(' ') || '',
        picture: user.picture || user.avatar,
        email: user.email,
        email_verified: true
      }
    });
  } else {
    res.json({
      authenticated: false,
      user: null
    });
  }
};

// Logout endpoint (no API key required)
const logout: RequestHandler = (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ error: 'Session cleanup failed' });
      }
      
      res.clearCookie('meeting.sid');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });
};

// Auth routes (no API key required)
router.get('/auth/status', getAuthStatus);
router.post('/auth/logout', logout);

// Apply authentication middleware to all other API routes
router.use(authenticateApiKey);

// Create room
const createRoom: RequestHandler = async (req: Request, res: Response) => {
  try {
    const room = await roomService.createRoom(req.body.name);
    res.json({ roomId: room.id, room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

// Get room
const getRoom: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = await roomService.getRoom(roomId);
    
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    res.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
};

// Check if room exists
const checkRoomExists: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const exists = await roomService.roomExists(roomId);
    res.json({ exists });
  } catch (error) {
    console.error('Error checking room existence:', error);
    res.status(500).json({ error: 'Failed to check room' });
  }
};

// Health check (no auth required)
const healthCheck: RequestHandler = (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

router.post('/rooms', createRoom);
router.get('/rooms/:roomId', getRoom);
router.get('/rooms/:roomId/exists', checkRoomExists);
router.get('/health', healthCheck);

export { router as apiRoutes };