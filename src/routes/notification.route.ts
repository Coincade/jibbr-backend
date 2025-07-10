import express, { RequestHandler } from "express";
import authMiddleware from "../middleware/Auth.middleware.js";
import {
  markAsRead,
  getUnreadCounts,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../controllers/notification.controller.js";

const router = express.Router();

// Mark messages as read
router.post("/mark-as-read", authMiddleware as unknown as RequestHandler, markAsRead as unknown as RequestHandler);

// Get unread counts for channels and conversations
router.get("/unread-counts", authMiddleware as unknown as RequestHandler, getUnreadCounts as unknown as RequestHandler);

// Get user notifications
router.get("/notifications", authMiddleware as unknown as RequestHandler, getUserNotifications as unknown as RequestHandler);

// Mark specific notification as read
router.patch("/notifications/:notificationId/read", authMiddleware as unknown as RequestHandler, markNotificationAsRead as unknown as RequestHandler);

// Mark all notifications as read
router.patch("/notifications/mark-all-read", authMiddleware as unknown as RequestHandler, markAllNotificationsAsRead as unknown as RequestHandler);

// Get user notification preferences
router.get("/preferences", authMiddleware as unknown as RequestHandler, getNotificationPreferences as unknown as RequestHandler);

// Update user notification preferences
router.put("/preferences", authMiddleware as unknown as RequestHandler, updateNotificationPreferences as unknown as RequestHandler);

export default router; 