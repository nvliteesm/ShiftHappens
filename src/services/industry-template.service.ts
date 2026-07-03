/**
 * Industry Template Service (Control Layer)
 *
 * Manages industry templates for onboarding.
 * Handles CRUD with validation, name uniqueness,
 * and delegates to existing AI generation for new templates.
 *
 * Platform-level service — not org-scoped.
 */
import { IndustryTemplateRepository } from "@/repositories/industry-template.repository";
import { Prisma } from "@prisma/client";

export interface TemplateDepartmentInput {
  name: string;
  description: string;
  color: string;
}

export interface TemplateWorkRuleInput {
  name: string;
  type: "break_interval" | "max_hours_daily" | "max_hours_weekly";
  hoursThreshold?: number;
  breakHours?: number;
  maxHours?: number;
  reason: string;
}

export class IndustryTemplateService {
  private templateRepo = new IndustryTemplateRepository();

  /** Returns all templates with usage counts — for platform admin */
  async getAllTemplates() {
    const [templates, usageCounts] = await Promise.all([
      this.templateRepo.findAll(),
      this.templateRepo.getUsageCounts(),
    ]);

    return templates.map((t) => ({
      ...t,
      usageCount: usageCounts[t.id] || 0,
    }));
  }

  /** Returns active templates only — for onboarding and settings */
  async getActiveTemplates() {
    return this.templateRepo.findActive();
  }

  /** Returns a single template by ID */
  async getTemplateById(id: string) {
    const template = await this.templateRepo.findById(id);
    if (!template) throw new Error("Template not found");
    return template;
  }

  /** Creates a new template with validation */
  async createTemplate(input: {
    name: string;
    icon: string;
    description: string;
    departments: TemplateDepartmentInput[];
    workRules: TemplateWorkRuleInput[];
    certifications: string[];
    isAiGenerated?: boolean;
  }) {
    // Name uniqueness
    const existing = await this.templateRepo.findByName(input.name);
    if (existing) {
      throw new Error("A template with this name already exists");
    }

    // Validate structure
    this.validateTemplateData(input.departments, input.workRules, input.certifications);

    return this.templateRepo.create({
      name: input.name.trim(),
      icon: input.icon,
      description: input.description.trim(),
      departments: input.departments as unknown as Prisma.InputJsonValue,
      workRules: input.workRules as unknown as Prisma.InputJsonValue,
      certifications: input.certifications as unknown as Prisma.InputJsonValue,
      isAiGenerated: input.isAiGenerated,
    });
  }

  /** Updates an existing template */
  async updateTemplate(
    id: string,
    input: {
      name?: string;
      icon?: string;
      description?: string;
      departments?: TemplateDepartmentInput[];
      workRules?: TemplateWorkRuleInput[];
      certifications?: string[];
      isActive?: boolean;
    }
  ) {
    const template = await this.templateRepo.findById(id);
    if (!template) throw new Error("Template not found");

    // Name uniqueness (if changing)
    if (input.name && input.name !== template.name) {
      const existing = await this.templateRepo.findByName(input.name);
      if (existing) {
        throw new Error("A template with this name already exists");
      }
    }

    // Validate structure if updating content
    if (input.departments || input.workRules || input.certifications) {
      this.validateTemplateData(
        input.departments || (template.departments as unknown as TemplateDepartmentInput[]),
        input.workRules || (template.workRules as unknown as TemplateWorkRuleInput[]),
        input.certifications || (template.certifications as unknown as string[])
      );
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.description !== undefined) updateData.description = input.description.trim();
    if (input.departments !== undefined) updateData.departments = input.departments as unknown as Prisma.InputJsonValue;
    if (input.workRules !== undefined) updateData.workRules = input.workRules as unknown as Prisma.InputJsonValue;
    if (input.certifications !== undefined) updateData.certifications = input.certifications as unknown as Prisma.InputJsonValue;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    if (Object.keys(updateData).length === 0) {
      return template;
    }

    return this.templateRepo.update(id, updateData);
  }

  /** Toggle template active status */
  async toggleStatus(id: string) {
    const template = await this.templateRepo.findById(id);
    if (!template) throw new Error("Template not found");

    if (template.isActive) {
      return this.templateRepo.deactivate(id);
    } else {
      return this.templateRepo.activate(id);
    }
  }

  /** Validates template data structure */
  private validateTemplateData(
    departments: TemplateDepartmentInput[],
    workRules: TemplateWorkRuleInput[],
    certifications: string[]
  ) {
    if (!departments || departments.length === 0) {
      throw new Error("At least one department is required");
    }
    if (departments.length > 10) {
      throw new Error("Maximum 10 departments per template");
    }
    if (workRules.length > 10) {
      throw new Error("Maximum 10 work rules per template");
    }
    if (certifications.length > 15) {
      throw new Error("Maximum 15 certifications per template");
    }

    const validTypes = ["break_interval", "max_hours_daily", "max_hours_weekly"];

    for (const dept of departments) {
      if (!dept.name?.trim()) throw new Error("Department name is required");
      if (!dept.color?.trim()) throw new Error("Department color is required");
    }

    for (const rule of workRules) {
      if (!rule.name?.trim()) throw new Error("Work rule name is required");
      if (!validTypes.includes(rule.type)) {
        throw new Error(`Invalid work rule type: ${rule.type}`);
      }
    }
  }
}