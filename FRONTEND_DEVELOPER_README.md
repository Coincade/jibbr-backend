# Frontend Developer Guide

## Overview

This guide provides comprehensive documentation for frontend developers working with the Jibbr Backend API. The backend provides real-time messaging, workspace management, and user presence functionality through REST APIs and WebSocket connections.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [REST API Endpoints](#rest-api-endpoints)
4. [WebSocket Integration](#websocket-integration)
5. [Online Status & Presence](#online-status--presence)
6. [Real-time Features](#real-time-features)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Code Examples](#code-examples)

## Getting Started

### Base URL
```
Development: http://localhost:7000
Production: https://your-production-domain.com
```

### Required Headers
All API requests require authentication:
```javascript
const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
};
```

## Authentication

### Login
```javascript
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.token);
    return data.user;
  }
  throw new Error(data.message);
};
```

### Register
```javascript
const register = async (userData) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  
  return response.json();
};
```

## REST API Endpoints

### Workspace Management

#### Get User's Workspaces
```javascript
const getWorkspaces = async () => {
  const response = await fetch('/api/workspace', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

#### Create Workspace
```javascript
const createWorkspace = async (workspaceData) => {
  const response = await fetch('/api/workspace', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(workspaceData)
  });
  return response.json();
};
```

#### Join Workspace
```javascript
const joinWorkspace = async (joinCode) => {
  const response = await fetch('/api/workspace/join', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode })
  });
  return response.json();
};
```

### Channel Management

#### Get Workspace Channels
```javascript
const getChannels = async (workspaceId) => {
  const response = await fetch(`/api/channel/workspace/${workspaceId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

#### Create Channel
```javascript
const createChannel = async (channelData) => {
  const response = await fetch('/api/channel', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(channelData)
  });
  return response.json();
};
```

#### Join Channel
```javascript
const joinChannel = async (channelId) => {
  const response = await fetch('/api/channel/join', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId })
  });
  return response.json();
};
```

### Message Management

#### Get Channel Messages
```javascript
const getMessages = async (channelId, page = 1, limit = 50) => {
  const response = await fetch(`/api/messages?channelId=${channelId}&page=${page}&limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

#### Send Message
```javascript
const sendMessage = async (messageData) => {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(messageData)
  });
  return response.json();
};
```

### Direct Messages

#### Get Conversations
```javascript
const getConversations = async () => {
  const response = await fetch('/api/conversations', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

#### Get Conversation Messages
```javascript
const getConversationMessages = async (conversationId, page = 1) => {
  const response = await fetch(`/api/conversations/${conversationId}/messages?page=${page}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

## WebSocket Integration

### Connection Setup
```javascript
import { io } from 'socket.io-client';

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(token) {
    this.socket = io('http://localhost:7000', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
    });

    this.socket.on('authenticated', (data) => {
      console.log('Authentication successful:', data);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }
}
```

### Channel Events

#### Join Channel
```javascript
socket.emit('join_channel', { channelId: 'channel_123' });

socket.on('joined_channel', (data) => {
  console.log('Joined channel:', data.channelId);
});
```

#### Send Message
```javascript
socket.emit('send_message', {
  content: "Hello, world!",
  channelId: "channel_123",
  replyToId: "message_456", // Optional
  attachments: [] // Optional
});

socket.on('new_message', (message) => {
  console.log('New message received:', message);
  // Update UI with new message
});
```

#### Add Reaction
```javascript
socket.emit('add_reaction', {
  messageId: "message_123",
  emoji: "👍",
  channelId: "channel_123"
});

socket.on('reaction_added', (reaction) => {
  console.log('Reaction added:', reaction);
});
```

### Direct Message Events

#### Join Conversation
```javascript
socket.emit('join_conversation', { conversationId: 'conversation_123' });

socket.on('conversation_joined', (data) => {
  console.log('Joined conversation:', data.conversationId);
});
```

#### Send Direct Message
```javascript
socket.emit('send_direct_message', {
  content: "Hello, how are you?",
  conversationId: "conversation_123"
});

socket.on('new_direct_message', (message) => {
  console.log('New direct message received:', message);
});
```

## Online Status & Presence

### Real-time Status Updates
```javascript
socket.on('user_status_change', (data) => {
  console.log('User status changed:', data);
  // data = { userId: "user_123", isOnline: true, timestamp: "2024-01-01T00:00:00.000Z" }
  updateUserStatus(data.userId, data.isOnline);
});
```

### Query Online Status

#### Get All Online Users
```javascript
const getOnlineUsers = async () => {
  const response = await fetch('/api/presence/online', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.onlineUsers; // Array of user IDs
};
```

#### Check Specific User
```javascript
const checkUserStatus = async (userId) => {
  const response = await fetch(`/api/presence/online/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.isOnline; // boolean
};
```

#### Check Multiple Users
```javascript
const checkMultipleUsers = async (userIds) => {
  const response = await fetch('/api/presence/online/check-multiple', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds })
  });
  const data = await response.json();
  return data; // { "user1": true, "user2": false, "user3": true }
};
```

### Presence Manager Class
```javascript
class PresenceManager {
  constructor(socket) {
    this.socket = socket;
    this.onlineUsers = new Set();
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.socket.on('user_status_change', (data) => {
      if (data.isOnline) {
        this.onlineUsers.add(data.userId);
      } else {
        this.onlineUsers.delete(data.userId);
      }
      this.updateUI();
    });
  }

  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers);
  }

  updateUI() {
    // Update your UI to show online indicators
    document.querySelectorAll('[data-user-id]').forEach(element => {
      const userId = element.dataset.userId;
      const isOnline = this.isUserOnline(userId);
      element.classList.toggle('online', isOnline);
      element.classList.toggle('offline', !isOnline);
    });
  }

  async loadInitialStatus() {
    try {
      const response = await fetch('/api/presence/online', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      this.onlineUsers = new Set(data.onlineUsers);
      this.updateUI();
    } catch (error) {
      console.error('Failed to load online status:', error);
    }
  }
}
```

## Real-time Features

### Message Broadcasting
- Messages are automatically broadcast to all users in the same channel/conversation
- Real-time updates for message edits, deletions, and reactions
- Automatic reconnection handling

### File Attachments
```javascript
// 1. Upload file first
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  return response.json();
};

// 2. Send message with attachment
const sendMessageWithFile = async (channelId, content, file) => {
  const uploadResult = await uploadFile(file);
  
  socket.emit('send_message', {
    content,
    channelId,
    attachments: [uploadResult.data]
  });
};
```

### Message Forwarding
```javascript
// Forward message to another channel
socket.emit('forward_message', {
  messageId: "message_123",
  channelId: "source_channel_123",
  targetChannelId: "target_channel_456"
});

// Forward message to direct conversation
socket.emit('forward_to_direct', {
  messageId: "message_123",
  targetConversationId: "conversation_456"
});
```

## Error Handling

### API Error Handling
```javascript
const handleApiError = (response) => {
  if (!response.ok) {
    switch (response.status) {
      case 401:
        // Unauthorized - redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
        break;
      case 403:
        // Forbidden - show access denied message
        showError('You do not have permission to perform this action');
        break;
      case 404:
        // Not found
        showError('Resource not found');
        break;
      case 422:
        // Validation error
        response.json().then(data => {
          showValidationErrors(data.errors);
        });
        break;
      default:
        showError('An error occurred. Please try again.');
    }
  }
};
```

### WebSocket Error Handling
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  
  if (error.message === 'Authentication failed') {
    // Redirect to login
    localStorage.removeItem('token');
    window.location.href = '/login';
  } else {
    // Show user-friendly error message
    showError('Connection error. Please refresh the page.');
  }
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Implement retry logic
  setTimeout(() => {
    socket.connect();
  }, 5000);
});
```

## Best Practices

### 1. Connection Management
```javascript
class ConnectionManager {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(token) {
    this.socket = io('http://localhost:7000', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('disconnect', () => {
      this.handleDisconnect();
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });
  }

  handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.socket.connect();
      }, Math.pow(2, this.reconnectAttempts) * 1000);
    }
  }
}
```

### 2. State Management
```javascript
class AppState {
  constructor() {
    this.currentUser = null;
    this.workspaces = [];
    this.currentWorkspace = null;
    this.channels = [];
    this.currentChannel = null;
    this.messages = [];
    this.onlineUsers = new Set();
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.notifyListeners('userChanged', user);
  }

  addMessage(message) {
    this.messages.push(message);
    this.notifyListeners('messageAdded', message);
  }

  notifyListeners(event, data) {
    // Implement your event system here
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  }
}
```

### 3. Performance Optimization
```javascript
// Debounce message sending
const debouncedSendMessage = debounce((messageData) => {
  socket.emit('send_message', messageData);
}, 300);

// Throttle status updates
const throttledUpdateStatus = throttle((userId, isOnline) => {
  updateUserStatusUI(userId, isOnline);
}, 1000);

// Lazy load messages
const loadMessages = async (channelId, page = 1) => {
  const messages = await getMessages(channelId, page);
  if (page === 1) {
    this.messages = messages;
  } else {
    this.messages.unshift(...messages);
  }
};
```

## Code Examples

### Complete Chat Component (React)
```jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const ChatComponent = ({ channelId, token }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:7000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join_channel', { channelId });
    });

    newSocket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [channelId, token]);

  const sendMessage = () => {
    if (newMessage.trim() && socket) {
      socket.emit('send_message', {
        content: newMessage,
        channelId
      });
      setNewMessage('');
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className="message">
            <strong>{message.user.name}:</strong> {message.content}
          </div>
        ))}
      </div>
      <div className="input-container">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage} disabled={!isConnected}>
          Send
        </button>
      </div>
    </div>
  );
};
```

### Complete Presence Component (Vue)
```vue
<template>
  <div class="user-list">
    <div 
      v-for="user in users" 
      :key="user.id"
      class="user-item"
      :class="{ online: isUserOnline(user.id) }"
    >
      <div class="user-avatar">
        <img :src="user.image" :alt="user.name" />
        <div class="status-indicator"></div>
      </div>
      <span class="user-name">{{ user.name }}</span>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client';

export default {
  data() {
    return {
      socket: null,
      onlineUsers: new Set(),
      users: []
    };
  },
  mounted() {
    this.initializeSocket();
    this.loadUsers();
  },
  methods: {
    initializeSocket() {
      this.socket = io('http://localhost:7000', {
        auth: { token: this.$store.state.token }
      });

      this.socket.on('user_status_change', (data) => {
        if (data.isOnline) {
          this.onlineUsers.add(data.userId);
        } else {
          this.onlineUsers.delete(data.userId);
        }
      });
    },
    isUserOnline(userId) {
      return this.onlineUsers.has(userId);
    },
    async loadUsers() {
      try {
        const response = await fetch('/api/presence/online', {
          headers: { 'Authorization': `Bearer ${this.$store.state.token}` }
        });
        const data = await response.json();
        this.onlineUsers = new Set(data.onlineUsers);
      } catch (error) {
        console.error('Failed to load online users:', error);
      }
    }
  }
};
</script>

<style scoped>
.user-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
}

.user-item.online .status-indicator {
  background-color: #4CAF50;
}

.user-item:not(.online) .status-indicator {
  background-color: #ccc;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 8px;
}
</style>
```

## Support

For questions or issues:
1. Check the [WebSocket Documentation](./WEBSOCKET_DOCUMENTATION.md)
2. Review the [API Documentation](./API_DOCUMENTATION.md)
3. Contact the backend development team

---

**Happy Coding! 🚀**
