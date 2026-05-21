/**
 * User Management Service (Control Layer)
 * 
 * Orchestrates user management within an organization:
 * - Listing organization members
 * - Inviting new users via email
 * - Updating member roles and department assignments
 * - Activating/deactivating members
 * 
 * BCE: Sits between Boundary (API routes) and Entity (repositories).
 * Only Company Admin can perform these operations (enforced at Boundary).
 * 
 * Security:
 * - Invitation tokens generated with crypto.randomBytes
 * - Duplicate invitation prevention
 * - Existing membership check before inviting
 */
import crypto from "crypto";
import { MembershipRepository } from "@/repositories/membership.repository";
import { InvitationRepository } from "@/repositories/invitation.repository";
import { UserRepository } from "@/repositories/user.repository";
import { EmailService } from "@/services/email.service";
import type { InviteUserInput, UpdateUserRoleInput } from "@/lib/validations";

export class UserManagementService {
  private membershipRepo = new MembershipRepository();
  private invitationRepo = new InvitationRepository();
  private userRepo = new UserRepository();
  private emailService = new EmailService();

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
   * 5. Send invitation email (TODO: implement in EmailService)
   */
  async inviteUser(
    input: InviteUserInput,
    organizationId: string,
    invitedById: string
  ) {
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

    // TODO: Send invitation email with accept link
    // await this.emailService.sendInvitationEmail(input.email, token, orgName);

    return invitation;
  }

  /**
   * Updates a member's role and optionally their department assignments.
   * Supports promoting staff to manager, assigning managers to departments, etc.
   */
  async updateMemberRole(
    userId: string,
    organizationId: string,
    input: UpdateUserRoleInput
  ) {
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId
    );
    if (!membership) {
      throw new Error("Membership not found");
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

    return updated;
  }

  /**
   * Toggles a member's status between active and inactive.
   * Deactivation prevents access to the organization.
   * Task auto-unassignment will be added in Phase 4.
   */
  async toggleMemberStatus(userId: string, organizationId: string) {
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId
    );
    if (!membership) {
      throw new Error("Membership not found");
    }

    const newStatus = membership.status === "active" ? "inactive" : "active";
    return this.membershipRepo.updateStatus(membership.id, newStatus);
  }
}