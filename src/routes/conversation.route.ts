import express, { RequestHandler } from "express";
import { upload } from "../config/upload.js";
import authMiddleware from "../middleware/Auth.middleware.js";
import {
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  sendDirectMessage,
  sendDirectMessageWithAttachments,
  deleteDirectMessage,
} from "../controllers/conversation.controller.js";

const router = express.Router();

// Get or create conversation between two users
router.get("/with/:targetUserId", authMiddleware as unknown as RequestHandler, getOrCreateConversation as unknown as RequestHandler);

// Get user's conversations
router.get("/", authMiddleware as unknown as RequestHandler, getUserConversations as unknown as RequestHandler);

// Get conversation messages
router.get("/:conversationId/messages", authMiddleware as unknown as RequestHandler, getConversationMessages as unknown as RequestHandler);

// Send direct message (text only)
router.post("/:conversationId/messages", authMiddleware as unknown as RequestHandler, sendDirectMessage as unknown as RequestHandler);

// Send direct message with attachments
router.post("/:conversationId/messages/with-attachments", 
  authMiddleware as unknown as RequestHandler, 
  upload.array('attachments', 5) as unknown as RequestHandler,
  sendDirectMessageWithAttachments as unknown as RequestHandler
);

// Delete direct message (Soft Delete)
router.delete("/:conversationId/messages/:messageId", authMiddleware as unknown as RequestHandler, deleteDirectMessage as unknown as RequestHandler);

export default router; 