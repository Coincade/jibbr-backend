import { LRUCache } from 'lru-cache';
import prisma from '../config/database.js';

// LRU Cache configuration
const lruCache = new LRUCache<string, any>({
  max: 1000, // Maximum number of items
  ttl: 1000 * 60 * 5, // 5 minutes TTL
  updateAgeOnGet: true, // Update age when accessed
  updateAgeOnHas: true, // Update age when checked
});

export class CacheService {
  // Message Cache Methods
  static async cacheRecentMessages(channelId: string, messages: any[], ttlMinutes: number = 5): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      
      // Store in LRU cache for immediate access
      lruCache.set(`messages:${channelId}`, {
        messages,
        expires: Date.now() + ttlMinutes * 60 * 1000
      });

      // Store in PostgreSQL for persistence
      await prisma.messageCache.upsert({
        where: { channelId },
        update: {
          messageData: messages,
          expiresAt,
          updatedAt: new Date()
        },
        create: {
          channelId,
          messageData: messages,
          expiresAt
        }
      });
    } catch (error) {
      console.error('Error caching recent messages:', error);
    }
  }

  static async getRecentMessages(channelId: string): Promise<any[] | null> {
    try {
      // First check LRU cache
      const lruItem = lruCache.get(`messages:${channelId}`);
      if (lruItem && Date.now() < lruItem.expires) {
        return lruItem.messages;
      }

      // Fallback to PostgreSQL
      const dbItem = await prisma.messageCache.findUnique({
        where: { channelId }
      });

      if (dbItem && dbItem.expiresAt > new Date()) {
        // Update LRU cache with fresh data
        lruCache.set(`messages:${channelId}`, {
          messages: dbItem.messageData,
          expires: dbItem.expiresAt.getTime()
        });
        return dbItem.messageData as any[];
      }

      // Clean up expired cache
      if (dbItem) {
        await prisma.messageCache.delete({
          where: { channelId }
        });
      }

      return null;
    } catch (error) {
      console.error('Error getting recent messages:', error);
      return null;
    }
  }

  // Session Cache Methods
  static async cacheUserSession(userId: string, token: string, userData: any, ttlHours: number = 24): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      
      // Store in LRU cache
      lruCache.set(`session:${userId}`, {
        userData,
        token,
        expires: expiresAt.getTime()
      });

      // Store in PostgreSQL
      await prisma.sessionCache.upsert({
        where: { userId },
        update: {
          token,
          userData,
          expiresAt,
          updatedAt: new Date()
        },
        create: {
          userId,
          token,
          userData,
          expiresAt
        }
      });
    } catch (error) {
      console.error('Error caching user session:', error);
    }
  }

  static async getUserSession(userId: string): Promise<any | null> {
    try {
      // Check LRU cache first
      const lruItem = lruCache.get(`session:${userId}`);
      if (lruItem && Date.now() < lruItem.expires) {
        return lruItem.userData;
      }

      // Fallback to PostgreSQL
      const dbItem = await prisma.sessionCache.findUnique({
        where: { userId }
      });

      if (dbItem && dbItem.expiresAt > new Date()) {
        // Update LRU cache
        lruCache.set(`session:${userId}`, {
          userData: dbItem.userData,
          token: dbItem.token,
          expires: dbItem.expiresAt.getTime()
        });
        return dbItem.userData;
      }

      // Clean up expired session
      if (dbItem) {
        await prisma.sessionCache.delete({
          where: { userId }
        });
      }

      return null;
    } catch (error) {
      console.error('Error getting user session:', error);
      return null;
    }
  }

  static async validateSessionToken(token: string): Promise<any | null> {
    try {
      const session = await prisma.sessionCache.findUnique({
        where: { token }
      });

      if (session && session.expiresAt > new Date()) {
        return session.userData;
      }

      // Clean up expired session
      if (session) {
        await prisma.sessionCache.delete({
          where: { token }
        });
      }

      return null;
    } catch (error) {
      console.error('Error validating session token:', error);
      return null;
    }
  }

  static async invalidateUserSession(userId: string): Promise<void> {
    try {
      // Remove from LRU cache
      lruCache.delete(`session:${userId}`);

      // Remove from PostgreSQL
      await prisma.sessionCache.delete({
        where: { userId }
      });
    } catch (error) {
      console.error('Error invalidating user session:', error);
    }
  }

  // Workspace Cache Methods
  static async cacheWorkspace(workspaceId: string, workspaceData: any, ttlMinutes: number = 10): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      
      // Store in LRU cache
      lruCache.set(`workspace:${workspaceId}`, {
        workspaceData,
        expires: expiresAt.getTime()
      });

      // Store in PostgreSQL
      await prisma.workspaceCache.upsert({
        where: { workspaceId },
        update: {
          workspaceData,
          expiresAt,
          updatedAt: new Date()
        },
        create: {
          workspaceId,
          workspaceData,
          expiresAt
        }
      });
    } catch (error) {
      console.error('Error caching workspace:', error);
    }
  }

  static async getWorkspace(workspaceId: string): Promise<any | null> {
    try {
      // Check LRU cache first
      const lruItem = lruCache.get(`workspace:${workspaceId}`);
      if (lruItem && Date.now() < lruItem.expires) {
        return lruItem.workspaceData;
      }

      // Fallback to PostgreSQL
      const dbItem = await prisma.workspaceCache.findUnique({
        where: { workspaceId }
      });

      if (dbItem && dbItem.expiresAt > new Date()) {
        // Update LRU cache
        lruCache.set(`workspace:${workspaceId}`, {
          workspaceData: dbItem.workspaceData,
          expires: dbItem.expiresAt.getTime()
        });
        return dbItem.workspaceData;
      }

      // Clean up expired cache
      if (dbItem) {
        await prisma.workspaceCache.delete({
          where: { workspaceId }
        });
      }

      return null;
    } catch (error) {
      console.error('Error getting workspace:', error);
      return null;
    }
  }

  // Generic Cache Methods
  static async set(key: string, value: any, ttlMinutes: number = 5): Promise<void> {
    try {
      const expires = Date.now() + ttlMinutes * 60 * 1000;
      lruCache.set(key, { value, expires });
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  static async get(key: string): Promise<any | null> {
    try {
      const item = lruCache.get(key);
      if (item && Date.now() < item.expires) {
        return item.value;
      }
      
      // Remove expired item
      if (item) {
        lruCache.delete(key);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      lruCache.delete(key);
    } catch (error) {
      console.error('Error deleting cache:', error);
    }
  }

  // Cache Statistics
  static getCacheStats(): any {
    return {
      size: lruCache.size,
      max: lruCache.max,
      ttl: lruCache.ttl,
      calculatedSize: lruCache.calculatedSize
    };
  }

  // Cleanup expired entries
  static async cleanupExpiredEntries(): Promise<void> {
    try {
      // Clean up expired PostgreSQL entries
      await prisma.messageCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      await prisma.sessionCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      await prisma.workspaceCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      console.log('Expired cache entries cleaned up');
    } catch (error) {
      console.error('Error cleaning up expired entries:', error);
    }
  }
}

// Auto cleanup every hour
setInterval(() => {
  CacheService.cleanupExpiredEntries();
}, 60 * 60 * 1000); // 1 hour
