import { ConnectionOptions, DefaultJobOptions } from "bullmq";

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  // Add retry strategy for better connection handling
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  // Suppress Redis warnings
  lazyConnect: true,
  // Add connection event handlers
  enableReadyCheck: true,
};

export const defaultQueueOptions: DefaultJobOptions = {
  removeOnComplete: {
    age: 60 * 60, // 1 hour
    count: 20,
  },
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 3000    
  },
  removeOnFail: false,
};

// Queue configuration options
export const queueOptions = {
  connection: redisConnection,
  defaultJobOptions: defaultQueueOptions,
  // Add queue-specific settings
  settings: {
    stalledInterval: 30000, // 30 seconds
    maxStalledCount: 1,
  }
};