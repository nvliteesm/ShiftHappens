/**
 * Tests for Notification Service (Control Layer)
 *
 * Covers notification creation (single + bulk), fire-and-forget
 * behavior, pagination, unread counting, mark-as-read with
 * ownership verification, and mark-all-as-read.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { NotificationService, NOTIFICATION_TYPES } from "@/services/notification.service";
import { UserRepository } from "@/repositories/user.repository";
import { cleanDatabase } from "../helpers/cleanup";

const notificationService = new NotificationService();
const userRepo = new UserRepository();

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  await cleanDatabase();

  const user = await userRepo.create({
    name: "Test User",
    email: "user@test.com",
    hashedPassword: "hash",
  });
  userId = user.id;

  const other = await userRepo.create({
    name: "Other User",
    email: "other@test.com",
    hashedPassword: "hash",
  });
  otherUserId = other.id;
});

describe("NotificationService", () => {
  describe("notify", () => {
    it("creates a notification for a user", async () => {
      await notificationService.notify(
        userId,
        NOTIFICATION_TYPES.TASK_ASSIGNED,
        "New assignment",
        "You've been assigned to Kitchen prep",
        "assignment",
        "task-123"
      );

      const notifications = await notificationService.getNotifications(userId);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("task_assigned");
      expect(notifications[0].title).toBe("New assignment");
      expect(notifications[0].isRead).toBe(false);
    });

    it("does not throw on invalid userId (fire-and-forget)", async () => {
      // Should log error but not throw
      await expect(
        notificationService.notify(
          "nonexistent-user-id",
          NOTIFICATION_TYPES.TASK_ASSIGNED,
          "Test",
          "Message"
        )
      ).resolves.not.toThrow();
    });
  });

  describe("notifyMany", () => {
    it("creates notifications for multiple users", async () => {
      await notificationService.notifyMany(
        [userId, otherUserId],
        NOTIFICATION_TYPES.ORG_SUSPENDED,
        "Organization suspended",
        "Your organization has been suspended"
      );

      const userNotifs = await notificationService.getNotifications(userId);
      const otherNotifs = await notificationService.getNotifications(otherUserId);

      expect(userNotifs).toHaveLength(1);
      expect(otherNotifs).toHaveLength(1);
      expect(userNotifs[0].type).toBe("org_suspended");
    });

    it("handles empty user list without error", async () => {
      await expect(
        notificationService.notifyMany([], "test", "Test", "Message")
      ).resolves.not.toThrow();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications with pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await notificationService.notify(
          userId,
          NOTIFICATION_TYPES.TASK_ASSIGNED,
          `Notification ${i}`,
          `Message ${i}`
        );
      }

      const page1 = await notificationService.getNotifications(userId, 2, 0);
      const page2 = await notificationService.getNotifications(userId, 2, 2);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });

    it("returns empty array for user with no notifications", async () => {
      const notifications = await notificationService.getNotifications(userId);
      expect(notifications).toEqual([]);
    });
  });

  describe("getUnreadCount", () => {
    it("returns correct unread count", async () => {
      await notificationService.notify(userId, "test", "N1", "Msg");
      await notificationService.notify(userId, "test", "N2", "Msg");

      const count = await notificationService.getUnreadCount(userId);
      expect(count).toBe(2);
    });

    it("returns 0 when no notifications exist", async () => {
      const count = await notificationService.getUnreadCount(userId);
      expect(count).toBe(0);
    });

    it("decreases after marking as read", async () => {
      await notificationService.notify(userId, "test", "N1", "Msg");
      await notificationService.notify(userId, "test", "N2", "Msg");

      const notifications = await notificationService.getNotifications(userId);
      await notificationService.markAsRead(notifications[0].id, userId);

      const count = await notificationService.getUnreadCount(userId);
      expect(count).toBe(1);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", async () => {
      await notificationService.notify(userId, "test", "Test", "Msg");

      const notifications = await notificationService.getNotifications(userId);
      const result = await notificationService.markAsRead(notifications[0].id, userId);

      expect(result.isRead).toBe(true);
    });

    it("throws for non-existent notification", async () => {
      await expect(
        notificationService.markAsRead("nonexistent", userId)
      ).rejects.toThrow("Notification not found");
    });

    it("throws when user tries to mark another user's notification", async () => {
      await notificationService.notify(otherUserId, "test", "Not mine", "Msg");

      const notifications = await notificationService.getNotifications(otherUserId);

      await expect(
        notificationService.markAsRead(notifications[0].id, userId)
      ).rejects.toThrow("Not authorized");
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read for a user", async () => {
      await notificationService.notify(userId, "test", "N1", "Msg");
      await notificationService.notify(userId, "test", "N2", "Msg");
      await notificationService.notify(userId, "test", "N3", "Msg");

      await notificationService.markAllAsRead(userId);

      const count = await notificationService.getUnreadCount(userId);
      expect(count).toBe(0);
    });

    it("does not affect other users' notifications", async () => {
      await notificationService.notify(userId, "test", "Mine", "Msg");
      await notificationService.notify(otherUserId, "test", "Theirs", "Msg");

      await notificationService.markAllAsRead(userId);

      const myCount = await notificationService.getUnreadCount(userId);
      const otherCount = await notificationService.getUnreadCount(otherUserId);

      expect(myCount).toBe(0);
      expect(otherCount).toBe(1);
    });
  });

  describe("NOTIFICATION_TYPES", () => {
    it("exports all expected type constants", () => {
      expect(NOTIFICATION_TYPES.TASK_ASSIGNED).toBe("task_assigned");
      expect(NOTIFICATION_TYPES.ASSIGNMENT_ACCEPTED).toBe("assignment_accepted");
      expect(NOTIFICATION_TYPES.ASSIGNMENT_REJECTED).toBe("assignment_rejected");
      expect(NOTIFICATION_TYPES.CERT_VERIFIED).toBe("cert_verified");
      expect(NOTIFICATION_TYPES.CERT_REJECTED).toBe("cert_rejected");
      expect(NOTIFICATION_TYPES.ORG_SUSPENDED).toBe("org_suspended");
    });
  });
});