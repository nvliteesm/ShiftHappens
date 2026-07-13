/**
 * Notification Repository (Entity Layer)
 *
 * Database operations for user notifications.
 * Supports create, list (paginated), unread count,
 * mark as read (single + bulk), and bulk create.
 * All queries are user-scoped — no org filtering needed
 * since notifications belong directly to users.
 */
import { prisma } from "@/lib/prisma";

export class NotificationRepository {
  /** Creates a single notification */
  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }) {
    return prisma.notification.create({ data });
  }

  /** Creates multiple notifications at once (e.g., org suspension) */
  async createMany(
    notifications: {
      userId: string;
      type: string;
      title: string;
      message: string;
      entityType?: string;
      entityId?: string;
    }[]
  ) {
    return prisma.notification.createMany({ data: notifications });
  }

  /** Returns notifications for a user, newest first */
  async findByUserId(userId: string, limit = 20, offset = 0) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /** Counts unread notifications for a user */
  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /** Marks a single notification as read */
  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /** Marks all notifications as read for a user */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /** Finds a notification by ID (for ownership verification) */
  async findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  }

  /**
   * Checks whether a notification of this type already exists for the user
   * (optionally about a specific entity) since a given time.
   * Used to avoid re-sending the same alert on every clock-out.
   */
  async existsSince(
    userId: string,
    type: string,
    since: Date,
    entityId?: string
  ): Promise<boolean> {
    const count = await prisma.notification.count({
      where: {
        userId,
        type,
        createdAt: { gte: since },
        ...(entityId ? { entityId } : {}),
      },
    });
    return count > 0;
  }
}