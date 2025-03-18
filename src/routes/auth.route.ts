import express, { RequestHandler } from "express";
import { login, logout, register } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register as unknown as RequestHandler);
router.post("/login", login as unknown as RequestHandler);
router.post("/logout", logout as unknown as RequestHandler);

export default router;
