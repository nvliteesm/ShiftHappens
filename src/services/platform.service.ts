/**
 * Platform Service (Control Layer)
 * 
 * Business logic for platform administration.
 * Manages organization tenants across the entire platform.
 * Only accessible to users with isPlatformAdmin flag.
 */
import { PlatformRepository } from "@/repositories/platform.repository";
import { AuditLogService, ACTIONS } from "@/services/audit-log.service";

export class PlatformService {
  private platformRepo = new PlatformRepository();

  /** Lists all organizations with member and task counts */
  async getOrganizations(limit = 50, offset = 0) {
    const [organizations, total] = await Promise.all([
      this.platformRepo.findAllOrganizations(limit, offset),
      this.platformRepo.countOrganizations(),
    ]);

    return { organizations, total, limit, offset };
  }

  /** Gets a single organization by ID */
  async getOrganizationById(orgId: string) {
    const org = await this.platformRepo.findOrganizationById(orgId);
    if (!org) {
      throw new Error("Organization not found");
    }
    return org;
  }

  /** Toggles an organization's status between active and suspended */
  async toggleOrganizationStatus(orgId: string) {
    const org = await this.platformRepo.findOrganizationById(orgId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const newStatus = org.status === "active" ? "suspended" : "active";
    return this.platformRepo.updateOrganizationStatus(orgId, newStatus);
  }

  /** Gets platform-wide statistics */
  async getStats() {
    return this.platformRepo.getStats();
  }
}