/**
 * Work Rule Repository (Entity Layer)
 *
 * Data access layer for custom work rules (break intervals,
 * daily/weekly hour limits). Supports org-scoped CRUD and
 * querying applicable rules for eligibility checks.
 *
 * All queries are org-scoped for multi-tenant isolation.
 * Security: Prisma parameterized queries prevent SQL injection.
 */
import { prisma } from "@/lib/prisma";

export class WorkRuleRepository {
  /** Creates a new work rule within an organization */
  async create(data: {
    organizationId: string;
    name: string;
    type: string;
    roleId?: string | null;
    hoursThreshold?: number | null;
    breakHours?: number | null;
    maxHours?: number | null;
    isActive?: boolean;
  }) {
    return prisma.workRule.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        type: data.type,
        roleId: data.roleId ?? null,
        hoursThreshold: data.hoursThreshold ?? null,
        breakHours: data.breakHours ?? null,
        maxHours: data.maxHours ?? null,
        isActive: data.isActive ?? true,
      },
      include: {
        role: { select: { id: true, name: true, displayLabel: true } },
      },
    });
  }

  /** Finds a work rule by ID */
  async findById(id: string) {
    return prisma.workRule.findUnique({
      where: { id },
      include: {
        role: { select: { id: true, name: true, displayLabel: true } },
      },
    });
  }

  /** Lists all work rules for an organization */
  async findByOrganizationId(organizationId: string) {
    return prisma.workRule.findMany({
      where: { organizationId },
      include: {
        role: { select: { id: true, name: true, displayLabel: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Finds active rules applicable to a specific context.
   * Returns rules that either apply to all staff (roleId = null)
   * or apply to the specified roleId.
   */
  async findApplicableRules(
    organizationId: string,
    roleId?: string | null
  ) {
    return prisma.workRule.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { roleId: null },
          ...(roleId ? [{ roleId }] : []),
        ],
      },
      include: {
        role: { select: { id: true, name: true, displayLabel: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Checks if a work rule name already exists in the organization */
  async existsByName(organizationId: string, name: string, excludeId?: string) {
    const existing = await prisma.workRule.findUnique({
      where: {
        organizationId_name: { organizationId, name },
      },
    });
    if (!existing) return false;
    if (excludeId && existing.id === excludeId) return false;
    return true;
  }

  /** Updates a work rule's fields */
  async update(
    id: string,
    data: {
      name?: string;
      type?: string;
      roleId?: string | null;
      hoursThreshold?: number | null;
      breakHours?: number | null;
      maxHours?: number | null;
      isActive?: boolean;
    }
  ) {
    return prisma.workRule.update({
      where: { id },
      data,
      include: {
        role: { select: { id: true, name: true, displayLabel: true } },
      },
    });
  }

  /** Deletes a work rule */
  async delete(id: string) {
    return prisma.workRule.delete({ where: { id } });
  }
}