import { formatError } from "../helper.js";

import { Request, Response } from "express";
import prisma from "../config/database.js";
import generateCode from "../helpers/generateCode.js";
import { createWorkspaceSchema, joinWorkspaceSchema } from "../validation/workspace.validations.js";
import { ZodError } from "zod";


export const createWorkspace = async (req: Request, res: Response) => {
  try {
    const joinCode = generateCode();
    const user = req.user;

    const body = req.body;
    const payload = createWorkspaceSchema.parse(body);

    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }
    const workspace = await prisma.workspace.create({
      data: {
        name: payload.name,
        joinCode: joinCode,
        userId: user.id,
      },
    });

    await prisma.member.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "ADMIN",
      },
    });

    // Create General channel (PUBLIC)
    const generalChannel = await prisma.channel.create({
      data: {
        name: "General",
        workspaceId: workspace.id,
        type: "PUBLIC",
      },
    });

    // Create TownHall channel (ANNOUNCEMENT)
    const townHallChannel = await prisma.channel.create({
      data: {
        name: "TownHall",
        workspaceId: workspace.id,
        type: "ANNOUNCEMENT",
      },
    });

    // Add workspace creator to both channels
    await prisma.channelMember.createMany({
      data: [
        {
          userId: user.id,
          channelId: generalChannel.id,
        },
        {
          userId: user.id,
          channelId: townHallChannel.id,
        },
      ],
    });

    return res.status(201).json({
      message: "Workspace created successfully",
      data: {
        workspaceId: workspace.id,
        joinCode: joinCode,
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


export const getAllWorkspaces = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }
    const workspaces = await prisma.workspace.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
    });
    return res.status(200).json({
      message: "Workspaces fetched successfully",
      data: workspaces,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const getWorkspace = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: req.params.id,
        isActive: true,
        deletedAt: null,
      },
    });
    return res.status(200).json({
      message: "Workspace fetched successfully",
      data: workspace,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllWorkspacesForUser = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }
    const workspaces = await prisma.workspace.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { userId: user.id },
          {
            members: {
              some: {
                userId: user.id
              }
            }
          }
        ]
      },
    });
    return res.status(200).json({ message: "Workspaces fetched successfully", data: workspaces });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getWorkspaceMembers = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: req.params.id,
        isActive: true,
      },
    });
    if (!workspace) {
      return res.status(422).json({ message: "Workspace not found" });
    }
    const members = await prisma.member.findMany({
      where: {
        workspaceId: workspace.id,
        isActive: true
      },
      include: {
        user: {
          select: {
            name: true,
            image: true,
            email: true
          }
        }
      }
    });
    return res.status(200).json({ message: "Members fetched successfully", data: members });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const joinWorkspace = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const body = req.body;
    const payload = joinWorkspaceSchema.parse(body);

    const workspace = await prisma.workspace.findUnique({
      where: {
        id: req.params.id,
        isActive: true,
        joinCode: payload.joinCode,
      },
    });
    if (!workspace) {
      return res.status(422).json({ message: "Workspace not found" });
    }

    const existingMember = await prisma.member.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspace.id,
        isActive: true
      },
    });

    if (existingMember) {
      return res.status(422).json({ message: "You are already a member of this workspace" });
    }
    
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "MEMBER",
      },
    });

    // Get the default channels (General and TownHall)
    const defaultChannels = await prisma.channel.findMany({
      where: {
        workspaceId: workspace.id,
        name: {
          in: ["General", "TownHall"]
        }
      }
    });

    // Add user to both default channels
    if (defaultChannels.length > 0) {
      await prisma.channelMember.createMany({
        data: defaultChannels.map(channel => ({
          userId: user.id,
          channelId: channel.id,
        })),
        skipDuplicates: true, // Skip if user is already a member
      });
    }

    return res.status(200).json({ message: "Joined workspace successfully", data: member });
  } catch (error) {
    if (error instanceof ZodError) {  
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const leaveWorkspace = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: req.params.id,
        isActive: true,
      },
    });
    if (!workspace) {
      return res.status(422).json({ message: "Workspace not found" });
    }
    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    });
    if (!member) {
      return res.status(422).json({ message: "Member not found" });
    }
    await prisma.member.update({
      where: {
        id: member.id,
      },
      data: {
        isActive: false
      }
    });
    return res.status(200).json({ message: "Left workspace successfully" });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateWorkspace = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const workspaceId = req.params.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const wk = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
        isActive: true,
      },
    }); 
    if (!wk) {
      return res.status(422).json({ message: "Workspace not found" });
    }

    const workspace = await prisma.workspace.update({
      where: {
        id: wk.id,
      },
      data: {
        name,
      },
    });

    return res.status(200).json({
      message: "Workspace updated successfully",
      data: workspace,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const softDeleteWorkspace = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const workspaceId = req.params.id;

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        isActive: true,
        deletedAt: null
      },
    }); 
    if (!workspace) {
      return res.status(422).json({ message: "Workspace not found" });
    }

    // Check if user is the workspace creator or has admin role
    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspaceId,
        isActive: true
      }
    });

    const isWorkspaceCreator = workspace.userId === user.id;
    const isAdmin = member?.role === "ADMIN";

    if (!isWorkspaceCreator && !isAdmin) {
      return res.status(403).json({ message: "You don't have permission to delete this workspace" });
    }

    // Soft delete the workspace by setting deletedAt timestamp
    await prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        deletedAt: new Date()
      },
    });   

    return res.status(200).json({ 
      message: "Workspace soft deleted successfully. All data is preserved." 
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const hardDeleteWorkspace = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const workspaceId = req.params.id;
    const deletePass = req.body.DELETE_PASS;

    // Check if DELETE_PASS is provided and matches environment variable
    if (!deletePass || deletePass !== process.env.DELETE_PASS) {
      return res.status(403).json({ message: "Invalid delete password" });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        isActive: true,
        deletedAt: null
      },
    }); 
    if (!workspace) {
      return res.status(422).json({ message: "Workspace not found" });
    }

    // Hard delete everything related to the workspace
    // Delete in order to avoid foreign key constraints
    
    // 1. Delete all reactions in messages from all channels in this workspace
    await prisma.reaction.deleteMany({
      where: {
        message: {
          channel: {
            workspaceId: workspaceId
          }
        }
      }
    });

    // 2. Delete all attachments in messages from all channels in this workspace
    await prisma.attachment.deleteMany({
      where: {
        message: {
          channel: {
            workspaceId: workspaceId
          }
        }
      }
    });

    // 3. Delete all forwarded messages from all channels in this workspace
    await prisma.forwardedMessage.deleteMany({
      where: {
        channel: {
          workspaceId: workspaceId
        }
      }
    });

    // 4. Delete all messages in all channels in this workspace
    await prisma.message.deleteMany({
      where: {
        channel: {
          workspaceId: workspaceId
        }
      }
    });

    // 5. Delete all channel members from all channels in this workspace
    await prisma.channelMember.deleteMany({
      where: {
        channel: {
          workspaceId: workspaceId
        }
      }
    });

    // 6. Delete all channels in this workspace
    await prisma.channel.deleteMany({
      where: {
        workspaceId: workspaceId
      }
    });

    // 7. Delete all workspace members
    await prisma.member.deleteMany({
      where: {
        workspaceId: workspaceId
      }
    });

    // 8. Finally delete the workspace itself
    await prisma.workspace.delete({
      where: {
        id: workspaceId
      }
    });

    return res.status(200).json({ 
      message: "Workspace and all associated data permanently deleted successfully" 
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatError(error);
      return res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};
