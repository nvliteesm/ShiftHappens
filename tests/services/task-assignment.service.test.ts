/**
 * Tests for TaskAssignment Service (Control Layer)
 * Verifies accept, reject, clock in/out business logic
 * with status transition validation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TaskAssignmentService } from "@/services/task-assignment.service";
import { TaskRepository } from "@/repositories/task.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const assignmentService = new TaskAssignmentService();
const taskRepo = new TaskRepository();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;
let userId: string;
let membershipId: string;
let taskId: string;

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

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId },
  });
  membershipId = membership!.id;

  const task = await taskRepo.create({
    title: "Test task",
    organizationId: orgId,
    createdById: userId,
  });
  taskId = task.id;
});

async function createAssignment(status = "pending") {
  const assignment = await prisma.taskAssignment.create({
    data: {
      taskId,
      membershipId,
      assignedById: userId,
      status,
    },
  });
  return assignment;
}

describe("TaskAssignmentService", () => {
  describe("accept", () => {
    it("accepts a pending assignment", async () => {
      const assignment = await createAssignment();

      const accepted = await assignmentService.accept(assignment.id, membershipId);
      expect(accepted.status).toBe("accepted");
    });

    it("throws if assignment not found", async () => {
      await expect(
        assignmentService.accept("nonexistent", membershipId)
      ).rejects.toThrow("Assignment not found");
    });

    it("throws if not the assigned member", async () => {
      const assignment = await createAssignment();

      const user2 = await userRepo.create({
        name: "Other",
        email: "other@example.com",
        hashedPassword: "hash",
      });
      const membership2 = await prisma.membership.create({
        data: { userId: user2.id, organizationId: orgId, role: "staff", status: "active" },
      });

      await expect(
        assignmentService.accept(assignment.id, membership2.id)
      ).rejects.toThrow("Not authorized");
    });

    it("throws if not in pending status", async () => {
      const assignment = await createAssignment("accepted");

      await expect(
        assignmentService.accept(assignment.id, membershipId)
      ).rejects.toThrow("Can only accept pending assignments");
    });
  });

  describe("reject", () => {
    it("rejects a pending assignment with reason", async () => {
      const assignment = await createAssignment();

      const rejected = await assignmentService.reject(
        assignment.id,
        membershipId,
        "Schedule conflict"
      );
      expect(rejected.status).toBe("rejected");
      expect(rejected.rejectionReason).toBe("Schedule conflict");
    });

    it("throws if not in pending status", async () => {
      const assignment = await createAssignment("accepted");

      await expect(
        assignmentService.reject(assignment.id, membershipId, "Reason")
      ).rejects.toThrow("Can only reject pending assignments");
    });
  });

  describe("clockIn", () => {
    it("clocks in to an accepted assignment", async () => {
      const assignment = await createAssignment("accepted");

      const clocked = await assignmentService.clockIn(assignment.id, membershipId);
      expect(clocked.clockInTime).not.toBeNull();
    });

    it("throws if not accepted", async () => {
      const assignment = await createAssignment("pending");

      await expect(
        assignmentService.clockIn(assignment.id, membershipId)
      ).rejects.toThrow("Can only clock in to accepted assignments");
    });

    it("throws if already clocked in", async () => {
      const assignment = await createAssignment("accepted");
      await assignmentService.clockIn(assignment.id, membershipId);

      await expect(
        assignmentService.clockIn(assignment.id, membershipId)
      ).rejects.toThrow("Already clocked in");
    });
  });

  describe("clockOut", () => {
    it("clocks out and completes the assignment", async () => {
      const assignment = await createAssignment("accepted");
      await assignmentService.clockIn(assignment.id, membershipId);

      const clocked = await assignmentService.clockOut(assignment.id, membershipId);
      expect(clocked.clockOutTime).not.toBeNull();
      expect(clocked.status).toBe("completed");
    });

    it("throws if not clocked in", async () => {
      const assignment = await createAssignment("accepted");

      await expect(
        assignmentService.clockOut(assignment.id, membershipId)
      ).rejects.toThrow("Must clock in before clocking out");
    });

    it("throws if already clocked out", async () => {
      const assignment = await createAssignment("accepted");
      await assignmentService.clockIn(assignment.id, membershipId);
      await assignmentService.clockOut(assignment.id, membershipId);

      await expect(
        assignmentService.clockOut(assignment.id, membershipId)
      ).rejects.toThrow("Already clocked out");
    });
  });
});