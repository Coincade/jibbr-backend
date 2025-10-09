import express, { RequestHandler } from "express";
import { createWorkspace, getAllWorkspaces, getWorkspace, getAllWorkspacesForUser, getWorkspaceMembers, joinWorkspace, leaveWorkspace, updateWorkspace, softDeleteWorkspace, hardDeleteWorkspace, getPublicChannels, updateMemberRole } from "../controllers/workspace.controller.js";
import authMiddleware from "../middleware/Auth.middleware.js";
import roleMiddleware from "../middleware/Role.middleware.js";

const router = express.Router();

router.post("/create", authMiddleware as unknown as RequestHandler, createWorkspace as unknown as RequestHandler);
router.post("/join/:id", authMiddleware as unknown as RequestHandler, joinWorkspace as unknown as RequestHandler);
router.post("/leave/:id", authMiddleware as unknown as RequestHandler, leaveWorkspace as unknown as RequestHandler);

router.get("/all", authMiddleware as unknown as RequestHandler, getAllWorkspaces as unknown as RequestHandler);
router.get("/get-workspaces-for-user", authMiddleware as unknown as RequestHandler, getAllWorkspacesForUser as unknown as RequestHandler);
router.get("/get-workspace-members/:id", authMiddleware as unknown as RequestHandler, getWorkspaceMembers as unknown as RequestHandler);
router.get("/get-public-channels/:id", authMiddleware as unknown as RequestHandler, getPublicChannels as unknown as RequestHandler);
router.get("/:id", authMiddleware as unknown as RequestHandler, getWorkspace as unknown as RequestHandler);

// Update member role (admin only)
router.put("/:id/members/:memberId/role", 
    authMiddleware as unknown as RequestHandler, 
    roleMiddleware(["ADMIN"]) as unknown as RequestHandler, 
    updateMemberRole as unknown as RequestHandler
);

router.put("/:id", 
    authMiddleware as unknown as RequestHandler, 
    roleMiddleware(["ADMIN"]) as unknown as RequestHandler, 
    updateWorkspace as unknown as RequestHandler
);

// Soft delete a workspace (preserves all data)
router.delete("/:id/soft", 
    authMiddleware as unknown as RequestHandler, 
    roleMiddleware(["ADMIN"]) as unknown as RequestHandler, 
    softDeleteWorkspace as unknown as RequestHandler
);

// Hard delete a workspace (permanently removes everything - requires DELETE_PASS)
router.delete("/:id/hard", 
    authMiddleware as unknown as RequestHandler, 
    hardDeleteWorkspace as unknown as RequestHandler
);

export default router;