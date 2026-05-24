/**
 * Eligibility Service (Control Layer)
 * 
 * The core eligibility engine. Checks three dimensions to determine
 * if a staff member is eligible for a task assignment:
 * 
 * 1. HOURS LIMIT — Has the member exceeded the break rule threshold?
 *    Uses company settings breakRuleHoursWorked to check recent hours.
 * 
 * 2. AVAILABILITY — Is the member available at the task's scheduled time?
 *    Checks weekly schedule and date overrides.
 * 
 * 3. CERTIFICATIONS — Does the member have required certifications?
 *    (Placeholder for now — tasks don't yet specify required certs)
 * 
 * Each dimension returns eligible/ineligible with a reason.
 * Eligibility overrides can bypass specific rules with documentation.
 */
import { AvailabilityRepository } from "@/repositories/availability.repository";
import { CertificationRepository } from "@/repositories/certification.repository";
import { EligibilityOverrideRepository } from "@/repositories/eligibility-override.repository";
import { SettingsRepository } from "@/repositories/settings.repository";
import { TaskAssignmentRepository } from "@/repositories/task-assignment.repository";
import { MembershipRepository } from "@/repositories/membership.repository";
import { prisma } from "@/lib/prisma";

interface EligibilityCheck {
  eligible: boolean;
  reason?: string;
}

interface StaffEligibility {
  membershipId: string;
  memberName: string;
  eligible: boolean;
  checks: {
    hoursLimit: EligibilityCheck;
    availability: EligibilityCheck;
    scheduling: EligibilityCheck;
  };
  overrides: string[];
}

export class EligibilityService {
  private availRepo = new AvailabilityRepository();
  private certRepo = new CertificationRepository();
  private overrideRepo = new EligibilityOverrideRepository();
  private settingsRepo = new SettingsRepository();
  private assignmentRepo = new TaskAssignmentRepository();
  private membershipRepo = new MembershipRepository();

  /**
   * Checks eligibility for all active staff in an organization
   * against a specific task. Returns a list of staff with
   * their eligibility status and reasons.
   */
  async checkEligibilityForTask(
    taskId: string,
    organizationId: string
  ): Promise<StaffEligibility[]> {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error("Task not found");

    const settings = await this.settingsRepo.getOrCreate(organizationId);

    // Get all active non-admin members
    const allMembers = await this.membershipRepo.findByOrgId(organizationId);
    const eligibleMembers = allMembers.filter(
      (m) => m.status === "active" && m.role !== "company_admin"
    );

    const results: StaffEligibility[] = [];

    for (const member of eligibleMembers) {
      // Check for existing overrides
      const overrides: string[] = [];
      const hasHoursOverride = await this.overrideRepo.hasOverride(
        taskId, member.id, "hours_limit"
      );
      const hasAvailOverride = await this.overrideRepo.hasOverride(
        taskId, member.id, "availability"
      );
      if (hasHoursOverride) overrides.push("hours_limit");
      if (hasAvailOverride) overrides.push("availability");

      // 1. Check hours limit
      const hoursCheck = hasHoursOverride
        ? { eligible: true, reason: "Override applied" }
        : await this.checkHoursLimit(member.id, settings.breakRuleHoursWorked);

      // 2. Check availability
      let availCheck: EligibilityCheck = { eligible: true };
      if (task.scheduledStart && task.scheduledEnd) {
        const startTime = task.scheduledStart.toISOString().slice(11, 16);
        const endTime = task.scheduledEnd.toISOString().slice(11, 16);

        if (hasAvailOverride) {
          availCheck = { eligible: true, reason: "Override applied" };
        } else {
          const availResult = await this.availRepo.isAvailableAt(
            member.id,
            task.scheduledStart,
            startTime,
            endTime
          );
          availCheck = {
            eligible: availResult.available,
            reason: availResult.reason,
          };
        }
      }

      // 3. Check scheduling conflicts
      const schedulingCheck = await this.checkSchedulingConflicts(
        member.id,
        task
      );

      const eligible =
        hoursCheck.eligible &&
        availCheck.eligible &&
        schedulingCheck.eligible;

      results.push({
        membershipId: member.id,
        memberName: member.user.name || member.user.email,
        eligible,
        checks: {
          hoursLimit: hoursCheck,
          availability: availCheck,
          scheduling: schedulingCheck,
        },
        overrides,
      });
    }

    return results;
  }

  /**
   * Checks if a member has exceeded the hours limit.
   * Looks at hours worked in the last 24 hours based on clock in/out data.
   */
  async checkHoursLimit(
    membershipId: string,
    maxHours: number
  ): Promise<EligibilityCheck> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentAssignments = await prisma.taskAssignment.findMany({
      where: {
        membershipId,
        status: "completed",
        clockInTime: { gte: oneDayAgo },
        clockOutTime: { not: null },
      },
    });

    let totalHours = 0;
    for (const assignment of recentAssignments) {
      if (assignment.clockInTime && assignment.clockOutTime) {
        const hours =
          (assignment.clockOutTime.getTime() - assignment.clockInTime.getTime()) /
          (1000 * 60 * 60);
        totalHours += hours;
      }
    }

    if (totalHours >= maxHours) {
      return {
        eligible: false,
        reason: `Worked ${totalHours.toFixed(1)}h in last 24h (limit: ${maxHours}h)`,
      };
    }

    return {
      eligible: true,
      reason: `${totalHours.toFixed(1)}h worked of ${maxHours}h limit`,
    };
  }

  /**
   * Checks for scheduling conflicts with existing assignments.
   */
  private async checkSchedulingConflicts(
    membershipId: string,
    task: { id: string; scheduledStart: Date | null; scheduledEnd: Date | null }
  ): Promise<EligibilityCheck> {
    if (!task.scheduledStart || !task.scheduledEnd) {
      return { eligible: true, reason: "No schedule set" };
    }

    const conflicts = await prisma.task.findMany({
      where: {
        assignments: {
          some: {
            membershipId,
            status: { in: ["pending", "accepted"] },
          },
        },
        scheduledStart: { lt: task.scheduledEnd },
        scheduledEnd: { gt: task.scheduledStart },
        id: { not: task.id },
      },
      select: { title: true },
    });

    if (conflicts.length > 0) {
      return {
        eligible: false,
        reason: `Conflicts with: ${conflicts.map((c) => c.title).join(", ")}`,
      };
    }

    return { eligible: true };
  }

  /**
   * Creates an eligibility override for a specific member and task.
   * Used by managers to bypass eligibility blocks with documentation.
   */
  async createOverride(
    taskId: string,
    membershipId: string,
    overriddenById: string,
    reason: string,
    ruleOverridden: string
  ) {
    return this.overrideRepo.create({
      taskId,
      membershipId,
      overriddenById,
      reason,
      ruleOverridden,
    });
  }

  /** Gets all overrides for a task */
  async getOverridesForTask(taskId: string) {
    return this.overrideRepo.findByTaskId(taskId);
  }
}