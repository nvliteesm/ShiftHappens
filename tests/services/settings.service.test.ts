/**
 * Tests for Settings Service (Control Layer)
 * Verifies company settings retrieval and updates
 * with lazy initialization via getOrCreate pattern.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SettingsService } from "@/services/settings.service";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";

const settingsService = new SettingsService();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;

beforeEach(async () => {
  await prisma.companySettings.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.invitationToken.deleteMany();
  await prisma.departmentMembership.deleteMany();
  await prisma.department.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const user = await userRepo.create({
    name: "Admin User",
    email: "admin@example.com",
    hashedPassword: "hash",
  });
  const org = await orgRepo.create(
    { name: "Acme Corp", slug: "acme-corp" },
    user.id
  );
  orgId = org.id;
});

describe("SettingsService", () => {
  describe("getSettings", () => {
    it("returns default settings for new org", async () => {
      const settings = await settingsService.getSettings(orgId);

      expect(settings.allocationMode).toBe("manual");
      expect(settings.taskAcceptanceMode).toBe("auto_accept");
      expect(settings.breakRuleHoursWorked).toBe(8);
      expect(settings.breakRuleBreakHours).toBe(1);
    });

    it("returns existing settings if already created", async () => {
      await prisma.companySettings.create({
        data: {
          organizationId: orgId,
          allocationMode: "suggested",
        },
      });

      const settings = await settingsService.getSettings(orgId);
      expect(settings.allocationMode).toBe("suggested");
    });
  });

  describe("updateSettings", () => {
    it("updates allocation mode", async () => {
      const updated = await settingsService.updateSettings(orgId, {
        allocationMode: "auto",
      });
      expect(updated.allocationMode).toBe("auto");
    });

    it("updates task acceptance mode", async () => {
      const updated = await settingsService.updateSettings(orgId, {
        taskAcceptanceMode: "require_acceptance",
      });
      expect(updated.taskAcceptanceMode).toBe("require_acceptance");
    });

    it("updates break rules", async () => {
      const updated = await settingsService.updateSettings(orgId, {
        breakRuleHoursWorked: 6,
        breakRuleBreakHours: 12,
      });
      expect(updated.breakRuleHoursWorked).toBe(6);
      expect(updated.breakRuleBreakHours).toBe(12);
    });

    it("updates notification preferences", async () => {
      const updated = await settingsService.updateSettings(orgId, {
        notificationPreferences: {
          emailNotifications: true,
          taskAssignment: true,
          hourLimitWarning: false,
        },
      });

      const parsed = JSON.parse(updated.notificationPreferences!);
      expect(parsed.emailNotifications).toBe(true);
      expect(parsed.hourLimitWarning).toBe(false);
    });

    it("creates settings if none exist before updating", async () => {
      const updated = await settingsService.updateSettings(orgId, {
        allocationMode: "suggested",
      });

      expect(updated.allocationMode).toBe("suggested");
      expect(updated.taskAcceptanceMode).toBe("auto_accept");
    });
  });
});