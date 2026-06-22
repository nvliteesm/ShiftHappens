/**
 * Tests for User Management Service (Control Layer)
 * Verifies user invitation, role updates, department assignments,
 * custom role assignment guards, and activation/deactivation
 * within an organization.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserManagementService } from "@/services/user-management.service";
import { DepartmentRepository } from "@/repositories/department.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const userMgmtService = new UserManagementService();
const deptRepo = new DepartmentRepository();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;
let adminUserId: string;

// Mock EmailService to prevent actual emails during tests
vi.mock("@/services/email.service", () => ({
  EmailService: class {
    sendVerificationEmail = vi.fn().mockResolvedValue(undefined);
    sendPasswordResetEmail = vi.fn().mockResolvedValue(undefined);
    sendInvitationEmail = vi.fn().mockResolvedValue(undefined);
  },
}));

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

describe("UserManagementService", () => {
  describe("getOrgMembers", () => {
    it("returns all members of an organization", async () => {
      const members = await userMgmtService.getOrgMembers(orgId);
      expect(members).toHaveLength(1);
      expect(members[0].user.email).toBe("admin@example.com");
    });
  });

  describe("inviteUser", () => {
    it("creates an invitation for a new user", async () => {
      const invitation = await userMgmtService.inviteUser(
        { email: "newuser@example.com", role: "staff" },
        orgId,
        adminUserId
      );

      expect(invitation.email).toBe("newuser@example.com");
      expect(invitation.role).toBe("staff");
    });

    it("throws if user is already a member", async () => {
      await expect(
        userMgmtService.inviteUser(
          { email: "admin@example.com", role: "staff" },
          orgId,
          adminUserId
        )
      ).rejects.toThrow("User is already a member of this organization");
    });

    it("throws if pending invitation already exists", async () => {
      await userMgmtService.inviteUser(
        { email: "newuser@example.com", role: "staff" },
        orgId,
        adminUserId
      );

      await expect(
        userMgmtService.inviteUser(
          { email: "newuser@example.com", role: "manager" },
          orgId,
          adminUserId
        )
      ).rejects.toThrow("An invitation has already been sent to this email");
    });

    it("creates invitation with department assignment", async () => {
      const dept = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });

      const invitation = await userMgmtService.inviteUser(
        { email: "dev@example.com", role: "staff", departmentId: dept.id },
        orgId,
        adminUserId
      );

      expect(invitation.departmentId).toBe(dept.id);
    });
  });

  describe("updateMemberRole", () => {
    it("updates a member's role", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });

      const updated = await userMgmtService.updateMemberRole(
        user2.id,
        orgId,
        { role: "manager" }
      );

      expect(updated.role).toBe("manager");
    });

    it("assigns departments when updating role", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      const membership = await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });
      const dept = await deptRepo.create({
        name: "Engineering",
        organizationId: orgId,
      });

      await userMgmtService.updateMemberRole(user2.id, orgId, {
        role: "manager",
        departmentIds: [dept.id],
      });

      const deptMemberships = await prisma.departmentMembership.findMany({
        where: { membershipId: membership.id },
      });
      expect(deptMemberships).toHaveLength(1);
    });

    it("throws if membership not found", async () => {
      await expect(
        userMgmtService.updateMemberRole("nonexistent", orgId, {
          role: "manager",
        })
      ).rejects.toThrow("Membership not found");
    });

    it("throws when demoting the last company_admin", async () => {
      await expect(
        userMgmtService.updateMemberRole(adminUserId, orgId, {
          role: "staff",
        })
      ).rejects.toThrow("Cannot demote the last Company Admin");
    });

    it("allows demoting a company_admin when another exists", async () => {
      // Create a second admin
      const user2 = await userRepo.create({
        name: "Second Admin",
        email: "admin2@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "company_admin",
          status: "active",
        },
      });

      // Now demoting the first admin should work
      const updated = await userMgmtService.updateMemberRole(
        adminUserId,
        orgId,
        { role: "manager" }
      );
      expect(updated.role).toBe("manager");
    });

    it("auto-clears custom role when promoting to company_admin", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      const membership = await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });

      // Create and assign a custom role
      const customRole = await prisma.role.create({
        data: {
          name: "shift_lead",
          displayLabel: "Shift Lead",
          organizationId: orgId,
          isSystemRole: false,
        },
      });
      await prisma.membership.update({
        where: { id: membership.id },
        data: { customRoleId: customRole.id },
      });

      // Promote to company_admin — should clear custom role
      await userMgmtService.updateMemberRole(user2.id, orgId, {
        role: "company_admin",
      });

      const updated = await prisma.membership.findUnique({
        where: { id: membership.id },
      });
      expect(updated!.role).toBe("company_admin");
      expect(updated!.customRoleId).toBeNull();
    });
  });

  describe("assignCustomRole", () => {
    it("assigns a custom role to staff", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });

      const customRole = await prisma.role.create({
        data: {
          name: "shift_lead",
          displayLabel: "Shift Lead",
          organizationId: orgId,
          isSystemRole: false,
        },
      });

      const result = await userMgmtService.assignCustomRole(
        user2.id,
        orgId,
        customRole.id
      );
      expect(result.customRoleId).toBe(customRole.id);
    });

    it("assigns a custom role to manager", async () => {
      const user2 = await userRepo.create({
        name: "Manager User",
        email: "mgr@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "manager",
          status: "active",
        },
      });

      const customRole = await prisma.role.create({
        data: {
          name: "head_chef",
          displayLabel: "Head Chef",
          organizationId: orgId,
          isSystemRole: false,
        },
      });

      const result = await userMgmtService.assignCustomRole(
        user2.id,
        orgId,
        customRole.id
      );
      expect(result.customRoleId).toBe(customRole.id);
    });

    it("blocks custom role assignment for company_admin", async () => {
      const customRole = await prisma.role.create({
        data: {
          name: "shift_lead",
          displayLabel: "Shift Lead",
          organizationId: orgId,
          isSystemRole: false,
        },
      });

      await expect(
        userMgmtService.assignCustomRole(adminUserId, orgId, customRole.id)
      ).rejects.toThrow("Company Admins cannot be assigned custom roles");
    });

    it("clears custom role when passing null", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });

      const customRole = await prisma.role.create({
        data: {
          name: "shift_lead",
          displayLabel: "Shift Lead",
          organizationId: orgId,
          isSystemRole: false,
        },
      });

      await userMgmtService.assignCustomRole(user2.id, orgId, customRole.id);
      const cleared = await userMgmtService.assignCustomRole(user2.id, orgId, null);
      expect(cleared.customRoleId).toBeNull();
    });

    it("blocks assignment of system roles", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });

      const systemRole = await prisma.role.create({
        data: {
          name: "company_admin",
          displayLabel: "Company Admin",
          organizationId: orgId,
          isSystemRole: true,
        },
      });

      await expect(
        userMgmtService.assignCustomRole(user2.id, orgId, systemRole.id)
      ).rejects.toThrow("Cannot assign system roles as custom roles");
    });

    it("blocks assignment of role from different org", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });

      const otherUser = await userRepo.create({
        name: "Other Admin",
        email: "other@example.com",
        hashedPassword: "hash",
      });
      const otherOrg = await orgRepo.create(
        { name: "Other Org", slug: "other-org" },
        otherUser.id
      );
      const otherRole = await prisma.role.create({
        data: {
          name: "other_role",
          displayLabel: "Other Role",
          organizationId: otherOrg.id,
          isSystemRole: false,
        },
      });

      await expect(
        userMgmtService.assignCustomRole(user2.id, orgId, otherRole.id)
      ).rejects.toThrow("Custom role not found");
    });

    it("throws if membership not found", async () => {
      await expect(
        userMgmtService.assignCustomRole("nonexistent", orgId, null)
      ).rejects.toThrow("Membership not found");
    });
  });

  describe("toggleMemberStatus", () => {
    it("deactivates an active member", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });

      const updated = await userMgmtService.toggleMemberStatus(
        user2.id,
        orgId
      );
      expect(updated.status).toBe("inactive");
    });

    it("reactivates an inactive member", async () => {
      const user2 = await userRepo.create({
        name: "Staff User",
        email: "staff@example.com",
        hashedPassword: "hash",
      });
      await prisma.membership.create({
        data: {
          userId: user2.id,
          organizationId: orgId,
          role: "staff",
          status: "inactive",
        },
      });

      const updated = await userMgmtService.toggleMemberStatus(
        user2.id,
        orgId
      );
      expect(updated.status).toBe("active");
    });

    it("throws if membership not found", async () => {
      await expect(
        userMgmtService.toggleMemberStatus("nonexistent", orgId)
      ).rejects.toThrow("Membership not found");
    });

    it("throws when deactivating the last company_admin", async () => {
      await expect(
        userMgmtService.toggleMemberStatus(adminUserId, orgId)
      ).rejects.toThrow("Cannot deactivate the last active Company Admin");
    });
  });
});