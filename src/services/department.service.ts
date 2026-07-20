/**
 * Department Service (Control Layer)
 *
 * Business logic for department management within an organization.
 * Enforces rules:
 * - No duplicate department names within the same org
 * - Cannot delete a department that has assigned members
 * - Subscription tier limits on department count
 */
import { DepartmentRepository } from "@/repositories/department.repository";
import { AuditLogService, ACTIONS } from "@/services/audit-log.service";
import { SubscriptionService } from "@/services/subscription.service";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "@/lib/validations";

export class DepartmentService {
  private deptRepo = new DepartmentRepository();
  private auditService = new AuditLogService();
  private subscriptionService = new SubscriptionService();

  /**
   * Creates a new department in an organization.
   * Checks subscription limit, then duplicate names before creating.
   */
  async create(input: CreateDepartmentInput, organizationId: string, userId?: string) {
    await this.subscriptionService.enforceResourceLimit(organizationId, 'departments');

    const nameExists = await this.deptRepo.nameExistsInOrg(
      input.name,
      organizationId
    );
    if (nameExists) {
      throw new Error("Department name already exists");
    }

    const department = await this.deptRepo.create({
      name: input.name,
      description: input.description,
      color: input.color,
      organizationId,
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: ACTIONS.DEPARTMENT_CREATED,
      entityType: "department",
      entityId: department.id,
      details: { name: input.name, color: input.color },
    });

    return department;
  }

  /** Retrieves all departments for an organization */
  async getByOrganization(organizationId: string) {
    return this.deptRepo.findByOrganizationId(organizationId);
  }

  /** Retrieves a single department by ID */
  async getById(departmentId: string) {
    return this.deptRepo.findById(departmentId);
  }

  /**
   * Updates a department's name and/or description.
   * Checks for name conflicts, excluding the department being updated.
   */
  async update(
    departmentId: string,
    organizationId: string,
    input: UpdateDepartmentInput,
    userId?: string
  ) {
    if (input.name) {
      const nameExists = await this.deptRepo.nameExistsInOrg(
        input.name,
        organizationId,
        departmentId
      );
      if (nameExists) {
        throw new Error("Department name already exists");
      }
    }

    const department = await this.deptRepo.update(departmentId, {
      name: input.name,
      description: input.description,
      color: input.color,
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: ACTIONS.DEPARTMENT_UPDATED,
      entityType: "department",
      entityId: departmentId,
      details: { name: input.name, description: input.description, color: input.color },
    });

    return department;
  }

  /**
   * Deletes a department if it has no assigned members.
   * Blocks deletion with a clear error message when members exist.
   */
  async delete(departmentId: string, organizationId: string, userId?: string) {
    const hasMembers = await this.deptRepo.hasMembers(departmentId);
    if (hasMembers) {
      throw new Error(
        "Cannot delete department with assigned members. Please reassign or remove members first."
      );
    }

    const department = await this.deptRepo.delete(departmentId);

    await this.auditService.log({
      organizationId,
      userId,
      action: ACTIONS.DEPARTMENT_DELETED,
      entityType: "department",
      entityId: departmentId,
    });

    return department;
  }
}