import express, { RequestHandler } from "express";
import { login, logout, register, getUser } from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/Auth.middleware.js";

const router = express.Router();

router.post("/register", register as unknown as RequestHandler);
router.post("/login", login as unknown as RequestHandler);
router.post("/logout", logout as unknown as RequestHandler);
router.get("/user", authMiddleware as unknown as RequestHandler, getUser as unknown as RequestHandler);

export default router;
