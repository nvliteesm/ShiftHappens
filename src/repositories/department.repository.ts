/**
 * Department Repository (Entity Layer)
 * 
 * Data access layer for Department model operations.
 * All queries are org-scoped to enforce multi-tenant data isolation.
 * Includes member check to support blocked deletion when staff assigned.
 * 
 * Security: Prisma parameterized queries prevent SQL injection.
 */
import { prisma } from "@/lib/prisma";

export class DepartmentRepository {
  /** Creates a new department within an organization */
  async create(data: {
    name: string;
    description?: string;
    organizationId: string;
  }) {
    return prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        organizationId: data.organizationId,
      },
    });
  }

  /** Finds a department by ID, includes member count */
  async findById(id: string) {
    return prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { departmentMemberships: true },
        },
      },
    });
  }

  /** 
   * Finds all departments for an organization.
   * Org-scoped query for tenant isolation.
   * Includes member count for display purposes.
   */
  async findByOrganizationId(organizationId: string) {
    return prisma.department.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { departmentMemberships: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /** Updates a department's name and/or description */
  async update(id: string, data: { name?: string; description?: string }) {
    return prisma.department.update({
      where: { id },
      data,
    });
  }

  /** Deletes a department — caller must check hasMembers() first */
  async delete(id: string) {
    return prisma.department.delete({
      where: { id },
    });
  }

  /**
   * Checks if a department has any assigned members.
   * Used to block deletion when staff are still assigned.
   * Enhancement: Smart reassignment suggestions planned for Phase 5/6.
   */
  async hasMembers(departmentId: string): Promise<boolean> {
    const count = await prisma.departmentMembership.count({
      where: { departmentId },
    });
    return count > 0;
  }

  /**
   * Checks if a department name already exists within an organization.
   * Used to prevent duplicate department names per org.
   * Optional excludeId parameter for update operations (exclude self).
   */
  async nameExistsInOrg(
    name: string,
    organizationId: string,
    excludeId?: string
  ): Promise<boolean> {
    const count = await prisma.department.count({
      where: {
        name,
        organizationId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return count > 0;
  }
}