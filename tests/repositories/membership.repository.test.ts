/**
 * Tests for Membership Repository (Entity Layer)
 * Verifies org membership operations including role updates,
 * department assignments, and user status management.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { MembershipRepository } from "@/repositories/membership.repository";
import { DepartmentRepository } from "@/repositories/department.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const membershipRepo = new MembershipRepository();
const deptRepo = new DepartmentRepository();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;
let adminUserId: string;

beforeEach(async () => {
  await cleanDatabase();

  const user = await userRepo.create({
    name: "Admin User",
    email: "admin@example.com",
    hashedPassword: "hash",
  });
  adminUserId = user.id;

  const org = await orgRepo.create(
    { name: "Acme Corp", slug: "acme-corp" },
    user.id
  );
  orgId = org.id;
});

describe("MembershipRepository", () => {
  describe("findByOrgId", () => {
    it("returns all members of an organization", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });

      await membershipRepo.create({
        userId: user2.id,
        organizationId: orgId,
        role: "staff",
      });

      const members = await membershipRepo.findByOrgId(orgId);
      expect(members).toHaveLength(2);
    });

    it("does not return members from other organizations", async () => {
      const user2 = await userRepo.create({
        name: "Other User",
        email: "other@example.com",
        hashedPassword: "hash",
      });
      const org2 = await orgRepo.create(
        { name: "Other Corp", slug: "other-corp" },
        user2.id
      );

      const members = await membershipRepo.findByOrgId(orgId);
      expect(members).toHaveLength(1);
    });
  });

  describe("findByUserAndOrg", () => {
    it("finds a specific user's membership in an org", async () => {
      const membership = await membershipRepo.findByUserAndOrg(
        adminUserId,
        orgId
      );

      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("company_admin");
    });

    it("returns null for non-member", async () => {
      const user2 = await userRepo.create({
        name: "Outsider",
        email: "outsider@example.com",
        hashedPassword: "hash",
      });

      const membership = await membershipRepo.findByUserAndOrg(
        user2.id,
        orgId
      );
      expect(membership).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a new membership", async () => {
      const user2 = await userRepo.create({
        name: "New Staff",
        email: "newstaff@example.com",
        hashedPassword: "hash",
      });

      const membership = await membershipRepo.create({
        userId: user2.id,
        organizationId: orgId,
        role: "staff",
      });

      expect(membership.id).toBeDefined();
      expect(membership.role).toBe("staff");
      expect(membership.status).toBe("active");
    });
  });

  describe("updateRole", () => {
    it("updates a member's role", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });

      const membership = await membershipRepo.create({
        userId: user2.id,
        organizationId: orgId,
        role: "staff",
      });

      const updated = await membershipRepo.updateRole(
        membership.id,
        "manager"
      );
      expect(updated.role).toBe("manager");
    });
  });

  describe("updateStatus", () => {
    it("deactivates a member", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });

      const membership = await membershipRepo.create({
        userId: user2.id,
        organizationId: orgId,
        role: "staff",
      });

      const updated = await membershipRepo.updateStatus(
        membership.id,
        "inactive"
      );
      expect(updated.status).toBe("inactive");
    });

    it("reactivates a member", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });

      const membership = await membershipRepo.create({
        userId: user2.id,
        organizationId: orgId,
        role: "staff",
      });

      await membershipRepo.updateStatus(membership.id, "inactive");
      const reactivated = await membershipRepo.updateStatus(
        membership.id,
        "active"
      );
      expect(reactivated.status).toBe("active");
    });
  });

  describe("assignDepartments", () => {
    it("assigns a member to departments", async () => {
      const dept1 = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });
      const dept2 = await deptRepo.create({
        name: "Marketing",
        organizationId: orgId,
      });

      const membership = await prisma.membership.findFirst({
        where: { userId: adminUserId, organizationId: orgId },
      });

      await membershipRepo.assignDepartments(membership!.id, [
        dept1.id,
        dept2.id,
      ]);

      const deptMemberships = await prisma.departmentMembership.findMany({
        where: { membershipId: membership!.id },
      });
      expect(deptMemberships).toHaveLength(2);
    });

    it("replaces existing department assignments", async () => {
      const dept1 = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });
      const dept2 = await deptRepo.create({
        name: "Marketing",
        organizationId: orgId,
      });
      const dept3 = await deptRepo.create({
        name: "Sales",
        organizationId: orgId,
      });

      const membership = await prisma.membership.findFirst({
        where: { userId: adminUserId, organizationId: orgId },
      });

      // First assign to dept1 and dept2
      await membershipRepo.assignDepartments(membership!.id, [
        dept1.id,
        dept2.id,
      ]);

      // Then reassign to dept3 only — should replace, not append
      await membershipRepo.assignDepartments(membership!.id, [dept3.id]);

      const deptMemberships = await prisma.departmentMembership.findMany({
        where: { membershipId: membership!.id },
      });
      expect(deptMemberships).toHaveLength(1);
      expect(deptMemberships[0].departmentId).toBe(dept3.id);
    });
  });

  describe("getDepartments", () => {
    it("returns departments for a membership", async () => {
      const dept1 = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });
      const dept2 = await deptRepo.create({
        name: "Marketing",
        organizationId: orgId,
      });

      const membership = await prisma.membership.findFirst({
        where: { userId: adminUserId, organizationId: orgId },
      });

      await membershipRepo.assignDepartments(membership!.id, [
        dept1.id,
        dept2.id,
      ]);

      const depts = await membershipRepo.getDepartments(membership!.id);
      expect(depts).toHaveLength(2);
    });
  });
});