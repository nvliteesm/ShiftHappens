/**
 * Tests for User Management Service (Control Layer)
 * Verifies user invitation, role updates, department assignments,
 * and activation/deactivation within an organization.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserManagementService } from "@/services/user-management.service";
import { DepartmentRepository } from "@/repositories/department.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";

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
  });
});