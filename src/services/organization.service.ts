/**
 * Organization Service (Control Layer)
 *
 * Handles organization creation with unique slug generation,
 * industry template application, and retrieval of user's organizations.
 *
 * Template application bypasses subscription tier limits —
 * it's initialization during org creation, not a regular user action.
 * After setup, all further additions are subject to tier limits.
 */
import { OrganizationRepository } from "@/repositories/organization.repository";
import {
  getTemplateById,
  validateCustomTemplate,
  CUSTOM_TEMPLATE_ID,
  type TemplateDefinition,
  type CustomTemplateData,
} from "@/lib/industry-templates";
import { prisma } from "@/lib/prisma";
import type { CreateOrganizationInput } from "@/lib/validations";

export class OrganizationService {
  private orgRepo = new OrganizationRepository();

  /**
   * Creates a new organization:
   * 1. Generate a unique URL-friendly slug from the org name
   * 2. Create the org with the creator as company_admin
   * 3. Apply industry template if selected (bypasses tier limits)
   */
  async create(
    input: CreateOrganizationInput,
    userId: string,
    templateId?: string,
    customTemplate?: CustomTemplateData
  ) {
    const slug = await this.generateUniqueSlug(input.name);

    const org = await this.orgRepo.create(
      {
        name: input.name,
        slug,
        industry: input.industry,
        description: input.description,
      },
      userId
    );

    // Apply template (fire-and-forget pattern — org is created regardless)
    try {
      if (templateId && templateId !== CUSTOM_TEMPLATE_ID) {
        const template = getTemplateById(templateId);
        if (template) {
          await this.applyTemplate(org.id, template);
        }
      } else if (customTemplate && validateCustomTemplate(customTemplate)) {
        await this.applyCustomTemplate(org.id, customTemplate);
      }
    } catch (error) {
      console.error("[Template Application Error]", error);
      // Org is created — user can configure departments and rules manually
    }

    return org;
  }

  /** Retrieves all organizations a user belongs to */
  async getUserOrganizations(userId: string) {
    return this.orgRepo.findByUserId(userId);
  }

  /**
   * Applies a static industry template to an organization.
   * Creates departments and work rules from the template definition.
   * Uses prisma directly — bypasses service-level tier checks.
   */
  private async applyTemplate(orgId: string, template: TemplateDefinition) {
    // Create departments
    for (const dept of template.departments) {
      await prisma.department.create({
        data: {
          organizationId: orgId,
          name: dept.name,
          description: dept.description,
          color: dept.color,
        },
      });
    }

    // Create work rules
    for (const rule of template.workRules) {
      await prisma.workRule.create({
        data: {
          organizationId: orgId,
          name: rule.name,
          type: rule.type,
          hoursThreshold: rule.hoursThreshold ?? null,
          breakHours: rule.breakHours ?? null,
          maxHours: rule.maxHours ?? null,
          isActive: true,
        },
      });
    }
  }

  /**
   * Applies an AI-generated or manually crafted custom template.
   * Validates the data structure before creating resources.
   */
  private async applyCustomTemplate(orgId: string, template: CustomTemplateData) {
    // Create departments
    for (const dept of template.departments) {
      await prisma.department.create({
        data: {
          organizationId: orgId,
          name: dept.name,
          description: dept.description || "",
          color: dept.color || "#6B7280",
        },
      });
    }

    // Create work rules
    for (const rule of template.workRules) {
      await prisma.workRule.create({
        data: {
          organizationId: orgId,
          name: rule.name,
          type: rule.type,
          hoursThreshold: rule.hoursThreshold ?? null,
          breakHours: rule.breakHours ?? null,
          maxHours: rule.maxHours ?? null,
          isActive: true,
        },
      });
    }
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