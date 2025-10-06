import { Socket } from 'socket.io';

// WebRTC types
interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
}

// Call participant interface
export interface CallParticipant {
  userId: string;
  socketId: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  joinedAt: Date;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

// Call room interface
export interface CallRoom {
  id: string;
  type: 'audio' | 'video';
  creatorId: string;
  participants: Map<string, CallParticipant>;
  createdAt: Date;
  isActive: boolean;
  metadata?: {
    channelId?: string;
    conversationId?: string;
    title?: string;
  };
}

// Store active call rooms
const activeCallRooms = new Map<string, CallRoom>();

// ICE Server Configuration
const getICEServers = () => {
  const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  // Add TURN servers if configured
  if (process.env.TURN_SERVER_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
    // Support multiple TURN URLs (comma-separated)
    const turnUrls = process.env.TURN_SERVER_URL.split(',').map(url => url.trim());
    turnUrls.forEach(url => {
      iceServers.push({
        urls: url,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD
      });
    });
  }

  return iceServers;
};

// Utility functions
const createCallRoom = (roomId: string, type: 'audio' | 'video', creatorId: string, metadata?: any): CallRoom => ({
  id: roomId,
  type,
  creatorId,
  participants: new Map(),
  createdAt: new Date(),
  isActive: true,
  metadata
});

const addParticipantToRoom = (room: CallRoom, userId: string, socketId: string, name: string, avatar?: string): CallParticipant => {
  const participant: CallParticipant = {
    userId,
    socketId,
    name,
    avatar,
    isMuted: false,
    isVideoEnabled: room.type === 'video',
    joinedAt: new Date(),
    connectionState: 'connecting'
  };
  
  room.participants.set(userId, participant);
  return participant;
};

const removeParticipantFromRoom = (room: CallRoom, userId: string): CallParticipant | null => {
  const participant = room.participants.get(userId);
  if (participant) {
    room.participants.delete(userId);
  }
  return participant || null;
};

const getRoomParticipants = (room: CallRoom): CallParticipant[] => {
  return Array.from(room.participants.values());
};

const isRoomEmpty = (room: CallRoom): boolean => {
  return room.participants.size === 0;
};

const cleanupEmptyRoom = (roomId: string): void => {
  const room = activeCallRooms.get(roomId);
  if (room && isRoomEmpty(room)) {
    activeCallRooms.delete(roomId);
    console.log(`🧹 Cleaned up empty call room: ${roomId}`);
  }
};

// Main call handler
export const handleCallEvents = (socket: Socket, io: any) => {
  // Get ICE servers
  socket.on('get-ice-servers', () => {
    socket.emit('ice-servers', { iceServers: getICEServers() });
  });

  // Start a call
  socket.on('start-call', async (data: { 
    roomId: string; 
    type: 'audio' | 'video'; 
    participants: string[];
    metadata?: any;
  }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, type, participants, metadata } = data;
      const userId = socket.data.user.id;
      const userName = socket.data.user.name || 'Unknown';
      const userAvatar = socket.data.user.image;

      // Check if room already exists
      if (activeCallRooms.has(roomId)) {
        socket.emit('call-error', { message: 'Call room already exists' });
        return;
      }

      // Create call room
      const room = createCallRoom(roomId, type, userId, metadata);
      activeCallRooms.set(roomId, room);

      // Add creator as first participant
      const creatorParticipant = addParticipantToRoom(room, userId, socket.id, userName, userAvatar);
      
      // Join the call room
      await socket.join(roomId);

      // Notify all participants about incoming call
      participants.forEach(participantId => {
        if (participantId !== userId) {
          socket.to(`user_${participantId}`).emit('incoming-call', {
            roomId,
            type,
            from: userName,
            fromId: userId,
            metadata,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Send room state to creator
      socket.emit('call-started', {
        roomId,
        type,
        participants: getRoomParticipants(room),
        isCreator: true
      });

      console.log(`📞 Call started by ${userName} in room ${roomId} (${type})`);
    } catch (error) {
      console.error('Error starting call:', error);
      socket.emit('call-error', { message: 'Failed to start call' });
    }
  });

  // Answer call (accept/decline)
  socket.on('answer-call', async (data: { 
    roomId: string; 
    accept: boolean; 
    type?: 'audio' | 'video';
  }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, accept } = data;
      const userId = socket.data.user.id;
      const userName = socket.data.user.name || 'Unknown';
      const userAvatar = socket.data.user.image;

      const room = activeCallRooms.get(roomId);
      if (!room) {
        socket.emit('call-error', { message: 'Call room not found' });
        return;
      }

      if (!room.isActive) {
        socket.emit('call-error', { message: 'Call is no longer active' });
        return;
      }

      if (accept) {
        // Check if user is already in the call
        if (room.participants.has(userId)) {
          socket.emit('call-error', { message: 'Already in call' });
          return;
        }

        // Add participant to room
        const participant = addParticipantToRoom(room, userId, socket.id, userName, userAvatar);
        
        // Join the call room
        await socket.join(roomId);

        // Notify existing participants about new joiner
        socket.to(roomId).emit('participant-joined', {
          participant,
          roomId,
          existingParticipants: getRoomParticipants(room).filter(p => p.userId !== userId)
        });

        // Send room state to new participant
        socket.emit('call-joined', {
          roomId,
          type: room.type,
          participants: getRoomParticipants(room),
          isCreator: false
        });

        console.log(`📞 Call accepted by ${userName} in room ${roomId}`);
      } else {
        // Notify creator about decline
        const creator = room.participants.get(room.creatorId);
        if (creator) {
          socket.to(`user_${room.creatorId}`).emit('call-declined', {
            userId,
            name: userName,
            roomId,
            timestamp: new Date().toISOString()
          });
        }

        console.log(`📞 Call declined by ${userName} in room ${roomId}`);
      }
    } catch (error) {
      console.error('Error answering call:', error);
      socket.emit('call-error', { message: 'Failed to answer call' });
    }
  });

  // WebRTC Signaling Events
  socket.on('webrtc-offer', async (data: { 
    roomId: string; 
    offer: RTCSessionDescriptionInit; 
    targetUserId: string;
  }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, offer, targetUserId } = data;
      const userId = socket.data.user.id;
      const userName = socket.data.user.name || 'Unknown';

      const room = activeCallRooms.get(roomId);
      if (!room || !room.participants.has(userId)) {
        socket.emit('call-error', { message: 'Not in call room' });
        return;
      }

      // Send offer to specific user
      socket.to(`user_${targetUserId}`).emit('webrtc-offer', {
        offer,
        from: userId,
        fromName: userName,
        roomId
      });

      console.log(`📡 WebRTC offer sent from ${userName} to user ${targetUserId} in room ${roomId}`);
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
      socket.emit('call-error', { message: 'Failed to send WebRTC offer' });
    }
  });

  socket.on('webrtc-answer', async (data: { 
    roomId: string; 
    answer: RTCSessionDescriptionInit; 
    targetUserId: string;
  }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, answer, targetUserId } = data;
      const userId = socket.data.user.id;
      const userName = socket.data.user.name || 'Unknown';

      const room = activeCallRooms.get(roomId);
      if (!room || !room.participants.has(userId)) {
        socket.emit('call-error', { message: 'Not in call room' });
        return;
      }

      // Send answer to specific user
      socket.to(`user_${targetUserId}`).emit('webrtc-answer', {
        answer,
        from: userId,
        fromName: userName,
        roomId
      });

      console.log(`📡 WebRTC answer sent from ${userName} to user ${targetUserId} in room ${roomId}`);
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
      socket.emit('call-error', { message: 'Failed to send WebRTC answer' });
    }
  });

  socket.on('webrtc-candidate', async (data: { 
    roomId: string; 
    candidate: RTCIceCandidateInit; 
    targetUserId: string;
  }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, candidate, targetUserId } = data;
      const userId = socket.data.user.id;
      const userName = socket.data.user.name || 'Unknown';

      const room = activeCallRooms.get(roomId);
      if (!room || !room.participants.has(userId)) {
        socket.emit('call-error', { message: 'Not in call room' });
        return;
      }

      // Send candidate to specific user
      socket.to(`user_${targetUserId}`).emit('webrtc-candidate', {
        candidate,
        from: userId,
        fromName: userName,
        roomId
      });

      console.log(`🧊 ICE candidate sent from ${userName} to user ${targetUserId} in room ${roomId}`);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      socket.emit('call-error', { message: 'Failed to send ICE candidate' });
    }
  });

  // Participant controls
  socket.on('toggle-mute', (data: { roomId: string; isMuted: boolean }) => {
    try {
      const { roomId, isMuted } = data;
      const userId = socket.data.user?.id;
      
      if (!userId) return;

      const room = activeCallRooms.get(roomId);
      if (!room || !room.participants.has(userId)) return;

      const participant = room.participants.get(userId)!;
      participant.isMuted = isMuted;

      // Notify all participants
      socket.to(roomId).emit('participant-muted', {
        userId,
        isMuted,
        roomId
      });

      console.log(`🎙️ User ${participant.name} ${isMuted ? 'muted' : 'unmuted'} in room ${roomId}`);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  });

  socket.on('toggle-video', (data: { roomId: string; isVideoEnabled: boolean }) => {
    try {
      const { roomId, isVideoEnabled } = data;
      const userId = socket.data.user?.id;
      
      if (!userId) return;

      const room = activeCallRooms.get(roomId);
      if (!room || !room.participants.has(userId)) return;

      const participant = room.participants.get(userId)!;
      participant.isVideoEnabled = isVideoEnabled;

      // Notify all participants
      socket.to(roomId).emit('participant-video-toggled', {
        userId,
        isVideoEnabled,
        roomId
      });

      console.log(`📹 User ${participant.name} ${isVideoEnabled ? 'enabled' : 'disabled'} video in room ${roomId}`);
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  });

  // Update connection state
  socket.on('connection-state-change', (data: { 
    roomId: string; 
    targetUserId: string; 
    state: 'connecting' | 'connected' | 'disconnected' | 'failed';
  }) => {
    try {
      const { roomId, targetUserId, state } = data;
      const userId = socket.data.user?.id;
      
      if (!userId) return;

      const room = activeCallRooms.get(roomId);
      if (!room || !room.participants.has(userId)) return;

      const participant = room.participants.get(targetUserId);
      if (participant) {
        participant.connectionState = state;
        
        // Notify all participants about connection state change
        socket.to(roomId).emit('participant-connection-state', {
          userId: targetUserId,
          state,
          roomId
        });

        console.log(`🔗 Connection state changed for ${participant.name}: ${state}`);
      }
    } catch (error) {
      console.error('Error updating connection state:', error);
    }
  });

  // Leave call
  socket.on('leave-call', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const userId = socket.data.user?.id;
      
      if (!userId) return;

      const room = activeCallRooms.get(roomId);
      if (!room || !room.participants.has(userId)) return;

      const participant = removeParticipantFromRoom(room, userId);
      if (!participant) return;

      // Leave the call room
      await socket.leave(roomId);

      // Notify remaining participants
      socket.to(roomId).emit('participant-left', {
        userId,
        name: participant.name,
        roomId,
        timestamp: new Date().toISOString()
      });

      // Clean up empty room
      cleanupEmptyRoom(roomId);

      console.log(`📞 User ${participant.name} left call in room ${roomId}`);
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  });

  // Get call room info
  socket.on('get-call-room-info', (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const userId = socket.data.user?.id;
      
      if (!userId) return;

      const room = activeCallRooms.get(roomId);
      if (!room || !room.participants.has(userId)) {
        socket.emit('call-error', { message: 'Not in call room' });
        return;
      }

      socket.emit('call-room-info', {
        roomId,
        type: room.type,
        participants: getRoomParticipants(room),
        metadata: room.metadata,
        createdAt: room.createdAt
      });
    } catch (error) {
      console.error('Error getting call room info:', error);
      socket.emit('call-error', { message: 'Failed to get call room info' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    const userId = socket.data.user?.id;
    if (!userId) return;

    // Remove user from all call rooms
    for (const [roomId, room] of activeCallRooms.entries()) {
      if (room.participants.has(userId)) {
        const participant = removeParticipantFromRoom(room, userId);
        if (participant) {
          // Notify remaining participants
          socket.to(roomId).emit('participant-left', {
            userId,
            name: participant.name,
            roomId,
            timestamp: new Date().toISOString(),
            reason: 'disconnected'
          });

          // Clean up empty room
          cleanupEmptyRoom(roomId);
        }
      }
    }
  });
};

// Cleanup inactive call rooms periodically
setInterval(() => {
  const now = new Date();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

  for (const [roomId, room] of activeCallRooms.entries()) {
    if (now.getTime() - room.createdAt.getTime() > inactiveThreshold && isRoomEmpty(room)) {
      activeCallRooms.delete(roomId);
      console.log(`🧹 Cleaned up inactive call room: ${roomId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

export default handleCallEvents;
