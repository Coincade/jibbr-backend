import { Socket } from 'socket.io';

// WebRTC types for signaling
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

export interface HuddleParticipant {
  userId: string;
  socketId: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  joinedAt: Date;
}

export interface HuddleRoom {
  id: string;
  channelId: string;
  creatorId: string;
  participants: Map<string, HuddleParticipant>;
  createdAt: Date;
  isActive: boolean;
  isVideoCall: boolean;
}

// Store active huddles
const activeHuddles = new Map<string, HuddleRoom>();

// ICE Server Configuration for WebRTC
const getICEServers = () => {
  const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  // Add TURN servers if configured
  if (process.env.TURN_SERVER_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
    iceServers.push({
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD
    });
  }

  return iceServers;
};

export const handleHuddleEvents = (socket: Socket) => {
  // Create a new huddle
  socket.on('create_huddle', async (data: { channelId: string; isVideoCall?: boolean }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('huddle_error', { message: 'Authentication required' });
        return;
      }

      const { channelId, isVideoCall = false } = data;
      const huddleId = `huddle_${channelId}_${Date.now()}`;

      const huddle: HuddleRoom = {
        id: huddleId,
        channelId,
        creatorId: socket.data.user.id,
        participants: new Map(),
        createdAt: new Date(),
        isActive: true,
        isVideoCall
      };

      // Add creator as first participant
      const participant: HuddleParticipant = {
        userId: socket.data.user.id,
        socketId: socket.id,
        name: socket.data.user?.name || 'Unknown',
        avatar: socket.data.user?.image,
        isMuted: false,
        isVideoEnabled: isVideoCall,
        joinedAt: new Date()
      };

      huddle.participants.set(socket.data.user.id, participant);
      activeHuddles.set(huddleId, huddle);

      // Join the huddle room
      await socket.join(huddleId);

      // Notify channel about new huddle
      socket.to(channelId).emit('huddle_created', {
        huddleId,
        creatorId: socket.data.user.id,
        creatorName: participant.name,
        isVideoCall
      });

      // Send huddle details to creator
      socket.emit('huddle_joined', {
        huddleId,
        participants: Array.from(huddle.participants.values()),
        isCreator: true,
        isVideoCall
      });

      console.log(`🎙️ Huddle created: ${huddleId} by ${participant.name} (${isVideoCall ? 'Video' : 'Audio'})`);
    } catch (error) {
      console.error('Error creating huddle:', error);
      socket.emit('huddle_error', { message: 'Failed to create huddle' });
    }
  });

  // Join an existing huddle
  socket.on('join_huddle', async (data: { huddleId: string }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('huddle_error', { message: 'Authentication required' });
        return;
      }

      const { huddleId } = data;
      const huddle = activeHuddles.get(huddleId);

      if (!huddle) {
        socket.emit('huddle_error', { message: 'Huddle not found' });
        return;
      }

      if (!huddle.isActive) {
        socket.emit('huddle_error', { message: 'Huddle is no longer active' });
        return;
      }

      // Check if user is already in huddle
      if (huddle.participants.has(socket.data.user.id)) {
        socket.emit('huddle_error', { message: 'Already in huddle' });
        return;
      }

      // Add participant
      const participant: HuddleParticipant = {
        userId: socket.data.user.id,
        socketId: socket.id,
        name: socket.data.user?.name || 'Unknown',
        avatar: socket.data.user?.image,
        isMuted: false,
        isVideoEnabled: huddle.isVideoCall,
        joinedAt: new Date()
      };

      huddle.participants.set(socket.data.user.id, participant);

      // Join the huddle room
      await socket.join(huddleId);

      // Notify all participants about new member
      socket.to(huddleId).emit('participant_joined', participant);

      // Send huddle details to new participant
      socket.emit('huddle_joined', {
        huddleId,
        participants: Array.from(huddle.participants.values()),
        isCreator: socket.data.user.id === huddle.creatorId,
        isVideoCall: huddle.isVideoCall
      });

      console.log(`🎙️ User ${participant.name} joined huddle: ${huddleId}`);
    } catch (error) {
      console.error('Error joining huddle:', error);
      socket.emit('huddle_error', { message: 'Failed to join huddle' });
    }
  });

  // Leave huddle
  socket.on('leave_huddle', async (data: { huddleId: string }) => {
    try {
      const { huddleId } = data;
      const huddle = activeHuddles.get(huddleId);

      if (!huddle || !socket.data.user.id) return;

      const participant = huddle.participants.get(socket.data.user.id);
      if (!participant) return;

      // Remove participant
      huddle.participants.delete(socket.data.user.id);

      // Leave the huddle room
      await socket.leave(huddleId);

      // If no participants left, end the huddle
      if (huddle.participants.size === 0) {
        activeHuddles.delete(huddleId);
        socket.to(huddle.channelId).emit('huddle_ended', { huddleId });
        console.log(`🎙️ Huddle ended: ${huddleId}`);
      } else {
        // Notify remaining participants
        socket.to(huddleId).emit('participant_left', {
          userId: socket.data.user.id,
          name: participant.name
        });

        // If creator left, transfer ownership to next participant
        if (huddle.creatorId === socket.data.user.id && huddle.participants.size > 0) {
          const newCreator = Array.from(huddle.participants.values())[0];
          huddle.creatorId = newCreator.userId;
          socket.to(huddleId).emit('huddle_creator_changed', {
            newCreatorId: newCreator.userId,
            newCreatorName: newCreator.name
          });
        }

        console.log(`🎙️ User ${participant.name} left huddle: ${huddleId}`);
      }
    } catch (error) {
      console.error('Error leaving huddle:', error);
    }
  });

  // Start video call
  socket.on('start_video_call', async (data: { channelId: string }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('huddle_error', { message: 'Authentication required' });
        return;
      }

      const { channelId } = data;
      
      // Notify all users in the channel about incoming video call
      socket.to(channelId).emit('incoming_call', {
        callerId: socket.data.user.id,
        callerName: socket.data.user?.name || 'Unknown',
        channelId,
        isVideoCall: true
      });

      console.log(`📹 Video call started by ${socket.data.user.name} in channel ${channelId}`);
    } catch (error) {
      console.error('Error starting video call:', error);
      socket.emit('huddle_error', { message: 'Failed to start video call' });
    }
  });

  // Answer call
  socket.on('answer_call', async (data: { callerId: string; accept: boolean }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('huddle_error', { message: 'Authentication required' });
        return;
      }

      const { callerId, accept } = data;
      
      // Notify caller about the answer
      socket.to(`user_${callerId}`).emit('call_answered', {
        answererId: socket.data.user.id,
        answererName: socket.data.user?.name || 'Unknown',
        accepted: accept
      });

      if (accept) {
        console.log(`📞 Call accepted by ${socket.data.user.name}`);
      } else {
        console.log(`📞 Call rejected by ${socket.data.user.name}`);
      }
    } catch (error) {
      console.error('Error answering call:', error);
      socket.emit('huddle_error', { message: 'Failed to answer call' });
    }
  });

  // Participant controls
  socket.on('toggle_mute', (data: { huddleId: string; isMuted: boolean }) => {
    const { huddleId, isMuted } = data;
    const huddle = activeHuddles.get(huddleId);
    
    if (!huddle || !socket.data.user.id) return;
    
    const participant = huddle.participants.get(socket.data.user.id);
    if (!participant) return;

    participant.isMuted = isMuted;
    
    // Notify all participants
    socket.to(huddleId).emit('participant_muted', {
      userId: socket.data.user.id,
      name: participant.name,
      isMuted
    });

    console.log(`🎙️ User ${participant.name} ${isMuted ? 'muted' : 'unmuted'} in huddle: ${huddleId}`);
  });

  socket.on('toggle_video', (data: { huddleId: string; isVideoEnabled: boolean }) => {
    const { huddleId, isVideoEnabled } = data;
    const huddle = activeHuddles.get(huddleId);
    
    if (!huddle || !socket.data.user?.id) return;
    
    const participant = huddle.participants.get(socket.data.user.id);
    if (!participant) return;

    participant.isVideoEnabled = isVideoEnabled;
    
    // Notify all participants
    socket.to(huddleId).emit('participant_video_toggled', {
      userId: socket.data.user.id,
      name: participant.name,
      isVideoEnabled
    });

    console.log(`🎙️ User ${participant.name} ${isVideoEnabled ? 'enabled' : 'disabled'} video in huddle: ${huddleId}`);
  });

  // Start Call - Slack-like call initiation
  socket.on('start-call', async (data: { roomId: string; type: 'audio' | 'video'; from: string; participants: string[] }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, type, from, participants } = data;
      
      // Notify all participants about incoming call
      participants.forEach(participantId => {
        socket.to(`user_${participantId}`).emit('incoming-call', {
          roomId,
          type,
          from: socket.data.user?.name || 'Unknown',
          fromId: socket.data.user.id,
          timestamp: new Date().toISOString()
        });
      });

      console.log(`📞 Call started by ${socket.data.user.name} in room ${roomId} (${type})`);
    } catch (error) {
      console.error('Error starting call:', error);
      socket.emit('call-error', { message: 'Failed to start call' });
    }
  });

  // Answer Call - Accept or decline incoming call
  socket.on('answer-call', async (data: { roomId: string; from: string; accept: boolean; type: 'audio' | 'video' }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, from, accept, type } = data;
      
      if (accept) {
        // Join the call room
        await socket.join(roomId);
        
        // Notify caller and other participants
        socket.to(roomId).emit('user-joined', {
          userId: socket.data.user.id,
          name: socket.data.user?.name || 'Unknown',
          type,
          timestamp: new Date().toISOString()
        });

        console.log(`📞 Call accepted by ${socket.data.user.name} in room ${roomId}`);
      } else {
        // Notify caller about decline
        socket.to(`user_${from}`).emit('user-declined', {
          userId: socket.data.user.id,
          name: socket.data.user?.name || 'Unknown',
          timestamp: new Date().toISOString()
        });

        console.log(`📞 Call declined by ${socket.data.user.name} in room ${roomId}`);
      }
    } catch (error) {
      console.error('Error answering call:', error);
      socket.emit('call-error', { message: 'Failed to answer call' });
    }
  });

  // WebRTC Signaling Events
  socket.on('offer', async (data: { roomId: string; offer: RTCSessionDescriptionInit; from: string }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, offer, from } = data;
      
      // Forward offer to all participants in the room except sender
      socket.to(roomId).emit('offer', {
        offer,
        from: socket.data.user.id,
        fromName: socket.data.user?.name || 'Unknown',
        roomId
      });

      console.log(`📡 WebRTC offer sent from ${socket.data.user.name} in room ${roomId}`);
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
      socket.emit('call-error', { message: 'Failed to send WebRTC offer' });
    }
  });

  socket.on('answer', async (data: { roomId: string; answer: RTCSessionDescriptionInit; from: string }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, answer, from } = data;
      
      // Forward answer to all participants in the room except sender
      socket.to(roomId).emit('answer', {
        answer,
        from: socket.data.user.id,
        fromName: socket.data.user?.name || 'Unknown',
        roomId
      });

      console.log(`📡 WebRTC answer sent from ${socket.data.user.name} in room ${roomId}`);
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
      socket.emit('call-error', { message: 'Failed to send WebRTC answer' });
    }
  });

  socket.on('candidate', async (data: { roomId: string; candidate: RTCIceCandidateInit; from: string }) => {
    try {
      if (!socket.data.user?.id) {
        socket.emit('call-error', { message: 'Authentication required' });
        return;
      }

      const { roomId, candidate, from } = data;
      
      // Forward ICE candidate to all participants in the room except sender
      socket.to(roomId).emit('candidate', {
        candidate,
        from: socket.data.user.id,
        fromName: socket.data.user?.name || 'Unknown',
        roomId
      });

      console.log(`🧊 ICE candidate sent from ${socket.data.user.name} in room ${roomId}`);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      socket.emit('call-error', { message: 'Failed to send ICE candidate' });
    }
  });

  // Leave Call
  socket.on('leave-call', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      
      // Leave the call room
      await socket.leave(roomId);
      
      // Notify other participants
      socket.to(roomId).emit('user-left', {
        userId: socket.data.user?.id,
        name: socket.data.user?.name || 'Unknown',
        timestamp: new Date().toISOString()
      });

      console.log(`📞 User ${socket.data.user?.name} left call in room ${roomId}`);
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  });

  // Get ICE server configuration
  socket.on('get-ice-servers', () => {
    socket.emit('ice-servers', { iceServers: getICEServers() });
  });

  // Get active huddles for a channel
  socket.on('get_active_huddles', (data: { channelId: string }) => {
    const { channelId } = data;
    const huddles = Array.from(activeHuddles.values())
      .filter(huddle => huddle.channelId === channelId && huddle.isActive)
      .map(huddle => ({
        id: huddle.id,
        creatorId: huddle.creatorId,
        participantCount: huddle.participants.size,
        createdAt: huddle.createdAt
      }));

    socket.emit('active_huddles', { channelId, huddles });
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    // Remove user from all huddles
    for (const [huddleId, huddle] of activeHuddles.entries()) {
      if (socket.data.user.id && huddle.participants.has(socket.data.user.id)) {
        const participant = huddle.participants.get(socket.data.user.id);
        if (participant) {
          huddle.participants.delete(socket.data.user.id);
          
          if (huddle.participants.size === 0) {
            activeHuddles.delete(huddleId);
            socket.to(huddle.channelId).emit('huddle_ended', { huddleId });
          } else {
            socket.to(huddleId).emit('participant_left', {
              userId: socket.data.user.id,
              name: participant.name
            });
          }
        }
      }
    }
  });
};

// Cleanup inactive huddles periodically
setInterval(() => {
  const now = new Date();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

  for (const [huddleId, huddle] of activeHuddles.entries()) {
    if (now.getTime() - huddle.createdAt.getTime() > inactiveThreshold && huddle.participants.size === 0) {
      activeHuddles.delete(huddleId);
      console.log(`🧹 Cleaned up inactive huddle: ${huddleId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes
