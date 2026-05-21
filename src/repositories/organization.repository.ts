/**
 * Organization Repository (Entity Layer)
 * 
 * Data access layer for Organization model operations.
 * Handles org creation (with initial membership), lookups, 
 * and slug uniqueness checks.
 * 
 * Multi-tenancy: Organization queries support tenant isolation
 * through org-scoped lookups.
 */
import { prisma } from "@/lib/prisma";

export class OrganizationRepository {
  /**
   * Creates a new organization and assigns the creator as company_admin.
   * Uses a nested Prisma write to atomically create both the org and membership.
   */
  async create(
    data: {
      name: string;
      slug: string;
      industry?: string;
      description?: string;
    },
    creatorUserId: string
  ) {
    return prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        industry: data.industry,
        description: data.description,
        memberships: {
          create: {
            userId: creatorUserId,
            role: "company_admin",
            status: "active",
          },
        },
      },
      include: { memberships: true },
    });
  }

  /** Finds an organization by its URL-friendly slug */
  async findBySlug(slug: string) {
    return prisma.organization.findUnique({ where: { slug } });
  }

  /** Finds an organization by its ID */
  async findById(id: string) {
    return prisma.organization.findUnique({ where: { id } });
  }

  /**
   * Finds all organizations a user belongs to (with active membership).
   * Includes the user's role in each organization.
   * Supports multi-org staff who can belong to multiple companies.
   */
  async findByUserId(userId: string) {
    return prisma.organization.findMany({
      where: {
        memberships: {
          some: { userId, status: "active" },
        },
      },
      include: {
        memberships: {
          where: { userId },
          select: { role: true },
        },
      },
    });
  }

  /** Checks if a slug is already taken — used during slug generation */
  async slugExists(slug: string): Promise<boolean> {
    const count = await prisma.organization.count({ where: { slug } });
    return count > 0;
  }
}