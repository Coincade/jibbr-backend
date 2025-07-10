import jwt from 'jsonwebtoken';
import { Socket, ChannelClientsMap, ServerMessage } from './types.js';

/**
 * Authenticate Socket.IO connection using JWT token
 */
export const authenticateSocket = (token: string | null): { id: string; name?: string; image?: string } | null => {
  try {
    if (!token || !process.env.SECRET_KEY) {
      console.log('Auth failed: No token or SECRET_KEY');
      throw new Error('No token or SECRET_KEY');
    }
    
    console.log('Attempting to verify token with SECRET_KEY:', process.env.SECRET_KEY ? 'Present' : 'Missing');
    
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    console.log('Token decoded successfully:', decoded);
    
    if (typeof decoded === 'object' && decoded !== null && 'id' in decoded) {
      return decoded as { id: string; name?: string; image?: string };
    } else {
      console.log('Invalid token payload structure');
      throw new Error('Invalid token payload');
    }
  } catch (error) {
    console.log('JWT verification failed:', error);
    return null;
  }
};

/**
 * Broadcast message to all clients in a channel using Socket.IO rooms
 */
export const broadcastToChannel = (
  channelId: string,
  event: string,
  data: any,
  io: any
): void => {
  io.to(channelId).emit(event, data);
};

/**
 * Send error message to client
 */
export const sendError = (socket: Socket, message: string): void => {
  socket.emit('error', { message });
};

/**
 * Send success message to client
 */
export const sendSuccess = (socket: Socket, event: string, data: any): void => {
  socket.emit(event, data);
};

/**
 * Validate if user is member of channel
 */
export const validateChannelMembership = async (
  userId: string,
  channelId: string
): Promise<boolean> => {
  try {
    const { default: prisma } = await import('../config/database.js');
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId,
        userId,
        isActive: true,
      },
    });
    return !!channelMember;
  } catch (error) {
    console.error('Error validating channel membership:', error);
    return false;
  }
};

/**
 * Get user info from database
 */
export const getUserInfo = async (userId: string) => {
  try {
    const { default: prisma } = await import('../config/database.js');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });
    return user;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
};

/**
 * Add client to channel for messaging using Socket.IO rooms
 */
export const addClientToChannel = (
  socket: Socket,
  channelId: string,
  channelClients: ChannelClientsMap
): void => {
  // Join Socket.IO room
  socket.join(channelId);
  
  // Also track in our map for stats
  if (!channelClients.has(channelId)) {
    channelClients.set(channelId, new Set());
  }
  channelClients.get(channelId)!.add(socket);
};

/**
 * Remove client from all channels on disconnect
 */
export const removeClientFromAllChannels = (
  socket: Socket,
  channelClients: ChannelClientsMap
): void => {
  for (const [channelId, clients] of channelClients.entries()) {
    clients.delete(socket);
    // Clean up empty channel sets
    if (clients.size === 0) {
      channelClients.delete(channelId);
    }
  }
}; 