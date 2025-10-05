import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../../config';

// User interface for session
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string; // FIXED: Changed from avatar to picture to match frontend
  provider: 'google';
  googleId: string;
}

// Passport serialization
passport.serializeUser((user: AuthUser, done) => {
  done(null, user);
});

passport.deserializeUser((user: AuthUser, done) => {
  done(null, user);
});

// Google OAuth Strategy - FIXED callback URL
passport.use(new GoogleStrategy({
  clientID: config.googleClientId!,
  clientSecret: config.googleClientSecret!,
  callbackURL: `${config.backendUrl}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user: AuthUser = {
      id: profile.id,
      googleId: profile.id,
      email: profile.emails?.[0]?.value || '',
      name: profile.displayName || '',
      picture: profile.photos?.[0]?.value, // FIXED: Use picture field
      provider: 'google'
    };

    console.log('[Passport] Google OAuth successful for user:', user.email);
    return done(null, user);
  } catch (error) {
    console.error('[Passport] Google OAuth error:', error);
    return done(error, undefined);
  }
}));

export { passport };