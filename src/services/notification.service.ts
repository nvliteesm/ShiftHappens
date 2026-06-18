/**
 * Notification Service (Control Layer)
 *
 * Business logic for user notifications.
 * Provides methods for creating notifications (single + bulk),
 * listing, counting unread, and marking as read.
 *
 * Notification creation is fire-and-forget — callers should
 * not await or depend on notification delivery succeeding.
 * Ownership is verified before marking as read.
 */
import { NotificationRepository } from "@/repositories/notification.repository";

/** Notification type constants */
export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: "task_assigned",
  ASSIGNMENT_ACCEPTED: "assignment_accepted",
  ASSIGNMENT_REJECTED: "assignment_rejected",
  CERT_VERIFIED: "cert_verified",
  CERT_REJECTED: "cert_rejected",
  ORG_SUSPENDED: "org_suspended",
} as const;

export class NotificationService {
  private notificationRepo = new NotificationRepository();

  /**
   * Creates a notification for a single user.
   * Fire-and-forget — errors are logged, never thrown.
   */
  async notify(
    userId: string,
    type: string,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string
  ) {
    try {
      await this.notificationRepo.create({
        userId,
        type,
        title,
        message,
        entityType,
        entityId,
      });
    } catch (error) {
      console.error("[Notification Error]", error);
    }
  }

  /**
   * Creates notifications for multiple users at once.
   * Fire-and-forget — errors are logged, never thrown.
   */
  async notifyMany(
    userIds: string[],
    type: string,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string
  ) {
    try {
      const notifications = userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        entityType,
        entityId,
      }));
      await this.notificationRepo.createMany(notifications);
    } catch (error) {
      console.error("[Notification Error]", error);
    }
  }

  /** Returns paginated notifications for a user */
  async getNotifications(userId: string, limit = 20, offset = 0) {
    return this.notificationRepo.findByUserId(userId, limit, offset);
  }

  /** Returns the unread notification count for a user */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.countUnread(userId);
  }

  /**
   * Marks a single notification as read.
   * Verifies ownership — users can only mark their own notifications.
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepo.findById(notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }
    if (notification.userId !== userId) {
      throw new Error("Not authorized");
    }
    return this.notificationRepo.markAsRead(notificationId);
  }

  /** Marks all notifications as read for a user */
  async markAllAsRead(userId: string) {
    return this.notificationRepo.markAllAsRead(userId);
  }
}