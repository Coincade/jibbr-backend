import { Request, Response } from "express";
import { formatError } from "../helper.js";
import prisma from "../config/database.js";
import { ZodError } from "zod";
import { z } from "zod";

// Validation schemas
const markAsReadSchema = z.object({
  channelId: z.string().optional(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
});

const getUnreadCountsSchema = z.object({
  workspaceId: z.string().optional(),
});

const updateNotificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  desktopNotifications: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  mentionNotifications: z.boolean().optional(),
});

// Mark messages as read for a channel or conversation
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = markAsReadSchema.parse(body);

    if (payload.channelId) {
      // Mark channel messages as read
      const channelMember = await prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: payload.channelId,
            userId: user.id,
          },
        },
      });

      if (!channelMember) {
        return res.status(403).json({ message: "You are not a member of this channel" });
      }

      // Update last read time and reset unread count
      await prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId: payload.channelId,
            userId: user.id,
          },
        },
        data: {
          lastReadAt: new Date(),
          unreadCount: 0,
        },
      });
    } else if (payload.conversationId) {
      // Mark conversation messages as read
      const participant = await prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: payload.conversationId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        return res.status(403).json({ message: "You are not a participant of this conversation" });
      }

      // Update or create read status
      await prisma.conversationReadStatus.upsert({
        where: {
          conversationId_userId: {
            conversationId: payload.conversationId,
            userId: user.id,
          },
        },
        update: {
          lastReadAt: new Date(),
          unreadCount: 0,
        },
        create: {
          conversationId: payload.conversationId,
          userId: user.id,
          lastReadAt: new Date(),
          unreadCount: 0,
        },
      });
    }

    return res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    console.error("Error in markAsRead:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get unread counts for channels and conversations
export const getUnreadCounts = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const query = req.query;
    const payload = getUnreadCountsSchema.parse(query);

    // Get channel unread counts
    const channelUnreadCounts = await prisma.channelMember.findMany({
      where: {
        userId: user.id,
        isActive: true,
        channel: {
          workspace: payload.workspaceId ? {
            id: payload.workspaceId
          } : undefined,
        },
      },
      select: {
        channelId: true,
        unreadCount: true,
        lastReadAt: true,
        channel: {
          select: {
            name: true,
            workspaceId: true,
          },
        },
      },
    });

    // Get conversation unread counts
    const conversationUnreadCounts = await prisma.conversationReadStatus.findMany({
      where: {
        userId: user.id,
        conversation: {
          participants: {
            some: {
              userId: user.id,
              isActive: true,
            },
          },
        },
      },
      select: {
        conversationId: true,
        unreadCount: true,
        lastReadAt: true,
        conversation: {
          select: {
            participants: {
              where: {
                userId: { not: user.id },
                isActive: true,
              },
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate total unread count
    const totalUnread = channelUnreadCounts.reduce((sum, item) => sum + item.unreadCount, 0) +
                       conversationUnreadCounts.reduce((sum, item) => sum + item.unreadCount, 0);

    return res.status(200).json({
      message: "Unread counts fetched successfully",
      data: {
        totalUnread,
        channels: channelUnreadCounts.map(item => ({
          channelId: item.channelId,
          channelName: item.channel.name,
          workspaceId: item.channel.workspaceId,
          unreadCount: item.unreadCount,
          lastReadAt: item.lastReadAt,
        })),
        conversations: conversationUnreadCounts.map(item => ({
          conversationId: item.conversationId,
          participant: item.conversation.participants[0]?.user,
          unreadCount: item.unreadCount,
          lastReadAt: item.lastReadAt,
        })),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    console.error("Error in getUnreadCounts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get user notifications
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      userId: user.id,
      ...(unreadOnly === 'true' && { isRead: false }),
    };

    const notifications = await prisma.userNotification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: Number(limit),
    });

    const total = await prisma.userNotification.count({ where });

    return res.status(200).json({
      message: "Notifications fetched successfully",
      data: {
        notifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error in getUserNotifications:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const { notificationId } = req.params;

    const notification = await prisma.userNotification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await prisma.userNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error in markNotificationAsRead:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    await prisma.userNotification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error in markAllNotificationsAsRead:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get user notification preferences
export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    let preferences = await prisma.userNotificationPreference.findUnique({
      where: { userId: user.id },
    });

    if (!preferences) {
      // Create default preferences
      preferences = await prisma.userNotificationPreference.create({
        data: {
          userId: user.id,
        },
      });
    }

    return res.status(200).json({
      message: "Notification preferences fetched successfully",
      data: preferences,
    });
  } catch (error) {
    console.error("Error in getNotificationPreferences:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Update user notification preferences
export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = updateNotificationPreferencesSchema.parse(body);

    const preferences = await prisma.userNotificationPreference.upsert({
      where: { userId: user.id },
      update: payload,
      create: {
        userId: user.id,
        ...payload,
      },
    });

    return res.status(200).json({
      message: "Notification preferences updated successfully",
      data: preferences,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    console.error("Error in updateNotificationPreferences:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}; 