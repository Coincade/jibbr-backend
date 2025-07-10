# WebSocket Documentation

## Overview

The WebSocket service provides real-time communication for both channel messages and direct messages. It uses Socket.IO for reliable, bidirectional communication with automatic reconnection and fallback support.

## Connection

### Authentication
All WebSocket connections require JWT authentication. The token can be provided in two ways:

1. **Auth object (recommended)**
2. **Query parameter**

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

#### Channel Events

##### 1. Join Channel
```javascript
socket.emit('join_channel', {
  channelId: 'channel_123'
});
```

##### 2. Leave Channel
```javascript
socket.emit('leave_channel', {
  channelId: 'channel_123'
});
```

##### 3. Send Message
```javascript
socket.emit('send_message', {
  content: "Hello, world!",
  channelId: "channel_123",
  replyToId: "message_456", // Optional
  attachments: [] // Optional: File references from upload API
});
```

##### 4. Edit Message
```javascript
socket.emit('edit_message', {
  messageId: "message_123",
  content: "Updated content",
  channelId: "channel_123"
});
```

##### 5. Delete Message
```javascript
socket.emit('delete_message', {
  messageId: "message_123",
  channelId: "channel_123"
});
```

##### 6. Forward Message
```javascript
socket.emit('forward_message', {
  messageId: "message_123",
  channelId: "source_channel_123",
  targetChannelId: "target_channel_456"
});
```

##### 7. Add Reaction
```javascript
socket.emit('add_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});
```

##### 8. Remove Reaction
```javascript
socket.emit('remove_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});
```

#### Direct Message Events

##### 1. Join Conversation
```javascript
socket.emit('join_conversation', {
  conversationId: 'conversation_123'
});
```

##### 2. Leave Conversation
```javascript
socket.emit('leave_conversation', {
  conversationId: 'conversation_123'
});
```

##### 3. Send Direct Message
```javascript
socket.emit('send_direct_message', {
  content: "Hello, how are you?",
  conversationId: "conversation_123",
  replyToId: "message_456", // Optional
  attachments: [] // Optional: File references from upload API
});
```

##### 4. Edit Direct Message
```javascript
socket.emit('edit_direct_message', {
  messageId: "message_123",
  content: "Updated content",
  conversationId: "conversation_123"
});
```

##### 5. Delete Direct Message
```javascript
socket.emit('delete_direct_message', {
  messageId: "message_123",
  conversationId: "conversation_123"
});
```

##### 6. Add Direct Reaction
```javascript
socket.emit('add_direct_reaction', {
  messageId: "message_123",
  emoji: "👍",
  conversationId: "conversation_123"
});
```

##### 7. Remove Direct Reaction
```javascript
socket.emit('remove_direct_reaction', {
  messageId: "message_123",
  emoji: "👍",
  conversationId: "conversation_123"
});
```

#### Utility Events

##### 9. Ping (Health Check)
```javascript
socket.emit('ping');
```

### Server → Client Events

#### Channel Events

##### 1. New Message
```javascript
socket.on('new_message', (message) => {
  console.log('New message received:', message);
});
```

##### 2. Message Edited
```javascript
socket.on('message_edited', (data) => {
  console.log('Message edited:', data);
});
```

##### 3. Message Deleted
```javascript
socket.on('message_deleted', (data) => {
  console.log('Message deleted:', data);
});
```

##### 4. Message Forwarded
```javascript
socket.on('message_forwarded', (data) => {
  console.log('Message forwarded:', data);
});
```

##### 5. Reaction Added
```javascript
socket.on('reaction_added', (reaction) => {
  console.log('Reaction added:', reaction);
});
```

##### 6. Reaction Removed
```javascript
socket.on('reaction_removed', (data) => {
  console.log('Reaction removed:', data);
});
```

#### Direct Message Events

##### 1. New Direct Message
```javascript
socket.on('new_direct_message', (message) => {
  console.log('New direct message received:', message);
});
```

##### 2. Direct Message Edited
```javascript
socket.on('direct_message_edited', (data) => {
  console.log('Direct message edited:', data);
});
```

##### 3. Direct Message Deleted
```javascript
socket.on('direct_message_deleted', (data) => {
  console.log('Direct message deleted:', data);
});
```

##### 4. Direct Reaction Added
```javascript
socket.on('direct_reaction_added', (reaction) => {
  console.log('Direct reaction added:', reaction);
});
```

##### 5. Direct Reaction Removed
```javascript
socket.on('direct_reaction_removed', (data) => {
  console.log('Direct reaction removed:', data);
});
```

#### Connection Events

##### 1. Authenticated
```javascript
socket.on('authenticated', (data) => {
  console.log('Authentication successful:', data);
});
```

##### 2. Joined Channel
```javascript
socket.on('joined_channel', (data) => {
  console.log('Joined channel:', data);
});
```

##### 3. Left Channel
```javascript
socket.on('left_channel', (data) => {
  console.log('Left channel:', data);
});
```

##### 4. Joined Conversation
```javascript
socket.on('conversation_joined', (data) => {
  console.log('Joined conversation:', data);
});
```

##### 5. Left Conversation
```javascript
socket.on('conversation_left', (data) => {
  console.log('Left conversation:', data);
});
```

##### 6. Pong (Health Check Response)
```javascript
socket.on('pong', (data) => {
  console.log('Pong received:', data);
});
```

##### 7. Error
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data);
});
```

## Data Types

### Message Object (Channel)
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

### Direct Message Object
```typescript
interface DirectMessage {
  id: string;
  content: string;
  conversationId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  replyToId: string | null;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
  replyTo: DirectMessage | null;
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

### Conversation-Based Rooms
Each conversation is represented as a Socket.IO room:

```typescript
// Join conversation room
socket.on('join_conversation', async (data) => {
  const { conversationId } = data;
  
  // Validate user is participant of conversation
  const isParticipant = await validateConversationParticipation(socket.userId, conversationId);
  if (!isParticipant) {
    socket.emit('error', { message: 'Access denied to conversation' });
    return;
  }
  
  socket.join(conversationId);
  socket.emit('conversation_joined', { conversationId });
});

// Leave conversation room
socket.on('leave_conversation', (data) => {
  const { conversationId } = data;
  socket.leave(conversationId);
  socket.emit('conversation_left', { conversationId });
});
```

### Broadcasting to Rooms
```typescript
// Broadcast message to channel
io.to(channelId).emit('new_message', message);

// Broadcast message to conversation
io.to(conversationId).emit('new_direct_message', message);

// Broadcast reaction to channel
io.to(channelId).emit('reaction_added', reaction);

// Broadcast reaction to conversation
io.to(conversationId).emit('direct_reaction_added', reaction);

// Broadcast message edit to channel
io.to(channelId).emit('message_edited', {
  messageId: message.id,
  content: message.content
});

// Broadcast message edit to conversation
io.to(conversationId).emit('direct_message_edited', {
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
  // Handle disconnection logic
});
```

### Authentication Errors
```typescript
socket.on('error', (data) => {
  if (data.message === 'Authentication failed') {
    // Redirect to login or refresh token
    console.error('Authentication failed:', data);
  }
});
```

## Best Practices

### 1. Connection Management
```javascript
// Reconnect on connection loss
socket.on('disconnect', () => {
  console.log('Disconnected, attempting to reconnect...');
  setTimeout(() => {
    socket.connect();
  }, 1000);
});

// Handle reconnection
socket.on('connect', () => {
  console.log('Reconnected successfully');
  // Re-join rooms if needed
});
```

### 2. Room Management
```javascript
// Join rooms when connecting
socket.on('authenticated', (data) => {
  // Join user's active channels
  activeChannels.forEach(channelId => {
    socket.emit('join_channel', { channelId });
  });
  
  // Join user's active conversations
  activeConversations.forEach(conversationId => {
    socket.emit('join_conversation', { conversationId });
  });
});
```

### 3. Message Handling
```javascript
// Handle incoming messages
socket.on('new_message', (message) => {
  // Update UI with new message
  addMessageToUI(message);
});

socket.on('new_direct_message', (message) => {
  // Update UI with new direct message
  addDirectMessageToUI(message);
});

// Handle message updates
socket.on('message_edited', (data) => {
  // Update message in UI
  updateMessageInUI(data.messageId, data.content);
});

socket.on('direct_message_edited', (data) => {
  // Update direct message in UI
  updateDirectMessageInUI(data.messageId, data.content);
});
```

### 4. Error Recovery
```javascript
// Retry failed operations
socket.on('error', (data) => {
  if (data.message.includes('Failed to send')) {
    // Store message for retry
    storeMessageForRetry(data);
  }
});

// Implement retry mechanism
function retryFailedMessage(messageData) {
  setTimeout(() => {
    socket.emit('send_message', messageData);
  }, 2000);
}
```

## API Integration

### REST API for History
```javascript
// Load message history
async function loadChannelMessages(channelId, page = 1) {
  const response = await fetch(`/api/messages?channelId=${channelId}&page=${page}`);
  const data = await response.json();
  return data.data;
}

// Load direct message history
async function loadConversationMessages(conversationId, page = 1) {
  const response = await fetch(`/api/conversations/${conversationId}/messages?page=${page}`);
  const data = await response.json();
  return data.data;
}
```

### File Upload Integration
```javascript
// Upload file first, then send message with file reference
async function sendMessageWithFile(channelId, content, file) {
  // 1. Upload file
  const formData = new FormData();
  formData.append('file', file);
  
  const uploadResponse = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  const uploadData = await uploadResponse.json();
  
  // 2. Send message with file reference
  socket.emit('send_message', {
    content,
    channelId,
    attachments: [uploadData.data]
  });
}
```

## Security Considerations

1. **Authentication**: All connections require valid JWT tokens
2. **Authorization**: Users can only access channels they're members of and conversations they're participants in
3. **Input Validation**: All message content is validated before processing
4. **Rate Limiting**: Consider implementing rate limiting for message sending
5. **File Upload**: Files are validated for type and size before upload

## Performance Tips

1. **Room Management**: Only join rooms when needed, leave when not active
2. **Message Batching**: Consider batching multiple messages for better performance
3. **Connection Pooling**: Reuse connections when possible
4. **Error Handling**: Implement proper error handling to prevent connection drops
5. **Monitoring**: Use the stats endpoint to monitor connection health 