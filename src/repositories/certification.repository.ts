/**
 * Certification Repository (Entity Layer)
 * 
 * Data access layer for staff certifications.
 * Certifications are submitted by staff, verified by managers,
 * and used by the eligibility engine to determine task fitness.
 * 
 * Status lifecycle: pending → verified/rejected
 * Expired certifications are determined by expiryDate at check time.
 */
import { prisma } from "@/lib/prisma";

export class CertificationRepository {
  /** Creates a new certification submission */
  async create(data: {
    membershipId: string;
    name: string;
    issuedDate: Date;
    expiryDate?: Date;
    documentUrl?: string;
  }) {
    return prisma.certification.create({
      data: {
        membershipId: data.membershipId,
        name: data.name,
        issuedDate: data.issuedDate,
        expiryDate: data.expiryDate,
        documentUrl: data.documentUrl,
        status: "pending",
      },
    });
  }

  /** Finds a certification by ID */
  async findById(id: string) {
    return prisma.certification.findUnique({
      where: { id },
      include: {
        membership: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        verifiedBy: { select: { id: true, name: true } },
      },
    });
  }

  /** Gets all certifications for a member */
  async findByMembershipId(membershipId: string) {
    return prisma.certification.findMany({
      where: { membershipId },
      include: {
        verifiedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Gets all certifications for an org, optionally filtered by status */
  async findByOrganizationId(organizationId: string, status?: string) {
    return prisma.certification.findMany({
      where: {
        membership: { organizationId },
        ...(status && { status }),
      },
      include: {
        membership: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        verifiedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Verifies or rejects a certification */
  async updateStatus(id: string, status: string, verifiedById: string) {
    return prisma.certification.update({
      where: { id },
      data: {
        status,
        verifiedById,
        verifiedAt: new Date(),
      },
    });
  }

  /** Deletes a certification */
  async delete(id: string) {
    return prisma.certification.delete({ where: { id } });
  }

  /**
   * Gets all valid (verified, non-expired) certifications for a member.
   * Used by the eligibility engine.
   */
  async getValidCertifications(membershipId: string) {
    return prisma.certification.findMany({
      where: {
        membershipId,
        status: "verified",
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: new Date() } },
        ],
      },
    });
  }
}