/**
 * Industry Template Repository (Entity Layer)
 *
 * Data access layer for IndustryTemplate model.
 * Handles CRUD operations and active template queries.
 * Platform-level — not org-scoped.
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class IndustryTemplateRepository {
  /** Returns all templates (including inactive) — for platform admin */
  async findAll() {
    return prisma.industryTemplate.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  /** Returns only active templates — for onboarding and settings */
  async findActive() {
    return prisma.industryTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Finds a single template by ID */
  async findById(id: string) {
    return prisma.industryTemplate.findUnique({ where: { id } });
  }

  /** Finds a template by name — used for uniqueness checks */
  async findByName(name: string) {
    return prisma.industryTemplate.findUnique({ where: { name } });
  }

  /** Creates a new template */
  async create(data: {
    name: string;
    icon: string;
    description: string;
    departments: Prisma.InputJsonValue;
    workRules: Prisma.InputJsonValue;
    certifications: Prisma.InputJsonValue;
    isAiGenerated?: boolean;
  }) {
    return prisma.industryTemplate.create({
      data: {
        name: data.name,
        icon: data.icon,
        description: data.description,
        departments: data.departments,
        workRules: data.workRules,
        certifications: data.certifications,
        isAiGenerated: data.isAiGenerated ?? false,
      },
    });
  }

  /** Updates an existing template */
  async update(
    id: string,
    data: {
      name?: string;
      icon?: string;
      description?: string;
      departments?: Prisma.InputJsonValue;
      workRules?: Prisma.InputJsonValue;
      certifications?: Prisma.InputJsonValue;
      isActive?: boolean;
    }
  ) {
    return prisma.industryTemplate.update({
      where: { id },
      data,
    });
  }

  /** Soft-delete — sets isActive to false */
  async deactivate(id: string) {
    return prisma.industryTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Reactivate a deactivated template */
  async activate(id: string) {
    return prisma.industryTemplate.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /** Count how many organizations were created from this template */
  async getUsageCount(templateId: string): Promise<number> {
    return prisma.organization.count({
      where: { templateId },
    });
  }

  /** Count usage for all templates in one query */
  async getUsageCounts(): Promise<Record<string, number>> {
    const counts = await prisma.organization.groupBy({
      by: ["templateId"],
      _count: { templateId: true },
      where: { templateId: { not: null } },
    });

    const result: Record<string, number> = {};
    for (const row of counts) {
      if (row.templateId) {
        result[row.templateId] = row._count.templateId;
      }
    }
    return result;
  }
}