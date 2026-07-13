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
import { SettingsRepository } from "@/repositories/settings.repository";

/** Notification type constants */
export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: "task_assigned",
  TASK_UNASSIGNED: "task_unassigned",
  TASK_CANCELLED: "task_cancelled",
  TASK_RESCHEDULED: "task_rescheduled",
  STAFF_INELIGIBLE: "staff_ineligible",
  HOUR_LIMIT_WARNING: "hour_limit_warning",
  ASSIGNMENT_ACCEPTED: "assignment_accepted",
  ASSIGNMENT_REJECTED: "assignment_rejected",
  TASK_COMPLETED: "task_completed",
  WITHDRAWAL_REQUESTED: "withdrawal_requested",
  WITHDRAWAL_APPROVED: "withdrawal_approved",
  WITHDRAWAL_DENIED: "withdrawal_denied",
  CERT_VERIFIED: "cert_verified",
  CERT_REJECTED: "cert_rejected",
  ORG_SUSPENDED: "org_suspended",
} as const;

/**
 * Maps a notification type to the toggle in CompanySettings.notificationPreferences
 * that controls it. Types not listed here are always sent (they're not optional).
 */
const TYPE_TO_PREFERENCE: Record<string, string> = {
  [NOTIFICATION_TYPES.TASK_ASSIGNED]: "taskAssignment",
  [NOTIFICATION_TYPES.TASK_UNASSIGNED]: "taskAssignment",
  [NOTIFICATION_TYPES.TASK_CANCELLED]: "taskAssignment",
  [NOTIFICATION_TYPES.TASK_RESCHEDULED]: "taskAssignment",
  [NOTIFICATION_TYPES.STAFF_INELIGIBLE]: "taskAssignment",
  [NOTIFICATION_TYPES.ASSIGNMENT_REJECTED]: "taskRejection",
  [NOTIFICATION_TYPES.HOUR_LIMIT_WARNING]: "hourLimitWarning",
};

export class NotificationService {
  private notificationRepo = new NotificationRepository();
  private settingsRepo = new SettingsRepository();

  /**
   * Whether an org has this notification type enabled.
   * Defaults to true — a missing/unparseable preference never silences alerts.
   */
  async isTypeEnabled(organizationId: string, type: string): Promise<boolean> {
    const prefKey = TYPE_TO_PREFERENCE[type];
    if (!prefKey) return true; // not a gated type

    try {
      const settings = await this.settingsRepo.getOrCreate(organizationId);
      if (!settings.notificationPreferences) return true;
      const prefs = JSON.parse(settings.notificationPreferences) as Record<
        string,
        boolean
      >;
      return prefs[prefKey] !== false;
    } catch {
      return true;
    }
  }

  /**
   * Sends a notification only if the org has the type enabled.
   * Fire-and-forget — errors are logged, never thrown.
   */
  async notifyIfEnabled(
    organizationId: string,
    userId: string,
    type: string,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string
  ) {
    if (!(await this.isTypeEnabled(organizationId, type))) return;
    return this.notify(userId, type, title, message, entityType, entityId);
  }

  /** Sends to many users, respecting the org's notification preferences. */
  async notifyManyIfEnabled(
    organizationId: string,
    userIds: string[],
    type: string,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string
  ) {
    if (userIds.length === 0) return;
    if (!(await this.isTypeEnabled(organizationId, type))) return;
    return this.notifyMany(userIds, type, title, message, entityType, entityId);
  }

  /**
   * True if this user already got this alert type (about this entity)
   * since `since`. Used to avoid repeat alerts.
   */
  async wasNotifiedSince(
    userId: string,
    type: string,
    since: Date,
    entityId?: string
  ): Promise<boolean> {
    return this.notificationRepo.existsSince(userId, type, since, entityId);
  }

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