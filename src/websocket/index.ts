import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { Socket } from 'socket.io';
import { authenticateSocket, removeClientFromAllChannels, addClientToChannel, removeClientFromAllConversations, addClientToConversation } from './utils.js';
import { handleSendMessage, handleEditMessage, handleDeleteMessage, handleForwardMessage } from './handlers/message.handler.js';
import { handleAddReaction, handleRemoveReaction } from './handlers/reaction.handler.js';
import { handleSendDirectMessage, handleEditDirectMessage, handleDeleteDirectMessage, handleAddDirectReaction, handleRemoveDirectReaction, handleForwardDirectMessage } from './handlers/direct-message.handler.js';

// Global state for managing socket connections
let io: SocketIOServer;
const channelClients: Map<string, Set<Socket>> = new Map();
const conversationClients: Map<string, Set<Socket>> = new Map();
const onlineUsers: Map<string, Set<Socket>> = new Map(); // userId -> Set of sockets
const userSockets: Map<string, string> = new Map(); // socketId -> userId

// Initialize WebSocket service
export const initializeWebSocketService = (server: Server): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"]
    },
    // Allow all namespaces
    allowEIO3: true,
    // Better error handling
    connectTimeout: 45000,
    // Enable debugging
    transports: ['websocket', 'polling']
  });
  
  setupEventHandlers();
  return io;
};

// Setup event handlers for socket connections
const setupEventHandlers = (): void => {
  // Authentication middleware
  io.use(async (socket, next) => {
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

  io.on('connection', (socket: Socket) => {
    console.log(`New connection established: ${socket.id}`);
    handleConnection(socket);
  });

  // Handle connection errors
  io.engine.on('connection_error', (err) => {
    console.error('Connection error:', err);
  });
};

// Handle new socket connections
const handleConnection = (socket: Socket): void => {
  const user = socket.data.user;
  if (!user) {
    console.log('No user data found, disconnecting socket');
    socket.disconnect();
    return;
  }

  // Join user's personal room for direct messaging
  socket.join(`user_${user.id}`);

  // Track user as online
  addUserToOnlineList(user.id, socket);
  userSockets.set(socket.id, user.id);

  // Broadcast user online status to all connected users
  broadcastUserOnlineStatus(user.id, true);

  // Send authentication success event
  socket.emit('authenticated', {
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });

  // Handle channel message events
  socket.on('send_message', async (data) => {
    await handleSendMessageEvent(socket, data);
  });

  socket.on('edit_message', async (data) => {
    await handleEditMessageEvent(socket, data);
  });

  socket.on('delete_message', async (data) => {
    await handleDeleteMessageEvent(socket, data);
  });

  socket.on('forward_message', async (data) => {
    await handleForwardMessageEvent(socket, data);
  });

  socket.on('forward_to_direct', async (data) => {
    await handleForwardToDirectEvent(socket, data);
  });

  socket.on('add_reaction', async (data) => {
    await handleAddReactionEvent(socket, data);
  });

  socket.on('remove_reaction', async (data) => {
    await handleRemoveReactionEvent(socket, data);
  });

  // Handle direct message events
  socket.on('send_direct_message', async (data) => {
    await handleSendDirectMessageEvent(socket, data);
  });

  socket.on('edit_direct_message', async (data) => {
    await handleEditDirectMessageEvent(socket, data);
  });

  socket.on('delete_direct_message', async (data) => {
    await handleDeleteDirectMessageEvent(socket, data);
  });

  socket.on('add_direct_reaction', async (data) => {
    await handleAddDirectReactionEvent(socket, data);
  });

  socket.on('remove_direct_reaction', async (data) => {
    await handleRemoveDirectReactionEvent(socket, data);
  });

  // Join/Leave channel events
  socket.on('join_channel', (data) => {
    const { channelId } = data;
    addClientToChannel(socket, channelId, channelClients);
    socket.emit('joined_channel', { channelId });
    console.log(`User ${user.name} joined channel: ${channelId}`);
  });

  socket.on('leave_channel', (data) => {
    const { channelId } = data;
    removeClientFromAllChannels(socket, channelClients);
    socket.emit('left_channel', { channelId });
    console.log(`User ${user.name} left channel: ${channelId}`);
  });

  // Join/Leave conversation events
  socket.on('join_conversation', (data) => {
    const { conversationId } = data;
    addClientToConversation(socket, conversationId, conversationClients);
    socket.emit('conversation_joined', { conversationId });
    console.log(`User ${user.name} joined conversation: ${conversationId}`);
  });

  socket.on('leave_conversation', (data) => {
    const { conversationId } = data;
    removeClientFromAllConversations(socket, conversationClients);
    socket.emit('conversation_left', { conversationId });
    console.log(`User ${user.name} left conversation: ${conversationId}`);
  });

  // Ping/Pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    handleDisconnection(socket);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    handleDisconnection(socket);
  });
};

// Event handler functions for channel messages
const handleSendMessageEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    // Automatically add client to channel when sending message
    addClientToChannel(socket, data.channelId, channelClients);
    await handleSendMessage(socket, data, channelClients, io);
  } catch (error) {
    console.error('Error handling send message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

const handleEditMessageEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleEditMessage(socket, data, channelClients);
  } catch (error) {
    console.error('Error handling edit message:', error);
    socket.emit('error', { message: 'Failed to edit message' });
  }
};

const handleDeleteMessageEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleDeleteMessage(socket, data, channelClients);
  } catch (error) {
    console.error('Error handling delete message:', error);
    socket.emit('error', { message: 'Failed to delete message' });
  }
};

const handleForwardMessageEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleForwardMessage(socket, data, channelClients);
  } catch (error) {
    console.error('Error handling forward message:', error);
    socket.emit('error', { message: 'Failed to forward message' });
  }
};

const handleForwardToDirectEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleForwardDirectMessage(socket, data, conversationClients);
  } catch (error) {
    console.error('Error handling forward to direct message:', error);
    socket.emit('error', { message: 'Failed to forward message to direct conversation' });
  }
};

const handleAddReactionEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleAddReaction(socket, data, channelClients);
  } catch (error) {
    console.error('Error handling add reaction:', error);
    socket.emit('error', { message: 'Failed to add reaction' });
  }
};

const handleRemoveReactionEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleRemoveReaction(socket, data, channelClients);
  } catch (error) {
    console.error('Error handling remove reaction:', error);
    socket.emit('error', { message: 'Failed to remove reaction' });
  }
};

// Event handler functions for direct messages
const handleSendDirectMessageEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    // Automatically add client to conversation when sending message
    addClientToConversation(socket, data.conversationId, conversationClients);
    await handleSendDirectMessage(socket, data, conversationClients, io);
  } catch (error) {
    console.error('Error handling send direct message:', error);
    socket.emit('error', { message: 'Failed to send direct message' });
  }
};

const handleEditDirectMessageEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleEditDirectMessage(socket, data, conversationClients);
  } catch (error) {
    console.error('Error handling edit direct message:', error);
    socket.emit('error', { message: 'Failed to edit direct message' });
  }
};

const handleDeleteDirectMessageEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleDeleteDirectMessage(socket, data, conversationClients);
  } catch (error) {
    console.error('Error handling delete direct message:', error);
    socket.emit('error', { message: 'Failed to delete direct message' });
  }
};

const handleAddDirectReactionEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleAddDirectReaction(socket, data, conversationClients);
  } catch (error) {
    console.error('Error handling add direct reaction:', error);
    socket.emit('error', { message: 'Failed to add direct reaction' });
  }
};

const handleRemoveDirectReactionEvent = async (socket: Socket, data: any): Promise<void> => {
  try {
    await handleRemoveDirectReaction(socket, data, conversationClients);
  } catch (error) {
    console.error('Error handling remove direct reaction:', error);
    socket.emit('error', { message: 'Failed to remove direct reaction' });
  }
};

// Handle socket disconnection
const handleDisconnection = (socket: Socket): void => {
  const user = socket.data.user;
  if (user) {
    console.log(`User ${user.name} disconnected`);
    
    // Remove user from online tracking
    removeUserFromOnlineList(user.id, socket);
    userSockets.delete(socket.id);
    
    // Check if user is still online (has other connections)
    const isStillOnline = onlineUsers.has(user.id) && onlineUsers.get(user.id)!.size > 0;
    
    // If user is completely offline, broadcast offline status
    if (!isStillOnline) {
      broadcastUserOnlineStatus(user.id, false);
    }
  }

  // Remove from all channels and conversations
  removeClientFromAllChannels(socket, channelClients);
  removeClientFromAllConversations(socket, conversationClients);
};

// Utility functions for WebSocket operations
export const getWebSocketStats = (): { totalConnections: number; channelStats: Record<string, number>; conversationStats: Record<string, number> } => {
  const totalConnections = io.engine.clientsCount;
  
  const channelStats: Record<string, number> = {};
  for (const [channelId, clients] of channelClients.entries()) {
    channelStats[channelId] = clients.size;
  }

  const conversationStats: Record<string, number> = {};
  for (const [conversationId, clients] of conversationClients.entries()) {
    conversationStats[conversationId] = clients.size;
  }

  return {
    totalConnections,
    channelStats,
    conversationStats
  };
};

export const broadcastToChannel = (channelId: string, event: string, data: any): void => {
  io.to(channelId).emit(event, data);
};

// Online status management functions
const addUserToOnlineList = (userId: string, socket: Socket): void => {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId)!.add(socket);
};

const removeUserFromOnlineList = (userId: string, socket: Socket): void => {
  if (onlineUsers.has(userId)) {
    onlineUsers.get(userId)!.delete(socket);
    if (onlineUsers.get(userId)!.size === 0) {
      onlineUsers.delete(userId);
    }
  }
};

const broadcastUserOnlineStatus = (userId: string, isOnline: boolean): void => {
  const statusData = {
    userId,
    isOnline,
    timestamp: new Date().toISOString()
  };
  
  // Broadcast to all connected users
  io.emit('user_status_change', statusData);
  
  console.log(`User ${userId} is now ${isOnline ? 'online' : 'offline'}`);
};

// Get online users
export const getOnlineUsers = (): string[] => {
  return Array.from(onlineUsers.keys());
};

// Check if user is online
export const isUserOnline = (userId: string): boolean => {
  return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
};

// Get online status for multiple users
export const getUsersOnlineStatus = (userIds: string[]): Record<string, boolean> => {
  const status: Record<string, boolean> = {};
  userIds.forEach(userId => {
    status[userId] = isUserOnline(userId);
  });
  return status;
};

// Get online users count
export const getOnlineUsersCount = (): number => {
  return onlineUsers.size;
};

export const broadcastToConversation = (conversationId: string, event: string, data: any): void => {
  io.to(conversationId).emit(event, data);
};

export const sendToUser = (userId: string, event: string, data: any): void => {
  io.to(`user_${userId}`).emit(event, data);
}; 