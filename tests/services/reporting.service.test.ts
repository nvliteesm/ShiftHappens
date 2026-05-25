/**
 * Tests for Reporting Service (Control Layer)
 * Verifies dashboard reporting data aggregation including
 * completion trends, staff utilization, department workload,
 * and hours summary.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ReportingService } from "@/services/reporting.service";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { DepartmentRepository } from "@/repositories/department.repository";
import { UserRepository } from "@/repositories/user.repository";
import { TaskRepository } from "@/repositories/task.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const reportingService = new ReportingService();
const orgRepo = new OrganizationRepository();
const deptRepo = new DepartmentRepository();
const userRepo = new UserRepository();
const taskRepo = new TaskRepository();

let orgId: string;
let userId: string;
let staffMembershipId: string;
let deptId: string;

beforeEach(async () => {
  await cleanDatabase();

  const user = await userRepo.create({
    name: "Admin",
    email: "admin@example.com",
    hashedPassword: "hash",
  });
  userId = user.id;

  const org = await orgRepo.create(
    { name: "Test Org", slug: "test-org" },
    user.id
  );
  orgId = org.id;

  // Create company settings
  await prisma.companySettings.create({
    data: {
      organizationId: orgId,
      breakRuleHoursWorked: 8,
    },
  });

  // Create department
  const dept = await deptRepo.create({
    name: "Kitchen",
    organizationId: orgId,
    color: "#EF4444",
  });
  deptId = dept.id;

  // Create staff member
  const staffUser = await userRepo.create({
    name: "Staff User",
    email: "staff@example.com",
    hashedPassword: "hash",
  });

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

describe("ReportingService", () => {
  describe("getDashboardReports", () => {
    it("returns all four report sections", async () => {
      const reports = await reportingService.getDashboardReports(orgId);

      expect(reports).toHaveProperty("completionTrend");
      expect(reports).toHaveProperty("staffUtilization");
      expect(reports).toHaveProperty("departmentWorkload");
      expect(reports).toHaveProperty("hoursSummary");
    });

    it("returns 7 days in completion trend", async () => {
      const reports = await reportingService.getDashboardReports(orgId);

      expect(reports.completionTrend).toHaveLength(7);
      expect(reports.completionTrend[0]).toHaveProperty("date");
      expect(reports.completionTrend[0]).toHaveProperty("label");
      expect(reports.completionTrend[0]).toHaveProperty("completed");
    });

    it("counts completed tasks in completion trend", async () => {
      // Create a task and complete it today
      const task = await taskRepo.create({
        title: "Test task",
        organizationId: orgId,
        departmentId: deptId,
        createdById: userId,
      });

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          membershipId: staffMembershipId,
          assignedById: userId,
          status: "completed",
          clockInTime: twoHoursAgo,
          clockOutTime: now,
        },
      });

      const reports = await reportingService.getDashboardReports(orgId);

      // Last entry (today) should have 1 completed
      const today = reports.completionTrend[reports.completionTrend.length - 1];
      expect(today.completed).toBe(1);
    });

    it("calculates staff utilization from clock data", async () => {
      const task = await taskRepo.create({
        title: "Test task",
        organizationId: orgId,
        createdById: userId,
      });

      const now = new Date();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          membershipId: staffMembershipId,
          assignedById: userId,
          status: "completed",
          clockInTime: fourHoursAgo,
          clockOutTime: now,
        },
      });

      const reports = await reportingService.getDashboardReports(orgId);

      const staffUtil = reports.staffUtilization.find(
        (s) => s.name === "Staff User"
      );
      expect(staffUtil).toBeDefined();
      expect(staffUtil!.hoursWorked).toBeGreaterThan(3.5);
      expect(staffUtil!.hoursWorked).toBeLessThan(4.5);
      expect(staffUtil!.percentage).toBeGreaterThan(0);
    });

    it("returns department workload with colors", async () => {
      await taskRepo.create({
        title: "Kitchen task 1",
        organizationId: orgId,
        departmentId: deptId,
        createdById: userId,
      });
      await taskRepo.create({
        title: "Kitchen task 2",
        organizationId: orgId,
        departmentId: deptId,
        createdById: userId,
      });

      const reports = await reportingService.getDashboardReports(orgId);

      const kitchen = reports.departmentWorkload.find(
        (d) => d.name === "Kitchen"
      );
      expect(kitchen).toBeDefined();
      expect(kitchen!.taskCount).toBe(2);
      expect(kitchen!.color).toBe("#EF4444");
    });

    it("calculates hours summary", async () => {
      const task = await taskRepo.create({
        title: "Test task",
        organizationId: orgId,
        createdById: userId,
      });

      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          membershipId: staffMembershipId,
          assignedById: userId,
          status: "completed",
          clockInTime: threeHoursAgo,
          clockOutTime: now,
        },
      });

      const reports = await reportingService.getDashboardReports(orgId);

      expect(reports.hoursSummary.totalLogged).toBeGreaterThan(2.5);
      expect(reports.hoursSummary.totalCapacity).toBeGreaterThan(0);
      expect(reports.hoursSummary.percentage).toBeGreaterThan(0);
    });

    it("handles empty data gracefully", async () => {
      const reports = await reportingService.getDashboardReports(orgId);

      expect(reports.completionTrend).toHaveLength(7);
      expect(reports.completionTrend.every((d) => d.completed === 0)).toBe(true);
      expect(reports.staffUtilization.length).toBeGreaterThanOrEqual(0);
      expect(reports.hoursSummary.totalLogged).toBe(0);
    });
  });
});