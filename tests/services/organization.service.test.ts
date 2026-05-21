/**
 * Tests for Organization Service (Control Layer)
 * Verifies org creation with slug generation and
 * retrieval of user's organizations.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { OrganizationService } from "@/services/organization.service";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";

const orgService = new OrganizationService();
const userRepo = new UserRepository();

beforeEach(async () => {
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
});

describe("OrganizationService", () => {
  describe("create", () => {
    it("creates an organization with a slug", async () => {
      const user = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hash",
      });

      const org = await orgService.create(
        { name: "Acme Corp", industry: "Technology" },
        user.id
      );

      expect(org.name).toBe("Acme Corp");
      expect(org.slug).toBe("acme-corp");
      expect(org.industry).toBe("Technology");
    });

    it("generates unique slugs for duplicate names", async () => {
      const user = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hash",
      });

      const org1 = await orgService.create({ name: "Acme Corp" }, user.id);
      const org2 = await orgService.create({ name: "Acme Corp" }, user.id);

      expect(org1.slug).toBe("acme-corp");
      expect(org2.slug).toMatch(/^acme-corp-/);
      expect(org2.slug).not.toBe(org1.slug);
    });

    it("makes the creator a company_admin", async () => {
      const user = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hash",
      });

      const org = await orgService.create({ name: "Acme Corp" }, user.id);

      expect(org.memberships[0].role).toBe("company_admin");
      expect(org.memberships[0].userId).toBe(user.id);
    });
  });

  describe("getUserOrganizations", () => {
    it("returns all organizations for a user", async () => {
      const user = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hash",
      });

      await orgService.create({ name: "Org A" }, user.id);
      await orgService.create({ name: "Org B" }, user.id);

      const orgs = await orgService.getUserOrganizations(user.id);
      expect(orgs).toHaveLength(2);
    });
  });
});