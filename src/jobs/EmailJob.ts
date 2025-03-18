import { Queue, Worker, Job } from "bullmq";
import { defaultQueueOptions, redisConnection } from "../config/queue.js";
import { sendEmail, mailHelper } from "../config/mail.js";

export const emailQueueName = "emailQueue";

interface EmailJobDataType{
    to: string;
    subject: string;
    body: string;
}

// * Queue
export const emailQueue = new Queue(emailQueueName, {
  connection: redisConnection,
  defaultJobOptions: defaultQueueOptions,
});

// * Worker
export const emailWorker = new Worker(
  emailQueueName,
  async (job: Job) => {
    const data: EmailJobDataType = job.data;
    await mailHelper(data.to, data.subject, data.body);
  },
  {
    connection: redisConnection,
  }
);
