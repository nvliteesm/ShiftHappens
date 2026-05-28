/**
 * Tests for Platform Repository (Entity Layer)
 * Verifies cross-organization queries for platform admin.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PlatformRepository } from "@/repositories/platform.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { cleanDatabase } from "../helpers/cleanup";

const platformRepo = new PlatformRepository();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let userId: string;

beforeEach(async () => {
  await cleanDatabase();

  const user = await userRepo.create({
    name: "Admin",
    email: "admin@example.com",
    hashedPassword: "hash",
  });
  userId = user.id;
});

describe("PlatformRepository", () => {
  describe("findAllOrganizations", () => {
    it("returns all organizations with counts", async () => {
      await orgRepo.create({ name: "Org A", slug: "org-a" }, userId);
      await orgRepo.create({ name: "Org B", slug: "org-b" }, userId);

      const orgs = await platformRepo.findAllOrganizations();
      expect(orgs).toHaveLength(2);
      expect(orgs[0]._count).toBeDefined();
      expect(orgs[0]._count.memberships).toBeGreaterThanOrEqual(0);
      expect(orgs[0]._count.tasks).toBeGreaterThanOrEqual(0);
    });

    it("returns empty array when no organizations exist", async () => {
      const orgs = await platformRepo.findAllOrganizations();
      expect(orgs).toHaveLength(0);
    });

    it("supports pagination", async () => {
      await orgRepo.create({ name: "Org A", slug: "org-a" }, userId);
      await orgRepo.create({ name: "Org B", slug: "org-b" }, userId);
      await orgRepo.create({ name: "Org C", slug: "org-c" }, userId);

      const page1 = await platformRepo.findAllOrganizations(2, 0);
      expect(page1).toHaveLength(2);

      const page2 = await platformRepo.findAllOrganizations(2, 2);
      expect(page2).toHaveLength(1);
    });
  });

  describe("countOrganizations", () => {
    it("returns the total count", async () => {
      await orgRepo.create({ name: "Org A", slug: "org-a" }, userId);
      await orgRepo.create({ name: "Org B", slug: "org-b" }, userId);

      const count = await platformRepo.countOrganizations();
      expect(count).toBe(2);
    });
  });

  describe("findOrganizationById", () => {
    it("returns organization with counts", async () => {
      const org = await orgRepo.create({ name: "Org A", slug: "org-a" }, userId);

      const found = await platformRepo.findOrganizationById(org.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Org A");
      expect(found!._count.departments).toBeDefined();
    });

    it("returns null for non-existent org", async () => {
      const found = await platformRepo.findOrganizationById("nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("updateOrganizationStatus", () => {
    it("updates status to suspended", async () => {
      const org = await orgRepo.create({ name: "Org A", slug: "org-a" }, userId);

      const updated = await platformRepo.updateOrganizationStatus(org.id, "suspended");
      expect(updated.status).toBe("suspended");
    });

    it("updates status back to active", async () => {
      const org = await orgRepo.create({ name: "Org A", slug: "org-a" }, userId);
      await platformRepo.updateOrganizationStatus(org.id, "suspended");

      const updated = await platformRepo.updateOrganizationStatus(org.id, "active");
      expect(updated.status).toBe("active");
    });
  });

  describe("getStats", () => {
    it("returns platform-wide statistics", async () => {
      await orgRepo.create({ name: "Org A", slug: "org-a" }, userId);
      await orgRepo.create({ name: "Org B", slug: "org-b" }, userId);

      const stats = await platformRepo.getStats();
      expect(stats.totalOrganizations).toBe(2);
      expect(stats.activeOrganizations).toBe(2);
      expect(stats.totalUsers).toBeGreaterThanOrEqual(1);
      expect(stats.totalTasks).toBeGreaterThanOrEqual(0);
    });
  });
});