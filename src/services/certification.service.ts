/**
 * Certification Service (Control Layer)
 * 
 * Business logic for staff certification management.
 * Staff submit certifications, managers verify or reject them.
 * The eligibility engine uses verified, non-expired certifications
 * to determine task fitness.
 * 
 * Enforces rules:
 * - Only pending certifications can be verified/rejected
 * - Verification requires manager or admin role (enforced at route level)
 */
import { CertificationRepository } from "@/repositories/certification.repository";
import type { CreateCertificationInput } from "@/lib/validations";

export class CertificationService {
  private certRepo = new CertificationRepository();

  /** Submits a new certification */
  async create(membershipId: string, input: CreateCertificationInput) {
    return this.certRepo.create({
      membershipId,
      name: input.name,
      issuedDate: new Date(input.issuedDate),
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      documentUrl: input.documentUrl,
    });
  }

  /** Gets a certification by ID */
  async getById(certId: string) {
    return this.certRepo.findById(certId);
  }

  /** Gets all certifications for a member */
  async getByMembership(membershipId: string) {
    return this.certRepo.findByMembershipId(membershipId);
  }

  /** Gets all certifications for an org, optionally filtered by status */
  async getByOrganization(organizationId: string, status?: string) {
    return this.certRepo.findByOrganizationId(organizationId, status);
  }

  /** Verifies or rejects a certification */
  async updateStatus(certId: string, status: string, verifiedById: string) {
    const cert = await this.certRepo.findById(certId);
    if (!cert) throw new Error("Certification not found");

    if (cert.status !== "pending") {
      throw new Error("Can only verify or reject pending certifications");
    }

    return this.certRepo.updateStatus(certId, status, verifiedById);
  }

  /** Deletes a certification */
  async delete(certId: string) {
    const cert = await this.certRepo.findById(certId);
    if (!cert) throw new Error("Certification not found");

    return this.certRepo.delete(certId);
  }

  /** Gets valid (verified, non-expired) certifications for eligibility checks */
  async getValidCertifications(membershipId: string) {
    return this.certRepo.getValidCertifications(membershipId);
  }
}