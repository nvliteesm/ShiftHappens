/**
 * Platform Repository (Entity Layer)
 * 
 * Data access for platform-level queries across all organizations.
 * Used by the Platform Admin dashboard to manage tenants.
 * Unlike other repositories, queries here are NOT org-scoped —
 * they intentionally span all organizations.
 */
import { prisma } from "@/lib/prisma";

export class PlatformRepository {
  /** Lists all organizations with member and task counts */
  async findAllOrganizations(limit = 50, offset = 0) {
    return prisma.organization.findMany({
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            memberships: true,
            tasks: true,
          },
        },
      },
    });
  }

  /** Counts total organizations */
  async countOrganizations() {
    return prisma.organization.count();
  }

  /** Gets a single organization by ID with counts */
  async findOrganizationById(orgId: string) {
    return prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            memberships: true,
            tasks: true,
            departments: true,
          },
        },
      },
    });
  }

  /** Updates an organization's status (active/suspended) */
  async updateOrganizationStatus(orgId: string, status: string) {
    return prisma.organization.update({
      where: { id: orgId },
      data: { status },
    });
  }

  /** Gets platform-wide statistics */
  async getStats() {
    const [orgCount, userCount, taskCount, activeOrgCount] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.task.count(),
      prisma.organization.count({ where: { status: "active" } }),
    ]);

    return {
      totalOrganizations: orgCount,
      activeOrganizations: activeOrgCount,
      totalUsers: userCount,
      totalTasks: taskCount,
    };
  }
}