/**
 * Department Service (Control Layer)
 * 
 * Business logic for department management within an organization.
 * Enforces rules:
 * - No duplicate department names within the same org
 * - Cannot delete a department that has assigned members
 * 
 * Enhancement planned (Phase 5/6): Smart reassignment suggestions
 * when attempting to delete a department with members.
 */
import { DepartmentRepository } from "@/repositories/department.repository";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "@/lib/validations";

export class DepartmentService {
  private deptRepo = new DepartmentRepository();

  /**
   * Creates a new department in an organization.
   * Checks for duplicate names before creating.
   */
  async create(input: CreateDepartmentInput, organizationId: string) {
    const nameExists = await this.deptRepo.nameExistsInOrg(
      input.name,
      organizationId
    );
    if (nameExists) {
      throw new Error("Department name already exists");
    }

    return this.deptRepo.create({
      name: input.name,
      description: input.description,
      color: input.color,
      organizationId,
    });
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
    input: UpdateDepartmentInput
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

    return this.deptRepo.update(departmentId, {
      name: input.name,
      description: input.description,
      color: input.color,
    });
  }

  /**
   * Deletes a department if it has no assigned members.
   * Blocks deletion with a clear error message when members exist.
   * 
   * TODO (Phase 5/6): Enhance with smart reassignment suggestions
   * using the eligibility engine to recommend where to move staff.
   */
  async delete(departmentId: string) {
    const hasMembers = await this.deptRepo.hasMembers(departmentId);
    if (hasMembers) {
      throw new Error(
        "Cannot delete department with assigned members. Please reassign or remove members first."
      );
    }

    return this.deptRepo.delete(departmentId);
  }
}