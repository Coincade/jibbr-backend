import { formatError, isFileAttachmentsEnabledForChannel } from "../helper.js";
import { Request, Response } from "express";
import prisma from "../config/database.js";
import { uploadToSpaces, deleteFromSpaces } from "../config/upload.js";
import {
  sendMessageSchema,
  reactToMessageSchema,
  forwardMessageSchema,
  getMessagesSchema,
  getMessageSchema,
  deleteMessageSchema,
  updateMessageSchema,
  removeReactionSchema,
} from "../validation/message.validations.js";
import { ZodError } from "zod";

// Send a message (with optional attachments and reply)
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = sendMessageSchema.parse(body);

    // Check if user is member of the channel
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId: payload.channelId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!channelMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    // If replying, check if the original message exists
    if (payload.replyToId) {
      const originalMessage = await prisma.message.findUnique({
        where: { id: payload.replyToId },
      });
      if (!originalMessage) {
        return res.status(404).json({ message: "Original message not found" });
      }
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: payload.content,
        channelId: payload.channelId,
        userId: user.id,
        replyToId: payload.replyToId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Send a message with attachments
export const sendMessageWithAttachments = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = sendMessageSchema.parse(body);

    // Check if user is member of the channel
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId: payload.channelId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!channelMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    // Check if file attachments are enabled for this workspace
    const attachmentsEnabled = await isFileAttachmentsEnabledForChannel(payload.channelId);
    if (!attachmentsEnabled) {
      return res.status(403).json({ 
        message: "File attachments are disabled for this workspace" 
      });
    }

    // If replying, check if the original message exists
    if (payload.replyToId) {
      const originalMessage = await prisma.message.findUnique({
        where: { id: payload.replyToId },
      });
      if (!originalMessage) {
        return res.status(404).json({ message: "Original message not found" });
      }
    }

    // Upload attachments if any
    const attachments = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const fileUrl = await uploadToSpaces(file);
        attachments.push({
          filename: file.filename || file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: fileUrl,
        });
      }
    }

    // Create the message with attachments
    const message = await prisma.message.create({
      data: {
        content: payload.content,
        channelId: payload.channelId,
        userId: user.id,
        replyToId: payload.replyToId,
        attachments: {
          create: attachments,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get messages from a channel
export const getMessages = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const query = req.query;
    const payload = getMessagesSchema.parse(query);

    // Check if user is member of the channel
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId: payload.channelId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!channelMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    const skip = (payload.page - 1) * payload.limit;

    const messages = await prisma.message.findMany({
      where: {
        channelId: payload.channelId,
        deletedAt: null, // Exclude soft-deleted messages
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: payload.limit,
    });

    const total = await prisma.message.count({
      where: {
        channelId: payload.channelId,
        deletedAt: null, // Exclude soft-deleted messages
      },
    });

    return res.status(200).json({
      message: "Messages fetched successfully",
      data: {
        messages,
        pagination: {
          page: payload.page,
          limit: payload.limit,
          total,
          pages: Math.ceil(total / payload.limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get a specific message
export const getMessage = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const params = req.params;
    const payload = getMessageSchema.parse(params);

    const message = await prisma.message.findUnique({
      where: { id: payload.messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is member of the channel
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId: message.channelId!,
        userId: user.id,
        isActive: true,
      },
    });

    if (!channelMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    return res.status(200).json({
      message: "Message fetched successfully",
      data: message,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Update a message
export const updateMessage = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = updateMessageSchema.parse(body);

    const message = await prisma.message.findUnique({
      where: { id: payload.messageId },
      include: {
        channel: true,
      },
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is the message author
    if (message.userId !== user.id) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }

    // Check if user is still a member of the channel
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId: message.channelId!,
        userId: user.id,
        isActive: true,
      },
    });

    if (!channelMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: payload.messageId },
      data: {
        content: payload.content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      message: "Message updated successfully",
      data: updatedMessage,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a message
export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const params = req.params;
    const payload = deleteMessageSchema.parse(params);

    const message = await prisma.message.findUnique({
      where: { id: payload.messageId },
      include: {
        channel: true,
        attachments: true,
      },
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if message is already deleted
    if (message.deletedAt) {
      return res.status(400).json({ message: "Message is already deleted" });
    }

    // Check if user is the message author or channel admin
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId: message.channelId!,
        userId: user.id,
        isActive: true,
      },
    });

    if (!channelMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    // Only message author or workspace admin can delete
    const workspaceMember = await prisma.member.findFirst({
      where: {
        workspaceId: message.channel?.workspaceId!,
        userId: user.id,
        isActive: true,
      },
    });

    if (message.userId !== user.id && workspaceMember?.role !== "ADMIN") {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    // Soft delete the message
    await prisma.message.update({
      where: { id: payload.messageId },
      data: { 
        deletedAt: new Date(),
        content: '[This message was deleted]' // Optional: replace content
      },
    });

    return res.status(200).json({
      message: "Message deleted successfully",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// React to a message
export const reactToMessage = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = reactToMessageSchema.parse(body);

    const message = await prisma.message.findUnique({
      where: { id: payload.messageId },
      include: {
        channel: true,
      },
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is member of the channel
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId: message.channelId!,
        userId: user.id,
        isActive: true,
      },
    });

    if (!channelMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    // Check if reaction already exists
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: payload.messageId,
          userId: user.id,
          emoji: payload.emoji,
        },
      },
    });

    if (existingReaction) {
      return res.status(400).json({ message: "You have already reacted with this emoji" });
    }

    const reaction = await prisma.reaction.create({
      data: {
        emoji: payload.emoji,
        messageId: payload.messageId,
        userId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Reaction added successfully",
      data: reaction,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Remove reaction from a message
export const removeReaction = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = removeReactionSchema.parse(body);

    const reaction = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: payload.messageId,
          userId: user.id,
          emoji: payload.emoji,
        },
      },
    });

    if (!reaction) {
      return res.status(404).json({ message: "Reaction not found" });
    }

    await prisma.reaction.delete({
      where: {
        messageId_userId_emoji: {
          messageId: payload.messageId,
          userId: user.id,
          emoji: payload.emoji,
        },
      },
    });

    return res.status(200).json({
      message: "Reaction removed successfully",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Forward a message to another channel
export const forwardMessage = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = forwardMessageSchema.parse(body);

    // Check if original message exists
    const originalMessage = await prisma.message.findUnique({
      where: { id: payload.messageId },
      include: {
        channel: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        attachments: true,
      },
    });

    if (!originalMessage) {
      return res.status(404).json({ message: "Original message not found" });
    }

    // Check if user is member of both channels
    const [sourceChannelMember, targetChannelMember] = await Promise.all([
      prisma.channelMember.findFirst({
        where: {
          channelId: originalMessage.channelId!,
          userId: user.id,
          isActive: true,
        },
      }),
      prisma.channelMember.findFirst({
        where: {
          channelId: payload.channelId,
          userId: user.id,
          isActive: true,
        },
      }),
    ]);

    if (!sourceChannelMember || !targetChannelMember) {
      return res.status(403).json({ message: "You are not a member of one or both channels" });
    }

    // Create forwarded message record
    const forwardedMessage = await prisma.forwardedMessage.create({
      data: {
        originalMessageId: payload.messageId,
        forwardedByUserId: user.id,
        channelId: payload.channelId,
      },
      include: {
        originalMessage: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            attachments: true,
          },
        },
        forwardedBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Message forwarded successfully",
      data: forwardedMessage,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get forwarded messages in a channel
export const getForwardedMessages = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const { channelId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check if user is member of the channel
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!channelMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const forwardedMessages = await prisma.forwardedMessage.findMany({
      where: {
        channelId,
      },
      include: {
        originalMessage: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
            attachments: true,
          },
        },
        forwardedBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: Number(limit),
    });

    const total = await prisma.forwardedMessage.count({
      where: {
        channelId,
      },
    });

    return res.status(200).json({
      message: "Forwarded messages fetched successfully",
      data: {
        forwardedMessages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}; 