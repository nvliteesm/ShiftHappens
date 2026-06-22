/**
 * Role Service (Control Layer)
 * 
 * Business logic for custom role management.
 * Enforces rules:
 * - No duplicate role names within the same org
 * - System roles (company_admin, manager, staff) cannot be modified or deleted
 * - Every custom role must have at least one permission
 */
import { RoleRepository } from "@/repositories/role.repository";
import { AuditLogService, ACTIONS } from "@/services/audit-log.service";
import type { CreateRoleInput, UpdateRoleInput } from "@/lib/validations";
import { SubscriptionService } from "@/services/subscription.service";
import { SubscriptionRepository } from "@/repositories/subscription.repository";

export class RoleService {
  private roleRepo = new RoleRepository();
  private auditService = new AuditLogService();
  private subscriptionService = new SubscriptionService(new SubscriptionRepository());

  /**
   * Creates a new custom role in an organization.
   * Checks for duplicate names before creating.
   */
  async create(input: CreateRoleInput, organizationId: string, userId?: string) {
    await this.subscriptionService.enforceFeatureAccess(organizationId, 'custom_roles');
    await this.subscriptionService.enforceResourceLimit(organizationId, 'custom_roles');

    const nameExists = await this.roleRepo.nameExistsInOrg(
      input.name,
      organizationId
    );
    if (nameExists) {
      throw new Error("Role name already exists");
    }

    const role = await this.roleRepo.create({
      name: input.name,
      displayLabel: input.displayLabel,
      description: input.description,
      organizationId,
      permissionIds: input.permissionIds,
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: ACTIONS.ROLE_CREATED,
      entityType: "role",
      entityId: role.id,
      details: { name: input.name, permissionCount: input.permissionIds.length },
    });

    return role;
  }

  /** Retrieves all roles for an organization */
  async getByOrganization(organizationId: string) {
    return this.roleRepo.findByOrganizationId(organizationId);
  }

  /** Retrieves a single role by ID with its permissions */
  async getById(roleId: string) {
    return this.roleRepo.findById(roleId);
  }

  /**
   * Updates a custom role's display label, description, or permissions.
   * System roles cannot be modified.
   */
  async update(roleId: string, organizationId: string, input: UpdateRoleInput, userId?: string) {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    if (role.isSystemRole) {
      throw new Error("Cannot modify system roles");
    }

    const updated = await this.roleRepo.update(roleId, {
      displayLabel: input.displayLabel,
      description: input.description,
      permissionIds: input.permissionIds,
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: ACTIONS.ROLE_UPDATED,
      entityType: "role",
      entityId: roleId,
      details: { displayLabel: input.displayLabel },
    });

    return updated;
  }

  /**
   * Deletes a custom role.
   * System roles cannot be deleted.
   */
  async delete(roleId: string, organizationId: string, userId?: string) {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    if (role.isSystemRole) {
      throw new Error("Cannot delete system roles");
    }

    const deleted = await this.roleRepo.delete(roleId);

    await this.auditService.log({
      organizationId,
      userId,
      action: ACTIONS.ROLE_DELETED,
      entityType: "role",
      entityId: roleId,
      details: { name: role.name },
    });

    return deleted;
  }

  /** Returns all available permissions for the role creation/edit UI */
  async getAllPermissions() {
    return this.roleRepo.getAllPermissions();
  }
}