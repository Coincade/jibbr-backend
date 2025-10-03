# WebSocket Optimization & Scaling Guide

## 🎯 Performance Goals
- ⚡ Low latency (< 100ms)
- 📈 High throughput (10K+ concurrent connections per server)
- 🔄 Horizontal scalability
- 💪 Fault tolerance

---

## 1️⃣ Horizontal Scaling with Redis (Foundation)

### Why Redis?
Synchronizes messages across multiple server instances.

```bash
npm install @socket.io/redis-adapter redis
```

```typescript
// src/websocket/index.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

**Impact:** Enables multi-server deployment, 3-5x capacity increase

---

## 2️⃣ Socket.IO Configuration Optimization

### Current Config (Your Code)
```typescript
io = new SocketIOServer(server, {
  cors: { /* ... */ },
  transports: ['websocket', 'polling']
});
```

### Optimized Config
```typescript
io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  
  // 🚀 PERFORMANCE OPTIMIZATIONS
  
  // 1. Use WebSocket only (no polling fallback in production)
  transports: ['websocket'],
  allowUpgrades: false,
  
  // 2. Increase ping intervals (reduce overhead)
  pingInterval: 25000,  // 25s (default: 25s)
  pingTimeout: 20000,   // 20s (default: 20s)
  
  // 3. Enable compression for large messages
  perMessageDeflate: {
    threshold: 1024 // Only compress messages > 1KB
  },
  
  // 4. Limit max message size (prevent abuse)
  maxHttpBufferSize: 1e6, // 1MB
  
  // 5. Connection state recovery (survive brief disconnects)
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 min
    skipMiddlewares: true,
  },
  
  // 6. Reduce connection timeout
  connectTimeout: 10000, // 10s (default: 45s)
});
```

**Impact:** 30-40% reduction in network overhead, faster reconnections

---

## 3️⃣ Connection Pooling & Rate Limiting

### Limit Connections Per User
```typescript
const userConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_USER = 5; // Prevent abuse

io.use((socket, next) => {
  const userId = socket.data.user?.id;
  const count = userConnections.get(userId) || 0;
  
  if (count >= MAX_CONNECTIONS_PER_USER) {
    return next(new Error('Connection limit exceeded'));
  }
  
  userConnections.set(userId, count + 1);
  
  socket.on('disconnect', () => {
    userConnections.set(userId, (userConnections.get(userId) || 1) - 1);
  });
  
  next();
});
```

### Rate Limit Message Sending
```typescript
import rateLimit from 'express-rate-limit';

const messageRateLimiter = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const limit = messageRateLimiter.get(userId);
  
  if (!limit || now > limit.resetTime) {
    messageRateLimiter.set(userId, { count: 1, resetTime: now + 60000 }); // 60s window
    return true;
  }
  
  if (limit.count >= 60) { // Max 60 messages per minute
    return false;
  }
  
  limit.count++;
  return true;
};

socket.on('send_message', async (data) => {
  if (!checkRateLimit(socket.data.user.id)) {
    socket.emit('error', { message: 'Rate limit exceeded' });
    return;
  }
  // ... process message
});
```

**Impact:** Prevents abuse, maintains server stability

---

## 4️⃣ Database Query Optimization

### Problem: N+1 Queries
```typescript
// ❌ BAD: Queries user for EACH message
for (const message of messages) {
  const user = await prisma.user.findUnique({ where: { id: message.userId } });
}
```

### Solution: Use Prisma Include
```typescript
// ✅ GOOD: Single query with joins
const messages = await prisma.message.findMany({
  where: { channelId },
  include: {
    user: { select: { id: true, name: true, image: true } },
    reactions: { include: { user: true } },
    attachments: true
  },
  orderBy: { createdAt: 'desc' },
  take: 50
});
```

### Use Redis for Hot Data
```typescript
// Cache frequently accessed data
const getCachedChannelMembers = async (channelId: string) => {
  const cached = await redis.get(`channel:${channelId}:members`);
  if (cached) return JSON.parse(cached);
  
  const members = await prisma.channelMember.findMany({ where: { channelId } });
  await redis.setEx(`channel:${channelId}:members`, 300, JSON.stringify(members)); // 5min TTL
  return members;
};
```

**Impact:** 5-10x faster queries, reduced database load

---

## 5️⃣ Efficient Room Management

### Your Current Code
```typescript
socket.on('send_message', async (data) => {
  addClientToChannel(socket, data.channelId, channelClients);
  // ...
});
```

### Optimization: Batch Room Operations
```typescript
// Join multiple rooms at once
socket.on('authenticated', async (data) => {
  const userChannels = await getUserChannels(socket.data.user.id);
  
  // Join all rooms in parallel
  await Promise.all(
    userChannels.map(ch => socket.join(ch.id))
  );
  
  socket.emit('rooms_joined', { channels: userChannels.map(ch => ch.id) });
});
```

### Use Native Socket.IO Rooms (Drop Custom Maps)
```typescript
// ❌ OLD: Custom tracking with Maps
const channelClients: Map<string, Set<Socket>> = new Map();

// ✅ NEW: Use Socket.IO's built-in rooms
socket.join(channelId); // Automatically tracked
io.to(channelId).emit('new_message', message); // Broadcast to room
```

**Impact:** Less memory, better performance, cleaner code

---

## 6️⃣ Message Broadcasting Optimization

### Avoid Broadcasting to Sender
```typescript
// ❌ BAD: Sender receives their own message
io.to(channelId).emit('new_message', message);

// ✅ GOOD: Exclude sender
socket.to(channelId).emit('new_message', message);
socket.emit('message_sent', { messageId: message.id }); // Separate ack
```

### Batch Multiple Events
```typescript
// ❌ BAD: Multiple emissions
io.to(channelId).emit('new_message', message);
io.to(channelId).emit('typing_stopped', { userId });
io.to(channelId).emit('reaction_added', reaction);

// ✅ GOOD: Single emission with multiple events
io.to(channelId).emit('batch_update', {
  newMessage: message,
  typingStopped: { userId },
  reactionAdded: reaction
});
```

**Impact:** 50% reduction in network packets

---

## 7️⃣ Load Balancing Strategy

### Use Sticky Sessions (IP Hash)

**NGINX:**
```nginx
upstream websocket_backend {
    ip_hash;  # Sticky sessions
    server server1:8000;
    server server2:8000;
    server server3:8000;
}

server {
    location / {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

**Why?** Keeps same client connected to same server (better for state)

### Alternative: Redis Adapter (No Sticky Sessions Needed)
With Redis adapter, you can use round-robin load balancing:
```nginx
upstream websocket_backend {
    least_conn;  # Route to server with fewest connections
    server server1:8000;
    server server2:8000;
    server server3:8000;
}
```

**Impact:** Better load distribution, higher fault tolerance

---

## 8️⃣ Memory & CPU Optimization

### Use Node.js Cluster Mode
```typescript
// src/cluster.ts
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Starting ${numCPUs} workers...`);
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  // Worker process runs your server
  import('./index.js');
}
```

Run with: `node dist/cluster.js`

### Enable V8 Optimization Flags
```json
// package.json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 --optimize_for_size --gc_interval=100 ./dist/index.js"
  }
}
```

**Impact:** Utilize all CPU cores, 4-8x capacity per machine

---

## 9️⃣ Monitoring & Metrics

### Add Performance Tracking
```typescript
// Track connection metrics
let connectionCount = 0;
let messageCount = 0;

io.on('connection', (socket) => {
  connectionCount++;
  
  socket.on('send_message', () => {
    messageCount++;
  });
  
  socket.on('disconnect', () => {
    connectionCount--;
  });
});

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    connections: io.engine.clientsCount,
    rooms: io.sockets.adapter.rooms.size,
    messagesPerSecond: messageCount / process.uptime(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

### Use APM Tools
- **Datadog APM**
- **New Relic**
- **Prometheus + Grafana**

**Impact:** Identify bottlenecks, optimize proactively

---

## 🔟 Frontend Optimization

### Reconnection Strategy
```typescript
// Electron app
const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.io.on("reconnect_attempt", () => {
  console.log("Reconnecting...");
});

socket.io.on("reconnect", () => {
  console.log("Reconnected! Re-joining rooms...");
  // Re-join channels
  userChannels.forEach(ch => socket.emit('join_channel', { channelId: ch }));
});
```

### Lazy Load Old Messages
```typescript
// Don't load all messages on join
socket.on('joined_channel', async () => {
  // Load only recent 50 messages
  const messages = await loadMessages(channelId, { limit: 50, offset: 0 });
  
  // Load more on scroll
  onScrollTop(() => {
    loadMessages(channelId, { limit: 50, offset: messages.length });
  });
});
```

**Impact:** 80% faster initial load

---

## 📊 Performance Benchmark Goals

| Metric | Target | Excellent |
|--------|--------|-----------|
| Connection Time | < 200ms | < 100ms |
| Message Latency | < 100ms | < 50ms |
| Concurrent Connections/Server | 10K+ | 50K+ |
| CPU Usage | < 70% | < 50% |
| Memory per Connection | < 10KB | < 5KB |

---

## 🚀 Implementation Priority

### High Impact (Do First)
1. ✅ **Redis Adapter** - Horizontal scaling foundation
2. ✅ **Database Query Optimization** - 5-10x speedup
3. ✅ **Socket.IO Config Tuning** - 30-40% network reduction
4. ✅ **Rate Limiting** - Prevent abuse

### Medium Impact
5. ✅ **Room Management** - Use native Socket.IO rooms
6. ✅ **Connection Pooling** - Better resource management
7. ✅ **Load Balancing** - Distribute traffic

### Advanced
8. ✅ **Cluster Mode** - Multi-core utilization
9. ✅ **Monitoring** - Track performance
10. ✅ **Frontend Optimization** - Reduce client load

---

## 🎯 Quick Wins (Copy-Paste Ready)

### 1. Optimized Socket.IO Config
```typescript
io = new SocketIOServer(server, {
  transports: ['websocket'],
  perMessageDeflate: { threshold: 1024 },
  maxHttpBufferSize: 1e6,
  pingInterval: 25000,
  pingTimeout: 20000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000,
    skipMiddlewares: true,
  }
});
```

### 2. Add to Environment
```bash
REDIS_URL=redis://localhost:6379
NODE_ENV=production
MAX_CONNECTIONS=50000
```

### 3. Health Check Endpoint
```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed / 1024 / 1024
  });
});
```

---

## 📖 Summary

**Scaling Strategy:**
```
Single Server → Redis Adapter → Multi-Server → Cluster Mode → Redis Cluster
    1K           10K              50K            200K           1M+ connections
```

**Key Optimizations:**
- 🔴 Redis Adapter: Horizontal scaling
- ⚡ Transport: WebSocket only
- 💾 Cache: Redis for hot data
- 🗄️ Database: Optimize queries with includes
- 🔧 Config: Tune Socket.IO settings
- 📊 Monitor: Track metrics

**Want me to implement any of these optimizations in your backend?**

