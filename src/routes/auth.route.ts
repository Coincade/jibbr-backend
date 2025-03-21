import express, { RequestHandler } from "express";
import { login, logout, register, getUser, forgetPassword, resetPassword } from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/Auth.middleware.js";
import { authLimiter } from "../config/rateLimit.js";

const router = express.Router();

router.post("/register", authLimiter, register as unknown as RequestHandler);
router.post("/login", authLimiter, login as unknown as RequestHandler);
// router.post("/logout", authLimiter, logout as unknown as RequestHandler);

//Password Routes
router.post("/forget-password", authLimiter, forgetPassword as unknown as RequestHandler);
router.post("/reset-password", resetPassword as unknown as RequestHandler);

//Private User Routes
router.get("/user", authMiddleware as unknown as RequestHandler, getUser as unknown as RequestHandler);



export default router;
