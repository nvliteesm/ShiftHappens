/**
 * Auto-Schedule Service (Control Layer)
 *
 * Generates optimal weekly staff assignments using AI
 * with algorithmic fallback. Three-step workflow:
 * 1. collectWeekData — gathers tasks, staff, availability, rules
 * 2. generateSchedule — AI or algorithmic draft schedule
 * 3. confirmSchedule — creates all assignments in batch
 *
 * AI strategy: Groq → Gemini → algorithmic fallback.
 * The algorithmic fallback uses priority-based assignment
 * with fairness balancing (fewest cumulative hours first).
 */
import { TaskRepository } from "@/repositories/task.repository";
import { AvailabilityRepository } from "@/repositories/availability.repository";
import { CertificationRepository } from "@/repositories/certification.repository";
import { WorkRuleRepository } from "@/repositories/work-rule.repository";
import { TaskAssignmentRepository } from "@/repositories/task-assignment.repository";
import { SettingsRepository } from "@/repositories/settings.repository";
import { MembershipRepository } from "@/repositories/membership.repository";
import { AuditLogService, ACTIONS } from "@/services/audit-log.service";
import { NotificationService, NOTIFICATION_TYPES } from "@/services/notification.service";
import { prisma } from "@/lib/prisma";

interface StaffInfo {
  membershipId: string;
  userId: string;
  name: string;
  role: string;
  departments: string[];
  availability: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }[];
  certifications: string[];
  hoursThisWeek: number;
}

interface TaskInfo {
  id: string;
  title: string;
  departmentId: string | null;
  departmentName: string | null;
  priority: string;
  requiredHeadcount: number;
  currentAssignments: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  requiredCertifications?: string[];
}

export interface DraftAssignment {
  taskId: string;
  taskTitle: string;
  membershipId: string;
  staffName: string;
  reasoning: string;
}

export interface DraftSchedule {
  assignments: DraftAssignment[];
  unfilledTasks: { taskId: string; taskTitle: string; reason: string }[];
  summary: {
    totalTasks: number;
    totalAssignments: number;
    totalUnfilled: number;
    hoursDistribution: { name: string; hours: number }[];
  };
}

interface ScheduleContext {
  tasks: TaskInfo[];
  staff: StaffInfo[];
  workRules: { name: string; type: string; maxHours?: number | null; hoursThreshold?: number | null; breakHours?: number | null }[];
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export class AutoScheduleService {
  private taskRepo = new TaskRepository();
  private availRepo = new AvailabilityRepository();
  private certRepo = new CertificationRepository();
  private workRuleRepo = new WorkRuleRepository();
  private assignmentRepo = new TaskAssignmentRepository();
  private settingsRepo = new SettingsRepository();
  private membershipRepo = new MembershipRepository();
  private auditService = new AuditLogService();
  private notificationService = new NotificationService();

  /**
   * Collects all data needed for schedule generation:
   * open tasks for the week, staff with availability/certs/hours, and work rules.
   */
  async collectWeekData(
    organizationId: string,
    weekStart: Date
  ): Promise<ScheduleContext> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Get all tasks scheduled for this week that need more staff
    const allTasks = await this.taskRepo.findByOrganizationId(organizationId, {
      status: "open",
    });

    const tasks: TaskInfo[] = [];
    for (const task of allTasks) {
      if (!task.scheduledStart || !task.scheduledEnd) continue;
      const start = new Date(task.scheduledStart);
      const end = new Date(task.scheduledEnd);
      if (start >= weekEnd || end <= weekStart) continue;

      const currentAssignments = await this.assignmentRepo.countActiveByTaskId(task.id);
      if (currentAssignments >= task.requiredHeadcount) continue;

      tasks.push({
        id: task.id,
        title: task.title,
        departmentId: task.department?.id || null,
        departmentName: task.department?.name || null,
        priority: task.priority,
        requiredHeadcount: task.requiredHeadcount,
        currentAssignments,
        scheduledStart: start,
        scheduledEnd: end,
      });
    }

    // Get all active staff with their data
    const members = await prisma.membership.findMany({
      where: {
        organizationId,
        status: "active",
        role: { in: ["staff", "manager"] },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        departmentMemberships: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });

    const staff: StaffInfo[] = [];
    for (const member of members) {
      const availability = await this.availRepo.getWeeklySchedule(member.id);
      const certs = await this.certRepo.getValidCertifications(member.id);

      // Calculate hours worked this week from completed assignments
      const assignments = await prisma.taskAssignment.findMany({
        where: {
          membershipId: member.id,
          status: { in: ["accepted", "completed"] },
          clockInTime: { not: null },
          task: {
            scheduledStart: { gte: weekStart },
            scheduledEnd: { lte: weekEnd },
          },
        },
        select: { clockInTime: true, clockOutTime: true },
      });

      let hoursThisWeek = 0;
      for (const a of assignments) {
        if (a.clockInTime && a.clockOutTime) {
          hoursThisWeek +=
            (a.clockOutTime.getTime() - a.clockInTime.getTime()) / 3600000;
        }
      }

      staff.push({
        membershipId: member.id,
        userId: member.user.id,
        name: member.user.name || member.user.email,
        role: member.role,
        departments: member.departmentMemberships.map(
          (dm) => dm.department.name
        ),
        availability: availability.map((a) => ({
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
          isAvailable: a.isAvailable,
        })),
        certifications: certs.map((c) => c.name),
        hoursThisWeek,
      });
    }

    // Get active work rules
    const rules = await this.workRuleRepo.findApplicableRules(organizationId);

    return {
      tasks: tasks.sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 2) -
          (PRIORITY_ORDER[b.priority] ?? 2)
      ),
      staff,
      workRules: rules.map((r) => ({
        name: r.name,
        type: r.type,
        maxHours: r.maxHours,
        hoursThreshold: r.hoursThreshold,
        breakHours: r.breakHours,
      })),
    };
  }

  /**
   * Generates a draft schedule using AI with algorithmic fallback.
   * Returns draft assignments and unfilled tasks.
   */
  async generateSchedule(
    organizationId: string,
    weekStart: Date
  ): Promise<DraftSchedule> {
    const context = await this.collectWeekData(organizationId, weekStart);

    if (context.tasks.length === 0) {
      return {
        assignments: [],
        unfilledTasks: [],
        summary: {
          totalTasks: 0,
          totalAssignments: 0,
          totalUnfilled: 0,
          hoursDistribution: [],
        },
      };
    }

    // Try AI first, fall back to algorithmic
    let draft: DraftSchedule;
    try {
      draft = await this.generateWithAI(context);
    } catch (error) {
      console.log("[Auto-Schedule] AI failed, using algorithmic fallback:", error);
      draft = this.generateAlgorithmic(context);
    }

    return draft;
  }

  /**
   * Algorithmic schedule generation — deterministic fallback.
   * Assigns staff to tasks using priority ordering and fairness balancing.
   */
  private generateAlgorithmic(context: ScheduleContext): DraftSchedule {
    const assignments: DraftAssignment[] = [];
    const unfilledTasks: { taskId: string; taskTitle: string; reason: string }[] = [];

    // Track cumulative hours across assignments
    const cumulativeHours = new Map<string, number>();
    for (const s of context.staff) {
      cumulativeHours.set(s.membershipId, s.hoursThisWeek);
    }

    // Track which staff are assigned to which time slots (conflict detection)
    const staffSlots = new Map<string, { start: number; end: number }[]>();

    for (const task of context.tasks) {
      const slotsNeeded = task.requiredHeadcount - task.currentAssignments;
      const taskStart = task.scheduledStart.getTime();
      const taskEnd = task.scheduledEnd.getTime();
      const taskDuration = (taskEnd - taskStart) / 3600000;
      const taskDayOfWeek = task.scheduledStart.getDay();
      const taskStartHour = `${String(task.scheduledStart.getHours()).padStart(2, "0")}:${String(task.scheduledStart.getMinutes()).padStart(2, "0")}`;
      const taskEndHour = `${String(task.scheduledEnd.getHours()).padStart(2, "0")}:${String(task.scheduledEnd.getMinutes()).padStart(2, "0")}`;

      const assignedToThisTask: DraftAssignment[] = [];

      // Rank eligible staff
      const candidates = context.staff
        .filter((s) => {
          // Check availability on task day
          const daySchedule = s.availability.find(
            (a) => a.dayOfWeek === taskDayOfWeek
          );
          if (!daySchedule || !daySchedule.isAvailable) return false;
          if (daySchedule.startTime > taskStartHour) return false;
          if (daySchedule.endTime < taskEndHour) return false;

          // Check scheduling conflicts with already-assigned slots
          const existingSlots = staffSlots.get(s.membershipId) || [];
          const hasConflict = existingSlots.some(
            (slot) => taskStart < slot.end && taskEnd > slot.start
          );
          if (hasConflict) return false;

          // Check work rules
          const hours = cumulativeHours.get(s.membershipId) || 0;
          for (const rule of context.workRules) {
            if (rule.type === "max_hours_weekly" && rule.maxHours) {
              if (hours + taskDuration > rule.maxHours) return false;
            }
            if (rule.type === "max_hours_daily" && rule.maxHours) {
              if (taskDuration > rule.maxHours) return false;
            }
          }

          return true;
        })
        .map((s) => {
          const hours = cumulativeHours.get(s.membershipId) || 0;
          const inDepartment = task.departmentName
            ? s.departments.includes(task.departmentName)
            : false;
          const hasCerts = task.requiredCertifications
            ? task.requiredCertifications.every((c) =>
                s.certifications.includes(c)
              )
            : true;

          // Score: lower hours = higher priority (fairness)
          // Department match and certs add bonus
          const fairnessScore = 100 - Math.min(hours, 100);
          const deptScore = inDepartment ? 25 : 0;
          const certScore = hasCerts ? 25 : 0;

          return {
            ...s,
            score: fairnessScore + deptScore + certScore,
            hours,
            inDepartment,
          };
        })
        .sort((a, b) => b.score - a.score);

      // Assign top candidates
      for (
        let i = 0;
        i < candidates.length && assignedToThisTask.length < slotsNeeded;
        i++
      ) {
        const candidate = candidates[i];
        const reasons: string[] = [];
        if (candidate.inDepartment) reasons.push("department match");
        reasons.push(`${Math.round(candidate.hours)}h this week`);
        if (candidate.certifications.length > 0)
          reasons.push("certified");

        assignedToThisTask.push({
          taskId: task.id,
          taskTitle: task.title,
          membershipId: candidate.membershipId,
          staffName: candidate.name,
          reasoning: reasons.join(", "),
        });

        // Update cumulative tracking
        cumulativeHours.set(
          candidate.membershipId,
          (cumulativeHours.get(candidate.membershipId) || 0) + taskDuration
        );

        // Track time slot
        const slots = staffSlots.get(candidate.membershipId) || [];
        slots.push({ start: taskStart, end: taskEnd });
        staffSlots.set(candidate.membershipId, slots);
      }

      assignments.push(...assignedToThisTask);

      if (assignedToThisTask.length < slotsNeeded) {
        unfilledTasks.push({
          taskId: task.id,
          taskTitle: task.title,
          reason: `Only ${assignedToThisTask.length} of ${slotsNeeded} slots could be filled — no eligible staff remaining`,
        });
      }
    }

    // Build hours distribution
    const hoursMap = new Map<string, number>();
    for (const a of assignments) {
      const task = context.tasks.find((t) => t.id === a.taskId);
      if (task) {
        const duration =
          (task.scheduledEnd.getTime() - task.scheduledStart.getTime()) /
          3600000;
        hoursMap.set(
          a.staffName,
          (hoursMap.get(a.staffName) || 0) + duration
        );
      }
    }

    return {
      assignments,
      unfilledTasks,
      summary: {
        totalTasks: context.tasks.length,
        totalAssignments: assignments.length,
        totalUnfilled: unfilledTasks.length,
        hoursDistribution: Array.from(hoursMap.entries())
          .map(([name, hours]) => ({ name, hours: Math.round(hours) }))
          .sort((a, b) => b.hours - a.hours),
      },
    };
  }

  /**
   * AI-powered schedule generation using Groq or Gemini.
   * Falls back to algorithmic if AI response is unparseable.
   */
  private async generateWithAI(
    context: ScheduleContext
  ): Promise<DraftSchedule> {
    const prompt = this.buildAIPrompt(context);

    // Try Groq first
    let aiResponse: string | null = null;
    try {
      aiResponse = await this.callGroq(prompt);
    } catch {
      // Try Gemini
      try {
        aiResponse = await this.callGemini(prompt);
      } catch {
        throw new Error("Both AI providers failed");
      }
    }

    if (!aiResponse) throw new Error("Empty AI response");

    // Parse AI response
    try {
      const parsed = this.parseAIResponse(aiResponse, context);
      if (parsed.assignments.length === 0 && context.tasks.length > 0) {
        console.log("[Auto-Schedule] AI produced no valid assignments, using algorithmic fallback");
        return this.generateAlgorithmic(context);
      }
      return parsed;
    } catch {
      console.log("[Auto-Schedule] Failed to parse AI response, using algorithmic");
      return this.generateAlgorithmic(context);
    }
  }

  private buildAIPrompt(context: ScheduleContext): string {
    const taskList = context.tasks
      .map(
        (t) =>
          `- ${t.title} (${t.departmentName || "no dept"}, ${t.priority} priority, needs ${t.requiredHeadcount - t.currentAssignments} staff, ${t.scheduledStart.toLocaleString()} to ${t.scheduledEnd.toLocaleString()})`
      )
      .join("\n");

    const staffList = context.staff
      .map(
        (s) =>
          `- ${s.name} (${s.departments.join(", ") || "no dept"}, ${s.hoursThisWeek}h this week, certs: ${s.certifications.join(", ") || "none"}, available: ${s.availability.filter((a) => a.isAvailable).map((a) => `day${a.dayOfWeek} ${a.startTime}-${a.endTime}`).join(", ")})`
      )
      .join("\n");

    const rulesList = context.workRules
      .map((r) => {
        if (r.type === "max_hours_weekly") return `- ${r.name}: max ${r.maxHours}h per week`;
        if (r.type === "max_hours_daily") return `- ${r.name}: max ${r.maxHours}h per day`;
        return `- ${r.name}: break after ${r.hoursThreshold}h`;
      })
      .join("\n");

    return `You are a workforce scheduler. Generate optimal staff assignments for these tasks.

TASKS:
${taskList}

STAFF:
${staffList}

WORK RULES:
${rulesList || "None"}

INSTRUCTIONS:
1. Assign staff to tasks respecting availability, scheduling conflicts, and work rules.
2. Distribute hours fairly across staff (prioritize those with fewer hours).
3. Prefer staff in the matching department.
4. Each staff member can only work one task at a time (no overlapping schedules).

Respond ONLY with a JSON array of assignments:
[{"taskId": "...", "membershipId": "...", "reasoning": "brief reason"}]

If a task cannot be fully staffed, include fewer assignments for it. Do not invent staff or task IDs.`;
  }

  private async callGroq(prompt: string): Promise<string> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) throw new Error(`Groq error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  private async callGemini(prompt: string): Promise<string> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  private parseAIResponse(
    response: string,
    context: ScheduleContext
  ): DraftSchedule {
    // Extract JSON from response (may have markdown fences)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");

    const raw = JSON.parse(jsonMatch[0]) as {
      taskId: string;
      membershipId: string;
      reasoning: string;
    }[];

    // Validate and enrich with names
    const validTaskIds = new Set(context.tasks.map((t) => t.id));
    const validStaffIds = new Set(context.staff.map((s) => s.membershipId));

    const assignments: DraftAssignment[] = raw
      .filter((a) => validTaskIds.has(a.taskId) && validStaffIds.has(a.membershipId))
      .map((a) => ({
        taskId: a.taskId,
        taskTitle: context.tasks.find((t) => t.id === a.taskId)?.title || "",
        membershipId: a.membershipId,
        staffName:
          context.staff.find((s) => s.membershipId === a.membershipId)?.name || "",
        reasoning: a.reasoning || "AI recommended",
      }));

    // Find unfilled tasks
    const assignmentCounts = new Map<string, number>();
    for (const a of assignments) {
      assignmentCounts.set(a.taskId, (assignmentCounts.get(a.taskId) || 0) + 1);
    }

    const unfilledTasks = context.tasks
      .filter((t) => {
        const needed = t.requiredHeadcount - t.currentAssignments;
        const assigned = assignmentCounts.get(t.id) || 0;
        return assigned < needed;
      })
      .map((t) => ({
        taskId: t.id,
        taskTitle: t.title,
        reason: `AI assigned ${assignmentCounts.get(t.id) || 0} of ${t.requiredHeadcount - t.currentAssignments} needed`,
      }));

    // Hours distribution
    const hoursMap = new Map<string, number>();
    for (const a of assignments) {
      const task = context.tasks.find((t) => t.id === a.taskId);
      if (task) {
        const duration =
          (task.scheduledEnd.getTime() - task.scheduledStart.getTime()) /
          3600000;
        hoursMap.set(a.staffName, (hoursMap.get(a.staffName) || 0) + duration);
      }
    }

    return {
      assignments,
      unfilledTasks,
      summary: {
        totalTasks: context.tasks.length,
        totalAssignments: assignments.length,
        totalUnfilled: unfilledTasks.length,
        hoursDistribution: Array.from(hoursMap.entries())
          .map(([name, hours]) => ({ name, hours: Math.round(hours) }))
          .sort((a, b) => b.hours - a.hours),
      },
    };
  }

  /**
   * Confirms a draft schedule by creating all assignments in batch.
   * Fires notifications to all assigned staff.
   */
  async confirmSchedule(
    organizationId: string,
    assignments: DraftAssignment[],
    confirmedById: string
  ) {
    const settings = await this.settingsRepo.getOrCreate(organizationId);
    const assignmentStatus =
      settings.taskAcceptanceMode === "auto_accept" ? "accepted" : "pending";

    const created = [];
    for (const draft of assignments) {
      try {
        const assignment = await this.assignmentRepo.create({
          taskId: draft.taskId,
          membershipId: draft.membershipId,
          assignedById: confirmedById,
          status: assignmentStatus,
        });
        created.push(assignment);

        // Notify assigned staff
        const member = await this.membershipRepo.findById(draft.membershipId);
        if (member) {
          void this.notificationService.notify(
            member.userId,
            NOTIFICATION_TYPES.TASK_ASSIGNED,
            "New task assignment",
            `You've been assigned to "${draft.taskTitle}"`,
            "assignment",
            draft.taskId
          );
        }
      } catch (error) {
        console.error(
          `[Auto-Schedule] Failed to create assignment for ${draft.staffName} → ${draft.taskTitle}:`,
          error
        );
      }
    }

    await this.auditService.log({
      organizationId,
      userId: confirmedById,
      action: ACTIONS.TASK_ASSIGNED,
      entityType: "auto-schedule",
      details: {
        assignmentsCreated: created.length,
        totalPlanned: assignments.length,
        status: assignmentStatus,
      },
    });

    return {
      created: created.length,
      failed: assignments.length - created.length,
    };
  }
}