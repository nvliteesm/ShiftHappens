/**
 * Platform Service (Control Layer)
 *
 * Business logic for platform administration.
 * Manages organization tenants across the entire platform.
 * Only accessible to users with isPlatformAdmin flag.
 */
import { PlatformRepository } from "@/repositories/platform.repository";
import { SubscriptionRepository } from "@/repositories/subscription.repository";
import {
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
  getTierConfig,
} from "@/lib/subscription-tiers";

export class PlatformService {
  private platformRepo = new PlatformRepository();
  private subscriptionRepo = new SubscriptionRepository();

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

  /**
   * Updates an organization's subscription tier.
   * Validates the tier value against allowed tiers.
   * Used by platform admin to set/override tiers for demos or upgrades.
   */
  async updateOrganizationTier(orgId: string, tier: string) {
    if (!SUBSCRIPTION_TIERS.includes(tier as SubscriptionTier)) {
      throw new Error(
        `Invalid subscription tier: ${tier}. Must be one of: ${SUBSCRIPTION_TIERS.join(", ")}`
      );
    }

    const org = await this.platformRepo.findOrganizationById(orgId);
    if (!org) {
      throw new Error("Organization not found");
    }

    return this.subscriptionRepo.updateOrganizationTier(orgId, tier);
  }

  /** Gets platform-wide statistics */
  async getStats() {
    return this.platformRepo.getStats();
  }
}