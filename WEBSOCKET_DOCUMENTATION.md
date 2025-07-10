# Jibbr WebSocket Documentation

## Overview

The Jibbr backend uses **Socket.IO** for real-time messaging functionality, providing a robust and scalable solution for instant communication. This implementation focuses exclusively on **messaging-related features** while keeping other operations (channel management, user management) as REST APIs.

## Architecture

### Hybrid Approach
- **Socket.IO**: Real-time messaging, reactions, edits, and message management
- **REST APIs**: Message history, file uploads, channel management, user operations

### Key Benefits of Socket.IO
- **Automatic Reconnection**: Handles network interruptions gracefully
- **Fallback Support**: Falls back to HTTP long-polling if WebSockets fail
- **Room Management**: Built-in room system for channel management
- **Better Error Handling**: More robust error handling and recovery
- **Cross-Platform**: Better support across different browsers and environments
- **Event-Based**: Cleaner event-based API compared to message parsing

## Server Setup

### Dependencies
```json
{
  "socket.io": "^4.7.0",
  "@types/socket.io": "^3.0.2"
}
```

### Server Configuration
```typescript
import { Server } from 'socket.io';
import { createServer } from 'http';

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
```

## Authentication

### JWT Token Validation
Socket.IO connections require valid JWT tokens for authentication:

```typescript
// Middleware for token validation
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});
```

### Client Connection
```javascript
// Using auth object (recommended)
const socket = io('http://localhost:8000', {
  auth: {
    token: jwtToken
  }
});

// Or using query parameters
const socket = io('http://localhost:8000?token=' + jwtToken);
```

## Event Types

### Client → Server Events

#### 1. Join Channel
```javascript
socket.emit('join_channel', {
  channelId: 'channel_123'
});
```

#### 2. Leave Channel
```javascript
socket.emit('leave_channel', {
  channelId: 'channel_123'
});
```

#### 3. Send Message
```javascript
socket.emit('send_message', {
  content: "Hello, world!",
  channelId: "channel_123",
  replyToId: "message_456", // Optional
  attachments: [] // Optional: File references from upload API
});
```

#### 4. Edit Message
```javascript
socket.emit('edit_message', {
  messageId: "message_123",
  content: "Updated content",
  channelId: "channel_123"
});
```

#### 5. Delete Message
```javascript
socket.emit('delete_message', {
  messageId: "message_123",
  channelId: "channel_123"
});
```

#### 6. Forward Message
```javascript
socket.emit('forward_message', {
  messageId: "message_123",
  channelId: "source_channel_123",
  targetChannelId: "target_channel_456"
});
```

#### 7. Add Reaction
```javascript
socket.emit('add_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});
```

#### 8. Remove Reaction
```javascript
socket.emit('remove_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});
```

#### 9. Ping (Health Check)
```javascript
socket.emit('ping');
```

### Server → Client Events

#### 1. New Message
```javascript
socket.on('new_message', (message) => {
  console.log('New message received:', message);
});
```

#### 2. Message Edited
```javascript
socket.on('message_edited', (data) => {
  console.log('Message edited:', data);
});
```

#### 3. Message Deleted
```javascript
socket.on('message_deleted', (data) => {
  console.log('Message deleted:', data);
});
```

#### 4. Message Forwarded
```javascript
socket.on('message_forwarded', (data) => {
  console.log('Message forwarded:', data);
});
```

#### 5. Reaction Added
```javascript
socket.on('reaction_added', (reaction) => {
  console.log('Reaction added:', reaction);
});
```

#### 6. Reaction Removed
```javascript
socket.on('reaction_removed', (data) => {
  console.log('Reaction removed:', data);
});
```

#### 7. Pong (Health Check Response)
```javascript
socket.on('pong', (data) => {
  console.log('Pong received:', data);
});
```

#### 8. Error
```javascript
socket.on('error', (data) => {
  console.error('Error received:', data);
});
```

## File Upload Workflow

### Improved UX Approach

The new file upload system provides a better user experience by separating file upload from message sending:

#### Step 1: Upload Files via REST API
```javascript
// Upload files first
const uploadFiles = async (files) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  
  const response = await fetch('/api/upload/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  return response.json();
};
```

#### Step 2: Send Message with File References via Socket.IO
```javascript
// Send message with file references
socket.emit('send_message', {
  content: "Check out these files!",
  channelId: "channel_123",
  attachments: uploadedFiles // File references from step 1
});
```

### Benefits of This Approach

1. **Better UX**: Users can see upload progress and preview files
2. **Error Handling**: Upload failures don't affect message sending
3. **Flexibility**: Upload multiple files, send when ready
4. **Real-time**: Files shared instantly via Socket.IO
5. **Scalability**: Better handling of large files

## Data Models

### Message Object
```typescript
interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  replyToId: string | null;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
  replyTo: Message | null;
  attachments: Attachment[];
  reactions: Reaction[];
}
```

### Attachment Object
```typescript
interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}
```

### Reaction Object
```typescript
interface Reaction {
  id: string;
  emoji: string;
  messageId: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}
```

## Room Management

### Channel-Based Rooms
Each channel is represented as a Socket.IO room:

```typescript
// Join channel room
socket.on('join_channel', async (data) => {
  const { channelId } = data;
  
  // Validate user has access to channel
  const hasAccess = await validateChannelAccess(socket.userId, channelId);
  if (!hasAccess) {
    socket.emit('error', { message: 'Access denied to channel' });
    return;
  }
  
  socket.join(channelId);
  socket.emit('joined_channel', { channelId });
});

// Leave channel room
socket.on('leave_channel', (data) => {
  const { channelId } = data;
  socket.leave(channelId);
  socket.emit('left_channel', { channelId });
});
```

### Broadcasting to Rooms
```typescript
// Broadcast message to channel
io.to(channelId).emit('new_message', message);

// Broadcast reaction to channel
io.to(channelId).emit('reaction_added', reaction);

// Broadcast message edit to channel
io.to(channelId).emit('message_edited', {
  messageId: message.id,
  content: message.content
});
```

## Error Handling

### Connection Errors
```typescript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Handle reconnection logic
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Handle disconnection
});
```

### Event Errors
```typescript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
  // Show user-friendly error message
});
```

### Server-Side Error Handling
```typescript
// Wrap event handlers in try-catch
socket.on('send_message', async (data) => {
  try {
    // Process message
    const message = await createMessage(data);
    io.to(data.channelId).emit('new_message', message);
  } catch (error) {
    socket.emit('error', { 
      message: 'Failed to send message',
      details: error.message 
    });
  }
});
```

## Performance Optimization

### Message Batching
```typescript
// Batch multiple messages for bulk operations
const batchMessages = (messages: Message[]) => {
  io.to(channelId).emit('batch_messages', messages);
};
```

### Connection Limits
```typescript
// Limit connections per user
const userConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_USER = 3;

socket.on('connect', () => {
  const currentConnections = userConnections.get(socket.userId) || 0;
  if (currentConnections >= MAX_CONNECTIONS_PER_USER) {
    socket.disconnect();
    return;
  }
  userConnections.set(socket.userId, currentConnections + 1);
});
```

### Rate Limiting
```typescript
// Implement rate limiting for Socket.IO events
const rateLimit = new Map<string, number[]>();

const checkRateLimit = (userId: string, event: string) => {
  const now = Date.now();
  const userEvents = rateLimit.get(`${userId}:${event}`) || [];
  const recentEvents = userEvents.filter(time => now - time < 60000); // 1 minute
  
  if (recentEvents.length >= 10) { // Max 10 events per minute
    return false;
  }
  
  recentEvents.push(now);
  rateLimit.set(`${userId}:${event}`, recentEvents);
  return true;
};
```

## Testing

### Unit Tests
```typescript
import { io as Client } from 'socket.io-client';

describe('Socket.IO Tests', () => {
  let client: any;
  
  beforeEach((done) => {
    client = Client('http://localhost:8000', {
      auth: { token: 'valid-jwt-token' }
    });
    client.on('connect', done);
  });
  
  afterEach(() => {
    client.close();
  });
  
  test('should send and receive message', (done) => {
    client.emit('send_message', {
      content: 'Test message',
      channelId: 'test-channel'
    });
    
    client.on('new_message', (message) => {
      expect(message.content).toBe('Test message');
      done();
    });
  });
});
```

### Integration Tests
```typescript
// Test with real database
test('should create message in database', async () => {
  const message = await createMessage({
    content: 'Test message',
    channelId: 'test-channel',
    userId: 'test-user'
  });
  
  expect(message).toBeDefined();
  expect(message.content).toBe('Test message');
});
```

## Monitoring and Debugging

### Connection Statistics
```typescript
// Get connection stats
app.get('/api/ws/stats', (req, res) => {
  const stats = {
    totalConnections: io.engine.clientsCount,
    channelStats: getChannelStats(),
    userStats: getUserStats()
  };
  res.json(stats);
});
```

### Logging
```typescript
// Log all events for debugging
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);
  
  socket.onAny((eventName, ...args) => {
    console.log(`Event: ${eventName}`, args);
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});
```

## Migration from Raw WebSockets

### Key Changes Made
1. **Replaced `ws` package with `socket.io`**
2. **Updated authentication middleware**
3. **Changed from message parsing to event-based communication**
4. **Replaced manual room management with Socket.IO rooms**
5. **Updated all event handlers to use Socket.IO emit methods**

### Benefits Achieved
- **Automatic reconnection handling**
- **Better cross-browser compatibility**
- **Built-in room management**
- **Improved error handling**
- **Fallback to HTTP long-polling**
- **Cleaner event-based API**

## Best Practices

### 1. Connection Management
- Let Socket.IO handle reconnection automatically
- Monitor connection status for user feedback
- Handle connection errors gracefully

### 2. Event Handling
- Always validate data before processing
- Handle unknown event types gracefully
- Implement proper error responses

### 3. Security
- Always validate JWT tokens
- Implement rate limiting for events
- Sanitize user input before broadcasting

### 4. Performance
- Limit message size and frequency
- Use rooms for targeted broadcasting
- Implement connection pooling for multiple channels

### 5. Testing
- Mock Socket.IO for unit tests
- Test both success and error scenarios
- Test reconnection logic

This documentation provides a comprehensive guide for the Socket.IO implementation in the Jibbr messaging system, focusing on real-time messaging features while maintaining a clean separation of concerns with REST APIs for other operations. 