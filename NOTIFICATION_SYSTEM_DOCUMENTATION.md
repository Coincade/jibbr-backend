# Notification System Documentation

## Overview

The notification system provides real-time tracking of unread messages for both channels and direct messages, along with comprehensive notification management. It includes:

- **Unread Message Tracking**: Automatic counting of unread messages per channel/conversation
- **Real-time Updates**: WebSocket events for instant notification updates
- **Notification Management**: Create, read, and manage user notifications
- **Preferences**: User-configurable notification settings
- **Mention Support**: Special notifications for user mentions
- **Reaction Notifications**: Notify users when their messages receive reactions

## Database Schema

### New Models Added

#### ChannelMember (Updated)
```sql
-- Added fields for unread tracking
lastReadAt  DateTime?
unreadCount Int       @default(0)
```

#### UserNotification
```sql
model UserNotification {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        NotificationType
  title       String
  message     String
  data        Json?     // Additional data like channelId, conversationId, messageId
  isRead      Boolean   @default(false)
  createdAt   DateTime  @default(now())
  readAt      DateTime?

  @@index([userId, isRead])
  @@index([userId, createdAt])
}
```

#### ConversationReadStatus
```sql
model ConversationReadStatus {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  lastReadAt     DateTime     @default(now())
  unreadCount    Int          @default(0)

  @@unique([conversationId, userId])
  @@index([userId, lastReadAt])
}
```

#### UserNotificationPreference
```sql
model UserNotificationPreference {
  id                    String    @id @default(cuid())
  userId                String    @unique
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  emailNotifications     Boolean   @default(true)
  pushNotifications     Boolean   @default(true)
  desktopNotifications  Boolean   @default(true)
  soundEnabled          Boolean   @default(true)
  mentionNotifications  Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt @default(now())
}
```

#### NotificationType Enum
```sql
enum NotificationType {
  NEW_MESSAGE
  MENTION
  REACTION
  CHANNEL_INVITE
  WORKSPACE_INVITE
  SYSTEM
}
```

## API Endpoints

### Base URL: `/api/notifications`

#### 1. Mark Messages as Read
```http
POST /api/notifications/mark-as-read
Authorization: Bearer <token>
Content-Type: application/json

{
  "channelId": "channel_123",        // Optional - for channel messages
  "conversationId": "conv_456",      // Optional - for direct messages
  "messageId": "msg_789"             // Optional - specific message
}
```

**Response:**
```json
{
  "message": "Messages marked as read"
}
```

#### 2. Get Unread Counts
```http
GET /api/notifications/unread-counts?workspaceId=workspace_123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Unread counts fetched successfully",
  "data": {
    "totalUnread": 15,
    "channels": [
      {
        "channelId": "channel_123",
        "channelName": "general",
        "workspaceId": "workspace_123",
        "unreadCount": 5,
        "lastReadAt": "2024-01-15T10:30:00Z"
      }
    ],
    "conversations": [
      {
        "conversationId": "conv_456",
        "participant": {
          "id": "user_789",
          "name": "John Doe",
          "image": "https://example.com/avatar.jpg"
        },
        "unreadCount": 3,
        "lastReadAt": "2024-01-15T09:45:00Z"
      }
    ]
  }
}
```

#### 3. Get User Notifications
```http
GET /api/notifications/notifications?page=1&limit=20&unreadOnly=false
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Notifications fetched successfully",
  "data": {
    "notifications": [
      {
        "id": "notif_123",
        "type": "NEW_MESSAGE",
        "title": "New message in #general",
        "message": "John Doe sent: Hello everyone!",
        "data": {
          "channelId": "channel_123",
          "messageId": "msg_456",
          "senderId": "user_789",
          "channelName": "general"
        },
        "isRead": false,
        "createdAt": "2024-01-15T10:30:00Z",
        "readAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

#### 4. Mark Notification as Read
```http
PATCH /api/notifications/notifications/:notificationId/read
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Notification marked as read"
}
```

#### 5. Mark All Notifications as Read
```http
PATCH /api/notifications/notifications/mark-all-read
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "All notifications marked as read"
}
```

#### 6. Get Notification Preferences
```http
GET /api/notifications/preferences
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Notification preferences fetched successfully",
  "data": {
    "id": "pref_123",
    "userId": "user_456",
    "emailNotifications": true,
    "pushNotifications": true,
    "desktopNotifications": true,
    "soundEnabled": true,
    "mentionNotifications": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### 7. Update Notification Preferences
```http
PUT /api/notifications/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "emailNotifications": true,
  "pushNotifications": false,
  "desktopNotifications": true,
  "soundEnabled": true,
  "mentionNotifications": true
}
```

**Response:**
```json
{
  "message": "Notification preferences updated successfully",
  "data": {
    "id": "pref_123",
    "userId": "user_456",
    "emailNotifications": true,
    "pushNotifications": false,
    "desktopNotifications": true,
    "soundEnabled": true,
    "mentionNotifications": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

## WebSocket Events

### Client to Server Events

#### Mark as Read
```javascript
socket.emit('mark_as_read', {
  channelId: 'channel_123',        // Optional
  conversationId: 'conv_456',       // Optional
  messageId: 'msg_789'             // Optional
});
```

### Server to Client Events

#### Unread Counts Updated
```javascript
socket.on('unread_counts_updated', (data) => {
  console.log('Unread counts updated:', data);
  // data.totalUnread - total unread messages
  // data.channels - array of channel unread counts
  // data.conversations - array of conversation unread counts
});
```

#### New Notification
```javascript
socket.on('new_notification', (data) => {
  console.log('New notification:', data.notification);
  // Show notification toast, update badge, etc.
});
```

## Frontend Integration Examples

### React/Vite Integration

#### 1. Notification Context
```typescript
// contexts/NotificationContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface NotificationContextType {
  unreadCounts: {
    totalUnread: number;
    channels: Array<{
      channelId: string;
      channelName: string;
      unreadCount: number;
    }>;
    conversations: Array<{
      conversationId: string;
      participant: any;
      unreadCount: number;
    }>;
  };
  notifications: Array<any>;
  markAsRead: (channelId?: string, conversationId?: string) => Promise<void>;
  loadNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadCounts, setUnreadCounts] = useState({
    totalUnread: 0,
    channels: [],
    conversations: []
  });
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io('http://localhost:8000', {
      auth: { token }
    });

    newSocket.on('unread_counts_updated', (data) => {
      setUnreadCounts(data);
    });

    newSocket.on('new_notification', (data) => {
      // Show notification toast
      showNotificationToast(data.notification);
      
      // Update unread counts
      loadUnreadCounts();
    });

    setSocket(newSocket);

    // Load initial data
    loadUnreadCounts();
    loadNotifications();

    return () => newSocket.close();
  }, []);

  const loadUnreadCounts = async () => {
    try {
      const response = await fetch('/api/notifications/unread-counts', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setUnreadCounts(data.data);
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications/notifications', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setNotifications(data.data.notifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const markAsRead = async (channelId?: string, conversationId?: string) => {
    try {
      await fetch('/api/notifications/mark-as-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channelId, conversationId })
      });
      
      // Reload unread counts
      loadUnreadCounts();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{
      unreadCounts,
      notifications,
      markAsRead,
      loadNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
```

#### 2. Channel List with Unread Counts
```typescript
// components/ChannelList.tsx
import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

const ChannelList: React.FC = () => {
  const { unreadCounts, markAsRead } = useNotifications();

  const handleChannelClick = async (channelId: string) => {
    await markAsRead(channelId);
    // Navigate to channel
  };

  return (
    <div className="channel-list">
      {unreadCounts.channels.map(channel => (
        <div 
          key={channel.channelId} 
          className="channel-item"
          onClick={() => handleChannelClick(channel.channelId)}
        >
          <span className="channel-name">#{channel.channelName}</span>
          {channel.unreadCount > 0 && (
            <span className="unread-badge">{channel.unreadCount}</span>
          )}
        </div>
      ))}
    </div>
  );
};
```

#### 3. Direct Message List with Unread Counts
```typescript
// components/DirectMessageList.tsx
import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

const DirectMessageList: React.FC = () => {
  const { unreadCounts, markAsRead } = useNotifications();

  const handleConversationClick = async (conversationId: string) => {
    await markAsRead(undefined, conversationId);
    // Navigate to conversation
  };

  return (
    <div className="dm-list">
      {unreadCounts.conversations.map(conv => (
        <div 
          key={conv.conversationId} 
          className="dm-item"
          onClick={() => handleConversationClick(conv.conversationId)}
        >
          <img 
            src={conv.participant?.image || '/default-avatar.png'} 
            alt={conv.participant?.name}
            className="avatar"
          />
          <span className="participant-name">
            {conv.participant?.name || 'Unknown User'}
          </span>
          {conv.unreadCount > 0 && (
            <span className="unread-badge">{conv.unreadCount}</span>
          )}
        </div>
      ))}
    </div>
  );
};
```

#### 4. Notification Toast Component
```typescript
// components/NotificationToast.tsx
import React, { useState, useEffect } from 'react';

interface NotificationToastProps {
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
  };
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (notification.type) {
      case 'NEW_MESSAGE':
        return '💬';
      case 'MENTION':
        return '👤';
      case 'REACTION':
        return '👍';
      default:
        return '🔔';
    }
  };

  return (
    <div className={`notification-toast ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="notification-icon">{getIcon()}</div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
      </div>
      <button className="notification-close" onClick={() => setIsVisible(false)}>
        ×
      </button>
    </div>
  );
};
```

#### 5. CSS for Notification Components
```css
/* styles/notifications.css */
.channel-item, .dm-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.channel-item:hover, .dm-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.unread-badge {
  background-color: #ff4757;
  color: white;
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  margin-left: auto;
}

.notification-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 16px;
  max-width: 400px;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.notification-toast.visible {
  transform: translateX(0);
}

.notification-toast.hidden {
  transform: translateX(100%);
}

.notification-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.notification-message {
  color: #666;
  font-size: 14px;
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-close:hover {
  color: #333;
}
```

## Electron Integration

### Main Process
```typescript
// main.ts
import { app, BrowserWindow, Notification } from 'electron';

// Handle notification clicks
app.on('ready', () => {
  // Request notification permission
  if (Notification.isSupported()) {
    // Notification permission is automatically granted in Electron
  }
});

// Show desktop notification
export const showDesktopNotification = (notification: any) => {
  if (Notification.isSupported()) {
    const desktopNotification = new Notification({
      title: notification.title,
      body: notification.message,
      icon: '/path/to/icon.png', // Optional
      silent: false
    });

    desktopNotification.on('click', () => {
      // Focus the window and navigate to the relevant channel/conversation
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.send('notification-clicked', notification.data);
      }
    });

    desktopNotification.show();
  }
};
```

### Renderer Process
```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (notification: any) => ipcRenderer.invoke('show-notification', notification),
  onNotificationClick: (callback: (data: any) => void) => {
    ipcRenderer.on('notification-clicked', (_, data) => callback(data));
  }
});
```

## Best Practices

### 1. Performance Optimization
- **Debounce Updates**: Don't update unread counts on every message
- **Batch Operations**: Group multiple notification operations
- **Lazy Loading**: Load notifications only when needed
- **Caching**: Cache unread counts locally

### 2. User Experience
- **Visual Feedback**: Show unread badges clearly
- **Sound Notifications**: Respect user preferences
- **Desktop Notifications**: Use sparingly to avoid spam
- **Mention Highlighting**: Special styling for mentions

### 3. Error Handling
- **Graceful Degradation**: Work without notifications if service fails
- **Retry Logic**: Retry failed notification operations
- **Offline Support**: Queue notifications when offline

### 4. Security
- **Permission Checks**: Verify user can access channels/conversations
- **Data Validation**: Validate all notification data
- **Rate Limiting**: Prevent notification spam

## Migration Guide

### 1. Database Migration
```bash
# Run the migration
npx prisma migrate dev --name add_notification_system

# Generate Prisma client
npx prisma generate
```

### 2. Backend Integration
1. Add notification routes to your Express app
2. Update WebSocket handlers to include notification logic
3. Test all notification endpoints

### 3. Frontend Integration
1. Add NotificationProvider to your app
2. Update channel/conversation components to show unread counts
3. Add notification toast system
4. Test real-time updates

### 4. Testing
```bash
# Test notification endpoints
curl -X POST http://localhost:8000/api/notifications/mark-as-read \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"channelId": "test_channel"}'

# Test WebSocket events
# Connect to WebSocket and send test events
```

## Troubleshooting

### Common Issues

1. **Unread counts not updating**
   - Check WebSocket connection
   - Verify notification service is running
   - Check database permissions

2. **Notifications not showing**
   - Check browser notification permissions
   - Verify notification preferences
   - Check console for errors

3. **Performance issues**
   - Implement debouncing
   - Add pagination to notification lists
   - Optimize database queries

### Debug Commands
```bash
# Check notification tables
npx prisma studio

# Monitor WebSocket connections
# Check server logs for WebSocket events

# Test notification flow
# Send test message and verify notification creation
```

This notification system provides a comprehensive solution for tracking unread messages and managing user notifications in your chat application. The system is designed to be scalable, performant, and user-friendly. 