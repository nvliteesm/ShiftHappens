/**
 * Tests for ReportingService — Calendar Methods
 *
 * Tests the calendar-specific methods: getCalendarCoverage
 * and getAllStaffSchedules. Covers coverage computation,
 * org isolation, empty states, boundary hours, and role filtering.
 *
 * These tests complement the main reporting.service.test.ts
 * which covers dashboard metrics. This file focuses on the
 * calendar heatmap and day-view staff panel data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ReportingService } from "@/services/reporting.service";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const reportingService = new ReportingService();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;
let otherOrgId: string;

async function createStaffWithAvailability(
  email: string,
  targetOrgId: string,
  schedules: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[]
) {
  const user = await userRepo.create({
    name: email.split("@")[0],
    email,
    hashedPassword: "hash",
  });
  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: targetOrgId,
      role: "staff",
      status: "active",
    },
  });
  for (const s of schedules) {
    await prisma.availability.create({
      data: {
        membershipId: membership.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isAvailable: s.isAvailable,
      },
    });
  }
  return { user, membership };
}

beforeEach(async () => {
  await cleanDatabase();

  const admin = await userRepo.create({
    name: "Admin",
    email: "admin@example.com",
    hashedPassword: "hash",
  });
  const org = await orgRepo.create({ name: "Test Org", slug: "test-org" }, admin.id);
  orgId = org.id;

  const admin2 = await userRepo.create({
    name: "Other Admin",
    email: "admin2@example.com",
    hashedPassword: "hash",
  });
  const org2 = await orgRepo.create({ name: "Other Org", slug: "other-org" }, admin2.id);
  otherOrgId = org2.id;
});

describe("ReportingService — Calendar methods", () => {
  describe("getCalendarCoverage", () => {
    it("returns all-zero matrix when no staff have availability", async () => {
      const coverage = await reportingService.getCalendarCoverage(orgId);

      expect(coverage.length).toBeGreaterThan(0);
      expect(coverage.every((c) => c.count === 0)).toBe(true);
    });

    it("counts staff available during a specific hour", async () => {
      await createStaffWithAvailability("alice@test.com", orgId, [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      ]);
      await createStaffWithAvailability("bob@test.com", orgId, [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      ]);

      const coverage = await reportingService.getCalendarCoverage(orgId);
      const mondayNine = coverage.find((c) => c.dayOfWeek === 1 && c.hour === 9);

      expect(mondayNine?.count).toBe(2);
    });

    it("does not count staff marked isAvailable=false", async () => {
      await createStaffWithAvailability("alice@test.com", orgId, [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: false },
      ]);

      const coverage = await reportingService.getCalendarCoverage(orgId);
      const mondayNine = coverage.find((c) => c.dayOfWeek === 1 && c.hour === 9);

      expect(mondayNine?.count).toBe(0);
    });

    it("counts coverage at boundary hours (hour 0 and hour 23)", async () => {
      await createStaffWithAvailability("nightowl@test.com", orgId, [
        { dayOfWeek: 4, startTime: "00:00", endTime: "06:00", isAvailable: true },
        { dayOfWeek: 5, startTime: "23:00", endTime: "24:00", isAvailable: true },
      ]);

      const coverage = await reportingService.getCalendarCoverage(orgId);
      const thursdayMidnight = coverage.find((c) => c.dayOfWeek === 4 && c.hour === 0);
      const fridayLateNight = coverage.find((c) => c.dayOfWeek === 5 && c.hour === 23);

      expect(thursdayMidnight?.count).toBe(1);
      expect(fridayLateNight?.count).toBe(1);
    });

    it("counts different staff separately on the same day and hour", async () => {
      await createStaffWithAvailability("alice@test.com", orgId, [
        { dayOfWeek: 2, startTime: "08:00", endTime: "16:00", isAvailable: true },
      ]);
      await createStaffWithAvailability("bob@test.com", orgId, [
        { dayOfWeek: 2, startTime: "10:00", endTime: "14:00", isAvailable: true },
      ]);

      const coverage = await reportingService.getCalendarCoverage(orgId);
      const tuesdayEleven = coverage.find((c) => c.dayOfWeek === 2 && c.hour === 11);
      const tuesdayNine = coverage.find((c) => c.dayOfWeek === 2 && c.hour === 9);

      expect(tuesdayEleven?.count).toBe(2); // both available
      expect(tuesdayNine?.count).toBe(1);   // only Alice
    });

    it("enforces org isolation — does not count staff from other orgs", async () => {
      await createStaffWithAvailability("other@test.com", otherOrgId, [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      ]);

      const coverage = await reportingService.getCalendarCoverage(orgId);
      const mondayNine = coverage.find((c) => c.dayOfWeek === 1 && c.hour === 9);

      expect(mondayNine?.count).toBe(0);
    });

    it("does not count hours outside availability window", async () => {
      await createStaffWithAvailability("alice@test.com", orgId, [
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isAvailable: true },
      ]);

      const coverage = await reportingService.getCalendarCoverage(orgId);
      const wedEight = coverage.find((c) => c.dayOfWeek === 3 && c.hour === 8);
      const wedSeventeen = coverage.find((c) => c.dayOfWeek === 3 && c.hour === 17);
      const wedNine = coverage.find((c) => c.dayOfWeek === 3 && c.hour === 9);

      expect(wedEight?.count).toBe(0);     // before availability
      expect(wedSeventeen?.count).toBe(0); // after availability ends
      expect(wedNine?.count).toBe(1);      // within availability
    });

    it("counts all 24 hours for staff available 00:00-24:00", async () => {
      await createStaffWithAvailability("allday@test.com", orgId, [
        { dayOfWeek: 3, startTime: "00:00", endTime: "24:00", isAvailable: true },
      ]);

      const coverage = await reportingService.getCalendarCoverage(orgId);
      const wednesdayCoverage = coverage.filter(
        (c) => c.dayOfWeek === 3 && c.count > 0
      );

      expect(wednesdayCoverage).toHaveLength(24);
      expect(wednesdayCoverage.every((c) => c.count === 1)).toBe(true);
    });
  });

  describe("getAllStaffSchedules", () => {
    it("returns empty array for org with no staff availability", async () => {
      const schedules = await reportingService.getAllStaffSchedules(orgId);
      expect(schedules).toEqual([]);
    });

    it("groups availability records by staff member", async () => {
      await createStaffWithAvailability("alice@test.com", orgId, [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
        { dayOfWeek: 2, startTime: "08:00", endTime: "16:00", isAvailable: true },
        { dayOfWeek: 3, startTime: "10:00", endTime: "18:00", isAvailable: true },
      ]);

      const schedules = await reportingService.getAllStaffSchedules(orgId);

      expect(schedules).toHaveLength(1);
      expect(schedules[0].name).toBe("alice");
      expect(schedules[0].schedules).toHaveLength(3);
    });

    it("returns multiple staff members separately", async () => {
      await createStaffWithAvailability("alice@test.com", orgId, [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      ]);
      await createStaffWithAvailability("bob@test.com", orgId, [
        { dayOfWeek: 1, startTime: "10:00", endTime: "18:00", isAvailable: true },
      ]);

      const schedules = await reportingService.getAllStaffSchedules(orgId);
      expect(schedules).toHaveLength(2);
    });

    it("uses name, falls back to email when name is null", async () => {
      const user = await prisma.user.create({
        data: { name: null, email: "noname@test.com", hashedPassword: "hash" },
      });
      const membership = await prisma.membership.create({
        data: { userId: user.id, organizationId: orgId, role: "staff", status: "active" },
      });
      await prisma.availability.create({
        data: { membershipId: membership.id, dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      });

      const schedules = await reportingService.getAllStaffSchedules(orgId);
      expect(schedules[0].name).toBe("noname@test.com");
    });

    it("enforces org isolation — only returns staff from requesting org", async () => {
      await createStaffWithAvailability("ours@test.com", orgId, [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      ]);
      await createStaffWithAvailability("theirs@test.com", otherOrgId, [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      ]);

      const schedules = await reportingService.getAllStaffSchedules(orgId);
      expect(schedules).toHaveLength(1);
      expect(schedules[0].name).toBe("ours");
    });

    it("excludes inactive members", async () => {
      const user = await userRepo.create({
        name: "Inactive",
        email: "inactive@test.com",
        hashedPassword: "hash",
      });
      const membership = await prisma.membership.create({
        data: { userId: user.id, organizationId: orgId, role: "staff", status: "inactive" },
      });
      await prisma.availability.create({
        data: { membershipId: membership.id, dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      });

      const schedules = await reportingService.getAllStaffSchedules(orgId);
      expect(schedules).toHaveLength(0);
    });

    it("includes managers but excludes company_admin", async () => {
      const mgrUser = await userRepo.create({
        name: "Manager",
        email: "mgr@test.com",
        hashedPassword: "hash",
      });
      const mgrMembership = await prisma.membership.create({
        data: { userId: mgrUser.id, organizationId: orgId, role: "manager", status: "active" },
      });
      await prisma.availability.create({
        data: { membershipId: mgrMembership.id, dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isAvailable: true },
      });

      const schedules = await reportingService.getAllStaffSchedules(orgId);
      const names = schedules.map((s) => s.name);
      expect(names).toContain("Manager");
      expect(names).not.toContain("Admin");
    });
  });
});