/**
 * Manager Dashboard Component (Boundary Layer)
 *
 * Client component for the Manager dashboard view.
 * Shows department-scoped data: needs-attention alerts,
 * key metrics, tomorrow's tasks, completion chart,
 * staff utilization, rejection trends, and team roster.
 *
 * All data is automatically filtered by the manager's
 * department(s) on the server side.
 */
"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import type { NeedsAttentionItem } from "@/components/dashboard/needs-attention";

// ============================================================
// API response types
// ============================================================

interface KeyMetrics {
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

interface TomorrowTask {
  id: string;
  title: string;
  departmentName: string | null;
  departmentColor: string | null;
  timeRange: string | null;
  isUnderstaffed: boolean;
  assignedCount: number;
  requiredHeadcount: number;
}

interface TeamMemberItem {
  membershipId: string;
  name: string;
  status: "on_shift" | "has_pending" | "available" | "off_today";
  statusLabel: string;
  pendingCount: number;
}

interface ManagerDashboardData {
  role: string;
  needsAttention: NeedsAttentionItem[] | null;
  keyMetrics: KeyMetrics | null;
  tomorrowsSchedule: TomorrowTask[] | null;
  staffUtilization: { membershipId: string; name: string; percentage: number }[] | null;
  teamRoster: TeamMemberItem[] | null;
}

// ============================================================
// Helpers
// ============================================================

const statusStyles: Record<string, string> = {
  on_shift: "bg-green-100 text-green-700",
  has_pending: "bg-amber-100 text-amber-700",
  available: "bg-gray-100 text-gray-600",
  off_today: "bg-gray-50 text-gray-400",
};

function trendArrow(trend: "up" | "down" | "flat"): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

function trendColor(trend: "up" | "down" | "flat"): string {
  if (trend === "up") return "text-green-600";
  if (trend === "down") return "text-red-600";
  return "text-muted-foreground";
}

// ============================================================
// Main component
// ============================================================

interface ManagerDashboardProps {
  orgId: string;
  orgName: string;
}

export default function ManagerDashboard({ orgId, orgName }: ManagerDashboardProps) {
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, [orgId]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/organizations/${orgId}/dashboard`);
      if (!res.ok) {
        setError("Failed to load dashboard");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">{orgName}</h2>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">{orgName}</h2>
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
          <button onClick={fetchDashboard} className="ml-2 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">{orgName}</h2>

      {/* Needs Attention */}
      {data.needsAttention && data.needsAttention.length > 0 && (
        <NeedsAttention items={data.needsAttention} />
      )}

      {/* Key Metrics */}
      {data.keyMetrics && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-secondary p-4">
            <p className="text-xs text-muted-foreground mb-1">Open tasks</p>
            <p className="text-2xl font-semibold">
              {data.keyMetrics.assignmentPipeline.pending + data.keyMetrics.assignmentPipeline.accepted}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              of {data.keyMetrics.assignmentPipeline.total} total
            </p>
          </div>

          <div className="rounded-lg bg-secondary p-4">
            <p className="text-xs text-muted-foreground mb-1">Completed (7d)</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold">
                {data.keyMetrics.completionRate.current}
              </p>
              <span className={`text-sm font-medium ${trendColor(data.keyMetrics.completionRate.trend)}`}>
                {trendArrow(data.keyMetrics.completionRate.trend)} vs{" "}
                {data.keyMetrics.completionRate.previous} last week
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-secondary p-4">
            <p className="text-xs text-muted-foreground mb-1">Hours logged (7d)</p>
            <p className="text-2xl font-semibold">{data.keyMetrics.hoursLogged.hours}h</p>
            <p className="text-xs text-muted-foreground mt-1">across team</p>
          </div>
        </div>
      )}

      {/* Tomorrow's Tasks + Team Roster */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {/* Tomorrow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tomorrow&apos;s tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.tomorrowsSchedule ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Could not load schedule
              </p>
            ) : data.tomorrowsSchedule.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tasks scheduled for tomorrow
              </p>
            ) : (
              <div className="space-y-2">
                {data.tomorrowsSchedule.map((task) => (
                  <div key={task.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: task.departmentColor || "#94A3B8" }}
                      />
                      <span className="truncate">{task.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {task.timeRange || `${task.assignedCount}/${task.requiredHeadcount}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Roster */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My team</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.teamRoster ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Could not load team data
              </p>
            ) : data.teamRoster.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No team members found
              </p>
            ) : (
              <div className="space-y-2">
                {data.teamRoster.map((member) => (
                  <div
                    key={member.membershipId}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{member.name}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[member.status]}`}
                    >
                      {member.statusLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
