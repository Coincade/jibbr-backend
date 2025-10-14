import { Redis } from 'ioredis';

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
  console.log('🔄 Connecting to Valkey:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Hide password in logs

  const pubClient = new Redis(redisUrl, {
    connectTimeout: 10000,    // 10 second connection timeout
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });

  const subClient = new Redis(redisUrl, {
    connectTimeout: 10000,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });

  pubClient.on('error', (err: Error) => {
    console.error('❌ Valkey Pub Error:', err.message);
    if (err.message.includes('ECONNRESET')) {
      console.log('🔄 Valkey connection reset, will retry...');
    }
  });
  
  subClient.on('error', (err: Error) => {
    console.error('❌ Valkey Sub Error:', err.message);
    if (err.message.includes('ECONNRESET')) {
      console.log('🔄 Valkey connection reset, will retry...');
    }
  });
  
  pubClient.on('ready', () => console.log('✅ Valkey Publisher ready'));
  subClient.on('ready', () => console.log('✅ Valkey Subscriber ready'));
  
  pubClient.on('connect', () => console.log('🔗 Valkey Publisher connecting...'));
  subClient.on('connect', () => console.log('🔗 Valkey Subscriber connecting...'));

  try {
    // ioredis connects automatically, no need for manual connect()
    console.log('✅ Valkey clients initialized - WebSocket scaling enabled!');
    return { pubClient, subClient };
  } catch (error) {
    console.error('❌ Failed to initialize Valkey clients:', error);
    throw error;
  }
};

// State client for online users, caching, etc.
export const createStateRedisClient = async () => {
  const client = new Redis(redisUrl, {
    connectTimeout: 10000,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });
  
  client.on('error', (err: Error) => {
    console.error('❌ Valkey State Error:', err.message);
  });
  
  client.on('ready', () => console.log('✅ Valkey State client ready'));
  client.on('connect', () => console.log('🔗 Valkey State client connecting...'));
  
  try {
    // ioredis connects automatically
    console.log('✅ Valkey State client initialized');
    return client;
  } catch (error) {
    console.error('❌ Failed to initialize Valkey State client:', error);
    throw error;
  }
};

