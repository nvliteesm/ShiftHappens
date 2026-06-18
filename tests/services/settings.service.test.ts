/**
 * Tests for Settings Service (Control Layer)
 *
 * Verifies company settings retrieval, updates, and validation.
 * Uses lazy initialization via getOrCreate pattern.
 *
 * Coverage:
 * - Default settings creation
 * - Individual field updates
 * - Operating hours validation (merged-state, zero-safe, boundaries)
 * - Partial update safety (unchanged fields persist)
 * - Notification preferences serialization
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SettingsService } from "@/services/settings.service";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const settingsService = new SettingsService();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;

beforeEach(async () => {
  await cleanDatabase();

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

    it("returns default operating hours for new org", async () => {
      const settings = await settingsService.getSettings(orgId);

      expect(settings.operatingHoursStart).toBe(6);
      expect(settings.operatingHoursEnd).toBe(22);
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
    describe("basic field updates", () => {
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

    describe("operating hours — valid updates", () => {
      it("updates both start and end together", async () => {
        const updated = await settingsService.updateSettings(orgId, {
          operatingHoursStart: 8,
          operatingHoursEnd: 20,
        });
        expect(updated.operatingHoursStart).toBe(8);
        expect(updated.operatingHoursEnd).toBe(20);
      });

      it("accepts start=0 for midnight opening (zero-safe)", async () => {
        const updated = await settingsService.updateSettings(orgId, {
          operatingHoursStart: 0,
          operatingHoursEnd: 24,
        });
        expect(updated.operatingHoursStart).toBe(0);
        expect(updated.operatingHoursEnd).toBe(24);
      });

      it("accepts full 24-hour range (start=0, end=24)", async () => {
        const updated = await settingsService.updateSettings(orgId, {
          operatingHoursStart: 0,
          operatingHoursEnd: 24,
        });
        expect(updated.operatingHoursEnd - updated.operatingHoursStart).toBe(24);
      });

      it("accepts minimum 1-hour range (start=23, end=24)", async () => {
        const updated = await settingsService.updateSettings(orgId, {
          operatingHoursStart: 23,
          operatingHoursEnd: 24,
        });
        expect(updated.operatingHoursStart).toBe(23);
        expect(updated.operatingHoursEnd).toBe(24);
      });

      it("partial update: only start sent, validates against existing end", async () => {
        // Default end is 22, so start=8 is valid
        const updated = await settingsService.updateSettings(orgId, {
          operatingHoursStart: 8,
        });
        expect(updated.operatingHoursStart).toBe(8);
        expect(updated.operatingHoursEnd).toBe(22); // unchanged
      });

      it("partial update: only end sent, validates against existing start", async () => {
        // Default start is 6, so end=20 is valid
        const updated = await settingsService.updateSettings(orgId, {
          operatingHoursEnd: 20,
        });
        expect(updated.operatingHoursStart).toBe(6); // unchanged
        expect(updated.operatingHoursEnd).toBe(20);
      });
    });

    describe("operating hours — invalid updates", () => {
      it("throws when end is less than start", async () => {
        await expect(
          settingsService.updateSettings(orgId, {
            operatingHoursStart: 22,
            operatingHoursEnd: 10,
          })
        ).rejects.toThrow("Operating hours end must be after start");
      });

      it("throws when end equals start (zero-hour window)", async () => {
        await expect(
          settingsService.updateSettings(orgId, {
            operatingHoursStart: 12,
            operatingHoursEnd: 12,
          })
        ).rejects.toThrow("Operating hours end must be after start");
      });

      it("throws on partial update: only start sent, exceeds existing end", async () => {
        // Default end is 22, sending start=22 creates end <= start
        await expect(
          settingsService.updateSettings(orgId, {
            operatingHoursStart: 22,
          })
        ).rejects.toThrow("Operating hours end must be after start");
      });

      it("throws on partial update: only end sent, below existing start", async () => {
        // Default start is 6, sending end=5 creates end <= start
        await expect(
          settingsService.updateSettings(orgId, {
            operatingHoursEnd: 5,
          })
        ).rejects.toThrow("Operating hours end must be after start");
      });

      it("throws on partial update: only start sent, equals existing end", async () => {
        // First set end to 15
        await settingsService.updateSettings(orgId, {
          operatingHoursEnd: 15,
        });
        // Then try to set start=15 (equals end)
        await expect(
          settingsService.updateSettings(orgId, {
            operatingHoursStart: 15,
          })
        ).rejects.toThrow("Operating hours end must be after start");
      });
    });

    describe("partial update safety", () => {
      it("updating one field does not clear other fields", async () => {
        // Set all fields
        await settingsService.updateSettings(orgId, {
          allocationMode: "suggested",
          taskAcceptanceMode: "require_acceptance",
          breakRuleHoursWorked: 10,
          breakRuleBreakHours: 2,
          operatingHoursStart: 7,
          operatingHoursEnd: 23,
        });

        // Update only allocation mode
        const updated = await settingsService.updateSettings(orgId, {
          allocationMode: "auto",
        });

        // All other fields should remain unchanged
        expect(updated.allocationMode).toBe("auto");
        expect(updated.taskAcceptanceMode).toBe("require_acceptance");
        expect(updated.breakRuleHoursWorked).toBe(10);
        expect(updated.breakRuleBreakHours).toBe(2);
        expect(updated.operatingHoursStart).toBe(7);
        expect(updated.operatingHoursEnd).toBe(23);
      });

      it("empty update object does not change any values", async () => {
        const before = await settingsService.getSettings(orgId);
        const after = await settingsService.updateSettings(orgId, {});

        expect(after.allocationMode).toBe(before.allocationMode);
        expect(after.breakRuleHoursWorked).toBe(before.breakRuleHoursWorked);
        expect(after.operatingHoursStart).toBe(before.operatingHoursStart);
        expect(after.operatingHoursEnd).toBe(before.operatingHoursEnd);
      });
    });
  });
});