/**
 * Reporting Service (Control Layer)
 *
 * Orchestrates dashboard data aggregation for three role-specific views:
 * - Company Admin: full org overview with needs-attention alerts, metrics, charts
 * - Manager: department-scoped with team roster
 * - Staff: personal calendar, stats, and certifications
 *
 * All data access flows through ReportingRepository (Entity layer).
 * Business logic (grouping, computation, formatting) lives here.
 * Each public method is independently callable by the API route,
 * which uses Promise.allSettled for per-section resilience.
 *
 * BCE compliant: Service (Control) → Repository (Entity).
 */
import { ReportingRepository } from "@/repositories/reporting.repository";
import { SettingsRepository } from "@/repositories/settings.repository";
import type {
  StaffAssignmentRecord,
  StaffAvailabilityRecord,
  StaffCertRecord,
} from "@/repositories/reporting.repository";

// ============================================================
// Response type interfaces
// ============================================================

/** Actionable alert for needs-attention section */
export interface NeedsAttentionItem {
  type:
    | "understaffed"
    | "pending_acceptance"
    | "expiring_cert"
    | "pending_verification";
  severity: "danger" | "warning" | "info";
  message: string;
  actionLabel: string;
  actionUrl: string;
  entityId?: string;
  isAiInsight?: boolean;
}

/** Three key metric cards for dashboard header */
export interface KeyMetrics {
  assignmentPipeline: {
    total: number;
    accepted: number;
    pending: number;
    rejected: number;
    completed: number;
  };
  completionRate: {
    current: number;
    previous: number;
    trend: "up" | "down" | "flat";
  };
  hoursLogged: {
    hours: number;
    capacity: number;
    utilization: number;
  };
}

/** Task in tomorrow's schedule list */
export interface TomorrowTask {
  id: string;
  title: string;
  departmentName: string | null;
  departmentColor: string | null;
  timeRange: string | null;
  isUnderstaffed: boolean;
  assignedCount: number;
  requiredHeadcount: number;
}

/** Daily completion count for bar chart */
export interface CompletionDay {
  date: string;
  label: string;
  count: number;
}

/** Staff member utilization for horizontal bar chart */
export interface StaffUtilizationItem {
  membershipId: string;
  name: string;
  hoursWorked: number;
  capacity: number;
  percentage: number;
}

/** Department workload with task-to-staff ratio */
export interface DepartmentWorkloadItem {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  staffCount: number;
  isImbalanced: boolean;
}

/** Staff rejection data grouped for trend analysis */
export interface RejectionTrendItem {
  staffName: string;
  membershipId: string;
  rejectionCount: number;
  reasons: { reason: string; count: number }[];
}

/** Team member with shift status badge for manager roster */
export interface TeamMemberItem {
  membershipId: string;
  name: string;
  status: "on_shift" | "has_pending" | "available" | "off_today";
  statusLabel: string;
  pendingCount: number;
}

/** Complete staff dashboard data bundle */
export interface StaffDashboardData {
  hoursThisWeek: number;
  weeklyCapacity: number;
  nextShift: {
    taskName: string;
    scheduledStart: Date;
    scheduledEnd: Date;
  } | null;
  tasksThisWeek: {
    total: number;
    pending: number;
  };
  weekAssignments: StaffAssignmentRecord[];
  availability: StaffAvailabilityRecord[];
  certifications: StaffCertRecord[];
  stats: {
    shiftsThisMonth: number;
    hoursThisMonth: number;
    acceptanceRate: number;
    onTimeRate: number;
  };
}

// Legacy types (backward compatibility with /reports endpoint)
interface LegacyCompletionTrend {
  date: string;
  label: string;
  completed: number;
}
interface LegacyStaffUtilization {
  name: string;
  hoursWorked: number;
  capacity: number;
  percentage: number;
}
interface LegacyDepartmentWorkload {
  name: string;
  color: string;
  taskCount: number;
  completedCount: number;
}
interface LegacyHoursSummary {
  totalLogged: number;
  totalCapacity: number;
  percentage: number;
}
export interface ReportingData {
  completionTrend: LegacyCompletionTrend[];
  staffUtilization: LegacyStaffUtilization[];
  departmentWorkload: LegacyDepartmentWorkload[];
  hoursSummary: LegacyHoursSummary;
}

// ============================================================
// Service
// ============================================================

export class ReportingService {
  private reportingRepo = new ReportingRepository();
  private settingsRepo = new SettingsRepository();

  // ===== Member Scoping =====

  /**
   * Gets department IDs for a membership.
   * Used by the dashboard API route to scope manager views
   * without directly accessing the Entity layer.
   */
  async getMemberDepartmentIds(membershipId: string): Promise<string[]> {
    return this.reportingRepo.getMemberDepartmentIds(membershipId);
  }

  // ===== Legacy (backward compatibility) =====

  /**
   * Returns chart data in the original format for the /reports endpoint.
   * Refactored to use ReportingRepository instead of direct prisma calls.
   * Will be deprecated once the new dashboard endpoints are active.
   */
  async getDashboardReports(organizationId: string): Promise<ReportingData> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const [completionChart, staffUtilization, deptMetrics, settings, clockData, staffCount] =
      await Promise.all([
        this.getCompletionChart(organizationId),
        this.getStaffUtilization(organizationId),
        this.reportingRepo.getDepartmentMetrics(organizationId),
        this.settingsRepo.getOrCreate(organizationId),
        this.reportingRepo.getClockData(organizationId, sevenDaysAgo),
        this.reportingRepo.getActiveStaffCount(organizationId),
      ]);

    // Compute total hours logged
    let totalLogged = 0;
    for (const r of clockData) {
      totalLogged +=
        (r.clockOutTime.getTime() - r.clockInTime.getTime()) / (1000 * 60 * 60);
    }
    totalLogged = Math.round(totalLogged * 10) / 10;

    const totalCapacity = staffCount * settings.breakRuleHoursWorked * 7;

    return {
      completionTrend: completionChart.map((d) => ({
        date: d.date,
        label: d.label,
        completed: d.count,
      })),
      staffUtilization: staffUtilization.map((s) => ({
        name: s.name,
        hoursWorked: s.hoursWorked,
        capacity: s.capacity,
        percentage: s.percentage,
      })),
      departmentWorkload: deptMetrics.map((d) => ({
        name: d.name,
        color: d.color,
        taskCount: d.activeTaskCount,
        completedCount: 0, // no longer tracked separately; legacy field
      })),
      hoursSummary: {
        totalLogged,
        totalCapacity,
        percentage:
          totalCapacity > 0
            ? Math.round((totalLogged / totalCapacity) * 100)
            : 0,
      },
    };
  }

  // ===== Needs Attention (Admin & Manager) =====

  /**
   * Builds a prioritized list of actionable alerts.
   * Severity order: danger → warning → info.
   * Each item includes a message and action button target.
   */
  async getNeedsAttention(
    organizationId: string,
    departmentIds?: string[]
  ): Promise<NeedsAttentionItem[]> {
    const [understaffed, pendingAssignments, expiringCerts, pendingVerifications] =
      await Promise.all([
        this.reportingRepo.getUnderstaffedTasks(organizationId, departmentIds),
        this.reportingRepo.getPendingAssignments(organizationId, departmentIds),
        this.reportingRepo.getExpiringCertifications(organizationId, 30),
        this.reportingRepo.getPendingCertVerifications(organizationId),
      ]);

    const items: NeedsAttentionItem[] = [];

    // Red: understaffed tasks
    for (const task of understaffed) {
      const needed = task.requiredHeadcount - task.assignedCount;
      items.push({
        type: "understaffed",
        severity: "danger",
        message: `${task.title} needs ${needed} more staff (${task.assignedCount}/${task.requiredHeadcount} assigned)`,
        actionLabel: "Assign",
        actionUrl: `/org/${organizationId}/tasks`,
        entityId: task.id,
      });
    }

    // Amber: pending acceptances (grouped into one alert)
    if (pendingAssignments.length > 0) {
      const uniqueNames = [
        ...new Set(pendingAssignments.map((a) => a.staffName)),
      ];
      const nameList =
        uniqueNames.length <= 3
          ? uniqueNames.join(", ")
          : `${uniqueNames.slice(0, 2).join(", ")} +${uniqueNames.length - 2} more`;
      items.push({
        type: "pending_acceptance",
        severity: "warning",
        message: `${pendingAssignments.length} assignment${pendingAssignments.length !== 1 ? "s" : ""} pending acceptance from ${nameList}`,
        actionLabel: "View",
        actionUrl: `/org/${organizationId}/tasks`,
      });
    }

    // Amber: expiring certifications
    for (const cert of expiringCerts) {
      const daysUntil = Math.ceil(
        (cert.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      items.push({
        type: "expiring_cert",
        severity: "warning",
        message: `${cert.staffName}'s ${cert.certName} expires in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`,
        actionLabel: "View",
        actionUrl: `/org/${organizationId}/certifications`,
        entityId: cert.id,
      });
    }

    // Blue: pending verifications (grouped into one alert)
    if (pendingVerifications.length > 0) {
      items.push({
        type: "pending_verification",
        severity: "info",
        message: `${pendingVerifications.length} certification${pendingVerifications.length !== 1 ? "s" : ""} awaiting verification`,
        actionLabel: "Review",
        actionUrl: `/org/${organizationId}/certifications`,
      });
    }

    return items;
  }

  // ===== Key Metrics (Admin & Manager) =====

  /**
   * Computes three key metric cards:
   * 1. Assignment pipeline (status breakdown)
   * 2. Completion rate (this week vs last week)
   * 3. Hours logged with utilization percentage
   */
  async getKeyMetrics(
    organizationId: string,
    departmentIds?: string[]
  ): Promise<KeyMetrics> {
    const now = new Date();

    // Week boundaries (Monday-based)
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [statusCounts, thisWeekCount, lastWeekCount, clockData, staffCount, settings] =
      await Promise.all([
        this.reportingRepo.countAssignmentsByStatus(
          organizationId,
          weekStart,
          departmentIds
        ),
        this.reportingRepo.countCompletions(
          organizationId,
          weekStart,
          weekEnd,
          departmentIds
        ),
        this.reportingRepo.countCompletions(
          organizationId,
          lastWeekStart,
          weekStart,
          departmentIds
        ),
        this.reportingRepo.getClockData(
          organizationId,
          sevenDaysAgo,
          departmentIds
        ),
        this.reportingRepo.getActiveStaffCount(organizationId, departmentIds),
        this.settingsRepo.getOrCreate(organizationId),
      ]);

    // Assignment pipeline
    const pipeline = { total: 0, accepted: 0, pending: 0, rejected: 0, completed: 0 };
    for (const s of statusCounts) {
      pipeline.total += s.count;
      if (s.status in pipeline) {
        pipeline[s.status as keyof typeof pipeline] = s.count;
      }
    }

    // Completion trend
    let trend: "up" | "down" | "flat" = "flat";
    if (thisWeekCount > lastWeekCount) trend = "up";
    else if (thisWeekCount < lastWeekCount) trend = "down";

    // Hours logged
    const totalHours = this.sumClockHours(clockData);
    const weeklyCapacity = staffCount * settings.breakRuleHoursWorked * 7;

    return {
      assignmentPipeline: pipeline,
      completionRate: {
        current: thisWeekCount,
        previous: lastWeekCount,
        trend,
      },
      hoursLogged: {
        hours: totalHours,
        capacity: weeklyCapacity,
        utilization:
          weeklyCapacity > 0
            ? Math.round((totalHours / weeklyCapacity) * 100)
            : 0,
      },
    };
  }

  // ===== Tomorrow's Schedule (Admin & Manager) =====

  /**
   * Gets tasks scheduled for tomorrow with staffing status.
   * Understaffed tasks are flagged for action buttons.
   */
  async getTomorrowsSchedule(
    organizationId: string,
    departmentIds?: string[]
  ): Promise<TomorrowTask[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayStart = new Date(tomorrow);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(tomorrow);
    dayEnd.setHours(23, 59, 59, 999);

    const tasks = await this.reportingRepo.getTasksForDateRange(
      organizationId,
      dayStart,
      dayEnd,
      departmentIds
    );

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      departmentName: t.departmentName,
      departmentColor: t.departmentColor,
      timeRange: this.formatTimeRange(t.scheduledStart, t.scheduledEnd),
      isUnderstaffed: t.assignedCount < t.requiredHeadcount,
      assignedCount: t.assignedCount,
      requiredHeadcount: t.requiredHeadcount,
    }));
  }

  // ===== Completion Chart (Admin & Manager) =====

  /**
   * Builds 7-day completion bar chart data.
   * Returns one entry per day with zero-fill for days with no completions.
   * Single repository query replaces the old 7-loop pattern.
   */
  async getCompletionChart(
    organizationId: string,
    departmentIds?: string[]
  ): Promise<CompletionDay[]> {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(0, 0, 0, 0);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const timestamps = await this.reportingRepo.getCompletionTimestamps(
      organizationId,
      startDate,
      endDate,
      departmentIds
    );

    // Group by date string (local timezone)
    const countMap = new Map<string, number>();
    for (const t of timestamps) {
      const dateKey = this.formatLocalDate(t.completedAt);
      countMap.set(dateKey, (countMap.get(dateKey) || 0) + 1);
    }

    // Build 7-day array with zero-fill
    const days: CompletionDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateKey = this.formatLocalDate(date);

      days.push({
        date: dateKey,
        label: dayNames[date.getDay()],
        count: countMap.get(dateKey) || 0,
      });
    }

    return days;
  }

  // ===== Staff Utilization (Admin & Manager) =====

  /**
   * Computes hours worked per staff member over the last 7 days.
   * Includes all active staff — those with 0 hours appear as low utilization.
   * Sorted by utilization percentage descending.
   */
  async getStaffUtilization(
    organizationId: string,
    departmentIds?: string[]
  ): Promise<StaffUtilizationItem[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [clockData, allStaff, settings] = await Promise.all([
      this.reportingRepo.getClockData(organizationId, sevenDaysAgo, departmentIds),
      this.reportingRepo.getActiveStaffList(organizationId, departmentIds),
      this.settingsRepo.getOrCreate(organizationId),
    ]);

    const weeklyCapacity = settings.breakRuleHoursWorked * 7;

    // Group hours by membership
    const hoursMap = new Map<string, number>();
    for (const r of clockData) {
      const hours =
        (r.clockOutTime.getTime() - r.clockInTime.getTime()) / (1000 * 60 * 60);
      hoursMap.set(r.membershipId, (hoursMap.get(r.membershipId) || 0) + hours);
    }

    // Build utilization for all staff (including 0-hour)
    const items: StaffUtilizationItem[] = allStaff.map((staff) => {
      const hoursWorked = Math.round((hoursMap.get(staff.membershipId) || 0) * 10) / 10;
      return {
        membershipId: staff.membershipId,
        name: staff.name,
        hoursWorked,
        capacity: weeklyCapacity,
        percentage:
          weeklyCapacity > 0
            ? Math.round((hoursWorked / weeklyCapacity) * 100)
            : 0,
      };
    });

    // Sort by utilization descending
    return items.sort((a, b) => b.percentage - a.percentage);
  }

  // ===== Department Workload (Admin) =====

  /**
   * Gets department task-to-staff ratios with imbalance detection.
   * A department is imbalanced when it has tasks but no staff,
   * or when the task-to-staff ratio exceeds 5:1.
   */
  async getDepartmentWorkload(
    organizationId: string
  ): Promise<DepartmentWorkloadItem[]> {
    const metrics = await this.reportingRepo.getDepartmentMetrics(organizationId);

    return metrics.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      taskCount: d.activeTaskCount,
      staffCount: d.staffCount,
      isImbalanced:
        (d.activeTaskCount > 0 && d.staffCount === 0) ||
        (d.staffCount > 0 && d.activeTaskCount / d.staffCount > 5),
    }));
  }

  // ===== Rejection Trends (Admin & Manager) =====

  /**
   * Groups rejection data by staff member with reason breakdown.
   * Sorted by rejection count descending (most rejections first).
   * The AI recommendations service can use this for pattern analysis.
   */
  async getRejectionTrends(
    organizationId: string,
    departmentIds?: string[]
  ): Promise<RejectionTrendItem[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const rejections = await this.reportingRepo.getRejectionData(
      organizationId,
      sevenDaysAgo,
      departmentIds
    );

    // Group by staff
    const staffMap = new Map<
      string,
      { name: string; reasons: Map<string, number> }
    >();

    for (const r of rejections) {
      if (!staffMap.has(r.membershipId)) {
        staffMap.set(r.membershipId, {
          name: r.staffName,
          reasons: new Map(),
        });
      }
      const entry = staffMap.get(r.membershipId)!;
      const reason = r.rejectionReason || "unspecified";
      entry.reasons.set(reason, (entry.reasons.get(reason) || 0) + 1);
    }

    // Build sorted result
    const items: RejectionTrendItem[] = [];
    for (const [membershipId, data] of staffMap) {
      const reasons = Array.from(data.reasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      items.push({
        staffName: data.name,
        membershipId,
        rejectionCount: reasons.reduce((sum, r) => sum + r.count, 0),
        reasons,
      });
    }

    return items.sort((a, b) => b.rejectionCount - a.rejectionCount);
  }

  // ===== Team Roster (Manager) =====

  /**
   * Gets team members with current shift status for the manager dashboard.
   * Status badges: "on_shift" (green), "has_pending" (amber),
   * "available" (gray), "off_today" (gray).
   */
  async getTeamRoster(
    organizationId: string,
    departmentIds: string[]
  ): Promise<TeamMemberItem[]> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const dayOfWeek = now.getDay();

    const members = await this.reportingRepo.getTeamMembers(
      organizationId,
      departmentIds,
      todayStart,
      todayEnd,
      dayOfWeek
    );

    return members.map((m) => {
      let status: TeamMemberItem["status"];
      let statusLabel: string;

      const hasAccepted = m.todayAssignments.some(
        (a) => a.status === "accepted"
      );
      const hasPending = m.pendingCount > 0;
      const isAvailable = m.availability?.isAvailable ?? false;

      if (hasAccepted) {
        status = "on_shift";
        statusLabel = "On shift";
      } else if (hasPending) {
        status = "has_pending";
        statusLabel = `${m.pendingCount} pending`;
      } else if (isAvailable) {
        status = "available";
        statusLabel = "Available";
      } else {
        status = "off_today";
        statusLabel = "Off today";
      }

      return {
        membershipId: m.membershipId,
        name: m.staffName,
        status,
        statusLabel,
        pendingCount: m.pendingCount,
      };
    });
  }

  // ===== Staff Dashboard =====

  /**
   * Builds the complete staff personal dashboard data bundle.
   * Includes hours, next shift, weekly calendar, certifications, and stats.
   */
  async getStaffDashboardData(
    membershipId: string,
    organizationId: string
  ): Promise<StaffDashboardData> {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      weekAssignments,
      availability,
      certifications,
      assignmentHistory,
      settings,
      clockDataWeek,
      clockDataMonth,
    ] = await Promise.all([
      this.reportingRepo.getStaffAssignments(membershipId, weekStart, weekEnd),
      this.reportingRepo.getStaffAvailability(membershipId),
      this.reportingRepo.getStaffCertifications(membershipId),
      this.reportingRepo.getStaffAssignmentHistory(membershipId, monthStart),
      this.settingsRepo.getOrCreate(organizationId),
      this.reportingRepo.getClockData(organizationId, weekStart),
      this.reportingRepo.getClockData(organizationId, monthStart),
    ]);

    // Hours this week (for this specific staff member)
    const myClockWeek = clockDataWeek.filter(
      (r) => r.membershipId === membershipId
    );
    const hoursThisWeek = this.sumClockHours(myClockWeek);

    const myClockMonth = clockDataMonth.filter(
      (r) => r.membershipId === membershipId
    );
    const hoursThisMonth = this.sumClockHours(myClockMonth);

    // Next upcoming shift
    const upcoming = weekAssignments.find(
      (a) =>
        a.scheduledStart &&
        a.scheduledStart > now &&
        (a.status === "accepted" || a.status === "pending")
    );
    const nextShift = upcoming?.scheduledStart && upcoming?.scheduledEnd
      ? {
          taskName: upcoming.taskTitle,
          scheduledStart: upcoming.scheduledStart,
          scheduledEnd: upcoming.scheduledEnd,
        }
      : null;

    // Tasks this week summary
    const activeWeekAssignments = weekAssignments.filter(
      (a) => a.status !== "completed"
    );
    const pendingWeekCount = weekAssignments.filter(
      (a) => a.status === "pending"
    ).length;

    // Personal stats from assignment history
    const totalAssignments = assignmentHistory.length;
    const acceptedOrCompleted = assignmentHistory.filter(
      (a) => a.status === "accepted" || a.status === "completed"
    ).length;
    const rejectedCount = assignmentHistory.filter(
      (a) => a.status === "rejected"
    ).length;
    const decidedCount = acceptedOrCompleted + rejectedCount;

    const onTimeCount = assignmentHistory.filter(
      (a) =>
        a.clockInTime &&
        a.scheduledStart &&
        a.clockInTime <= new Date(a.scheduledStart.getTime() + 5 * 60 * 1000) // 5-min grace
    ).length;
    const clockedInCount = assignmentHistory.filter(
      (a) => a.clockInTime !== null
    ).length;

    return {
      hoursThisWeek,
      weeklyCapacity: settings.breakRuleHoursWorked * 7,
      nextShift,
      tasksThisWeek: {
        total: activeWeekAssignments.length,
        pending: pendingWeekCount,
      },
      weekAssignments,
      availability,
      certifications,
      stats: {
        shiftsThisMonth: assignmentHistory.filter(
          (a) => a.status === "completed"
        ).length,
        hoursThisMonth: Math.round(hoursThisMonth * 10) / 10,
        acceptanceRate:
          decidedCount > 0
            ? Math.round((acceptedOrCompleted / decidedCount) * 100)
            : 100,
        onTimeRate:
          clockedInCount > 0
            ? Math.round((onTimeCount / clockedInCount) * 100)
            : 100,
      },
    };
  }

  // ===== Calendar Coverage (Heatmap) =====

  /**
   * Computes staff availability coverage for each hour of each day.
   * Returns a matrix with coverage counts per hour slot.
   * Used for calendar heatmap background tints.
   * Respects operating hours from settings.
   */
  async getCalendarCoverage(
    organizationId: string,
    departmentIds?: string[]
  ): Promise<{ dayOfWeek: number; hour: number; count: number }[]> {
    const schedules = await this.reportingRepo.getAllStaffAvailability(organizationId);

    // Build coverage matrix
    const coverage: { dayOfWeek: number; hour: number; count: number }[] = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const hourStr = `${String(hour).padStart(2, "0")}:00`;
        const nextHourStr = `${String(hour + 1).padStart(2, "0")}:00`;

        let count = 0;
        const seen = new Set<string>();

        for (const s of schedules) {
          if (s.dayOfWeek !== day || !s.isAvailable) continue;
          if (seen.has(s.membershipId)) continue;

          if (s.startTime <= hourStr && s.endTime >= nextHourStr) {
            count++;
            seen.add(s.membershipId);
          }
        }

        coverage.push({ dayOfWeek: day, hour, count });
      }
    }

    return coverage;
  }

  /**
   * Gets all active staff members with their weekly availability schedules.
   * Used for the calendar day-view staff panel.
   * Groups flat availability records by staff member.
   */
  async getAllStaffSchedules(
    organizationId: string
  ): Promise<
    {
      membershipId: string;
      name: string;
      schedules: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[];
    }[]
  > {
    const data = await this.reportingRepo.getAllStaffAvailability(organizationId);

    const staffMap = new Map<
      string,
      {
        membershipId: string;
        name: string;
        schedules: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[];
      }
    >();

    for (const s of data) {
      if (!staffMap.has(s.membershipId)) {
        staffMap.set(s.membershipId, {
          membershipId: s.membershipId,
          name: s.membership.user.name || s.membership.user.email,
          schedules: [],
        });
      }
      staffMap.get(s.membershipId)!.schedules.push({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isAvailable: s.isAvailable,
      });
    }

    return Array.from(staffMap.values());
  }

  // ===== Private Helpers =====

  /** Gets Monday 00:00 of the week containing the given date */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = 1, Sunday wraps to previous Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Formats a time range string from two dates, e.g. "7:00am–10:00am" */
  private formatTimeRange(
    start: Date | null,
    end: Date | null
  ): string | null {
    if (!start || !end) return null;

    const fmt = (d: Date) => {
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const period = hours >= 12 ? "pm" : "am";
      const h = hours % 12 || 12;
      return minutes > 0 ? `${h}:${String(minutes).padStart(2, "0")}${period}` : `${h}${period}`;
    };

    return `${fmt(start)}–${fmt(end)}`;
  }

  /** Sums clock-in/out durations to total hours (rounded to 1 decimal) */
  private sumClockHours(
    records: { clockInTime: Date; clockOutTime: Date }[]
  ): number {
    let total = 0;
    for (const r of records) {
      total +=
        (r.clockOutTime.getTime() - r.clockInTime.getTime()) / (1000 * 60 * 60);
    }
    return Math.round(total * 10) / 10;
  }

  /**
   * Formats a Date as YYYY-MM-DD using local timezone.
   * Avoids toISOString() which converts to UTC and can shift the date
   * in timezones ahead of UTC (e.g. SGT/UTC+8).
   */
  private formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}