/**
 * Tests for Role Repository (Entity Layer)
 * Verifies role CRUD operations with permission assignments
 * and org-scoped queries against a real PostgreSQL database.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { RoleRepository } from "@/repositories/role.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";

const roleRepo = new RoleRepository();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;
let permissionIds: string[];

beforeEach(async () => {
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

  // Get some permission IDs for testing
  const permissions = await prisma.permission.findMany({ take: 5 });
  permissionIds = permissions.map((p) => p.id);
});

describe("RoleRepository", () => {
  describe("create", () => {
    it("creates a role with permissions", async () => {
      const role = await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        description: "Leads a shift",
        organizationId: orgId,
        permissionIds: permissionIds.slice(0, 3),
      });

      expect(role.id).toBeDefined();
      expect(role.name).toBe("shift_lead");
      expect(role.displayLabel).toBe("Shift Lead");
      expect(role.rolePermissions).toHaveLength(3);
    });

    it("creates a role without description", async () => {
      const role = await roleRepo.create({
        name: "basic_staff",
        displayLabel: "Basic Staff",
        organizationId: orgId,
        permissionIds: [permissionIds[0]],
      });

      expect(role.name).toBe("basic_staff");
      expect(role.description).toBeNull();
    });
  });

  describe("findById", () => {
    it("finds a role by ID with permissions", async () => {
      const created = await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: orgId,
        permissionIds: permissionIds.slice(0, 2),
      });

      const found = await roleRepo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("shift_lead");
      expect(found!.rolePermissions).toHaveLength(2);
      expect(found!.rolePermissions[0].permission).toBeDefined();
    });

    it("returns null for non-existent ID", async () => {
      const found = await roleRepo.findById("nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("findByOrganizationId", () => {
    it("returns all roles for an organization", async () => {
      await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: orgId,
        permissionIds: [permissionIds[0]],
      });
      await roleRepo.create({
        name: "senior_staff",
        displayLabel: "Senior Staff",
        organizationId: orgId,
        permissionIds: [permissionIds[1]],
      });

      const roles = await roleRepo.findByOrganizationId(orgId);
      expect(roles).toHaveLength(2);
    });

    it("does not return roles from other organizations", async () => {
      const user2 = await userRepo.create({
        name: "Other Admin",
        email: "other@example.com",
        hashedPassword: "hash",
      });
      const org2 = await orgRepo.create(
        { name: "Other Corp", slug: "other-corp" },
        user2.id
      );

      await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: orgId,
        permissionIds: [permissionIds[0]],
      });
      await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: org2.id,
        permissionIds: [permissionIds[0]],
      });

      const roles = await roleRepo.findByOrganizationId(orgId);
      expect(roles).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("updates display label and description", async () => {
      const role = await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: orgId,
        permissionIds: [permissionIds[0]],
      });

      const updated = await roleRepo.update(role.id, {
        displayLabel: "Senior Shift Lead",
        description: "Updated description",
      });

      expect(updated.displayLabel).toBe("Senior Shift Lead");
      expect(updated.description).toBe("Updated description");
    });

    it("updates permissions by replacing them", async () => {
      const role = await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: orgId,
        permissionIds: permissionIds.slice(0, 2),
      });

      const updated = await roleRepo.update(role.id, {
        permissionIds: permissionIds.slice(2, 5),
      });

      expect(updated.rolePermissions).toHaveLength(3);
    });
  });

  describe("delete", () => {
    it("deletes a role and its permissions", async () => {
      const role = await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: orgId,
        permissionIds: permissionIds.slice(0, 3),
      });

      await roleRepo.delete(role.id);

      const found = await roleRepo.findById(role.id);
      expect(found).toBeNull();

      // Verify role permissions were cascade deleted
      const rolePerms = await prisma.rolePermission.findMany({
        where: { roleId: role.id },
      });
      expect(rolePerms).toHaveLength(0);
    });
  });

  describe("nameExistsInOrg", () => {
    it("returns true when name exists", async () => {
      await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: orgId,
        permissionIds: [permissionIds[0]],
      });

      const exists = await roleRepo.nameExistsInOrg("shift_lead", orgId);
      expect(exists).toBe(true);
    });

    it("returns false when name does not exist", async () => {
      const exists = await roleRepo.nameExistsInOrg("nonexistent", orgId);
      expect(exists).toBe(false);
    });

    it("excludes a specific role ID from the check", async () => {
      const role = await roleRepo.create({
        name: "shift_lead",
        displayLabel: "Shift Lead",
        organizationId: orgId,
        permissionIds: [permissionIds[0]],
      });

      const exists = await roleRepo.nameExistsInOrg("shift_lead", orgId, role.id);
      expect(exists).toBe(false);
    });
  });
});