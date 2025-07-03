import { ConnectionOptions, DefaultJobOptions } from "bullmq";

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

export const defaultQueueOptions: DefaultJobOptions = {
  removeOnComplete: {
      age: 60 * 60, // 1hour
    count: 20,
  },
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 3000    
  },
  removeOnFail: false,
};