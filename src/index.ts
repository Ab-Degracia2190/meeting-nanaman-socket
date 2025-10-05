import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';
import { createSocketServer } from './socket/server';

// Create Express app
const app = createApp();

// Create HTTP server
const server = createServer(app);

// Create Socket.IO server
const io = createSocketServer(server);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Client URL: ${config.clientUrl || 'Not configured'}`);
  console.log(`Redis URL: ${config.redisUrl}`);
});