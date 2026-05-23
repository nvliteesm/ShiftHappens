/**
 * Role Service (Control Layer)
 * 
 * Business logic for custom role management.
 * Enforces rules:
 * - No duplicate role names within the same org
 * - System roles (company_admin, manager, staff) cannot be modified or deleted
 * - Every custom role must have at least one permission
 * 
 * Company Admins use this to create roles like "Shift Lead" or
 * "Senior Chef" with specific permissions tailored to their business.
 */
import { RoleRepository } from "@/repositories/role.repository";
import type { CreateRoleInput, UpdateRoleInput } from "@/lib/validations";

export class RoleService {
  private roleRepo = new RoleRepository();

  /**
   * Creates a new custom role in an organization.
   * Checks for duplicate names before creating.
   */
  async create(input: CreateRoleInput, organizationId: string) {
    const nameExists = await this.roleRepo.nameExistsInOrg(
      input.name,
      organizationId
    );
    if (nameExists) {
      throw new Error("Role name already exists");
    }

    return this.roleRepo.create({
      name: input.name,
      displayLabel: input.displayLabel,
      description: input.description,
      organizationId,
      permissionIds: input.permissionIds,
    });
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
  async update(roleId: string, organizationId: string, input: UpdateRoleInput) {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    if (role.isSystemRole) {
      throw new Error("Cannot modify system roles");
    }

    return this.roleRepo.update(roleId, {
      displayLabel: input.displayLabel,
      description: input.description,
      permissionIds: input.permissionIds,
    });
  }

  /**
   * Deletes a custom role.
   * System roles cannot be deleted.
   */
  async delete(roleId: string, organizationId: string) {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    if (role.isSystemRole) {
      throw new Error("Cannot delete system roles");
    }

    return this.roleRepo.delete(roleId);
  }

  /** Returns all available permissions for the role creation/edit UI */
  async getAllPermissions() {
    return this.roleRepo.getAllPermissions();
  }
}