/**
 * Tests for Task Service (Control Layer)
 * Verifies task CRUD business logic including
 * scheduling validation and assignment management.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskService } from "@/services/task.service";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { DepartmentRepository } from "@/repositories/department.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const taskService = new TaskService();
const orgRepo = new OrganizationRepository();
const deptRepo = new DepartmentRepository();
const userRepo = new UserRepository();

let orgId: string;
let deptId: string;
let userId: string;
let membershipId: string;
let staffUserId: string;
let staffMembershipId: string;

beforeEach(async () => {
  await cleanDatabase();

  const user = await userRepo.create({
    name: "Admin User",
    email: "admin@example.com",
    hashedPassword: "hash",
  });
  userId = user.id;

  const org = await orgRepo.create(
    { name: "Acme Corp", slug: "acme-corp" },
    user.id
  );
  orgId = org.id;

  // Ensure require_acceptance mode for assignment tests
  await prisma.companySettings.create({
    data: {
      organizationId: orgId,
      taskAcceptanceMode: "require_acceptance",
    },
  });

  const dept = await deptRepo.create({
    name: "Kitchen",
    organizationId: orgId,
  });
  deptId = dept.id;

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId },
  });
  membershipId = membership!.id;

  // Create a staff member for assignment tests
  const staffUser = await userRepo.create({
    name: "Staff User",
    email: "staff@example.com",
    hashedPassword: "hash",
  });
  staffUserId = staffUser.id;

  const staffMembership = await prisma.membership.create({
    data: {
      userId: staffUser.id,
      organizationId: orgId,
      role: "staff",
      status: "active",
    },
  });
  staffMembershipId = staffMembership.id;
});

describe("TaskService", () => {
  describe("create", () => {
    it("creates a task", async () => {
      const task = await taskService.create(
        {
          title: "Clean kitchen",
          description: "Deep clean",
          departmentId: deptId,
          priority: "high",
          requiredHeadcount: 2,
        },
        orgId,
        userId
      );

      expect(task.title).toBe("Clean kitchen");
      expect(task.priority).toBe("high");
      expect(task.status).toBe("open");
    });

    it("throws if scheduledEnd is before scheduledStart", async () => {
      await expect(
        taskService.create(
          {
            title: "Bad schedule",
            scheduledStart: "2026-06-01T12:00:00.000Z",
            scheduledEnd: "2026-06-01T08:00:00.000Z",
          },
          orgId,
          userId
        )
      ).rejects.toThrow("End time must be after start time");
    });
  });

  describe("getByOrganization", () => {
    it("returns all tasks for an org", async () => {
      await taskService.create({ title: "Task 1" }, orgId, userId);
      await taskService.create({ title: "Task 2" }, orgId, userId);

      const tasks = await taskService.getByOrganization(orgId);
      expect(tasks).toHaveLength(2);
    });

    it("filters by status", async () => {
      await taskService.create({ title: "Open task" }, orgId, userId);
      const task2 = await taskService.create({ title: "Done task" }, orgId, userId);
      await taskService.update(task2.id, orgId, { status: "completed" });

      const tasks = await taskService.getByOrganization(orgId, { status: "open" });
      expect(tasks).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("returns a task", async () => {
      const created = await taskService.create({ title: "Test" }, orgId, userId);
      const found = await taskService.getById(created.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe("Test");
    });
  });

  describe("update", () => {
    it("updates task fields", async () => {
      const task = await taskService.create({ title: "Old" }, orgId, userId);
      const updated = await taskService.update(task.id, orgId, {
        title: "New",
        priority: "urgent",
      });

      expect(updated.title).toBe("New");
      expect(updated.priority).toBe("urgent");
    });

    it("throws if task not found", async () => {
      await expect(
        taskService.update("nonexistent", orgId, { title: "X" })
      ).rejects.toThrow("Task not found");
    });
  });

  describe("delete", () => {
    it("deletes a task", async () => {
      const task = await taskService.create({ title: "Delete me" }, orgId, userId);
      await taskService.delete(task.id, orgId);

      const found = await taskService.getById(task.id);
      expect(found).toBeNull();
    });

    it("throws if task not found", async () => {
      await expect(
        taskService.delete("nonexistent", orgId)
      ).rejects.toThrow("Task not found");
    });
  });

  describe("assignStaff", () => {
    it("assigns a member to a task", async () => {
      const task = await taskService.create({ title: "Test" }, orgId, userId);

      const assignments = await taskService.assignStaff(
        task.id,
        orgId,
        [staffMembershipId],
        userId
      );

      expect(assignments).toHaveLength(1);
      expect(assignments[0].membershipId).toBe(staffMembershipId);
      expect(assignments[0].status).toBe("pending");
    });

    it("auto-accepts assignments when taskAcceptanceMode is auto_accept", async () => {
      // Update settings to auto_accept
      await prisma.companySettings.updateMany({
        where: { organizationId: orgId },
        data: { taskAcceptanceMode: "auto_accept" },
      });

      const task = await taskService.create({ title: "Auto test" }, orgId, userId);

      const assignments = await taskService.assignStaff(
        task.id,
        orgId,
        [staffMembershipId],
        userId
      );

      expect(assignments).toHaveLength(1);
      expect(assignments[0].status).toBe("accepted");
    });

    it("throws if exceeding required headcount", async () => {
      const task = await taskService.create(
        { title: "Solo task", requiredHeadcount: 1 },
        orgId,
        userId
      );

      await taskService.assignStaff(task.id, orgId, [staffMembershipId], userId);

      const user2 = await userRepo.create({
        name: "Staff 2",
        email: "staff2@example.com",
        hashedPassword: "hash",
      });
      const membership2 = await prisma.membership.create({
        data: { userId: user2.id, organizationId: orgId, role: "staff", status: "active" },
      });

      await expect(
        taskService.assignStaff(task.id, orgId, [membership2.id], userId)
      ).rejects.toThrow("exceeds required headcount");
    });

    it("detects scheduling conflicts", async () => {
      const task1 = await taskService.create(
        {
          title: "Morning shift",
          scheduledStart: "2026-06-01T08:00:00.000Z",
          scheduledEnd: "2026-06-01T12:00:00.000Z",
        },
        orgId,
        userId
      );
      await taskService.assignStaff(task1.id, orgId, [staffMembershipId], userId);
      await prisma.taskAssignment.updateMany({
        where: { taskId: task1.id },
        data: { status: "accepted" },
      });

      const task2 = await taskService.create(
        {
          title: "Overlapping shift",
          scheduledStart: "2026-06-01T10:00:00.000Z",
          scheduledEnd: "2026-06-01T14:00:00.000Z",
        },
        orgId,
        userId
      );

      await expect(
        taskService.assignStaff(task2.id, orgId, [staffMembershipId], userId)
      ).rejects.toThrow("scheduling conflict");
    });
  });

  describe("assignStaffValidation", () => {
    it("throws if assigning a company admin", async () => {
      const task = await taskService.create({ title: "Test" }, orgId, userId);

      await expect(
        taskService.assignStaff(task.id, orgId, [membershipId], userId)
      ).rejects.toThrow("Company Admins cannot be assigned to tasks");
    });
  });

  describe("cancelAssignment", () => {
    it("cancels a pending assignment", async () => {
      const task = await taskService.create({ title: "Test" }, orgId, userId);
      const assignments = await taskService.assignStaff(task.id, orgId, [staffMembershipId], userId);

      await taskService.cancelAssignment(assignments[0].id);

      const staffTasks = await taskService.getStaffTasks(staffMembershipId);
      expect(staffTasks).toHaveLength(0);
    });

    it("throws if assignment is completed", async () => {
      const task = await taskService.create({ title: "Test" }, orgId, userId);
      const assignments = await taskService.assignStaff(task.id, orgId, [staffMembershipId], userId);

      await prisma.taskAssignment.update({
        where: { id: assignments[0].id },
        data: { status: "completed" },
      });

      await expect(
        taskService.cancelAssignment(assignments[0].id)
      ).rejects.toThrow("Cannot cancel a completed assignment");
    });
  });

  describe("getTasksByDepartment", () => {
    it("returns tasks for a department", async () => {
      await taskService.create({ title: "Kitchen task", departmentId: deptId }, orgId, userId);
      await taskService.create({ title: "No dept task" }, orgId, userId);

      const tasks = await taskService.getTasksByDepartment(deptId);
      expect(tasks).toHaveLength(1);
    });
  });

  describe("getStaffTasks", () => {
    it("returns tasks assigned to a member", async () => {
      const task = await taskService.create({ title: "My task" }, orgId, userId);
      await taskService.assignStaff(task.id, orgId, [staffMembershipId], userId);

      const assignments = await taskService.getStaffTasks(staffMembershipId);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].task.title).toBe("My task");
    });
  });
});