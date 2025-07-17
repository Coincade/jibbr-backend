import express, { RequestHandler } from "express";
import { createChannel, getWorkspaceChannels, getChannel, joinChannel, addMemberToChannel, updateChannel, softDeleteChannel, hardDeleteChannel } from "../controllers/channel.controller.js";
import authMiddleware from "../middleware/Auth.middleware.js";

const router = express.Router();

// Create a new channel
router.post("/create", authMiddleware as unknown as RequestHandler, createChannel as unknown as RequestHandler);

// Join a channel
router.post("/join", authMiddleware as unknown as RequestHandler, joinChannel as unknown as RequestHandler);

// Add member to private channel
router.post("/add-member", authMiddleware as unknown as RequestHandler, addMemberToChannel as unknown as RequestHandler);

// Get all channels in a workspace
router.get("/workspace/:workspaceId", authMiddleware as unknown as RequestHandler, getWorkspaceChannels as unknown as RequestHandler);

// Update a channel
router.put("/:id", authMiddleware as unknown as RequestHandler, updateChannel as unknown as RequestHandler);

// Soft delete a channel (preserves messages and reactions)
router.delete("/:id/soft", authMiddleware as unknown as RequestHandler, softDeleteChannel as unknown as RequestHandler);

// Hard delete a channel (permanently removes everything - for development/testing only)
router.delete("/:id/hard", authMiddleware as unknown as RequestHandler, hardDeleteChannel as unknown as RequestHandler);

// Get a specific channel (this should be last to avoid catching other routes)
router.get("/:id", authMiddleware as unknown as RequestHandler, getChannel as unknown as RequestHandler);

export default router;