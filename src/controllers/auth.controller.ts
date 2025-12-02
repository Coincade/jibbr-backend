import { Request, Response } from "express";
import prisma from "../config/database.js";

// Note: Most auth functions (register, login, getUser, forgetPassword, etc.) 
// have been moved to jibbr-auth-microservice. Only deleteUser remains here 
// as it's an admin function specific to the backend.

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(422).json({ message: "User not found" });
    }

    const userIdToDelete = req.params.id;
    const deletePass = req.body.DELETE_PASS;

    // Check if DELETE_PASS is provided and matches environment variable
    if (!deletePass || deletePass !== process.env.DELETE_PASS) {
      return res.status(403).json({ message: "Invalid delete password" });
    }

    // Check if user to delete exists
    const userToDelete = await prisma.user.findUnique({
      where: { id: userIdToDelete },
    });

    if (!userToDelete) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent user from deleting themselves
    if (user.id === userIdToDelete) {
      return res.status(400).json({ message: "You cannot delete yourself" });
    }

    // Delete all related data in the correct order to avoid foreign key constraints
    
    // 1. Delete all reactions by this user
    await prisma.reaction.deleteMany({
      where: { userId: userIdToDelete }
    });

    // 2. Delete all forwarded messages by this user
    await prisma.forwardedMessage.deleteMany({
      where: { forwardedByUserId: userIdToDelete }
    });

    // 3. Delete all attachments in messages by this user
    await prisma.attachment.deleteMany({
      where: {
        message: {
          userId: userIdToDelete
        }
      }
    });

    // 4. Delete all messages by this user
    await prisma.message.deleteMany({
      where: { userId: userIdToDelete }
    });

    // 5. Delete all channel memberships
    await prisma.channelMember.deleteMany({
      where: { userId: userIdToDelete }
    });

    // 6. Handle channels where user is admin - transfer admin to workspace creator or delete channel
    const channelsWhereUserIsAdmin = await prisma.channel.findMany({
      where: { channelAdminId: userIdToDelete },
      include: { workspace: true }
    });

    for (const channel of channelsWhereUserIsAdmin) {
      // Try to transfer admin to workspace creator
      const workspaceCreator = await prisma.user.findUnique({
        where: { id: channel.workspace.userId }
      });

      if (workspaceCreator) {
        // Transfer admin to workspace creator
        await prisma.channel.update({
          where: { id: channel.id },
          data: { channelAdminId: workspaceCreator.id }
        });
      } else {
        // If workspace creator doesn't exist, delete the channel
        await prisma.channel.delete({
          where: { id: channel.id }
        });
      }
    }

    // 7. Delete all workspace memberships
    await prisma.member.deleteMany({
      where: { userId: userIdToDelete }
    });

    // 8. Delete all conversation participations
    await prisma.conversationParticipant.deleteMany({
      where: { userId: userIdToDelete }
    });

    // 9. Delete all conversation read statuses
    await prisma.conversationReadStatus.deleteMany({
      where: { userId: userIdToDelete }
    });

    // 10. Delete all user notifications
    await prisma.userNotification.deleteMany({
      where: { userId: userIdToDelete }
    });

    // 11. Delete all notification preferences
    await prisma.userNotificationPreference.deleteMany({
      where: { userId: userIdToDelete }
    });

    // 12. Handle workspaces created by this user
    // First, get all workspaces created by this user
    const userWorkspaces = await prisma.workspace.findMany({
      where: { userId: userIdToDelete }
    });

    // For each workspace, delete all related data
    for (const workspace of userWorkspaces) {
      // Delete reactions in workspace channels
      await prisma.reaction.deleteMany({
        where: {
          message: {
            channel: {
              workspaceId: workspace.id
            }
          }
        }
      });

      // Delete attachments in workspace channels
      await prisma.attachment.deleteMany({
        where: {
          message: {
            channel: {
              workspaceId: workspace.id
            }
          }
        }
      });

      // Delete forwarded messages in workspace channels
      await prisma.forwardedMessage.deleteMany({
        where: {
          channel: {
            workspaceId: workspace.id
          }
        }
      });

      // Delete messages in workspace channels
      await prisma.message.deleteMany({
        where: {
          channel: {
            workspaceId: workspace.id
          }
        }
      });

      // Delete channel members
      await prisma.channelMember.deleteMany({
        where: {
          channel: {
            workspaceId: workspace.id
          }
        }
      });

      // Delete channels
      await prisma.channel.deleteMany({
        where: { workspaceId: workspace.id }
      });

      // Delete workspace members
      await prisma.member.deleteMany({
        where: { workspaceId: workspace.id }
      });

      // Delete the workspace
      await prisma.workspace.delete({
        where: { id: workspace.id }
      });
    }

    // 13. Finally, delete the user
    await prisma.user.delete({
      where: { id: userIdToDelete }
    });

    return res.status(200).json({
      message: "User and all associated data deleted successfully",
      deletedUserId: userIdToDelete
    });

  } catch (error) {
    console.error("Error in deleteUser:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
