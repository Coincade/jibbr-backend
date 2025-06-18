import express, { RequestHandler } from "express";
import { createChannel, getWorkspaceChannels, getChannel, joinChannel } from "../controllers/channel.controller.js";
import authMiddleware from "../middleware/Auth.middleware.js";

const router = express.Router();

// Create a new channel
router.post("/create", authMiddleware as unknown as RequestHandler, createChannel as unknown as RequestHandler);

// Join a channel
router.post("/join", authMiddleware as unknown as RequestHandler, joinChannel as unknown as RequestHandler);

// Get all channels in a workspace
router.get("/workspace/:workspaceId", authMiddleware as unknown as RequestHandler, getWorkspaceChannels as unknown as RequestHandler);

// Get a specific channel
router.get("/:id", authMiddleware as unknown as RequestHandler, getChannel as unknown as RequestHandler);

export default router;