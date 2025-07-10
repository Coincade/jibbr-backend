import { Socket } from 'socket.io';
import { JwtPayload } from 'jsonwebtoken';

// Re-export Socket for convenience
export { Socket };

// Socket.IO client with user info
export interface SocketWithUser extends Socket {
  data: {
    user?: JwtPayload & { id: string; name?: string; image?: string };
  };
}

// Client message types (from client to server)
export interface ClientMessage {
  type: string;
  [key: string]: any;
}

export interface SendMessageMessage extends ClientMessage {
  type: 'send_message';
  content: string;
  channelId: string;
  replyToId?: string;
  attachments?: AttachmentData[]; // File references from upload API
}

export interface EditMessageMessage extends ClientMessage {
  type: 'edit_message';
  messageId: string;
  content: string;
  channelId: string;
}

export interface DeleteMessageMessage extends ClientMessage {
  type: 'delete_message';
  messageId: string;
  channelId: string;
}

export interface ForwardMessageMessage extends ClientMessage {
  type: 'forward_message';
  messageId: string;
  targetChannelId: string;
  channelId: string;
}

export interface AddReactionMessage extends ClientMessage {
  type: 'add_reaction';
  messageId: string;
  emoji: string;
  channelId: string;
}

export interface RemoveReactionMessage extends ClientMessage {
  type: 'remove_reaction';
  messageId: string;
  emoji: string;
  channelId: string;
}

// Server message types (from server to client)
export interface ServerMessage {
  type: string;
  [key: string]: any;
}

export interface NewMessageEvent extends ServerMessage {
  type: 'new_message';
  message: MessageData;
}

export interface MessageEditedEvent extends ServerMessage {
  type: 'message_edited';
  messageId: string;
  content: string;
}

export interface MessageDeletedEvent extends ServerMessage {
  type: 'message_deleted';
  messageId: string;
}

export interface MessageForwardedEvent extends ServerMessage {
  type: 'message_forwarded';
  originalMessage: MessageData;
  targetChannelId: string;
}

export interface ReactionAddedEvent extends ServerMessage {
  type: 'reaction_added';
  reaction: ReactionData;
}

export interface ReactionRemovedEvent extends ServerMessage {
  type: 'reaction_removed';
  messageId: string;
  emoji: string;
  userId: string;
}

export interface ErrorEvent extends ServerMessage {
  type: 'error';
  message: string;
}

export interface PongEvent extends ServerMessage {
  type: 'pong';
  timestamp: number;
}

// Data types
export interface MessageData {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  replyToId?: string | null;
  user: {
    id: string;
    name?: string;
    image?: string;
  };
  attachments: AttachmentData[];
  reactions: ReactionData[];
}

export interface ReactionData {
  id: string;
  emoji: string;
  messageId: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    name?: string;
  };
}

export interface AttachmentData {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

// Channel clients mapping (simplified - no join/leave tracking)
export type ChannelClientsMap = Map<string, Set<Socket>>; 