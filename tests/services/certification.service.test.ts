/**
 * Tests for Certification Service (Control Layer)
 * Verifies certification submission, verification, and validation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { CertificationService } from "@/services/certification.service";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const certService = new CertificationService();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;
let membershipId: string;
let adminUserId: string;

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
  membershipId = staffMembership.id;
});

describe("CertificationService", () => {
  describe("create", () => {
    it("creates a certification with pending status", async () => {
      const cert = await certService.create(membershipId, {
        name: "Food Safety Level 2",
        issuedDate: "2026-01-15T00:00:00.000Z",
        expiryDate: "2027-01-15T00:00:00.000Z",
      });

      expect(cert.name).toBe("Food Safety Level 2");
      expect(cert.status).toBe("pending");
    });
  });

  describe("updateStatus", () => {
    it("verifies a pending certification", async () => {
      const cert = await certService.create(membershipId, {
        name: "Food Safety",
        issuedDate: "2026-01-15T00:00:00.000Z",
      });

      const verified = await certService.updateStatus(cert.id, orgId, "verified", adminUserId);
      expect(verified.status).toBe("verified");
      expect(verified.verifiedById).toBe(adminUserId);
    });

    it("throws if not pending", async () => {
      const cert = await certService.create(membershipId, {
        name: "Food Safety",
        issuedDate: "2026-01-15T00:00:00.000Z",
      });
      await certService.updateStatus(cert.id, orgId, "verified", adminUserId);

      await expect(
        certService.updateStatus(cert.id, orgId, "rejected", adminUserId)
      ).rejects.toThrow("Can only verify or reject pending");
    });

    it("throws if cert not found", async () => {
      await expect(
        certService.updateStatus("nonexistent", orgId, "verified", adminUserId)
      ).rejects.toThrow("Certification not found");
    });
  });

  describe("getByOrganization", () => {
    it("returns all certs for an org", async () => {
      await certService.create(membershipId, {
        name: "Food Safety",
        issuedDate: "2026-01-15T00:00:00.000Z",
      });
      await certService.create(membershipId, {
        name: "First Aid",
        issuedDate: "2026-02-15T00:00:00.000Z",
      });

      const certs = await certService.getByOrganization(orgId);
      expect(certs).toHaveLength(2);
    });
  });

  describe("delete", () => {
    it("deletes a certification", async () => {
      const cert = await certService.create(membershipId, {
        name: "Food Safety",
        issuedDate: "2026-01-15T00:00:00.000Z",
      });

      await certService.delete(cert.id, orgId);

      const found = await certService.getById(cert.id, orgId);
      expect(found).toBeNull();
    });

    it("throws if not found", async () => {
      await expect(
        certService.delete("nonexistent", orgId)
      ).rejects.toThrow("Certification not found");
    });
  });

  describe("getValidCertifications", () => {
    it("returns only verified non-expired certs", async () => {
      const cert1 = await certService.create(membershipId, {
        name: "Food Safety",
        issuedDate: "2026-01-15T00:00:00.000Z",
        expiryDate: "2028-01-15T00:00:00.000Z",
      });
      await certService.updateStatus(cert1.id, orgId, "verified", adminUserId);

      // Pending cert - should not be included
      await certService.create(membershipId, {
        name: "First Aid",
        issuedDate: "2026-01-15T00:00:00.000Z",
      });

      const valid = await certService.getValidCertifications(membershipId);
      expect(valid).toHaveLength(1);
      expect(valid[0].name).toBe("Food Safety");
    });
  });
});