import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import path from 'path';

// Setup env first, before other imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = path.join(__dirname, '../.env');

console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

// Debug log
console.log('Environment variables after loading:', {
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD_EXISTS: !!process.env.SMTP_PASSWORD
});

// Validate env
if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be defined in .env');
}

// Rest of your imports
import express, { Application, Request, Response } from "express";
import cors from "cors";
import ejs from "ejs";
import { sendEmail } from "./config/mail.js";

const app: Application = express();

const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//Set view engine
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, './views'));

app.get("/", async(req: Request, res: Response) => {
  try {
    const html = await ejs.renderFile(__dirname + `/views/emails/welcome.ejs`, {
      name: "Yash KVR"
    });
    // await sendEmail("yash@coincade.io", "Test Email", html);

    await emailQueue.add(emailQueueName, {to: "yash@coincade.io", subject: "Test Queue Email", body: html})

    res.json({
      msg: "Email sent successfully"
    });
  } catch (error) {
    console.error('Error in route handler:', error);
    res.status(500).json({
      error: "Failed to send email",
      details: error.message
    });
  }
});

// * Queue
import "./jobs/index.js";
import { emailQueue, emailQueueName } from './jobs/EmailJob.js';

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
