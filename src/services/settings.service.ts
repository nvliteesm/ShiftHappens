/**
 * Settings Service (Control Layer)
 * 
 * Business logic for company settings management.
 * Uses lazy initialization — settings are created with defaults
 * on first access, so no explicit setup step is needed.
 * 
 * Notification preferences are stored as JSON string in the database
 * but accepted as objects in the API for ease of use.
 */
import { SettingsRepository } from "@/repositories/settings.repository";
import { AuditLogService, ACTIONS } from "@/services/audit-log.service";
import type { UpdateCompanySettingsInput } from "@/lib/validations";

export class SettingsService {
  private settingsRepo = new SettingsRepository();
  private auditService = new AuditLogService();

  /** Gets settings for an org, creating defaults if none exist */
  async getSettings(organizationId: string) {
    return this.settingsRepo.getOrCreate(organizationId);
  }

  /**
   * Updates company settings.
   * Ensures settings exist before updating (lazy init).
   * Serializes notification preferences to JSON for storage.
   */
  async updateSettings(
    organizationId: string,
    input: UpdateCompanySettingsInput,
    userId?: string
  ) {
    // Ensure settings exist
    await this.settingsRepo.getOrCreate(organizationId);

    // Build update data, serializing nested objects to JSON
    const updateData: {
      allocationMode?: string;
      taskAcceptanceMode?: string;
      breakRuleHoursWorked?: number;
      breakRuleBreakHours?: number;
      notificationPreferences?: string;
    } = {};

    if (input.allocationMode) updateData.allocationMode = input.allocationMode;
    if (input.taskAcceptanceMode) updateData.taskAcceptanceMode = input.taskAcceptanceMode;
    if (input.breakRuleHoursWorked) updateData.breakRuleHoursWorked = input.breakRuleHoursWorked;
    if (input.breakRuleBreakHours) updateData.breakRuleBreakHours = input.breakRuleBreakHours;
    if (input.notificationPreferences) {
      updateData.notificationPreferences = JSON.stringify(input.notificationPreferences);
    }

    const settings = await this.settingsRepo.update(organizationId, updateData);

    await this.auditService.log({
      organizationId,
      userId,
      action: ACTIONS.SETTINGS_UPDATED,
      entityType: "settings",
      details: updateData,
    });

    return settings;
  }
}