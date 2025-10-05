// socket/src/app.ts
import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import session from "express-session";
import RedisStore from "connect-redis";
import Redis from "ioredis";
import { config, corsOptions } from "./config";
import { apiRoutes } from "./routes/api";
import { authRoutes } from "./routes/auth";
import { passport } from "./auth/google/passport";

// Extend session data interface
declare module "express-session" {
  interface SessionData {
    roomId?: string;
  }
}

export const createApp = () => {
  const app = express();

  // Redis client for session store
  const redis = new Redis(config.redisUrl);

  // Session middleware
  app.use(
    session({
    store: new RedisStore({
      client: redis,
    }),
      secret: config.sessionSecret || "fallback-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
      name: "meeting.sid",
    })
  );

  // CORS middleware
  app.use(cors(corsOptions));

  // JSON parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Static files middleware
  app.use("/static", express.static(config.staticDir));

  // Auth routes (before API routes to handle auth endpoints)
  app.use("/auth", authRoutes);

  // API routes
  app.use("/api", apiRoutes);

  // Home route
  app.get("/", (req: Request, res: Response) => {
    res.sendFile(path.join(config.staticDir, "index.html"));
  });

  // Error handling middleware
  app.use((error: any, req: Request, res: Response, next: any) => {
    console.error("Express error:", error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
};
