import dotenv from "dotenv";
import path from "path";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: requireEnv("APP_CHAT_SOCKET_PORT"),
  clientUrl: requireEnv("APP_CLIENT_URL"),
  backendUrl: requireEnv("APP_CHAT_SOCKET_URL"),
  redisUrl: requireEnv("APP_REDIS_URL"),
  apiKey: requireEnv("APP_API_KEY"),
  staticDir: path.join(__dirname, "../src", "home"),

  // Google OAuth
  googleClientId: requireEnv("APP_GOOGLE_CLIENT_ID"),
  googleClientSecret: requireEnv("APP_GOOGLE_CLIENT_SECRET"),

  // Session
  sessionSecret: requireEnv("APP_SESSION_SECRET"),
} as const;

export const corsOptions = {
  origin: config.clientUrl,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "x-api-key"],
};

export const socketCorsOptions = {
  origin: config.clientUrl,
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["x-api-key"],
};