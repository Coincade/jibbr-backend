# Jibbr Messaging API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [Error Handling](#error-handling)
5. [Hybrid Architecture](#hybrid-architecture)
6. [REST API Endpoints](#rest-api-endpoints)
7. [Socket.IO Events](#socketio-events)
8. [File Upload Workflow](#file-upload-workflow)
9. [Data Models](#data-models)
10. [Soft Delete Functionality](#soft-delete-functionality)
11. [React Integration Examples](#react-integration-examples)
12. [Best Practices](#best-practices)

## Overview

The Jibbr Messaging API uses a **hybrid architecture** combining REST APIs and Socket.IO for optimal performance:

- **REST APIs**: Message history, file uploads, and non-realtime operations
- **Socket.IO**: Real-time messaging, reactions, edits, and message management
- **Soft Delete**: Messages are preserved for audit/emergency purposes

### Key Features
- **Real-time Messaging**: Instant message delivery via Socket.IO
- **Direct Messaging**: Private conversations between users
- **Channel Messaging**: Group conversations in channels
- **Soft Delete**: Messages are hidden but preserved in database
- **Improved File Upload**: Two-step process for better UX (Upload → Send)
- **File Attachments**: Upload images, documents, and other files (up to 10MB each, max 5 files)
- **Live Reactions**: Real-time emoji reactions to messages
- **Message Threading**: Reply to specific messages
- **Message Forwarding**: Forward messages to other channels
- **Message History**: REST API for loading past messages
- **Automatic Reconnection**: Socket.IO handles network interruptions gracefully
- **Fallback Support**: Falls back to HTTP long-polling if WebSockets fail

## Authentication

### REST API Authentication
All REST API endpoints require authentication via JWT tokens. Include the token in the Authorization header:

```javascript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### Socket.IO Authentication
Socket.IO connections require JWT token via authentication or query parameter:

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

## Base URL

```
Production: https://your-api-domain.com
Development: http://localhost:7000
```

## Error Handling

### Standard Error Response Format
```json
{
  "message": "Error description",
  "errors": {
    "field": ["validation error"]
  }
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Hybrid Architecture

### REST APIs for:
- Message history retrieval
- File uploads
- User management
- Channel management
- Conversation management
- Message deletion (soft delete)

### Socket.IO for:
- Real-time message sending
- Live reactions
- Message editing
- Message deletion notifications
- Typing indicators
- Online status

## REST API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword"
}
```

### Channel Messages

#### Send Message
```http
POST /api/messages/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Hello, world!",
  "channelId": "channel_123",
  "replyToId": "message_456" // Optional
}
```

#### Send Message with Attachments
```http
POST /api/messages/send-with-attachments
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "content": "Check out these files!",
  "channelId": "channel_123",
  "replyToId": "message_456", // Optional
  "attachments": [file1, file2, ...] // Max 5 files, 10MB each
}
```

#### Get Channel Messages
```http
GET /api/messages?channelId=channel_123&page=1&limit=50
Authorization: Bearer <token>
```

#### Get Specific Message
```http
GET /api/messages/message_123
Authorization: Bearer <token>
```

#### Edit Message
```http
PUT /api/messages/message_123
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated message content"
}
```

#### Delete Message (Soft Delete)
```http
DELETE /api/messages/message_123
Authorization: Bearer <token>
```

**Note**: Messages are soft deleted (preserved in database but hidden from UI)

#### React to Message
```http
POST /api/messages/message_123/react
Authorization: Bearer <token>
Content-Type: application/json

{
  "emoji": "👍"
}
```

#### Remove Reaction
```http
DELETE /api/messages/message_123/reactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "emoji": "👍"
}
```

#### Forward Message
```http
POST /api/messages/message_123/forward
Authorization: Bearer <token>
Content-Type: application/json

{
  "channelId": "target_channel_456"
}
```

### Direct Messages (Conversations)

#### Get or Create Conversation
```http
GET /api/conversations/with/user_123
Authorization: Bearer <token>
```

#### Get User's Conversations
```http
GET /api/conversations
Authorization: Bearer <token>
```

#### Get Conversation Messages
```http
GET /api/conversations/conversation_123/messages?page=1&limit=50
Authorization: Bearer <token>
```

#### Send Direct Message
```http
POST /api/conversations/conversation_123/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Hello! How are you?",
  "replyToId": "message_456" // Optional
}
```

#### Send Direct Message with Attachments
```http
POST /api/conversations/conversation_123/messages/with-attachments
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "content": "Check out these files!",
  "replyToId": "message_456", // Optional
  "attachments": [file1, file2, ...] // Max 5 files, 10MB each
}
```

#### Delete Direct Message (Soft Delete)
```http
DELETE /api/conversations/conversation_123/messages/message_456
Authorization: Bearer <token>
```

### File Upload

#### Upload Files
```http
POST /api/upload/files
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "files": [file1, file2, ...] // Max 5 files, 10MB each
}
```

### Workspace Management

#### Create Workspace
```http
POST /api/workspace
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Workspace",
  "image": "workspace_image_url" // Optional
}
```

#### Get User's Workspaces
```http
GET /api/workspace
Authorization: Bearer <token>
```

#### Join Workspace
```http
POST /api/workspace/join
Authorization: Bearer <token>
Content-Type: application/json

{
  "joinCode": "ABC123"
}
```

### Channel Management

#### Create Channel
```http
POST /api/channel
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "General",
  "type": "PUBLIC", // PUBLIC, PRIVATE, ANNOUNCEMENT
  "workspaceId": "workspace_123"
}
```

#### Get Workspace Channels
```http
GET /api/channel?workspaceId=workspace_123
Authorization: Bearer <token>
```

## Socket.IO Events

### Client → Server Events

#### Channel Events
```javascript
// Join channel
socket.emit('join_channel', { channelId: 'channel_123' });

// Leave channel
socket.emit('leave_channel', { channelId: 'channel_123' });

// Send message
socket.emit('send_message', {
  content: "Hello, world!",
  channelId: "channel_123",
  replyToId: "message_456", // Optional
  attachments: [] // Optional: File references from upload API
});

// Edit message
socket.emit('edit_message', {
  messageId: "message_123",
  content: "Updated content",
  channelId: "channel_123"
});

// Delete message (Soft Delete)
socket.emit('delete_message', {
  messageId: "message_123",
  channelId: "channel_123"
});

// Add reaction
socket.emit('add_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});

// Remove reaction
socket.emit('remove_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});

// Forward message
socket.emit('forward_message', {
  messageId: "message_123",
  channelId: "source_channel_123",
  targetChannelId: "target_channel_456"
});
```

#### Direct Message Events
```javascript
// Join conversation
socket.emit('join_conversation', { conversationId: 'conversation_123' });

// Leave conversation
socket.emit('leave_conversation', { conversationId: 'conversation_123' });

// Send direct message
socket.emit('send_direct_message', {
  content: "Hello! How are you?",
  conversationId: "conversation_123",
  replyToId: "message_456", // Optional
  attachments: [] // Optional: File references from upload API
});

// Edit direct message
socket.emit('edit_direct_message', {
  messageId: "message_123",
  content: "Updated content",
  conversationId: "conversation_123"
});

// Delete direct message (Soft Delete)
socket.emit('delete_direct_message', {
  messageId: "message_123",
  conversationId: "conversation_123"
});

// Add direct reaction
socket.emit('add_direct_reaction', {
  messageId: "message_123",
  emoji: "👍",
  conversationId: "conversation_123"
});

// Remove direct reaction
socket.emit('remove_direct_reaction', {
  messageId: "message_123",
  emoji: "👍",
  conversationId: "conversation_123"
});
```

#### Utility Events
```javascript
// Health check
socket.emit('ping');
```

### Server → Client Events

#### Channel Events
```javascript
// New message
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

// Message edited
socket.on('message_edited', (data) => {
  console.log('Message edited:', data);
});

// Message deleted (Soft Delete)
socket.on('message_deleted', (data) => {
  console.log('Message deleted:', data);
});

// Reaction added
socket.on('reaction_added', (reaction) => {
  console.log('Reaction added:', reaction);
});

// Reaction removed
socket.on('reaction_removed', (data) => {
  console.log('Reaction removed:', data);
});

// Message forwarded
socket.on('message_forwarded', (data) => {
  console.log('Message forwarded:', data);
});
```

#### Direct Message Events
```javascript
// New direct message
socket.on('new_direct_message', (message) => {
  console.log('New direct message:', message);
});

// Direct message edited
socket.on('direct_message_edited', (data) => {
  console.log('Direct message edited:', data);
});

// Direct message deleted (Soft Delete)
socket.on('direct_message_deleted', (data) => {
  console.log('Direct message deleted:', data);
});

// Direct reaction added
socket.on('direct_reaction_added', (reaction) => {
  console.log('Direct reaction added:', reaction);
});

// Direct reaction removed
socket.on('direct_reaction_removed', (data) => {
  console.log('Direct reaction removed:', data);
});
```

#### Connection Events
```javascript
// Authentication successful
socket.on('authenticated', (data) => {
  console.log('Authenticated:', data);
});

// Joined channel
socket.on('joined_channel', (data) => {
  console.log('Joined channel:', data);
});

// Left channel
socket.on('left_channel', (data) => {
  console.log('Left channel:', data);
});

// Joined conversation
socket.on('conversation_joined', (data) => {
  console.log('Joined conversation:', data);
});

// Left conversation
socket.on('conversation_left', (data) => {
  console.log('Left conversation:', data);
});

// Health check response
socket.on('pong', (data) => {
  console.log('Pong received:', data);
});

// Error
socket.on('error', (data) => {
  console.error('Socket error:', data);
});
```

## File Upload Workflow

### Two-Step Process for Better UX

#### Step 1: Upload Files via REST API
```javascript
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
// Upload files first
const uploadedFiles = await uploadFiles(fileList);

// Send message with file references
socket.emit('send_message', {
  content: "Check out these files!",
  channelId: "channel_123",
  attachments: uploadedFiles.data // File references from step 1
});
```

### Benefits of This Approach
1. **Better UX**: Users can see upload progress and preview files
2. **Error Handling**: Upload failures don't affect message sending
3. **Flexibility**: Upload multiple files, send when ready
4. **Real-time**: Files shared instantly via Socket.IO
5. **Scalability**: Better handling of large files

## Data Models

### Message Object (Channel)
```typescript
interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null; // Soft delete timestamp
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
  deletedAt: string | null; // Soft delete timestamp
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

### Conversation Object
```typescript
interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  lastMessage?: DirectMessage;
  unreadCount?: number;
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

## Soft Delete Functionality

### Overview
Messages are **soft deleted** instead of being permanently removed from the database. This ensures data preservation for audit and emergency purposes while maintaining a clean user experience.

### How Soft Delete Works

#### When a message is "deleted":
1. **Sets `deletedAt` timestamp** instead of removing the record
2. **Optionally replaces content** with `[This message was deleted]`
3. **Preserves all data** for audit/emergency purposes
4. **Hides from message history** by filtering out `deletedAt: null`

#### Benefits:
- 🛡️ **Data Preservation**: Messages are never truly lost
- 🔍 **Audit Trail**: Can investigate deleted messages if needed
- 🚨 **Emergency Recovery**: Can restore messages if required
- 📊 **Analytics**: Can analyze deletion patterns
- ⚖️ **Compliance**: Meets data retention requirements

### API Behavior

#### Message History
```javascript
// GET /api/messages?channelId=channel_123
// Automatically excludes soft-deleted messages
{
  "data": {
    "messages": [
      // Only active messages (deletedAt: null)
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "pages": 2
    }
  }
}
```

#### Reply Validation
```javascript
// Cannot reply to deleted messages
socket.emit('send_message', {
  content: "This will fail",
  channelId: "channel_123",
  replyToId: "deleted_message_456" // Error: Original message not found or has been deleted
});
```

#### Delete Response
```javascript
// DELETE /api/messages/message_123
{
  "message": "Message deleted successfully"
}

// If already deleted
{
  "message": "Message is already deleted"
}
```

### Database Schema
```sql
-- Messages table with soft delete support
CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3), -- Soft delete timestamp
  "channelId" TEXT,
  "conversationId" TEXT,
  "userId" TEXT NOT NULL,
  "replyToId" TEXT,
  -- ... other fields
);
```

## React Integration Examples

### Basic Message Component
```jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const MessageComponent = ({ channelId }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:8000', {
      auth: { token: localStorage.getItem('token') }
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
      newSocket.emit('join_channel', { channelId });
    });

    newSocket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('message_deleted', (data) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });

    setSocket(newSocket);

    // Load message history
    loadMessages();

    return () => newSocket.close();
  }, [channelId]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/messages?channelId=${channelId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setMessages(data.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = () => {
    if (inputValue.trim() && socket) {
      socket.emit('send_message', {
        content: inputValue,
        channelId
      });
      setInputValue('');
    }
  };

  const deleteMessage = (messageId) => {
    if (socket) {
      socket.emit('delete_message', {
        messageId,
        channelId
      });
    }
  };

  const addReaction = (messageId, emoji) => {
    if (socket) {
      socket.emit('add_reaction', {
        messageId,
        emoji,
        channelId
      });
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className="message">
            <div className="message-header">
              <span className="username">{message.user.name}</span>
              <span className="timestamp">
                {new Date(message.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="message-content">{message.content}</div>
            
            {message.attachments.length > 0 && (
              <div className="attachments">
                {message.attachments.map(attachment => (
                  <div key={attachment.id} className="attachment">
                    <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                      {attachment.originalName}
                    </a>
                  </div>
                ))}
              </div>
            )}
            
            <div className="reactions">
              {message.reactions.map(reaction => (
                <span key={reaction.id} className="reaction">
                  {reaction.emoji}
                </span>
              ))}
            </div>
            
            <div className="message-actions">
              <button onClick={() => addReaction(message.id, '👍')}>👍</button>
              <button onClick={() => addReaction(message.id, '❤️')}>❤️</button>
              <button onClick={() => deleteMessage(message.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="message-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default MessageComponent;
```

### Direct Message Component
```jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const DirectMessageComponent = ({ conversationId }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:8000', {
      auth: { token: localStorage.getItem('token') }
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
      newSocket.emit('join_conversation', { conversationId });
    });

    newSocket.on('new_direct_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('direct_message_deleted', (data) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });

    setSocket(newSocket);

    // Load message history
    loadMessages();

    return () => newSocket.close();
  }, [conversationId]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setMessages(data.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = () => {
    if (inputValue.trim() && socket) {
      socket.emit('send_direct_message', {
        content: inputValue,
        conversationId
      });
      setInputValue('');
    }
  };

  const deleteMessage = (messageId) => {
    if (socket) {
      socket.emit('delete_direct_message', {
        messageId,
        conversationId
      });
    }
  };

  return (
    <div className="dm-container">
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className="message">
            <div className="message-header">
              <span className="username">{message.user.name}</span>
              <span className="timestamp">
                {new Date(message.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="message-content">{message.content}</div>
            
            <div className="message-actions">
              <button onClick={() => deleteMessage(message.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="message-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default DirectMessageComponent;
```

### File Upload Component
```jsx
import React, { useState } from 'react';

const FileUploadComponent = ({ onFilesUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFiles = async (files) => {
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        onFilesUploaded(data.data);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  return (
    <div className="file-upload">
      <input
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      
      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <span>Uploading... {uploadProgress}%</span>
        </div>
      )}
    </div>
  );
};

export default FileUploadComponent;
```

## Best Practices

### 1. Connection Management
```javascript
// Handle reconnection
socket.on('disconnect', () => {
  console.log('Disconnected, attempting to reconnect...');
  setTimeout(() => {
    socket.connect();
  }, 1000);
});

// Monitor connection status
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

### 2. Error Handling
```javascript
// Handle Socket.IO errors
socket.on('error', (data) => {
  if (data.message === 'Authentication failed') {
    // Redirect to login
    window.location.href = '/login';
  } else {
    // Show user-friendly error
    showNotification(data.message, 'error');
  }
});

// Handle API errors
const handleApiError = (error) => {
  if (error.status === 401) {
    // Token expired, redirect to login
    window.location.href = '/login';
  } else if (error.status === 403) {
    // Permission denied
    showNotification('You do not have permission to perform this action', 'error');
  } else {
    // Generic error
    showNotification('An error occurred. Please try again.', 'error');
  }
};
```

### 3. Message Handling
```javascript
// Optimistic updates for better UX
const sendMessageOptimistic = (content) => {
  const tempMessage = {
    id: `temp_${Date.now()}`,
    content,
    user: currentUser,
    createdAt: new Date().toISOString(),
    pending: true
  };

  setMessages(prev => [tempMessage, ...prev]);

  socket.emit('send_message', { content, channelId });

  // Remove temp message when real message arrives
  socket.on('new_message', (message) => {
    setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
  });
};
```

### 4. File Upload Best Practices
```javascript
// Validate file size and type
const validateFile = (file) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not supported.');
  }

  return true;
};

// Upload with progress
const uploadWithProgress = async (files) => {
  const formData = new FormData();
  files.forEach(file => {
    validateFile(file);
    formData.append('files', file);
  });

  const xhr = new XMLHttpRequest();
  
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const progress = (event.loaded / event.total) * 100;
      setUploadProgress(progress);
    }
  });

  return new Promise((resolve, reject) => {
    xhr.onload = () => resolve(JSON.parse(xhr.responseText));
    xhr.onerror = () => reject(new Error('Upload failed'));
    
    xhr.open('POST', '/api/upload/files');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};
```

### 5. Soft Delete Considerations
```javascript
// Handle deleted messages in UI
const handleMessageDeleted = (messageId) => {
  setMessages(prev => prev.filter(msg => msg.id !== messageId));
  
  // Optionally show a notification
  showNotification('Message deleted', 'info');
};

// Prevent actions on deleted messages
const canInteractWithMessage = (message) => {
  return !message.deletedAt;
};

// Show deleted message indicator
const renderMessage = (message) => {
  if (message.deletedAt) {
    return (
      <div className="message deleted">
        <em>This message was deleted</em>
      </div>
    );
  }
  
  return (
    <div className="message">
      {/* Normal message content */}
    </div>
  );
};
```

### 6. Performance Optimization
```javascript
// Paginate message history
const loadMessages = async (page = 1) => {
  const response = await fetch(`/api/messages?channelId=${channelId}&page=${page}&limit=50`);
  const data = await response.json();
  
  if (page === 1) {
    setMessages(data.data.messages);
  } else {
    setMessages(prev => [...prev, ...data.data.messages]);
  }
  
  return data.data.pagination;
};

// Debounce message sending
const debouncedSend = useCallback(
  debounce((content) => {
    socket.emit('send_message', { content, channelId });
  }, 300),
  [socket, channelId]
);
```

This comprehensive API documentation covers all the new features including soft delete functionality, direct messaging, and updated endpoints. The documentation provides clear examples and best practices for implementing these features in your frontend applications.