import express, { RequestHandler } from "express";
import { deleteUser } from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/Auth.middleware.js";

const router = express.Router();

// Note: Most auth routes (register, login, getUser, forgetPassword, etc.) 
// have been moved to jibbr-auth-microservice. Only deleteUser remains here 
// as it's an admin function specific to the backend.

// Admin Routes - Delete user (only for admins)
router.delete("/user/:id", authMiddleware as unknown as RequestHandler, deleteUser as unknown as RequestHandler);

export default router;
