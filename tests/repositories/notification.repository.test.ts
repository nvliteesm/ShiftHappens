/**
 * Tests for Notification Repository (Entity Layer)
 *
 * Covers CRUD operations, pagination, unread counting,
 * mark-as-read (single + bulk), bulk create, and user isolation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { NotificationRepository } from "@/repositories/notification.repository";
import { UserRepository } from "@/repositories/user.repository";
import { cleanDatabase } from "../helpers/cleanup";

const notificationRepo = new NotificationRepository();
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

describe("NotificationRepository", () => {
  describe("create", () => {
    it("creates a notification with all fields", async () => {
      const notification = await notificationRepo.create({
        userId,
        type: "task_assigned",
        title: "New task",
        message: "You've been assigned to Kitchen prep",
        entityType: "assignment",
        entityId: "task-123",
      });

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe(userId);
      expect(notification.type).toBe("task_assigned");
      expect(notification.title).toBe("New task");
      expect(notification.message).toBe("You've been assigned to Kitchen prep");
      expect(notification.entityType).toBe("assignment");
      expect(notification.entityId).toBe("task-123");
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });

    it("creates a notification without optional fields", async () => {
      const notification = await notificationRepo.create({
        userId,
        type: "org_suspended",
        title: "Organization suspended",
        message: "Your organization has been suspended",
      });

      expect(notification.entityType).toBeNull();
      expect(notification.entityId).toBeNull();
      expect(notification.isRead).toBe(false);
    });
  });

  describe("createMany", () => {
    it("creates multiple notifications at once", async () => {
      await notificationRepo.createMany([
        { userId, type: "task_assigned", title: "Task 1", message: "Msg 1" },
        { userId, type: "task_assigned", title: "Task 2", message: "Msg 2" },
        { userId: otherUserId, type: "task_assigned", title: "Task 3", message: "Msg 3" },
      ]);

      const userNotifs = await notificationRepo.findByUserId(userId);
      const otherNotifs = await notificationRepo.findByUserId(otherUserId);

      expect(userNotifs).toHaveLength(2);
      expect(otherNotifs).toHaveLength(1);
    });
  });

  describe("findByUserId", () => {
    it("returns notifications newest first", async () => {
      await notificationRepo.create({
        userId, type: "task_assigned", title: "First", message: "First msg",
      });
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 50));
      await notificationRepo.create({
        userId, type: "task_assigned", title: "Second", message: "Second msg",
      });

      const notifications = await notificationRepo.findByUserId(userId);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toBe("Second");
      expect(notifications[1].title).toBe("First");
    });

    it("respects limit and offset", async () => {
      for (let i = 0; i < 5; i++) {
        await notificationRepo.create({
          userId, type: "task_assigned", title: `Notif ${i}`, message: `Msg ${i}`,
        });
      }

      const page1 = await notificationRepo.findByUserId(userId, 2, 0);
      const page2 = await notificationRepo.findByUserId(userId, 2, 2);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it("only returns the specified user's notifications", async () => {
      await notificationRepo.create({
        userId, type: "task_assigned", title: "Mine", message: "My msg",
      });
      await notificationRepo.create({
        userId: otherUserId, type: "task_assigned", title: "Theirs", message: "Their msg",
      });

      const notifications = await notificationRepo.findByUserId(userId);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe("Mine");
    });

    it("returns empty array for user with no notifications", async () => {
      const notifications = await notificationRepo.findByUserId(userId);
      expect(notifications).toEqual([]);
    });
  });

  describe("countUnread", () => {
    it("counts only unread notifications", async () => {
      const n1 = await notificationRepo.create({
        userId, type: "task_assigned", title: "Unread 1", message: "Msg",
      });
      await notificationRepo.create({
        userId, type: "task_assigned", title: "Unread 2", message: "Msg",
      });
      await notificationRepo.markAsRead(n1.id);

      const count = await notificationRepo.countUnread(userId);
      expect(count).toBe(1);
    });

    it("returns 0 when all are read", async () => {
      const n = await notificationRepo.create({
        userId, type: "task_assigned", title: "Read", message: "Msg",
      });
      await notificationRepo.markAsRead(n.id);

      const count = await notificationRepo.countUnread(userId);
      expect(count).toBe(0);
    });

    it("returns 0 for user with no notifications", async () => {
      const count = await notificationRepo.countUnread(userId);
      expect(count).toBe(0);
    });

    it("does not count other users' unread notifications", async () => {
      await notificationRepo.create({
        userId: otherUserId, type: "task_assigned", title: "Other", message: "Msg",
      });

      const count = await notificationRepo.countUnread(userId);
      expect(count).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a single notification as read", async () => {
      const n = await notificationRepo.create({
        userId, type: "task_assigned", title: "Test", message: "Msg",
      });

      const updated = await notificationRepo.markAsRead(n.id);
      expect(updated.isRead).toBe(true);
    });

    it("does not affect other notifications", async () => {
      const n1 = await notificationRepo.create({
        userId, type: "task_assigned", title: "Read me", message: "Msg",
      });
      const n2 = await notificationRepo.create({
        userId, type: "task_assigned", title: "Keep unread", message: "Msg",
      });

      await notificationRepo.markAsRead(n1.id);

      const found = await notificationRepo.findById(n2.id);
      expect(found!.isRead).toBe(false);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all unread notifications as read for a user", async () => {
      await notificationRepo.create({
        userId, type: "task_assigned", title: "N1", message: "Msg",
      });
      await notificationRepo.create({
        userId, type: "task_assigned", title: "N2", message: "Msg",
      });

      await notificationRepo.markAllAsRead(userId);

      const count = await notificationRepo.countUnread(userId);
      expect(count).toBe(0);
    });

    it("does not affect other users' notifications", async () => {
      await notificationRepo.create({
        userId: otherUserId, type: "task_assigned", title: "Other", message: "Msg",
      });

      await notificationRepo.markAllAsRead(userId);

      const otherCount = await notificationRepo.countUnread(otherUserId);
      expect(otherCount).toBe(1);
    });
  });

  describe("findById", () => {
    it("returns a notification by ID", async () => {
      const created = await notificationRepo.create({
        userId, type: "task_assigned", title: "Find me", message: "Msg",
      });

      const found = await notificationRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Find me");
    });

    it("returns null for non-existent ID", async () => {
      const found = await notificationRepo.findById("nonexistent");
      expect(found).toBeNull();
    });
  });
});