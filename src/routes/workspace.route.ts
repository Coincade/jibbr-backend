import express, { RequestHandler } from "express";
import { createWorkspace, getAllWorkspaces, getWorkspace,getAllWorkspacesForUser } from "../controllers/workspace.controller.js"
import authMiddleware from "../middleware/Auth.middleware.js";

const router = express.Router();

router.post("/create",authMiddleware as unknown as RequestHandler, createWorkspace as unknown as RequestHandler);

router.get("/all",authMiddleware as unknown as RequestHandler, getAllWorkspaces as unknown as RequestHandler);
router.get("/get-workspaces-for-user",authMiddleware as unknown as RequestHandler, getAllWorkspacesForUser as unknown as RequestHandler);
router.get("/:id",authMiddleware as unknown as RequestHandler, getWorkspace as unknown as RequestHandler);



export default router;