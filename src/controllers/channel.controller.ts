import { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatError } from "../helper.js";
import { ZodError } from "zod";
import { z } from "zod";

const createChannelSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["PUBLIC", "PRIVATE"]),
  workspaceId: z.string()
});

const joinChannelSchema = z.object({
  channelId: z.string()
});

export const createChannel = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = createChannelSchema.parse(body);

    // Check if user is a member of the workspace
    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        workspaceId: payload.workspaceId,
        isActive: true
      }
    });

    if (!member) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    const channel = await prisma.channel.create({
      data: {
        name: payload.name,
        type: payload.type,
        workspaceId: payload.workspaceId,
        members: {
          create: {
            userId: user.id
          }
        }
      }
    });

    return res.status(201).json({
      message: "Channel created successfully",
      data: channel
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getWorkspaceChannels = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const workspaceId = req.params.workspaceId;

    // Check if user is a member of the workspace
    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspaceId,
        isActive: true
      }
    });

    if (!member) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    // Get channels where user is a member
    const channels = await prisma.channel.findMany({
      where: {
        workspaceId: workspaceId,
        members: {
          some: {
            userId: user.id,
            isActive: true
          }
        }
      }
    });

    return res.status(200).json({
      message: "Channels fetched successfully",
      data: channels
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getChannel = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const channelId = req.params.id;

    const channel = await prisma.channel.findUnique({
      where: {
        id: channelId
      },
      include: {
        workspace: true,
        members: {
          where: {
            userId: user.id,
            isActive: true
          }
        }
      }
    });

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if user is a member of the workspace
    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        workspaceId: channel.workspaceId,
        isActive: true
      }
    });

    if (!member) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    // Check if user is a member of the channel
    if (channel.members.length === 0) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    return res.status(200).json({
      message: "Channel fetched successfully",
      data: channel
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const joinChannel = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = joinChannelSchema.parse(body);

    const channel = await prisma.channel.findUnique({
      where: {
        id: payload.channelId
      }
    });

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if user is a member of the workspace
    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        workspaceId: channel.workspaceId,
        isActive: true
      }
    });

    if (!member) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    // Check if user is already a member of the channel
    const existingChannelMember = await prisma.channelMember.findFirst({
      where: {
        userId: user.id,
        channelId: channel.id,
        isActive: true
      }
    });

    if (existingChannelMember) {
      return res.status(400).json({ message: "You are already a member of this channel" });
    }

    // Create channel membership
    const channelMember = await prisma.channelMember.create({
      data: {
        userId: user.id,
        channelId: channel.id
      }
    });

    return res.status(200).json({
      message: "Joined channel successfully",
      data: channelMember
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}; 