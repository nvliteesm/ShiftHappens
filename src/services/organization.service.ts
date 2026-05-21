/**
 * Organization Service (Control Layer)
 * 
 * Handles organization creation with unique slug generation
 * and retrieval of user's organizations.
 * 
 * Slug generation: Converts org name to kebab-case.
 * If the slug already exists, appends a random 6-character suffix
 * to ensure uniqueness.
 */
import { OrganizationRepository } from "@/repositories/organization.repository";
import type { CreateOrganizationInput } from "@/lib/validations";

export class OrganizationService {
  private orgRepo = new OrganizationRepository();

  /**
   * Creates a new organization:
   * 1. Generate a unique URL-friendly slug from the org name
   * 2. Create the org with the creator as company_admin
   */
  async create(input: CreateOrganizationInput, userId: string) {
    const slug = await this.generateUniqueSlug(input.name);

    return this.orgRepo.create(
      {
        name: input.name,
        slug,
        industry: input.industry,
        description: input.description,
      },
      userId
    );
  }

  /** Retrieves all organizations a user belongs to */
  async getUserOrganizations(userId: string) {
    return this.orgRepo.findByUserId(userId);
  }

  /**
   * Generates a unique URL-friendly slug from an organization name.
   * Example: "Acme Corp" → "acme-corp"
   * If "acme-corp" exists, generates "acme-corp-k7f2m3"
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const exists = await this.orgRepo.slugExists(baseSlug);
    if (!exists) return baseSlug;

    const suffix = Math.random().toString(36).substring(2, 8);
    return `${baseSlug}-${suffix}`;
  }
}