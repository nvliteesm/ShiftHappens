/**
 * Allocation Service (Control Layer)
 * 
 * Orchestrates the three allocation modes:
 * 1. Manual — admin picks from eligibility list (handled by existing UI)
 * 2. Suggested — AI ranks eligible staff, admin confirms
 * 3. Auto — AI ranks and assigns top N automatically
 * 
 * Uses the Strategy pattern to swap AI providers.
 * Gathers staff attributes from multiple sources (hours worked,
 * certifications, availability, department history) and sends
 * them to the AI provider for intelligent ranking.
 */
import type { AIProvider, StaffCandidate, RankedStaff } from "./ai-provider";
import { GroqProvider } from "./providers/groq.provider";
import { GeminiProvider } from "./providers/gemini.provider";
import { EligibilityService } from "./eligibility.service";
import { CertificationRepository } from "@/repositories/certification.repository";
import { SettingsRepository } from "@/repositories/settings.repository";
import { TaskRepository } from "@/repositories/task.repository";
import { TaskService } from "./task.service";
import { prisma } from "@/lib/prisma";

export class AllocationService {
  private aiProvider: AIProvider;
  private eligibilityService = new EligibilityService();
  private certRepo = new CertificationRepository();
  private settingsRepo = new SettingsRepository();
  private taskRepo = new TaskRepository();
  private taskService = new TaskService();

  constructor(provider?: string) {
    // Strategy pattern: select AI provider based on config
    const selectedProvider = provider || process.env.AI_PROVIDER || "groq";
    switch (selectedProvider) {
      case "gemini":
        this.aiProvider = new GeminiProvider();
        break;
      case "groq":
      default:
        this.aiProvider = new GroqProvider();
        break;
    }
  }

  /**
   * Gets AI-ranked suggestions for a task.
   * Gathers staff attributes and sends to AI for ranking.
   */
  async getSuggestions(
    taskId: string,
    organizationId: string
  ): Promise<RankedStaff[]> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error("Task not found");

    // Get eligibility results
    const eligibility = await this.eligibilityService.checkEligibilityForTask(
      taskId,
      organizationId
    );

    // Filter to eligible staff only
    const eligibleStaff = eligibility.filter((e) => e.eligible);

    if (eligibleStaff.length === 0) {
      return [];
    }

    // Gather detailed attributes for each eligible staff member
    const settings = await this.settingsRepo.getOrCreate(organizationId);
    const candidates: StaffCandidate[] = [];

    for (const staff of eligibleStaff) {
      const candidate = await this.buildCandidate(
        staff.membershipId,
        staff.memberName,
        settings.breakRuleHoursWorked,
        task.departmentId
      );
      candidates.push(candidate);
    }

    // Send to AI for ranking
    const rankings = await this.aiProvider.rankStaff(
      {
        title: task.title,
        department: task.department?.name || null,
        priority: task.priority,
        scheduledStart: task.scheduledStart?.toISOString() || null,
        scheduledEnd: task.scheduledEnd?.toISOString() || null,
        requiredHeadcount: task.requiredHeadcount,
      },
      candidates
    );

    return rankings;
  }

  /**
   * Auto-allocates staff to a task.
   * Gets AI rankings and assigns top N based on requiredHeadcount.
   */
  async autoAllocate(
    taskId: string,
    organizationId: string,
    assignedById: string
  ) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error("Task not found");

    const settings = await this.settingsRepo.getOrCreate(organizationId);
    if (settings.allocationMode !== "auto") {
      throw new Error("Auto allocation is not enabled");
    }

    const rankings = await this.getSuggestions(taskId, organizationId);

    // Take top N based on required headcount
    const topN = rankings.slice(0, task.requiredHeadcount);

    if (topN.length === 0) {
      throw new Error("No eligible staff found for auto allocation");
    }

    // Assign the top-ranked staff
    const membershipIds = topN.map((r) => r.membershipId);
    return this.taskService.assignStaff(
      taskId,
      organizationId,
      membershipIds,
      assignedById
    );
  }

  /**
   * Builds a StaffCandidate object with all attributes
   * needed for AI ranking.
   */
  private async buildCandidate(
    membershipId: string,
    name: string,
    maxHours: number,
    departmentId: string | null
  ): Promise<StaffCandidate> {
    // Get hours worked in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAssignments = await prisma.taskAssignment.findMany({
      where: {
        membershipId,
        status: "completed",
        clockInTime: { gte: oneDayAgo },
        clockOutTime: { not: null },
      },
    });

    let hoursWorkedToday = 0;
    for (const a of recentAssignments) {
      if (a.clockInTime && a.clockOutTime) {
        hoursWorkedToday +=
          (a.clockOutTime.getTime() - a.clockInTime.getTime()) / (1000 * 60 * 60);
      }
    }

    // Get valid certifications
    const certs = await this.certRepo.getValidCertifications(membershipId);
    const certNames = certs.map((c) => c.name);

    // Get availability summary
    const availability = await prisma.availability.findMany({
      where: { membershipId },
      orderBy: { dayOfWeek: "asc" },
    });
    const availableHours = availability
      .filter((a) => a.isAvailable)
      .map((a) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][a.dayOfWeek]} ${a.startTime}-${a.endTime}`)
      .join(", ") || "Not set";

    // Get department history (how many times assigned to tasks in this dept)
    let departmentHistory = 0;
    if (departmentId) {
      departmentHistory = await prisma.taskAssignment.count({
        where: {
          membershipId,
          task: { departmentId },
          status: { in: ["accepted", "completed"] },
        },
      });
    }

    return {
      membershipId,
      name,
      hoursWorkedToday: Math.round(hoursWorkedToday * 10) / 10,
      maxHours,
      certifications: certNames,
      availableHours,
      departmentHistory,
    };
  }
}