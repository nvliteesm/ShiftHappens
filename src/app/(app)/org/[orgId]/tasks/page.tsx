/**
 * Tasks Management Page (Boundary Layer)
 * 
 * Admin/Manager can view all tasks, create new tasks,
 * assign staff, and manage task lifecycle.
 * Supports filtering by status, department, and priority.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  requiredHeadcount: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  department: { id: string; name: string } | null;
  createdBy: { id: string; name: string | null };
  assignments: {
    id: string;
    status: string;
    clockInTime: string | null;
    clockOutTime: string | null;
    membership: { user: { id: string; name: string | null } };
  }[];
}

interface Department {
  id: string;
  name: string;
}

interface Member {
  id: string;
  role: string;
  status: string;
  user: { id: string; name: string | null; email: string };
}

export default function TasksPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchTasks();
    fetchDepartments();
    fetchMembers();
  }, [orgId]);

  useEffect(() => {
    fetchTasks();
  }, [filterStatus, filterDept]);

  async function fetchTasks() {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterDept) params.set("departmentId", filterDept);

      const res = await fetch(`/api/organizations/${orgId}/tasks?${params}`);
      const data = await res.json();
      setTasks(data);
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function fetchDepartments() {
    try {
      const res = await fetch(`/api/organizations/${orgId}/departments`);
      const data = await res.json();
      setDepartments(data);
    } catch {}
  }

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`);
      const data = await res.json();
      setMembers(data.filter((m: Member) => m.status === "active"));
    } catch {}
  }

  async function fetchEligibility(taskId: string) {
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/tasks/${taskId}/eligibility`
      );
      const data = await res.json();
      const map: Record<string, any> = {};
      for (const item of data) {
        map[item.membershipId] = item;
      }
      setEligibility(map);
    } catch {}
  }

  async function onCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);

    const taskData: Record<string, unknown> = {
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      departmentId: formData.get("departmentId") || undefined,
      priority: formData.get("priority"),
      requiredHeadcount: Number(formData.get("requiredHeadcount")) || 1,
    };

    const start = formData.get("scheduledStart") as string;
    const end = formData.get("scheduledEnd") as string;
    if (start) taskData.scheduledStart = new Date(start).toISOString();
    if (end) taskData.scheduledEnd = new Date(end).toISOString();

    try {
      const res = await fetch(`/api/organizations/${orgId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to create task");
        return;
      }

      setShowCreate(false);
      setSuccess("Task created successfully");
      (event.target as HTMLFormElement).reset();
      fetchTasks();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onAssignStaff(taskId: string) {
    if (selectedMembers.length === 0) {
      setError("Select at least one member");
      return;
    }
    setError(null);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/tasks/${taskId}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ membershipIds: selectedMembers }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to assign staff");
        return;
      }

      setAssigningTaskId(null);
      setSelectedMembers([]);
      setSuccess("Staff assigned successfully");
      fetchTasks();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onDeleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    setError(null);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/tasks/${taskId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Failed to delete task");
        return;
      }

      fetchTasks();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onUpdateStatus(taskId: string, status: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Failed to update status");
        return;
      }

      fetchTasks();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onUpdateTask(event: React.FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    const updateData: Record<string, unknown> = {
      title: formData.get("editTitle"),
      description: formData.get("editDescription") || undefined,
      departmentId: formData.get("editDepartment") || undefined,
      priority: formData.get("editPriority"),
      requiredHeadcount: Number(formData.get("editHeadcount")) || 1,
    };

    const start = formData.get("editStart") as string;
    const end = formData.get("editEnd") as string;
    if (start) updateData.scheduledStart = new Date(start).toISOString();
    if (end) updateData.scheduledEnd = new Date(end).toISOString();

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to update task");
        return;
      }

      setEditingTaskId(null);
      setSuccess("Task updated");
      fetchTasks();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onCancelAssignment(assignmentId: string) {
    if (!confirm("Are you sure you want to unassign this staff member?")) return;
    setError(null);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/tasks/assignments/${assignmentId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Failed to cancel assignment");
        return;
      }

      fetchTasks();
    } catch {
      setError("Something went wrong");
    }
  }

  function toggleMemberSelection(membId: string) {
    setSelectedMembers((prev) =>
      prev.includes(membId)
        ? prev.filter((id) => id !== membId)
        : [...prev, membId]
    );
  }

  function statusColor(status: string) {
    switch (status) {
      case "open": return "bg-blue-100 text-blue-700";
      case "in_progress": return "bg-amber-100 text-amber-700";
      case "completed": return "bg-green-100 text-green-700";
      case "cancelled": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  }

  function priorityColor(priority: string) {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-700";
      case "high": return "bg-amber-100 text-amber-700";
      case "medium": return "bg-blue-100 text-blue-700";
      case "low": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "Create Task"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
        >
          <option value="">All departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
      </div>

      {/* Create task form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>New Task</CardTitle>
          </CardHeader>
          <form onSubmit={onCreateTask}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="departmentId">Department</Label>
                  <select
                    id="departmentId"
                    name="departmentId"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">No department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    name="priority"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    defaultValue="medium"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requiredHeadcount">Required headcount</Label>
                <Input
                  id="requiredHeadcount"
                  name="requiredHeadcount"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={1}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledStart">Start time</Label>
                  <Input
                    id="scheduledStart"
                    name="scheduledStart"
                    type="datetime-local"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledEnd">End time</Label>
                  <Input
                    id="scheduledEnd"
                    name="scheduledEnd"
                    type="datetime-local"
                  />
                </div>
              </div>
              <Button type="submit">Create Task</Button>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">No tasks found.</p>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {task.title}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(task.status)}`}>
                        {task.status.replace("_", " ")}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${priorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {task.department?.name || "No department"}
                      {" · "}
                      {task.assignments.length}/{task.requiredHeadcount} assigned
                      {task.scheduledStart && (
                        <>
                          {" · "}
                          {new Date(task.scheduledStart).toLocaleString()}
                          {task.scheduledEnd && ` — ${new Date(task.scheduledEnd).toLocaleString()}`}
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTaskId(editingTaskId === task.id ? null : task.id)}
                    >
                      {editingTaskId === task.id ? "Cancel" : "Edit"}
                    </Button>
                    {task.status === "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newId = assigningTaskId === task.id ? null : task.id;
                          setAssigningTaskId(newId);
                          setSelectedMembers([]);
                          if (newId) fetchEligibility(newId);
                        }}
                      >
                        Assign
                      </Button>
                    )}
                    <select
                      className="rounded-md border px-2 py-1 text-sm"
                      value={task.status}
                      onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteTask(task.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Edit task form */}
              {editingTaskId === task.id && (
                <CardContent>
                  <form onSubmit={(e) => onUpdateTask(e, task.id)} className="space-y-3">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input name="editTitle" defaultValue={task.title} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input name="editDescription" defaultValue={task.description || ""} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <select
                          name="editDepartment"
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          defaultValue={task.department?.id || ""}
                        >
                          <option value="">No department</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <select
                          name="editPriority"
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          defaultValue={task.priority}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Required headcount</Label>
                      <Input
                        name="editHeadcount"
                        type="number"
                        min={1}
                        max={50}
                        defaultValue={task.requiredHeadcount}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start time</Label>
                        <Input
                          name="editStart"
                          type="datetime-local"
                          defaultValue={task.scheduledStart ? new Date(task.scheduledStart).toISOString().slice(0, 16) : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End time</Label>
                        <Input
                          name="editEnd"
                          type="datetime-local"
                          defaultValue={task.scheduledEnd ? new Date(task.scheduledEnd).toISOString().slice(0, 16) : ""}
                        />
                      </div>
                    </div>
                    <Button type="submit" size="sm">Save Changes</Button>
                  </form>
                </CardContent>
              )}

              {task.description && editingTaskId !== task.id && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </CardContent>
              )}

              {/* Assignments */}
              {task.assignments.length > 0 && (
                <CardContent>
                  <p className="mb-2 text-sm font-medium">Assigned staff</p>
                  <div className="space-y-1">
                    {task.assignments.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <span>{a.membership.user.name || "Unnamed"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(a.status)}`}>
                          {a.status}
                        </span>
                        {a.clockInTime && (
                          <span className="text-xs text-muted-foreground">
                            In: {new Date(a.clockInTime).toLocaleTimeString()}
                          </span>
                        )}
                        {a.clockOutTime && (
                          <span className="text-xs text-muted-foreground">
                            Out: {new Date(a.clockOutTime).toLocaleTimeString()}
                          </span>
                        )}
                        {a.status !== "completed" && (
                          <button
                            className="text-xs text-red-500 hover:underline"
                            onClick={() => onCancelAssignment(a.id)}
                          >
                            Unassign
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}

              {/* Assign staff panel */}
              {assigningTaskId === task.id && (
                <CardContent>
                  <p className="mb-2 text-sm font-medium">Select staff to assign</p>
                  <div className="mb-3 space-y-1">
                    {members.map((m) => {
                      const elig = eligibility[m.id];
                      const isEligible = elig ? elig.eligible : true;

                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-2 text-sm ${
                            !isEligible ? "opacity-60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(m.id)}
                            onChange={() => toggleMemberSelection(m.id)}
                          />
                          <span>{m.user.name || m.user.email}</span>
                          <span className="text-xs text-muted-foreground">({m.role})</span>
                          {elig && !elig.eligible && (
                            <span className="text-xs text-red-500">
                              {elig.checks.availability?.reason ||
                               elig.checks.scheduling?.reason ||
                               elig.checks.hoursLimit?.reason ||
                               "Ineligible"}
                            </span>
                          )}
                          {elig && elig.eligible && (
                            <span className="text-xs text-green-500">✓ eligible</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <Button size="sm" onClick={() => onAssignStaff(task.id)}>
                    Confirm Assignment
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}