/**
 * AI Dashboard Service (Control Layer)
 * 
 * Generates AI-powered dashboard insights including:
 * - Natural language workforce summary (US-67)
 * - Proactive staffing alerts (US-68)
 * - Rejection pattern analysis (US-70)
 * 
 * Uses the same AI provider infrastructure (Groq/Gemini/fallback)
 * as the allocation service. All insights are advisory — the
 * admin always has final decision authority.
 */
import { TaskRepository } from "@/repositories/task.repository";
import { MembershipRepository } from "@/repositories/membership.repository";
import { SettingsRepository } from "@/repositories/settings.repository";
import { prisma } from "@/lib/prisma";

interface DashboardInsight {
  summary: string;
  alerts: { type: "warning" | "info" | "success"; message: string }[];
  rejectionPatterns: { staffName: string; pattern: string }[];
}

interface DashboardData {
  activeStaff: number;
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  unassignedTasks: number;
  understaffedTasks: { title: string; department: string; required: number; assigned: number; needed: number }[];
  staffNearLimit: { name: string; hours: number }[];
  recentRejections: { staffName: string; count: number; reasons: string[] }[];
  completedToday: number;
  pendingCertifications: number;
  departmentCount: number;
  departments: { name: string; taskCount: number; memberCount: number }[];
  maxHours: number;
}

export class AIDashboardService {
  private taskRepo = new TaskRepository();
  private membershipRepo = new MembershipRepository();
  private settingsRepo = new SettingsRepository();

  /** Shared system prompt used by all AI providers for consistency */
  private systemPrompt = `You are a workforce management AI assistant. Analyze the organizational data and provide insights.
You MUST respond with ONLY valid JSON matching this structure:
{
  "summary": "A 2-3 sentence natural language overview of today's workforce status",
  "alerts": [{"type": "warning|info|success", "message": "specific actionable alert"}],
  "rejectionPatterns": [{"staffName": "name", "pattern": "observed pattern description"}]
}
CRITICAL RULES:
- Be specific with names, numbers, and departments from the provided data ONLY.
- NEVER invent or hallucinate data. Only reference staff, tasks, and departments mentioned in the input.
- If there are no rejections in the data, rejectionPatterns MUST be an empty array [].
- If there are no issues, say so positively. Do not manufacture problems.
- Maximum 5 alerts. Keep alerts actionable and based on real data.`;

  /**
   * Generates a comprehensive dashboard insight by gathering
   * org data and sending it to the AI for analysis.
   */
  async generateInsights(organizationId: string): Promise<DashboardInsight> {
    const data = await this.gatherDashboardData(organizationId);

    if (data.totalTasks === 0 && data.activeStaff === 0) {
      return {
        summary: "Your organization is set up and ready. Create departments, invite staff, and start creating tasks to see AI-powered insights here.",
        alerts: [],
        rejectionPatterns: [],
      };
    }

    const prompt = this.buildPrompt(data);
    return this.callAIForInsights(prompt, data);
  }

  /**
   * Calls AI providers in order for dashboard insights.
   * Falls back to algorithmic analysis if all providers fail.
   */
  private async callAIForInsights(
    prompt: string,
    data: DashboardData
  ): Promise<DashboardInsight> {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // Try Groq first
    if (groqKey) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: this.systemPrompt },
              { role: "user", content: prompt },
            ],
            temperature: 0,
            max_tokens: 800,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const content = result.choices[0]?.message?.content || "";
          return this.parseInsightResponse(content, data);
        }
      } catch (error) {
        console.error("[Dashboard AI] Groq failed:", error);
      }
    }

    // Try Gemini
    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `${this.systemPrompt}\n\n${prompt}`,
                }],
              }],
              generationConfig: { temperature: 0, maxOutputTokens: 800 },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const content = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
          return this.parseInsightResponse(content, data);
        }
      } catch (error) {
        console.error("[Dashboard AI] Gemini failed:", error);
      }
    }

    // Algorithmic fallback
    return this.generateAlgorithmicInsights(data);
  }

  /** Parses AI JSON response with fallback to algorithmic analysis */
  private parseInsightResponse(content: string, data: DashboardData): DashboardInsight {
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        summary: parsed.summary || "Dashboard data loaded.",
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts.slice(0, 5) : [],
        rejectionPatterns: Array.isArray(parsed.rejectionPatterns) ? parsed.rejectionPatterns : [],
      };
    } catch {
      console.error("[Dashboard AI] Failed to parse response");
      return this.generateAlgorithmicInsights(data);
    }
  }

  /**
   * Generates insights without AI using pure data analysis.
   * Provides the same data structure as AI but without
   * natural language flair — factual and rule-based.
   */
  private generateAlgorithmicInsights(data: DashboardData): DashboardInsight {
    const alerts: { type: "warning" | "info" | "success"; message: string }[] = [];

    if (data.unassignedTasks > 0) {
      alerts.push({
        type: "warning",
        message: `${data.unassignedTasks} task${data.unassignedTasks > 1 ? "s" : ""} still need staff assigned.`,
      });
    }

    for (const task of data.understaffedTasks) {
      alerts.push({
        type: "warning",
        message: `"${task.title}" needs ${task.needed} more staff (${task.assigned}/${task.required} assigned).`,
      });
    }

    for (const staff of data.staffNearLimit) {
      alerts.push({
        type: "warning",
        message: `${staff.name} has worked ${staff.hours.toFixed(1)}h today (limit: ${data.maxHours}h).`,
      });
    }

    if (data.pendingCertifications > 0) {
      alerts.push({
        type: "info",
        message: `${data.pendingCertifications} certification${data.pendingCertifications > 1 ? "s" : ""} pending verification.`,
      });
    }

    if (data.completedToday > 0) {
      alerts.push({
        type: "success",
        message: `${data.completedToday} task${data.completedToday > 1 ? "s" : ""} completed today.`,
      });
    }

    // Only include rejection patterns when there's real data
    const rejectionPatterns = data.recentRejections.map((r) => ({
      staffName: r.staffName,
      pattern: `Rejected ${r.count} task${r.count > 1 ? "s" : ""} recently. ${r.reasons.length > 0 ? `Common reason: "${r.reasons[0]}"` : ""}`,
    }));

    const parts: string[] = [];
    parts.push(`You have ${data.totalTasks} active task${data.totalTasks !== 1 ? "s" : ""} across ${data.departmentCount} department${data.departmentCount !== 1 ? "s" : ""} with ${data.activeStaff} staff available.`);

    if (data.unassignedTasks > 0) {
      parts.push(`${data.unassignedTasks} task${data.unassignedTasks > 1 ? "s need" : " needs"} staff assignment.`);
    }

    if (data.completedToday > 0) {
      parts.push(`${data.completedToday} task${data.completedToday > 1 ? "s" : ""} completed today.`);
    }

    return {
      summary: parts.join(" "),
      alerts: alerts.slice(0, 5),
      rejectionPatterns,
    };
  }

  /** Builds the data prompt sent to AI providers */
  private buildPrompt(data: DashboardData): string {
    let prompt = `Analyze this workforce data and provide insights:\n\n`;
    prompt += `ORGANIZATION OVERVIEW:\n`;
    prompt += `- ${data.activeStaff} active staff across ${data.departmentCount} departments\n`;
    prompt += `- ${data.totalTasks} active tasks (${data.openTasks} open, ${data.inProgressTasks} in progress)\n`;
    prompt += `- ${data.unassignedTasks} tasks need staff assignment\n`;
    prompt += `- ${data.completedToday} tasks completed today\n`;
    prompt += `- Max hours per staff: ${data.maxHours}h\n\n`;

    if (data.understaffedTasks.length > 0) {
      prompt += `UNDERSTAFFED TASKS:\n`;
      for (const t of data.understaffedTasks) {
        prompt += `- "${t.title}" (${t.department}): ${t.assigned}/${t.required} staff assigned\n`;
      }
      prompt += `\n`;
    }

    if (data.staffNearLimit.length > 0) {
      prompt += `STAFF APPROACHING HOUR LIMITS:\n`;
      for (const s of data.staffNearLimit) {
        prompt += `- ${s.name}: ${s.hours.toFixed(1)}h worked (limit: ${data.maxHours}h)\n`;
      }
      prompt += `\n`;
    }

    if (data.recentRejections.length > 0) {
      prompt += `RECENT REJECTIONS (last 7 days):\n`;
      for (const r of data.recentRejections) {
        prompt += `- ${r.staffName}: rejected ${r.count} tasks. Reasons: ${r.reasons.join(", ") || "not provided"}\n`;
      }
    } else {
      prompt += `RECENT REJECTIONS: None in the last 7 days.\n`;
    }
    prompt += `\n`;

    if (data.pendingCertifications > 0) {
      prompt += `PENDING CERTIFICATIONS: ${data.pendingCertifications} awaiting verification\n\n`;
    }

    prompt += `DEPARTMENTS:\n`;
    for (const d of data.departments) {
      prompt += `- ${d.name}: ${d.taskCount} tasks, ${d.memberCount} members\n`;
    }

    return prompt;
  }

  /**
   * Gathers all data needed for dashboard analysis.
   */
  private async gatherDashboardData(organizationId: string): Promise<DashboardData> {
    const settings = await this.settingsRepo.getOrCreate(organizationId);
    const members = await this.membershipRepo.findByOrgId(organizationId);
    const activeStaff = members.filter(
      (m) => m.status === "active" && m.role !== "company_admin"
    );

    const tasks = await this.taskRepo.findByOrganizationId(organizationId);
    const openTasks = tasks.filter((t) => t.status === "open");
    const inProgressTasks = tasks.filter((t) => t.status === "in_progress");

    const unassignedTasks = openTasks.filter((t) => t.assignments.length === 0);
    const understaffedTasks = openTasks
      .filter((t) => t.assignments.length < t.requiredHeadcount && t.assignments.length > 0)
      .map((t) => ({
        title: t.title,
        department: t.department?.name || "No department",
        required: t.requiredHeadcount,
        assigned: t.assignments.length,
        needed: t.requiredHeadcount - t.assignments.length,
      }));

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staffNearLimit: { name: string; hours: number }[] = [];

    for (const staff of activeStaff) {
      const assignments = await prisma.taskAssignment.findMany({
        where: {
          membershipId: staff.id,
          status: "completed",
          clockInTime: { gte: oneDayAgo },
          clockOutTime: { not: null },
        },
      });

      let hours = 0;
      for (const a of assignments) {
        if (a.clockInTime && a.clockOutTime) {
          hours += (a.clockOutTime.getTime() - a.clockInTime.getTime()) / (1000 * 60 * 60);
        }
      }

      if (hours >= settings.breakRuleHoursWorked * 0.75) {
        staffNearLimit.push({
          name: staff.user.name || staff.user.email,
          hours,
        });
      }
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rejections = await prisma.taskAssignment.findMany({
      where: {
        task: { organizationId },
        status: "rejected",
        createdAt: { gte: oneWeekAgo },
      },
      include: {
        membership: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    const rejectionMap: Record<string, { staffName: string; count: number; reasons: string[] }> = {};
    for (const r of rejections) {
      const key = r.membershipId;
      if (!rejectionMap[key]) {
        rejectionMap[key] = {
          staffName: r.membership.user.name || r.membership.user.email,
          count: 0,
          reasons: [],
        };
      }
      rejectionMap[key].count++;
      if (r.rejectionReason && !rejectionMap[key].reasons.includes(r.rejectionReason)) {
        rejectionMap[key].reasons.push(r.rejectionReason);
      }
    }

    const recentRejections = Object.values(rejectionMap).filter((r) => r.count >= 2);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const completedToday = await prisma.taskAssignment.count({
      where: {
        task: { organizationId },
        status: "completed",
        clockOutTime: { gte: todayStart },
      },
    });

    const pendingCertifications = await prisma.certification.count({
      where: {
        membership: { organizationId },
        status: "pending",
      },
    });

    const departments = await prisma.department.findMany({
      where: { organizationId },
      include: {
        _count: { select: { departmentMemberships: true, tasks: true } },
      },
    });

    const deptStats = departments.map((d) => ({
      name: d.name,
      taskCount: d._count.tasks,
      memberCount: d._count.departmentMemberships,
    }));

    return {
      activeStaff: activeStaff.length,
      totalTasks: openTasks.length + inProgressTasks.length,
      openTasks: openTasks.length,
      inProgressTasks: inProgressTasks.length,
      unassignedTasks: unassignedTasks.length,
      understaffedTasks,
      staffNearLimit,
      recentRejections,
      completedToday,
      pendingCertifications,
      departmentCount: departments.length,
      departments: deptStats,
      maxHours: settings.breakRuleHoursWorked,
    };
  }
}