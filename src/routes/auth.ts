import { Router, Request, Response } from 'express';
import { passport } from '../auth/google/passport';

// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    roomId?: string;
  }
}

const router = Router();

// Initiate Google OAuth - FIXED to handle roomId properly
router.get('/google', (req: Request, res: Response, next) => {
  // Store roomId in session if provided
  const roomId = req.query.roomId as string;
  if (roomId) {
    req.session.roomId = roomId;
    console.log(`[Auth] Storing roomId in session: ${roomId}`);
  }
  
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
});

// Google OAuth callback - FIXED to redirect to frontend
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: `${process.env.APP_CLIENT_URL}/?error=auth_failed` }),
  (req: Request, res: Response) => {
    try {
      console.log('[Auth] Google OAuth callback successful for user:', (req.user as any)?.email);
      
      // Get roomId from session
      const roomId = req.session.roomId;
      delete req.session.roomId; // Clean up

      // FIXED: Redirect to frontend with proper URL
      const clientUrl = process.env.APP_CLIENT_URL || 'https://6j99tz4b-5173.asse.devtunnels.ms';
      const redirectUrl = roomId 
        ? `${clientUrl}/room/${roomId}` 
        : clientUrl;

      console.log(`[Auth] Redirecting to: ${redirectUrl}`);
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('[Auth] Callback error:', error);
      const clientUrl = process.env.APP_CLIENT_URL || 'https://6j99tz4b-5173.asse.devtunnels.ms';
      res.redirect(`${clientUrl}/?error=auth_failed`);
    }
  }
);

export { router as authRoutes };