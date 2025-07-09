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
10. [React Integration Examples](#react-integration-examples)
11. [Best Practices](#best-practices)

## Overview

The Jibbr Messaging API uses a **hybrid architecture** combining REST APIs and Socket.IO for optimal performance:

- **REST APIs**: Message history, file uploads, and non-realtime operations
- **Socket.IO**: Real-time messaging, reactions, edits, and message management

### Key Features
- **Real-time Messaging**: Instant message delivery via Socket.IO
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

### Token Format
```
REST API: Authorization: Bearer <your-jwt-token>
Socket.IO: auth.token or query parameter
```

## Base URL

```
REST API:
Development: http://localhost:8000/api
Production: https://your-domain.com/api

Socket.IO:
Development: http://localhost:8000
Production: https://your-domain.com
```

## Error Handling

### REST API Error Responses
```javascript
// Success Response
{
  "message": "Operation successful",
  "data": { /* response data */ }
}

// Error Response
{
  "message": "Error description",
  "errors": { /* validation errors */ }
}
```

### Socket.IO Error Events
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});
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

### When to Use REST APIs
- **Message History**: Loading past messages with pagination
- **File Uploads**: Uploading files before sending messages
- **Channel Management**: Creating, updating, deleting channels
- **User Management**: Authentication, user profiles

### When to Use Socket.IO
- **Real-time Messaging**: Sending and receiving messages instantly
- **Message Reactions**: Adding/removing emoji reactions
- **Message Edits**: Updating message content
- **Message Deletion**: Removing messages
- **Message Forwarding**: Forwarding to other channels
- **File Sharing**: Sending messages with file references

## REST API Endpoints

### 1. Get Message History

**GET** `/api/messages/channel/:channelId`

Retrieve messages from a channel with pagination.

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 20, max: 100)

#### Example
```javascript
const getMessages = async (channelId, page = 1, limit = 20) => {
  const response = await fetch(
    `/api/messages/channel/${channelId}?page=${page}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};
```

#### Response
```javascript
{
  "message": "Messages retrieved successfully",
  "data": {
    "messages": [
      {
        "id": "msg_123",
        "content": "Hello!",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "user": {
          "id": "user_123",
          "name": "John Doe",
          "image": "https://example.com/avatar.jpg"
        },
        "attachments": [
          {
            "id": "att_123",
            "filename": "document.pdf",
            "originalName": "document.pdf",
            "mimeType": "application/pdf",
            "size": 1024000,
            "url": "https://spaces.example.com/attachments/document.pdf"
          }
        ],
        "reactions": [
          {
            "id": "react_123",
            "emoji": "👍",
            "user": {
              "id": "user_456",
              "name": "Jane Smith"
            }
          }
        ],
        "replyTo": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

### 2. Get Single Message

**GET** `/api/messages/:messageId`

Retrieve a specific message by ID.

#### Response
```javascript
{
  "message": "Message retrieved successfully",
  "data": {
    "id": "msg_123",
    "content": "Hello!",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "user": {
      "id": "user_123",
      "name": "John Doe",
      "image": "https://example.com/avatar.jpg"
    },
    "attachments": [],
    "reactions": [],
    "replyTo": null
  }
}
```

### 3. Upload Files

**POST** `/api/upload/files`

Upload files and get file references for use in messages.

#### Request
```javascript
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);

const response = await fetch('/api/upload/files', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

#### Response
```javascript
{
  "message": "Files uploaded successfully",
  "data": {
    "files": [
      {
        "id": "att_123",
        "filename": "document.pdf",
        "originalName": "document.pdf",
        "mimeType": "application/pdf",
        "size": 1024000,
        "url": "https://spaces.example.com/attachments/document.pdf",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### 4. Socket.IO Stats

**GET** `/api/ws/stats`

Get current Socket.IO connection statistics.

#### Response
```javascript
{
  "totalConnections": 5,
  "channelStats": {
    "channel_123": 3,
    "channel_456": 2
  }
}
```

## Socket.IO Events

### Client → Server Events

#### Send Message
```javascript
socket.emit('send_message', {
  content: "Hello, world!",
  channelId: "channel_123",
  replyToId: "message_456", // Optional
  attachments: [] // Optional: File references from upload API
});
```

#### Edit Message
```javascript
socket.emit('edit_message', {
  messageId: "message_123",
  content: "Updated content",
  channelId: "channel_123"
});
```

#### Delete Message
```javascript
socket.emit('delete_message', {
  messageId: "message_123",
  channelId: "channel_123"
});
```

#### Forward Message
```javascript
socket.emit('forward_message', {
  messageId: "message_123",
  channelId: "source_channel_123",
  targetChannelId: "target_channel_456"
});
```

#### Add Reaction
```javascript
socket.emit('add_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});
```

#### Remove Reaction
```javascript
socket.emit('remove_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});
```

#### Ping (Health Check)
```javascript
socket.emit('ping');
```

### Server → Client Events

#### New Message
```javascript
socket.on('new_message', (message) => {
  console.log('New message received:', message);
  // message structure:
  // {
  //   id: "message_123",
  //   content: "Hello, world!",
  //   channelId: "channel_123",
  //   userId: "user_123",
  //   createdAt: "2024-01-01T00:00:00.000Z",
  //   updatedAt: "2024-01-01T00:00:00.000Z",
  //   replyToId: null,
  //   user: { id: "user_123", name: "John Doe", image: "avatar.jpg" },
  //   attachments: [],
  //   reactions: []
  // }
});
```

#### Message Edited
```javascript
socket.on('message_edited', (data) => {
  console.log('Message edited:', data);
  // data structure:
  // {
  //   messageId: "message_123",
  //   content: "Updated content"
  // }
});
```

#### Message Deleted
```javascript
socket.on('message_deleted', (data) => {
  console.log('Message deleted:', data);
  // data structure:
  // {
  //   messageId: "message_123"
  // }
});
```

#### Message Forwarded
```javascript
socket.on('message_forwarded', (data) => {
  console.log('Message forwarded:', data);
  // data structure:
  // {
  //   originalMessage: { /* message object */ },
  //   targetChannelId: "target_channel_456"
  // }
});
```

#### Reaction Added
```javascript
socket.on('reaction_added', (reaction) => {
  console.log('Reaction added:', reaction);
  // reaction structure:
  // {
  //   id: "reaction_123",
  //   emoji: "👍",
  //   messageId: "message_123",
  //   userId: "user_123",
  //   createdAt: "2024-01-01T00:00:00.000Z",
  //   user: { id: "user_123", name: "John Doe" }
  // }
});
```

#### Reaction Removed
```javascript
socket.on('reaction_removed', (data) => {
  console.log('Reaction removed:', data);
  // data structure:
  // {
  //   messageId: "message_123",
  //   emoji: "👍",
  //   userId: "user_123"
  // }
});
```

#### Pong (Health Check Response)
```javascript
socket.on('pong', (data) => {
  console.log('Pong received:', data);
  // data structure:
  // {
  //   timestamp: 1704067200000
  // }
});
```

#### Error
```javascript
socket.on('error', (data) => {
  console.error('Error received:', data);
  // data structure:
  // {
  //   message: "Error description"
  // }
});
```

## File Upload Workflow

### Improved UX Approach

The new file upload system provides a better user experience by separating file upload from message sending:

#### Step 1: Upload Files
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

#### Step 2: Send Message with File References
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
```javascript
{
  id: string,
  content: string,
  channelId: string,
  userId: string,
  createdAt: string,
  updatedAt: string,
  replyToId: string | null,
  user: {
    id: string,
    name: string,
    image: string | null
  },
  replyTo: Message | null,
  attachments: Attachment[],
  reactions: Reaction[]
}
```

### Attachment Object
```javascript
{
  id: string,
  filename: string,
  originalName: string,
  mimeType: string,
  size: number,
  url: string,
  createdAt: string
}
```

### Reaction Object
```javascript
{
  id: string,
  emoji: string,
  messageId: string,
  userId: string,
  createdAt: string,
  user: {
    id: string,
    name: string
  }
}
```

## React Integration Examples

### 1. Basic Chat Component

```jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const ChatComponent = ({ channelId, token }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const newSocket = io('http://localhost:8000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to chat');
    });

    newSocket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('message_edited', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, content: data.content }
          : msg
      ));
    });

    newSocket.on('message_deleted', (data) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });

    newSocket.on('reaction_added', (reaction) => {
      setMessages(prev => prev.map(msg => 
        msg.id === reaction.messageId
          ? { ...msg, reactions: [...msg.reactions, reaction] }
          : msg
      ));
    });

    newSocket.on('reaction_removed', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId
          ? { 
              ...msg, 
              reactions: msg.reactions.filter(r => 
                !(r.emoji === data.emoji && r.userId === data.userId)
              )
            }
          : msg
      ));
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [token]);

  const sendMessage = () => {
    if (inputValue.trim() && socket) {
      socket.emit('send_message', {
        content: inputValue,
        channelId
      });
      setInputValue('');
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

export default ChatComponent;
```

### 2. Advanced Chat with Improved File Upload UX

```jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const AdvancedChat = ({ channelId, token }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:8000', {
      auth: { token }
    });

    // Socket.IO event handlers
    newSocket.on('connect', () => {
      console.log('Connected to chat');
    });

    newSocket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // ... other event handlers

    setSocket(newSocket);
    return () => newSocket.close();
  }, [token]);

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setUploadedFiles(prev => [...prev, ...result.data.files]);
        setSelectedFiles([]);
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = () => {
    if ((inputValue.trim() || uploadedFiles.length > 0) && socket) {
      socket.emit('send_message', {
        content: inputValue,
        channelId,
        attachments: uploadedFiles
      });
      setInputValue('');
      setUploadedFiles([]);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeUploadedFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="advanced-chat">
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
        
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
        
        {/* Selected Files (not yet uploaded) */}
        {selectedFiles.length > 0 && (
          <div className="selected-files">
            <h4>Files to upload:</h4>
            {selectedFiles.map((file, index) => (
              <div key={index} className="file-item">
                <span>{file.name}</span>
                <button onClick={() => removeSelectedFile(index)}>Remove</button>
              </div>
            ))}
            <button 
              onClick={uploadFiles} 
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>
        )}
        
        {/* Uploaded Files (ready to send) */}
        {uploadedFiles.length > 0 && (
          <div className="uploaded-files">
            <h4>Files ready to send:</h4>
            {uploadedFiles.map(file => (
              <div key={file.id} className="file-item">
                <span>{file.originalName}</span>
                <button onClick={() => removeUploadedFile(file.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
        
        <button 
          onClick={sendMessage} 
          disabled={!inputValue.trim() && uploadedFiles.length === 0}
        >
          Send Message
        </button>
      </div>
    </div>
  );
};

export default AdvancedChat;
```

## Best Practices

### 1. Connection Management
- Socket.IO handles reconnection automatically
- Monitor connection status for user feedback
- Handle connection errors gracefully

### 2. Error Handling
- Always listen for 'error' events
- Implement fallback to REST APIs when Socket.IO fails
- Log errors for debugging

### 3. Message Handling
- Validate message structure before processing
- Handle unknown event types gracefully
- Implement optimistic UI updates

### 4. File Upload
- Upload files before sending messages
- Show upload progress to users
- Handle upload errors gracefully
- Validate file types and sizes client-side

### 5. Performance
- Limit message size and frequency
- Implement message batching for bulk operations
- Use connection pooling for multiple channels

### 6. Security
- Always validate JWT tokens
- Implement rate limiting for Socket.IO events
- Sanitize user input before broadcasting

### 7. Testing
- Test both Socket.IO and REST API endpoints
- Mock Socket.IO for unit tests
- Test error scenarios and edge cases

## Migration from Raw WebSockets

This API was migrated from raw WebSockets (`ws` package) to Socket.IO for the following benefits:

### Advantages of Socket.IO
- **Automatic Reconnection**: Handles network interruptions gracefully
- **Fallback Support**: Falls back to HTTP long-polling if WebSockets fail
- **Room Management**: Built-in room system for channel management
- **Better Error Handling**: More robust error handling and recovery
- **Cross-Platform**: Better support across different browsers and environments
- **Event-Based**: Cleaner event-based API compared to message parsing

### Key Changes
- Replaced `WebSocketServer` with `SocketIOServer`
- Changed from message parsing to event-based communication
- Updated authentication to use Socket.IO middleware
- Replaced manual room management with Socket.IO rooms
- Updated all event handlers to use Socket.IO emit methods

This documentation provides a comprehensive guide for React frontend team to integrate with the hybrid Jibbr messaging API, using Socket.IO for real-time messaging and REST APIs for file uploads and message history.