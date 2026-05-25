/**
 * Reporting Service (Control Layer)
 * 
 * Aggregates data for dashboard reporting charts:
 * - Task completion trend (7 days)
 * - Staff utilization (hours worked vs capacity)
 * - Department workload (tasks per department)
 * - Hours logged summary (total vs capacity)
 * 
 * All queries are org-scoped for multi-tenant isolation.
 */
import { prisma } from "@/lib/prisma";
import { SettingsRepository } from "@/repositories/settings.repository";

interface CompletionTrend {
  date: string;
  label: string;
  completed: number;
}

interface StaffUtilization {
  name: string;
  hoursWorked: number;
  capacity: number;
  percentage: number;
}

interface DepartmentWorkload {
  name: string;
  color: string;
  taskCount: number;
  completedCount: number;
}

interface HoursSummary {
  totalLogged: number;
  totalCapacity: number;
  percentage: number;
}

export interface ReportingData {
  completionTrend: CompletionTrend[];
  staffUtilization: StaffUtilization[];
  departmentWorkload: DepartmentWorkload[];
  hoursSummary: HoursSummary;
}

export class ReportingService {
  private settingsRepo = new SettingsRepository();

  /**
   * Generates all reporting data for the dashboard charts.
   */
  async getDashboardReports(organizationId: string): Promise<ReportingData> {
    const [completionTrend, staffUtilization, departmentWorkload, hoursSummary] =
      await Promise.all([
        this.getCompletionTrend(organizationId),
        this.getStaffUtilization(organizationId),
        this.getDepartmentWorkload(organizationId),
        this.getHoursSummary(organizationId),
      ]);

    return { completionTrend, staffUtilization, departmentWorkload, hoursSummary };
  }

  /**
   * Task completion count per day for the last 7 days.
   */
  private async getCompletionTrend(organizationId: string): Promise<CompletionTrend[]> {
    const days: CompletionTrend[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = await prisma.taskAssignment.count({
        where: {
          task: { organizationId },
          status: "completed",
          clockOutTime: {
            gte: date,
            lt: nextDay,
          },
        },
      });

      days.push({
        date: date.toISOString().split("T")[0],
        label: dayNames[date.getDay()],
        completed: count,
      });
    }

    return days;
  }

  /**
   * Hours worked vs daily capacity for each active staff member
   * over the last 7 days.
   */
  private async getStaffUtilization(organizationId: string): Promise<StaffUtilization[]> {
    const settings = await this.settingsRepo.getOrCreate(organizationId);
    const weeklyCapacity = settings.breakRuleHoursWorked * 7;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const members = await prisma.membership.findMany({
      where: {
        organizationId,
        status: "active",
        role: { in: ["staff", "manager"] },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const utilization: StaffUtilization[] = [];

    for (const member of members) {
      const assignments = await prisma.taskAssignment.findMany({
        where: {
          membershipId: member.id,
          status: "completed",
          clockInTime: { gte: sevenDaysAgo },
          clockOutTime: { not: null },
        },
      });

      let hoursWorked = 0;
      for (const a of assignments) {
        if (a.clockInTime && a.clockOutTime) {
          hoursWorked +=
            (a.clockOutTime.getTime() - a.clockInTime.getTime()) /
            (1000 * 60 * 60);
        }
      }

      utilization.push({
        name: member.user.name || member.user.email,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        capacity: weeklyCapacity,
        percentage:
          weeklyCapacity > 0
            ? Math.round((hoursWorked / weeklyCapacity) * 100)
            : 0,
      });
    }

    // Sort by percentage descending
    return utilization.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Task count and completion count per department.
   */
  private async getDepartmentWorkload(organizationId: string): Promise<DepartmentWorkload[]> {
    const departments = await prisma.department.findMany({
      where: { organizationId },
      include: {
        tasks: {
          select: { status: true },
        },
      },
    });

    return departments
      .map((dept) => ({
        name: dept.name,
        color: dept.color || "#94A3B8",
        taskCount: dept.tasks.length,
        completedCount: dept.tasks.filter((t) => t.status === "completed").length,
      }))
      .sort((a, b) => b.taskCount - a.taskCount);
  }

  /**
   * Total hours logged this week vs total team capacity.
   */
  private async getHoursSummary(organizationId: string): Promise<HoursSummary> {
    const settings = await this.settingsRepo.getOrCreate(organizationId);

    const staffCount = await prisma.membership.count({
      where: {
        organizationId,
        status: "active",
        role: { in: ["staff", "manager"] },
      },
    });

    const totalCapacity = staffCount * settings.breakRuleHoursWorked * 7;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const assignments = await prisma.taskAssignment.findMany({
      where: {
        task: { organizationId },
        status: "completed",
        clockInTime: { gte: sevenDaysAgo },
        clockOutTime: { not: null },
      },
    });

    let totalLogged = 0;
    for (const a of assignments) {
      if (a.clockInTime && a.clockOutTime) {
        totalLogged +=
          (a.clockOutTime.getTime() - a.clockInTime.getTime()) /
          (1000 * 60 * 60);
      }
    }

    totalLogged = Math.round(totalLogged * 10) / 10;

    return {
      totalLogged,
      totalCapacity,
      percentage:
        totalCapacity > 0
          ? Math.round((totalLogged / totalCapacity) * 100)
          : 0,
    };
  }
}