/**
 * Tests for Department Repository (Entity Layer)
 * Verifies department CRUD operations with org-scoped queries
 * against a real PostgreSQL database.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DepartmentRepository } from "@/repositories/department.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const deptRepo = new DepartmentRepository();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;

beforeEach(async () => {
  await cleanDatabase();

  // Create a user and org for all tests to use
  const user = await userRepo.create({
    name: "John Doe",
    email: "john@example.com",
    hashedPassword: "hash",
  });
  const org = await orgRepo.create(
    { name: "Acme Corp", slug: "acme-corp" },
    user.id
  );
  orgId = org.id;
});

describe("DepartmentRepository", () => {
  describe("create", () => {
    it("creates a department within an organization", async () => {
      const dept = await deptRepo.create({
        name: "Engineering",
        description: "The engineering team",
        organizationId: orgId,
      });

      expect(dept.id).toBeDefined();
      expect(dept.name).toBe("Engineering");
      expect(dept.description).toBe("The engineering team");
      expect(dept.organizationId).toBe(orgId);
    });

    it("allows same department name in different organizations", async () => {
      const user2 = await userRepo.create({
        name: "Jane Doe",
        email: "jane@example.com",
        hashedPassword: "hash",
      });
      const org2 = await orgRepo.create(
        { name: "Other Corp", slug: "other-corp" },
        user2.id
      );

      await deptRepo.create({ name: "Engineering", organizationId: orgId });
      const dept2 = await deptRepo.create({ name: "Engineering", organizationId: org2.id });

      expect(dept2.name).toBe("Engineering");
    });
  });

  describe("findById", () => {
    it("finds a department by ID", async () => {
      const created = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });

      const found = await deptRepo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Engineering");
    });

    it("returns null for non-existent ID", async () => {
      const found = await deptRepo.findById("nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("findByOrganizationId", () => {
    it("returns all departments for an organization", async () => {
      await deptRepo.create({ name: "Engineering", organizationId: orgId });
      await deptRepo.create({ name: "Marketing", organizationId: orgId });
      await deptRepo.create({ name: "Sales", organizationId: orgId });

      const depts = await deptRepo.findByOrganizationId(orgId);
      expect(depts).toHaveLength(3);
    });

    it("returns empty array for org with no departments", async () => {
      const depts = await deptRepo.findByOrganizationId(orgId);
      expect(depts).toHaveLength(0);
    });

    it("does not return departments from other organizations", async () => {
      const user2 = await userRepo.create({
        name: "Jane Doe",
        email: "jane@example.com",
        hashedPassword: "hash",
      });
      const org2 = await orgRepo.create(
        { name: "Other Corp", slug: "other-corp" },
        user2.id
      );

      await deptRepo.create({ name: "Engineering", organizationId: orgId });
      await deptRepo.create({ name: "Marketing", organizationId: org2.id });

      const depts = await deptRepo.findByOrganizationId(orgId);
      expect(depts).toHaveLength(1);
      expect(depts[0].name).toBe("Engineering");
    });
  });

  describe("update", () => {
    it("updates department name", async () => {
      const dept = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });

      const updated = await deptRepo.update(dept.id, { name: "Product Engineering" });
      expect(updated.name).toBe("Product Engineering");
    });

    it("updates department description", async () => {
      const dept = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });

      const updated = await deptRepo.update(dept.id, { description: "Updated description" });
      expect(updated.description).toBe("Updated description");
    });
  });

  describe("delete", () => {
    it("deletes a department", async () => {
      const dept = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });

      await deptRepo.delete(dept.id);

      const found = await deptRepo.findById(dept.id);
      expect(found).toBeNull();
    });
  });

  describe("hasMembers", () => {
    it("returns false for empty department", async () => {
      const dept = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });

      const result = await deptRepo.hasMembers(dept.id);
      expect(result).toBe(false);
    });

    it("returns true when department has members", async () => {
      const dept = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });

      // Get the membership created during org setup (company_admin)
      const membership = await prisma.membership.findFirst({
        where: { organizationId: orgId },
      });

      // Assign the user to the department
      await prisma.departmentMembership.create({
        data: {
          membershipId: membership!.id,
          departmentId: dept.id,
        },
      });

      const result = await deptRepo.hasMembers(dept.id);
      expect(result).toBe(true);
    });
  });

  describe("nameExistsInOrg", () => {
    it("returns true when name already exists in org", async () => {
      await deptRepo.create({ name: "Engineering", organizationId: orgId });

      const exists = await deptRepo.nameExistsInOrg("Engineering", orgId);
      expect(exists).toBe(true);
    });

    it("returns false when name does not exist in org", async () => {
      const exists = await deptRepo.nameExistsInOrg("Engineering", orgId);
      expect(exists).toBe(false);
    });

    it("excludes a specific department ID from the check", async () => {
      const dept = await deptRepo.create({ name: "Engineering", organizationId: orgId });

      // Should return false because we're excluding the department itself
      const exists = await deptRepo.nameExistsInOrg("Engineering", orgId, dept.id);
      expect(exists).toBe(false);
    });
  });
});