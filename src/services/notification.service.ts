import prisma from "../config/database.js";

export interface NotificationData {
  id: string;
  type: 'NEW_MESSAGE' | 'MENTION' | 'REACTION' | 'CHANNEL_INVITE' | 'WORKSPACE_INVITE' | 'SYSTEM';
  title: string;
  message: string;
  data?: any;
  userId: string;
  createdAt: Date;
}

export class NotificationService {
  /**
   * Increment unread count for a channel
   */
  static async incrementChannelUnreadCount(channelId: string, userId: string): Promise<void> {
    try {
      await prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId,
            userId,
          },
        },
        data: {
          unreadCount: {
            increment: 1,
          },
        },
      });
    } catch (error) {
      console.error('Error incrementing channel unread count:', error);
    }
  }

  /**
   * Increment unread count for a conversation
   */
  static async incrementConversationUnreadCount(conversationId: string, userId: string): Promise<void> {
    try {
      await prisma.conversationReadStatus.upsert({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        update: {
          unreadCount: {
            increment: 1,
          },
        },
        create: {
          conversationId,
          userId,
          unreadCount: 1,
        },
      });
    } catch (error) {
      console.error('Error incrementing conversation unread count:', error);
    }
  }

  /**
   * Create a notification for a user
   */
  static async createNotification(data: Omit<NotificationData, 'id' | 'createdAt'>): Promise<NotificationData> {
    try {
      const notification = await prisma.userNotification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data,
        },
      });

      return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data as any,
        userId: notification.userId,
        createdAt: notification.createdAt,
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notification for new message in channel
   */
  static async notifyNewChannelMessage(
    channelId: string,
    messageId: string,
    senderId: string,
    messageContent: string,
    channelName: string
  ): Promise<void> {
    try {
      // Get all channel members except the sender
      const channelMembers = await prisma.channelMember.findMany({
        where: {
          channelId,
          userId: { not: senderId },
          isActive: true,
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

      // Get sender info
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true },
      });

      // Create notifications for all members
      for (const member of channelMembers) {
        // Increment unread count
        await this.incrementChannelUnreadCount(channelId, member.userId);

        // Create notification
        await this.createNotification({
          userId: member.userId,
          type: 'NEW_MESSAGE',
          title: `New message in #${channelName}`,
          message: `${sender?.name || 'Someone'} sent: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}`,
          data: {
            channelId,
            messageId,
            senderId,
            channelName,
          },
        });
      }
    } catch (error) {
      console.error('Error notifying new channel message:', error);
    }
  }

  /**
   * Create notification for new direct message
   */
  static async notifyNewDirectMessage(
    conversationId: string,
    messageId: string,
    senderId: string,
    messageContent: string
  ): Promise<void> {
    try {
      // Get all conversation participants except the sender
      const participants = await prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { not: senderId },
          isActive: true,
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

      // Get sender info
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true },
      });

      // Create notifications for all participants
      for (const participant of participants) {
        // Increment unread count
        await this.incrementConversationUnreadCount(conversationId, participant.userId);

        // Create notification
        await this.createNotification({
          userId: participant.userId,
          type: 'NEW_MESSAGE',
          title: `New message from ${sender?.name || 'Someone'}`,
          message: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
          data: {
            conversationId,
            messageId,
            senderId,
            senderName: sender?.name,
          },
        });
      }
    } catch (error) {
      console.error('Error notifying new direct message:', error);
    }
  }

  /**
   * Create notification for mention
   */
  static async notifyMention(
    channelId: string,
    messageId: string,
    mentionedUserId: string,
    senderId: string,
    messageContent: string,
    channelName: string
  ): Promise<void> {
    try {
      // Get sender info
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true },
      });

      // Create mention notification
      await this.createNotification({
        userId: mentionedUserId,
        type: 'MENTION',
        title: `You were mentioned in #${channelName}`,
        message: `${sender?.name || 'Someone'} mentioned you: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}`,
        data: {
          channelId,
          messageId,
          senderId,
          channelName,
        },
      });
    } catch (error) {
      console.error('Error notifying mention:', error);
    }
  }

  /**
   * Create notification for reaction
   */
  static async notifyReaction(
    messageId: string,
    reactorId: string,
    messageOwnerId: string,
    emoji: string,
    channelName?: string,
    conversationId?: string
  ): Promise<void> {
    try {
      // Don't notify if user reacts to their own message
      if (reactorId === messageOwnerId) {
        return;
      }

      // Get reactor info
      const reactor = await prisma.user.findUnique({
        where: { id: reactorId },
        select: { name: true },
      });

      const title = channelName 
        ? `Reaction in #${channelName}`
        : 'New reaction to your message';

      await this.createNotification({
        userId: messageOwnerId,
        type: 'REACTION',
        title,
        message: `${reactor?.name || 'Someone'} reacted with ${emoji} to your message`,
        data: {
          messageId,
          reactorId,
          emoji,
          channelName,
          conversationId,
        },
      });
    } catch (error) {
      console.error('Error notifying reaction:', error);
    }
  }

  /**
   * Get unread counts for a user
   */
  static async getUserUnreadCounts(userId: string, workspaceId?: string) {
    try {
      // Get channel unread counts
      const channelUnreadCounts = await prisma.channelMember.findMany({
        where: {
          userId,
          isActive: true,
          channel: {
            workspace: workspaceId ? {
              id: workspaceId
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
          userId,
          conversation: {
            participants: {
              some: {
                userId,
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
                  userId: { not: userId },
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

      return {
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
      };
    } catch (error) {
      console.error('Error getting user unread counts:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read for a channel
   */
  static async markChannelAsRead(channelId: string, userId: string): Promise<void> {
    try {
      await prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId,
            userId,
          },
        },
        data: {
          lastReadAt: new Date(),
          unreadCount: 0,
        },
      });
    } catch (error) {
      console.error('Error marking channel as read:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read for a conversation
   */
  static async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      await prisma.conversationReadStatus.upsert({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        update: {
          lastReadAt: new Date(),
          unreadCount: 0,
        },
        create: {
          conversationId,
          userId,
          lastReadAt: new Date(),
          unreadCount: 0,
        },
      });
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  }
} 