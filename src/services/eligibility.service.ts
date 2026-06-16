/**
 * Eligibility Service (Control Layer)
 *
 * The core eligibility engine. Checks four dimensions to determine
 * if a staff member is eligible for a task assignment:
 *
 * 1. HOURS LIMIT — Has the member exceeded the company break rule threshold?
 * 2. AVAILABILITY — Is the member available at the task's scheduled time?
 * 3. SCHEDULING — Does the member have conflicting assignments?
 * 4. WORK RULES — Does the assignment violate any custom work rules?
 *    (break_interval, max_hours_daily, max_hours_weekly)
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
import { WorkRuleRepository } from "@/repositories/work-rule.repository";
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
    workRules: EligibilityCheck;
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
  private workRuleRepo = new WorkRuleRepository();

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

    // Get all active work rules for this org (no role filtering — check all, filter per member later)
    const allWorkRules = await this.workRuleRepo.findApplicableRules(organizationId);

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
        taskId,
        member.id,
        "hours_limit"
      );
      const hasAvailOverride = await this.overrideRepo.hasOverride(
        taskId,
        member.id,
        "availability"
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

      // 4. Check work rules
      const workRulesCheck = await this.checkWorkRules(
        member.id,
        allWorkRules,
        task
      );

      const eligible =
        hoursCheck.eligible &&
        availCheck.eligible &&
        schedulingCheck.eligible &&
        workRulesCheck.eligible;

      results.push({
        membershipId: member.id,
        memberName: member.user.name || member.user.email,
        eligible,
        checks: {
          hoursLimit: hoursCheck,
          availability: availCheck,
          scheduling: schedulingCheck,
          workRules: workRulesCheck,
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
          (assignment.clockOutTime.getTime() -
            assignment.clockInTime.getTime()) /
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
   * Checks all applicable work rules against a staff member.
   * Returns ineligible with the first violated rule's name and reason.
   *
   * Rule types:
   * - break_interval: hours worked in last 24h vs threshold
   * - max_hours_daily: hours worked on the task's scheduled date
   * - max_hours_weekly: hours worked in the task's scheduled week
   */
  private async checkWorkRules(
    membershipId: string,
    rules: Awaited<ReturnType<WorkRuleRepository["findApplicableRules"]>>,
    task: { scheduledStart: Date | null; scheduledEnd: Date | null }
  ): Promise<EligibilityCheck> {
    if (rules.length === 0) {
      return { eligible: true };
    }

    for (const rule of rules) {
      let violated = false;
      let reason = "";

      switch (rule.type) {
        case "break_interval": {
          if (!rule.hoursThreshold) break;
          const hours = await this.getHoursInLast24h(membershipId);
          if (hours >= rule.hoursThreshold) {
            violated = true;
            reason = `Worked ${hours.toFixed(1)}h in last 24h (rule "${rule.name}": max ${rule.hoursThreshold}h before break)`;
          }
          break;
        }

        case "max_hours_daily": {
          if (!rule.maxHours || !task.scheduledStart) break;
          const dailyHours = await this.getHoursOnDate(
            membershipId,
            task.scheduledStart
          );
          if (dailyHours >= rule.maxHours) {
            violated = true;
            reason = `Already worked ${dailyHours.toFixed(1)}h on this day (rule "${rule.name}": max ${rule.maxHours}h/day)`;
          }
          break;
        }

        case "max_hours_weekly": {
          if (!rule.maxHours || !task.scheduledStart) break;
          const weeklyHours = await this.getHoursInWeek(
            membershipId,
            task.scheduledStart
          );
          if (weeklyHours >= rule.maxHours) {
            violated = true;
            reason = `Already worked ${weeklyHours.toFixed(1)}h this week (rule "${rule.name}": max ${rule.maxHours}h/week)`;
          }
          break;
        }
      }

      if (violated) {
        return { eligible: false, reason };
      }
    }

    return { eligible: true };
  }

  /** Gets total hours worked in the last 24 hours */
  private async getHoursInLast24h(membershipId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const assignments = await prisma.taskAssignment.findMany({
      where: {
        membershipId,
        status: "completed",
        clockInTime: { gte: oneDayAgo },
        clockOutTime: { not: null },
      },
    });

    return this.sumHours(assignments);
  }

  /** Gets total hours worked on a specific calendar date */
  private async getHoursOnDate(
    membershipId: string,
    date: Date
  ): Promise<number> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const assignments = await prisma.taskAssignment.findMany({
      where: {
        membershipId,
        status: "completed",
        clockInTime: { gte: dayStart, lt: dayEnd },
        clockOutTime: { not: null },
      },
    });

    return this.sumHours(assignments);
  }

  /** Gets total hours worked in the calendar week containing the date */
  private async getHoursInWeek(
    membershipId: string,
    date: Date
  ): Promise<number> {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday-based week
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const assignments = await prisma.taskAssignment.findMany({
      where: {
        membershipId,
        status: "completed",
        clockInTime: { gte: weekStart, lt: weekEnd },
        clockOutTime: { not: null },
      },
    });

    return this.sumHours(assignments);
  }

  /** Sums clock-in/out durations to total hours */
  private sumHours(
    assignments: { clockInTime: Date | null; clockOutTime: Date | null }[]
  ): number {
    let total = 0;
    for (const a of assignments) {
      if (a.clockInTime && a.clockOutTime) {
        total +=
          (a.clockOutTime.getTime() - a.clockInTime.getTime()) /
          (1000 * 60 * 60);
      }
    }
    return Math.round(total * 10) / 10;
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