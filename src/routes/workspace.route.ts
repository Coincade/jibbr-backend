import express, { RequestHandler } from "express";
import { createWorkspace, getAllWorkspaces, getWorkspace, getAllWorkspacesForUser, getWorkspaceMembers, joinWorkspace, leaveWorkspace, updateWorkspace, deleteWorkspace } from "../controllers/workspace.controller.js";
import authMiddleware from "../middleware/Auth.middleware.js";
import roleMiddleware from "../middleware/Role.middleware.js";

const router = express.Router();

router.post("/create", authMiddleware as unknown as RequestHandler, createWorkspace as unknown as RequestHandler);
router.post("/join/:id", authMiddleware as unknown as RequestHandler, joinWorkspace as unknown as RequestHandler);
router.post("/leave/:id", authMiddleware as unknown as RequestHandler, leaveWorkspace as unknown as RequestHandler);

router.get("/all", authMiddleware as unknown as RequestHandler, getAllWorkspaces as unknown as RequestHandler);
router.get("/get-workspaces-for-user", authMiddleware as unknown as RequestHandler, getAllWorkspacesForUser as unknown as RequestHandler);
router.get("/get-workspace-members/:id", authMiddleware as unknown as RequestHandler, getWorkspaceMembers as unknown as RequestHandler);
router.get("/:id", authMiddleware as unknown as RequestHandler, getWorkspace as unknown as RequestHandler);

router.put("/:id", 
    authMiddleware as unknown as RequestHandler, 
    roleMiddleware(["ADMIN", "MODERATOR"]) as unknown as RequestHandler, 
    updateWorkspace as unknown as RequestHandler
);

router.delete("/:id", 
    authMiddleware as unknown as RequestHandler, 
    roleMiddleware(["ADMIN"]) as unknown as RequestHandler, 
    deleteWorkspace as unknown as RequestHandler
);

export default router;