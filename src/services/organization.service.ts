import { OrganizationRepository } from "@/repositories/organization.repository";
import type { CreateOrganizationInput } from "@/lib/validations";

export class OrganizationService {
  private orgRepo = new OrganizationRepository();

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

  async getUserOrganizations(userId: string) {
    return this.orgRepo.findByUserId(userId);
  }

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