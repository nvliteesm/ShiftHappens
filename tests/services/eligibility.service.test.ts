/**
 * Tests for Eligibility Service (Control Layer)
 * Verifies the three-dimensional eligibility engine:
 * hours limit, availability, and scheduling conflicts.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { EligibilityService } from "@/services/eligibility.service";
import { TaskRepository } from "@/repositories/task.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { AvailabilityRepository } from "@/repositories/availability.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const eligibilityService = new EligibilityService();
const taskRepo = new TaskRepository();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();
const availRepo = new AvailabilityRepository();

let orgId: string;
let adminUserId: string;
let staffMembershipId: string;
let taskId: string;

beforeEach(async () => {
  await cleanDatabase();

  const admin = await userRepo.create({
    name: "Admin User",
    email: "admin@example.com",
    hashedPassword: "hash",
  });
  adminUserId = admin.id;

  const org = await orgRepo.create(
    { name: "Acme Corp", slug: "acme-corp" },
    admin.id
  );
  orgId = org.id;

  const staff = await userRepo.create({
    name: "Staff User",
    email: "staff@example.com",
    hashedPassword: "hash",
  });

  const staffMembership = await prisma.membership.create({
    data: {
      userId: staff.id,
      organizationId: org.id,
      role: "staff",
      status: "active",
    },
  });
  staffMembershipId = staffMembership.id;

  // Create company settings
  await prisma.companySettings.create({
    data: {
      organizationId: org.id,
      breakRuleHoursWorked: 8,
    },
  });
});

describe("EligibilityService", () => {
  describe("checkEligibilityForTask", () => {
    it("returns eligible staff when no constraints", async () => {
      const task = await taskRepo.create({
        title: "Simple task",
        organizationId: orgId,
        createdById: adminUserId,
      });

      const results = await eligibilityService.checkEligibilityForTask(
        task.id,
        orgId
      );

      // Should include staff but not admin
      const staffResult = results.find(
        (r) => r.membershipId === staffMembershipId
      );
      expect(staffResult).toBeDefined();
      expect(staffResult!.eligible).toBe(true);

      // Admin should not be in results
      const adminResult = results.find(
        (r) => r.memberName === "Admin User"
      );
      expect(adminResult).toBeUndefined();
    });

    it("marks staff ineligible when unavailable", async () => {
      const task = await taskRepo.create({
        title: "Scheduled task",
        organizationId: orgId,
        createdById: adminUserId,
        scheduledStart: new Date("2026-06-15T09:00:00.000Z"), // Monday
        scheduledEnd: new Date("2026-06-15T12:00:00.000Z"),
      });

      // No availability set = unavailable

      const results = await eligibilityService.checkEligibilityForTask(
        task.id,
        orgId
      );

      const staffResult = results.find(
        (r) => r.membershipId === staffMembershipId
      );
      expect(staffResult!.eligible).toBe(false);
      expect(staffResult!.checks.availability.eligible).toBe(false);
    });

    it("marks staff eligible when available", async () => {
      // Set Monday availability
      await availRepo.setDayAvailability({
        membershipId: staffMembershipId,
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "18:00",
        isAvailable: true,
      });

      const task = await taskRepo.create({
        title: "Monday task",
        organizationId: orgId,
        createdById: adminUserId,
        scheduledStart: new Date("2026-06-15T09:00:00.000Z"), // Monday
        scheduledEnd: new Date("2026-06-15T12:00:00.000Z"),
      });

      const results = await eligibilityService.checkEligibilityForTask(
        task.id,
        orgId
      );

      const staffResult = results.find(
        (r) => r.membershipId === staffMembershipId
      );
      expect(staffResult!.eligible).toBe(true);
      expect(staffResult!.checks.availability.eligible).toBe(true);
    });

    it("marks staff ineligible with scheduling conflict", async () => {
      // Create first task and assign staff
      const task1 = await taskRepo.create({
        title: "Morning shift",
        organizationId: orgId,
        createdById: adminUserId,
        scheduledStart: new Date("2026-06-15T09:00:00.000Z"),
        scheduledEnd: new Date("2026-06-15T12:00:00.000Z"),
      });

      await prisma.taskAssignment.create({
        data: {
          taskId: task1.id,
          membershipId: staffMembershipId,
          assignedById: adminUserId,
          status: "accepted",
        },
      });

      // Create overlapping task
      const task2 = await taskRepo.create({
        title: "Overlapping task",
        organizationId: orgId,
        createdById: adminUserId,
        scheduledStart: new Date("2026-06-15T10:00:00.000Z"),
        scheduledEnd: new Date("2026-06-15T14:00:00.000Z"),
      });

      const results = await eligibilityService.checkEligibilityForTask(
        task2.id,
        orgId
      );

      const staffResult = results.find(
        (r) => r.membershipId === staffMembershipId
      );
      expect(staffResult!.eligible).toBe(false);
      expect(staffResult!.checks.scheduling.eligible).toBe(false);
    });

    it("throws if task not found", async () => {
      await expect(
        eligibilityService.checkEligibilityForTask("nonexistent", orgId)
      ).rejects.toThrow("Task not found");
    });
  });

  describe("checkHoursLimit", () => {
    it("returns eligible when under limit", async () => {
      const result = await eligibilityService.checkHoursLimit(
        staffMembershipId,
        8
      );
      expect(result.eligible).toBe(true);
    });

    it("returns ineligible when over limit", async () => {
      // Create a completed task with 9 hours worked
      const task = await taskRepo.create({
        title: "Long shift",
        organizationId: orgId,
        createdById: adminUserId,
      });

      const now = new Date();
      const nineHoursAgo = new Date(now.getTime() - 9 * 60 * 60 * 1000);

      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          membershipId: staffMembershipId,
          assignedById: adminUserId,
          status: "completed",
          clockInTime: nineHoursAgo,
          clockOutTime: now,
        },
      });

      const result = await eligibilityService.checkHoursLimit(
        staffMembershipId,
        8
      );
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("limit");
    });
  });

  describe("createOverride", () => {
    it("creates an eligibility override", async () => {
      const task = await taskRepo.create({
        title: "Test task",
        organizationId: orgId,
        createdById: adminUserId,
      });

      const override = await eligibilityService.createOverride(
        task.id,
        staffMembershipId,
        adminUserId,
        "Staff has equivalent experience",
        "certification"
      );

      expect(override.ruleOverridden).toBe("certification");
      expect(override.reason).toBe("Staff has equivalent experience");
    });

    it("override makes staff eligible for blocked rule", async () => {
      const task = await taskRepo.create({
        title: "Test task",
        organizationId: orgId,
        createdById: adminUserId,
        scheduledStart: new Date("2026-06-15T09:00:00.000Z"),
        scheduledEnd: new Date("2026-06-15T12:00:00.000Z"),
      });

      // Staff has no availability = blocked
      let results = await eligibilityService.checkEligibilityForTask(
        task.id,
        orgId
      );
      let staffResult = results.find(
        (r) => r.membershipId === staffMembershipId
      );
      expect(staffResult!.checks.availability.eligible).toBe(false);

      // Create override
      await eligibilityService.createOverride(
        task.id,
        staffMembershipId,
        adminUserId,
        "Manager approved",
        "availability"
      );

      // Check again — availability should now pass
      results = await eligibilityService.checkEligibilityForTask(
        task.id,
        orgId
      );
      staffResult = results.find(
        (r) => r.membershipId === staffMembershipId
      );
      expect(staffResult!.checks.availability.eligible).toBe(true);
      expect(staffResult!.overrides).toContain("availability");
    });
  });
});