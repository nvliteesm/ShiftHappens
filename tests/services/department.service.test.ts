/**
 * Tests for Department Service (Control Layer)
 * Verifies department CRUD business logic including
 * duplicate name prevention and blocked deletion.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DepartmentService } from "@/services/department.service";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const deptService = new DepartmentService();
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

describe("DepartmentService", () => {
  describe("create", () => {
    it("creates a department", async () => {
      const dept = await deptService.create(
        { name: "Engineering", description: "Dev team" },
        orgId
      );

      expect(dept.name).toBe("Engineering");
      expect(dept.description).toBe("Dev team");
      expect(dept.organizationId).toBe(orgId);
    });

    it("throws if department name already exists in org", async () => {
      await deptService.create({ name: "Engineering" }, orgId);

      await expect(
        deptService.create({ name: "Engineering" }, orgId)
      ).rejects.toThrow("Department name already exists");
    });
  });

  describe("getByOrganization", () => {
    it("returns all departments for an org", async () => {
      await deptService.create({ name: "Engineering" }, orgId);
      await deptService.create({ name: "Marketing" }, orgId);

      const depts = await deptService.getByOrganization(orgId);
      expect(depts).toHaveLength(2);
    });
  });

  describe("getById", () => {
    it("returns a department by ID", async () => {
      const created = await deptService.create({ name: "Engineering" }, orgId);

      const found = await deptService.getById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Engineering");
    });
  });

  describe("update", () => {
    it("updates department name", async () => {
      const dept = await deptService.create({ name: "Engineering" }, orgId);

      const updated = await deptService.update(dept.id, orgId, {
        name: "Product Engineering",
      });
      expect(updated.name).toBe("Product Engineering");
    });

    it("throws if new name conflicts with existing department", async () => {
      await deptService.create({ name: "Engineering" }, orgId);
      const dept2 = await deptService.create({ name: "Marketing" }, orgId);

      await expect(
        deptService.update(dept2.id, orgId, { name: "Engineering" })
      ).rejects.toThrow("Department name already exists");
    });

    it("allows updating to the same name (no-op rename)", async () => {
      const dept = await deptService.create({ name: "Engineering" }, orgId);

      const updated = await deptService.update(dept.id, orgId, {
        name: "Engineering",
        description: "Updated desc",
      });
      expect(updated.description).toBe("Updated desc");
    });
  });

  describe("delete", () => {
    it("deletes an empty department", async () => {
      const dept = await deptService.create({ name: "Engineering" }, orgId);

      await deptService.delete(dept.id, orgId);

      const found = await deptService.getById(dept.id);
      expect(found).toBeNull();
    });

    it("throws if department has members", async () => {
      const dept = await deptService.create({ name: "Engineering" }, orgId);

      // Assign the admin to the department
      const membership = await prisma.membership.findFirst({
        where: { organizationId: orgId },
      });
      await prisma.departmentMembership.create({
        data: {
          membershipId: membership!.id,
          departmentId: dept.id,
        },
      });

      await expect(deptService.delete(dept.id, orgId)).rejects.toThrow(
        "Cannot delete department with assigned members"
      );
    });
  });
});