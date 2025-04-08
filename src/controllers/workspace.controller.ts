import { formatError } from "../helper.js";

import { Request, Response } from "express";
import prisma from "../config/database.js";
import generateCode from "../helpers/generateCode.js";
import { createWorkspaceSchema } from "../validation/workspace.validations.js";
import { ZodError } from "zod";
export const createWorkspace = async (req: Request, res: Response) => {
  try {
    //ToDo: Create a proper method later
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

    await prisma.channel.create({
      data: {
        name: "TownHall",
        workspaceId: workspace.id,
        type: "ANNOUNCEMENT",
      },
    });

    return res.status(201).json({
      message: "Workspace created successfully",
      data: {
        workspaceId: workspace.id,
        joinCode: joinCode,
      },
    });
  } catch (error) {
    // console.log("Error in create workspace controller:", error);
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
    const workspaces = await prisma.workspace.findMany();
    return res.status(200).json({
      message: "Workspaces fetched successfully",
      data: workspaces,
    });
  } catch (error) {
    // console.log("Error in get all workspace controller:", error);
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
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: req.params.id,
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


