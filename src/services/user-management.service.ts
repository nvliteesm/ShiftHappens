/**
 * User Management Service (Control Layer)
 *
 * Orchestrates user management within an organization:
 * - Listing organization members
 * - Inviting new users via email (with invitation email)
 * - Updating member roles and department assignments
 * - Activating/deactivating members
 *
 * BCE: Sits between Boundary (API routes) and Entity (repositories).
 * Only Company Admin can perform these operations (enforced at Boundary).
 */
import crypto from "crypto";
import { MembershipRepository } from "@/repositories/membership.repository";
import { InvitationRepository } from "@/repositories/invitation.repository";
import { UserRepository } from "@/repositories/user.repository";
import { EmailService } from "@/services/email.service";
import { AuditLogService, ACTIONS } from "@/services/audit-log.service";
import { prisma } from "@/lib/prisma";
import type { InviteUserInput, UpdateUserRoleInput } from "@/lib/validations";
import { SubscriptionService } from "@/services/subscription.service";
import { SubscriptionRepository } from "@/repositories/subscription.repository";

export class UserManagementService {
  private membershipRepo = new MembershipRepository();
  private invitationRepo = new InvitationRepository();
  private userRepo = new UserRepository();
  private emailService = new EmailService();
  private auditService = new AuditLogService();
  private subscriptionService = new SubscriptionService(new SubscriptionRepository());

  /** Lists all members of an organization with user details and departments */
  async getOrgMembers(organizationId: string) {
    return this.membershipRepo.findByOrgId(organizationId);
  }

  /**
   * Invites a user to an organization:
   * 1. Check if user is already a member
   * 2. Check for existing pending invitation
   * 3. Generate secure invitation token
   * 4. Create invitation record
   * 5. Log audit event
   * 6. Send invitation email (fire-and-forget)
   */
  async inviteUser(
    input: InviteUserInput,
    organizationId: string,
    invitedById: string
  ) {
    await this.subscriptionService.enforceResourceLimit(organizationId, 'members');

    // Check if the email already belongs to a member of this org
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      const existingMembership = await this.membershipRepo.findByUserAndOrg(
        existingUser.id,
        organizationId
      );
      if (existingMembership) {
        throw new Error("User is already a member of this organization");
      }
    }

    // Check for duplicate pending invitation
    const pendingInvitation = await this.invitationRepo.findPendingByEmail(
      input.email,
      organizationId
    );
    if (pendingInvitation) {
      throw new Error("An invitation has already been sent to this email");
    }

    // Generate secure token and create invitation
    const token = crypto.randomBytes(32).toString("hex");

    const invitation = await this.invitationRepo.create({
      organizationId,
      email: input.email,
      role: input.role,
      departmentId: input.departmentId,
      token,
      invitedById,
    });

    await this.auditService.log({
      organizationId,
      userId: invitedById,
      action: ACTIONS.MEMBER_INVITED,
      entityType: "invitation",
      entityId: invitation.id,
      details: { email: input.email, role: input.role },
    });

    // Send invitation email (fire-and-forget — never blocks or fails the invite)
    this.sendInvitationEmailAsync(
      input.email,
      token,
      organizationId,
      invitedById
    );

    return invitation;
  }

  /**
   * Sends the invitation email asynchronously.
   * Fetches org name and inviter name, then delegates to EmailService.
   * Errors are logged but never propagated — the invitation is
   * already created regardless of email delivery.
   */
  private async sendInvitationEmailAsync(
    email: string,
    token: string,
    organizationId: string,
    invitedById: string
  ) {
    try {
      const [org, inviter] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        }),
        this.userRepo.findById(invitedById),
      ]);

      await this.emailService.sendInvitationEmail(
        email,
        token,
        org?.name || "your organization",
        inviter?.name || inviter?.email || "A team member"
      );
    } catch (error) {
      console.error("[Invite Email Error]", error);
    }
  }

  /**
   * Updates a member's role and optionally their department assignments.
   * Prevents the last company_admin from being demoted.
   */
  async updateMemberRole(
    userId: string,
    organizationId: string,
    input: UpdateUserRoleInput,
    performedById?: string
  ) {
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId
    );
    if (!membership) {
      throw new Error("Membership not found");
    }

    const previousRole = membership.role;

    // Prevent demoting the last company_admin
    if (membership.role === "company_admin" && input.role !== "company_admin") {
      const allMembers = await this.membershipRepo.findByOrgId(organizationId);
      const adminCount = allMembers.filter(
        (m) => m.role === "company_admin" && m.status === "active"
      ).length;

      if (adminCount <= 1) {
        throw new Error(
          "Cannot demote the last Company Admin. Promote another member first."
        );
      }
    }

    // Update the role
    const updated = await this.membershipRepo.updateRole(
      membership.id,
      input.role
    );

    // Update department assignments if provided
    if (input.departmentIds) {
      await this.membershipRepo.assignDepartments(
        membership.id,
        input.departmentIds
      );
    }

    await this.auditService.log({
      organizationId,
      userId: performedById,
      action: ACTIONS.MEMBER_ROLE_CHANGED,
      entityType: "member",
      entityId: userId,
      details: { previousRole, newRole: input.role, departmentIds: input.departmentIds },
    });

    return updated;
  }

  /**
   * Toggles a member's status between active and inactive.
   * Deactivation prevents access to the organization.
   */
  async toggleMemberStatus(userId: string, organizationId: string, performedById?: string) {
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId
    );
    if (!membership) {
      throw new Error("Membership not found");
    }

    // Prevent deactivating the last active admin
    if (membership.role === "company_admin" && membership.status === "active") {
      const allMembers = await this.membershipRepo.findByOrgId(organizationId);
      const activeAdmins = allMembers.filter(
        (m) => m.role === "company_admin" && m.status === "active"
      );

      if (activeAdmins.length <= 1) {
        throw new Error(
          "Cannot deactivate the last active Company Admin."
        );
      }
    }

    const newStatus = membership.status === "active" ? "inactive" : "active";
    const updated = await this.membershipRepo.updateStatus(membership.id, newStatus);

    await this.auditService.log({
      organizationId,
      userId: performedById,
      action: newStatus === "active" ? ACTIONS.MEMBER_ACTIVATED : ACTIONS.MEMBER_DEACTIVATED,
      entityType: "member",
      entityId: userId,
      details: { previousStatus: membership.status, newStatus },
    });

    return updated;
  }
}