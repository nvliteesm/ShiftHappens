import { prisma } from "@/lib/prisma";

export class OrganizationRepository {
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

  async findBySlug(slug: string) {
    return prisma.organization.findUnique({ where: { slug } });
  }

  async findById(id: string) {
    return prisma.organization.findUnique({ where: { id } });
  }

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

  async slugExists(slug: string): Promise<boolean> {
    const count = await prisma.organization.count({ where: { slug } });
    return count > 0;
  }
}