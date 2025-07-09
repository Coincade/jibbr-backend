import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { Socket } from 'socket.io';
import { authenticateSocket, removeClientFromAllChannels, addClientToChannel } from './utils.js';
import { handleSendMessage, handleEditMessage, handleDeleteMessage, handleForwardMessage } from './handlers/message.handler.js';
import { handleAddReaction, handleRemoveReaction } from './handlers/reaction.handler.js';

export class WebSocketService {
  private io: SocketIOServer;
  private channelClients: Map<string, Set<Socket>> = new Map();

  constructor(server: Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      // Allow all namespaces
      allowEIO3: true,
      // Better error handling
      connectTimeout: 45000,
      // Enable debugging
      transports: ['websocket', 'polling']
    });
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        // Get token from handshake auth or query
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          console.log('No token provided');
          return next(new Error('Authentication token required'));
        }

        // Authenticate user
        const user = authenticateSocket(token);
        if (!user) {
          console.log('Authentication failed for token');
          return next(new Error('Authentication failed'));
        }

        socket.data.user = user;
        console.log(`Socket connected: User ${user.id} (${user.name})`);
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`New connection established: ${socket.id}`);
      this.handleConnection(socket);
    });

    // Handle connection errors
    this.io.engine.on('connection_error', (err) => {
      console.error('Connection error:', err);
    });
  }

  private handleConnection(socket: Socket): void {
    const user = socket.data.user;
    if (!user) {
      console.log('No user data found, disconnecting socket');
      socket.disconnect();
      return;
    }

    // Send authentication success event
    socket.emit('authenticated', {
      userId: user.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

    // Handle incoming events
    socket.on('send_message', async (data) => {
      await this.handleSendMessage(socket, data);
    });

    socket.on('edit_message', async (data) => {
      await this.handleEditMessage(socket, data);
    });

    socket.on('delete_message', async (data) => {
      await this.handleDeleteMessage(socket, data);
    });

    socket.on('forward_message', async (data) => {
      await this.handleForwardMessage(socket, data);
    });

    socket.on('add_reaction', async (data) => {
      await this.handleAddReaction(socket, data);
    });

    socket.on('remove_reaction', async (data) => {
      await this.handleRemoveReaction(socket, data);
    });

    // Join/Leave channel events
    socket.on('join_channel', (data) => {
      const { channelId } = data;
      addClientToChannel(socket, channelId, this.channelClients);
      socket.emit('joined_channel', { channelId });
      console.log(`User ${user.name} joined channel: ${channelId}`);
    });

    socket.on('leave_channel', (data) => {
      const { channelId } = data;
      removeClientFromAllChannels(socket, this.channelClients);
      socket.emit('left_channel', { channelId });
      console.log(`User ${user.name} left channel: ${channelId}`);
    });

    // Ping/Pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      this.handleDisconnection(socket);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.handleDisconnection(socket);
    });
  }

  private async handleSendMessage(socket: Socket, data: any): Promise<void> {
    try {
      // Automatically add client to channel when sending message
      addClientToChannel(socket, data.channelId, this.channelClients);
      await handleSendMessage(socket, data, this.channelClients);
    } catch (error) {
      console.error('Error handling send message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handleEditMessage(socket: Socket, data: any): Promise<void> {
    try {
      await handleEditMessage(socket, data, this.channelClients);
    } catch (error) {
      console.error('Error handling edit message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  }

  private async handleDeleteMessage(socket: Socket, data: any): Promise<void> {
    try {
      await handleDeleteMessage(socket, data, this.channelClients);
    } catch (error) {
      console.error('Error handling delete message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  }

  private async handleForwardMessage(socket: Socket, data: any): Promise<void> {
    try {
      await handleForwardMessage(socket, data, this.channelClients);
    } catch (error) {
      console.error('Error handling forward message:', error);
      socket.emit('error', { message: 'Failed to forward message' });
    }
  }

  private async handleAddReaction(socket: Socket, data: any): Promise<void> {
    try {
      await handleAddReaction(socket, data, this.channelClients);
    } catch (error) {
      console.error('Error handling add reaction:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  }

  private async handleRemoveReaction(socket: Socket, data: any): Promise<void> {
    try {
      await handleRemoveReaction(socket, data, this.channelClients);
    } catch (error) {
      console.error('Error handling remove reaction:', error);
      socket.emit('error', { message: 'Failed to remove reaction' });
    }
  }

  private handleDisconnection(socket: Socket): void {
    const user = socket.data.user;
    if (user) {
      console.log(`Socket disconnected: User ${user.id}`);
    }
    removeClientFromAllChannels(socket, this.channelClients);
  }

  /**
   * Get current connection stats
   */
  public getStats(): { totalConnections: number; channelStats: Record<string, number> } {
    const totalConnections = this.io.engine.clientsCount;
    const channelStats: Record<string, number> = {};
    
    for (const [channelId, clients] of this.channelClients.entries()) {
      channelStats[channelId] = clients.size;
    }

    return { totalConnections, channelStats };
  }

  /**
   * Broadcast message to all clients in a channel
   */
  public broadcastToChannel(channelId: string, event: string, data: any): void {
    this.io.to(channelId).emit(event, data);
  }

  /**
   * Send message to specific user
   */
  public sendToUser(userId: string, event: string, data: any): void {
    this.io.sockets.sockets.forEach((socket) => {
      if (socket.data.user?.id === userId) {
        socket.emit(event, data);
      }
    });
  }
}

export default WebSocketService; 