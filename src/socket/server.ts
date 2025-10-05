import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { socketCorsOptions } from '../config';
import { SocketHandlers } from './handlers';

export const createSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: socketCorsOptions
  });

  const socketHandlers = new SocketHandlers(io);
  
  io.on('connection', socketHandlers.handleConnection);

  return io;
};