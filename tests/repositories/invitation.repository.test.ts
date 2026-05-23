/**
 * Tests for Invitation Repository (Entity Layer)
 * Verifies invitation token creation, lookup, acceptance,
 * and expiry handling against a real PostgreSQL database.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { InvitationRepository } from "@/repositories/invitation.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const invitationRepo = new InvitationRepository();
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

describe("InvitationRepository", () => {
  describe("create", () => {
    it("creates an invitation token", async () => {
      const invitation = await invitationRepo.create({
        organizationId: orgId,
        email: "newuser@example.com",
        role: "staff",
        token: "test-token-123",
        invitedById: adminUserId,
      });

      expect(invitation.id).toBeDefined();
      expect(invitation.email).toBe("newuser@example.com");
      expect(invitation.role).toBe("staff");
      expect(invitation.token).toBe("test-token-123");
      expect(invitation.expires).toBeInstanceOf(Date);
      expect(invitation.acceptedAt).toBeNull();
    });

    it("creates an invitation with department assignment", async () => {
      const dept = await prisma.department.create({
        data: { name: "Engineering", organizationId: orgId },
      });

      const invitation = await invitationRepo.create({
        organizationId: orgId,
        email: "newuser@example.com",
        role: "manager",
        departmentId: dept.id,
        token: "test-token-456",
        invitedById: adminUserId,
      });

      expect(invitation.departmentId).toBe(dept.id);
    });
  });

  describe("findByToken", () => {
    it("finds a valid invitation by token", async () => {
      await invitationRepo.create({
        organizationId: orgId,
        email: "newuser@example.com",
        role: "staff",
        token: "find-me-token",
        invitedById: adminUserId,
      });

      const found = await invitationRepo.findByToken("find-me-token");
      expect(found).not.toBeNull();
      expect(found!.email).toBe("newuser@example.com");
    });

    it("returns null for non-existent token", async () => {
      const found = await invitationRepo.findByToken("nonexistent");
      expect(found).toBeNull();
    });

    it("includes organization details", async () => {
      await invitationRepo.create({
        organizationId: orgId,
        email: "newuser@example.com",
        role: "staff",
        token: "org-details-token",
        invitedById: adminUserId,
      });

      const found = await invitationRepo.findByToken("org-details-token");
      expect(found!.organization.name).toBe("Acme Corp");
    });
  });

  describe("findByOrgId", () => {
    it("returns all invitations for an organization", async () => {
      await invitationRepo.create({
        organizationId: orgId,
        email: "user1@example.com",
        role: "staff",
        token: "token-1",
        invitedById: adminUserId,
      });
      await invitationRepo.create({
        organizationId: orgId,
        email: "user2@example.com",
        role: "manager",
        token: "token-2",
        invitedById: adminUserId,
      });

      const invitations = await invitationRepo.findByOrgId(orgId);
      expect(invitations).toHaveLength(2);
    });
  });

  describe("findPendingByEmail", () => {
    it("finds pending invitation for an email in an org", async () => {
      await invitationRepo.create({
        organizationId: orgId,
        email: "pending@example.com",
        role: "staff",
        token: "pending-token",
        invitedById: adminUserId,
      });

      const found = await invitationRepo.findPendingByEmail(
        "pending@example.com",
        orgId
      );
      expect(found).not.toBeNull();
    });

    it("does not return accepted invitations", async () => {
      const invitation = await invitationRepo.create({
        organizationId: orgId,
        email: "accepted@example.com",
        role: "staff",
        token: "accepted-token",
        invitedById: adminUserId,
      });

      await invitationRepo.markAccepted(invitation.id);

      const found = await invitationRepo.findPendingByEmail(
        "accepted@example.com",
        orgId
      );
      expect(found).toBeNull();
    });
  });

  describe("markAccepted", () => {
    it("sets acceptedAt timestamp", async () => {
      const invitation = await invitationRepo.create({
        organizationId: orgId,
        email: "newuser@example.com",
        role: "staff",
        token: "accept-token",
        invitedById: adminUserId,
      });

      const accepted = await invitationRepo.markAccepted(invitation.id);
      expect(accepted.acceptedAt).not.toBeNull();
      expect(accepted.acceptedAt).toBeInstanceOf(Date);
    });
  });

  describe("delete", () => {
    it("deletes an invitation", async () => {
      const invitation = await invitationRepo.create({
        organizationId: orgId,
        email: "delete@example.com",
        role: "staff",
        token: "delete-token",
        invitedById: adminUserId,
      });

      await invitationRepo.delete(invitation.id);

      const found = await invitationRepo.findByToken("delete-token");
      expect(found).toBeNull();
    });
  });
});