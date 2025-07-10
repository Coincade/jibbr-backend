import express, { RequestHandler } from "express";
import { upload } from "../config/upload.js";
import authMiddleware from "../middleware/Auth.middleware.js";
import {
  sendMessage,
  sendMessageWithAttachments,
  getMessages,
  getMessage,
  updateMessage,
  deleteMessage,
  reactToMessage,
  removeReaction,
  forwardMessage,
  getForwardedMessages,
} from "../controllers/message.controller.js";

const router = express.Router();

// Send a message (text only)
router.post("/send", authMiddleware as unknown as RequestHandler, sendMessage as unknown as RequestHandler);

// Send a message with attachments
router.post("/send-with-attachments", 
  authMiddleware as unknown as RequestHandler, 
  upload.array("attachments", 5) as unknown as RequestHandler, 
  sendMessageWithAttachments as unknown as RequestHandler
);

// Get messages from a channel
router.get("/channel/:channelId", authMiddleware as unknown as RequestHandler, getMessages as unknown as RequestHandler);

// Get a specific message
router.get("/:messageId", authMiddleware as unknown as RequestHandler, getMessage as unknown as RequestHandler);

// Update a message
router.put("/:messageId", authMiddleware as unknown as RequestHandler, updateMessage as unknown as RequestHandler);

// Delete a message
router.delete("/:messageId", authMiddleware as unknown as RequestHandler, deleteMessage as unknown as RequestHandler);

// React to a message
router.post("/react", authMiddleware as unknown as RequestHandler, reactToMessage as unknown as RequestHandler);

// Remove reaction from a message
router.delete("/react", authMiddleware as unknown as RequestHandler, removeReaction as unknown as RequestHandler);

// Forward a message to another channel
router.post("/forward", authMiddleware as unknown as RequestHandler, forwardMessage as unknown as RequestHandler);

// Get forwarded messages in a channel
router.get("/forwarded/:channelId", authMiddleware as unknown as RequestHandler, getForwardedMessages as unknown as RequestHandler);

export default router;
