/**
 * My Tasks Page (Boundary Layer)
 * 
 * Staff view of their own task assignments.
 * Can accept/reject pending assignments and clock in/out.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Assignment {
  id: string;
  status: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  rejectionReason: string | null;
  rejectionNotes: string | null
  task: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    department: { name: string } | null;
    createdBy: { name: string | null };
  };
  assignedBy: { name: string | null };
}

export default function MyTasksPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, [orgId]);

  async function fetchAssignments() {
    try {
      const res = await fetch(`/api/organizations/${orgId}/my-tasks`);
      const data = await res.json();
      setAssignments(data);
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function onAccept(assignmentId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/assignments/${assignmentId}/accept?orgId=${orgId}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const result = await res.json();
        setError(result.error);
        return;
      }
      setSuccess("Task accepted");
      fetchAssignments();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onReject(assignmentId: string, reason: string, notes?: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/assignments/${assignmentId}/reject?orgId=${orgId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason: reason, rejectionNotes: notes }),
        }
      );
      if (!res.ok) {
        const result = await res.json();
        setError(result.error);
        return;
      }
      setRejectingId(null);
      setSuccess("Task rejected");
      fetchAssignments();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onClockIn(assignmentId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/assignments/${assignmentId}/clock-in?orgId=${orgId}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const result = await res.json();
        setError(result.error);
        return;
      }
      setSuccess("Clocked in");
      fetchAssignments();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onClockOut(assignmentId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/assignments/${assignmentId}/clock-out?orgId=${orgId}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const result = await res.json();
        setError(result.error);
        return;
      }
      setSuccess("Clocked out — task completed");
      fetchAssignments();
    } catch {
      setError("Something went wrong");
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-700";
      case "accepted": return "bg-blue-100 text-blue-700";
      case "rejected": return "bg-red-100 text-red-700";
      case "completed": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-600";
    }
  }

  if (loading) return <p>Loading...</p>;

  const pending = assignments.filter((a) => a.status === "pending");
  const active = assignments.filter((a) => a.status === "accepted");
  const completed = assignments.filter((a) => a.status === "completed");
  const rejected = assignments.filter((a) => a.status === "rejected");

  return (
    <div className="max-w-4xl">
      <h2 className="mb-6 text-2xl font-bold">My Tasks</h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {assignments.length === 0 && (
        <p className="text-muted-foreground">No tasks assigned to you yet.</p>
      )}

      {/* Pending assignments */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold">
            Pending ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {a.task.title}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(a.status)}`}>
                      {a.status}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {a.task.department?.name || "No department"}
                    {" · "}Assigned by {a.assignedBy.name || "Unknown"}
                    {a.task.scheduledStart && (
                      <> · {new Date(a.task.scheduledStart).toLocaleString()}</>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {a.task.description && (
                    <p className="mb-3 text-sm text-muted-foreground">{a.task.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onAccept(a.id)}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectingId(rejectingId === a.id ? null : a.id)}
                    >
                      Reject
                    </Button>
                  </div>
                  {rejectingId === a.id && (
                    <form
                      className="mt-3 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        onReject(
                          a.id,
                          formData.get("rejectionReason") as string,
                          (formData.get("rejectionNotes") as string) || undefined
                        );
                      }}
                    >
                      <div className="space-y-1">
                        <select
                          name="rejectionReason"
                          required
                          className="w-full rounded-md border px-3 py-2 text-sm"
                        >
                          <option value="">Select a reason...</option>
                          <option value="schedule_conflict">Schedule conflict</option>
                          <option value="feeling_unwell">Feeling unwell</option>
                          <option value="exceeds_preferred_hours">Exceeds preferred hours</option>
                          <option value="transport_issues">Transport issues</option>
                          <option value="insufficient_notice">Insufficient notice</option>
                          <option value="rest_period_needed">Rest period needed</option>
                          <option value="personal_reasons">Personal reasons</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <Input
                        name="rejectionNotes"
                        placeholder="Additional notes (optional)"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Confirm rejection
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active assignments */}
      {active.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold">
            Active ({active.length})
          </h3>
          <div className="space-y-3">
            {active.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {a.task.title}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(a.status)}`}>
                      accepted
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {a.task.department?.name || "No department"}
                    {a.clockInTime && (
                      <> · Clocked in: {new Date(a.clockInTime).toLocaleTimeString()}</>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {!a.clockInTime && (
                      <Button size="sm" onClick={() => onClockIn(a.id)}>
                        Clock In
                      </Button>
                    )}
                    {a.clockInTime && !a.clockOutTime && (
                      <Button size="sm" onClick={() => onClockOut(a.id)}>
                        Clock Out
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold">
            Completed ({completed.length})
          </h3>
          <div className="space-y-3">
            {completed.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {a.task.title}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(a.status)}`}>
                      completed
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {a.clockInTime && new Date(a.clockInTime).toLocaleTimeString()}
                    {a.clockOutTime && ` — ${new Date(a.clockOutTime).toLocaleTimeString()}`}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">
            Rejected ({rejected.length})
          </h3>
          <div className="space-y-3">
            {rejected.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {a.task.title}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(a.status)}`}>
                      rejected
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Reason: {a.rejectionReason?.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                    {a.rejectionNotes && ` — ${a.rejectionNotes}`}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}