import { createClient } from 'redis';

// Build Redis URL from environment variables
const buildRedisUrl = (): string => {
  // Support both REDIS_URL format and separate host/port/password
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;

  // Build URL with or without password
  if (password) {
    return `redis://:${password}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
};

const redisUrl = buildRedisUrl();

// Create Redis clients for Socket.IO adapter (Pub/Sub)
export const createRedisClients = async () => {
  console.log('🔄 Connecting to Redis:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Hide password in logs

  const pubClient = createClient({ 
    url: redisUrl,
    socket: {
      connectTimeout: 10000,    // 10 second connection timeout
      reconnectStrategy: (retries: number) => {
        if (retries > 5) {
          console.error('❌ Redis connection failed after 5 retries');
          return new Error('Max retries reached');
        }
        const delay = Math.min(retries * 1000, 5000); // Max 5 second delay
        console.log(`⏳ Retrying Redis connection (attempt ${retries}) in ${delay}ms`);
        return delay;
      }
    }
  });

  const subClient = pubClient.duplicate();

  pubClient.on('error', (err: Error) => {
    console.error('❌ Redis Pub Error:', err.message);
    if (err.message.includes('ECONNRESET')) {
      console.log('🔄 Redis connection reset, will retry...');
    }
  });
  
  subClient.on('error', (err: Error) => {
    console.error('❌ Redis Sub Error:', err.message);
    if (err.message.includes('ECONNRESET')) {
      console.log('🔄 Redis connection reset, will retry...');
    }
  });
  
  pubClient.on('ready', () => console.log('✅ Redis Publisher ready'));
  subClient.on('ready', () => console.log('✅ Redis Subscriber ready'));
  
  pubClient.on('connect', () => console.log('🔗 Redis Publisher connecting...'));
  subClient.on('connect', () => console.log('🔗 Redis Subscriber connecting...'));

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.log('✅ Redis clients connected - WebSocket scaling enabled!');
    return { pubClient, subClient };
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
};

// State client for online users, caching, etc.
export const createStateRedisClient = async () => {
  const client = createClient({ 
    url: redisUrl,
    socket: {
      connectTimeout: 10000,
      reconnectStrategy: (retries: number) => {
        if (retries > 5) return new Error('Max retries reached');
        return Math.min(retries * 1000, 5000);
      }
    }
  });
  
  client.on('error', (err: Error) => {
    console.error('❌ Redis State Error:', err.message);
  });
  
  client.on('ready', () => console.log('✅ Redis State client ready'));
  client.on('connect', () => console.log('🔗 Redis State client connecting...'));
  
  try {
    await client.connect();
    console.log('✅ Redis State client connected');
    return client;
  } catch (error) {
    console.error('❌ Failed to connect Redis State client:', error);
    throw error;
  }
};

