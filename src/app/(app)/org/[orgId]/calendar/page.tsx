/**
 * Calendar View Page (Boundary Layer)
 * 
 * Weekly calendar showing scheduled tasks as colored blocks
 * by department. Admins and managers can see all tasks.
 * Click a task block to view details.
 * Navigate between weeks with prev/next buttons.
 * 
 * Features:
 * - Department color coding with legend
 * - Side-by-side rendering of overlapping tasks
 * - Department filter
 * - Current time indicator
 * - Unscheduled tasks notice
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  requiredHeadcount: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  department: { id: string; name: string; color: string | null } | null;
  assignments: {
    id: string;
    status: string;
    membership: { user: { name: string | null } };
  }[];
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Calculates column positions for overlapping tasks.
 * Returns a map of taskId -> { column, totalColumns }
 */
function calculateOverlapColumns(dayTasks: Task[]): Map<string, { column: number; totalColumns: number }> {
  const result = new Map<string, { column: number; totalColumns: number }>();

  if (dayTasks.length === 0) return result;

  const sorted = [...dayTasks].sort((a, b) => {
    return new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime();
  });

  const groups: Task[][] = [];
  let currentGroup: Task[] = [sorted[0]];
  let groupEnd = new Date(sorted[0].scheduledEnd!).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const taskStart = new Date(sorted[i].scheduledStart!).getTime();
    if (taskStart < groupEnd) {
      currentGroup.push(sorted[i]);
      groupEnd = Math.max(groupEnd, new Date(sorted[i].scheduledEnd!).getTime());
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
      groupEnd = new Date(sorted[i].scheduledEnd!).getTime();
    }
  }
  groups.push(currentGroup);

  for (const group of groups) {
    const totalColumns = group.length;
    group.forEach((task, column) => {
      result.set(task.id, { column, totalColumns });
    });
  }

  return result;
}

export default function CalendarPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterDept, setFilterDept] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchTasks();
  }, [orgId]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Re-fetch when page becomes visible (user navigates back)
  useEffect(() => {
    function onFocus() {
      fetchTasks();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [orgId]);

  async function fetchTasks() {
    try {
      const res = await fetch(`/api/organizations/${orgId}/tasks`);
      if (!res.ok) {
        setError("Failed to load tasks");
        return;
      }
      const data = await res.json();
      setTasks(data);
      setError(null);
    } catch {
      setError("Failed to load tasks. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function goToday() {
    const todayWeek = getWeekStart(new Date());
    if (todayWeek.getTime() === weekStart.getTime()) return;
    setWeekStart(todayWeek);
  }

  const weekDates = getWeekDates(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get unique departments for filter — sorted alphabetically
  const departments = Array.from(
    new Map(
      tasks
        .filter((t) => t.department)
        .map((t) => [t.department!.id, t.department!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Filter tasks
  const filteredTasks = filterDept
    ? tasks.filter((t) => t.department?.id === filterDept)
    : tasks;

  // Scheduled vs unscheduled
  const unscheduledCount = filteredTasks.filter(
    (t) => !t.scheduledStart || !t.scheduledEnd
  ).length;

  // Tasks within this week
  const weekTasks = filteredTasks.filter((t) => {
    if (!t.scheduledStart || !t.scheduledEnd) return false;
    const start = new Date(t.scheduledStart);
    const end = new Date(t.scheduledEnd);
    return start < weekEnd && end > weekStart;
  });

  function getTasksForDay(dayIndex: number): Task[] {
    const dayDate = weekDates[dayIndex];
    return weekTasks.filter((t) => {
      const start = new Date(t.scheduledStart!);
      return start.getDay() === dayDate.getDay() &&
        start.toDateString() === dayDate.toDateString();
    });
  }

  function getTaskPosition(task: Task) {
    const start = new Date(task.scheduledStart!);
    const end = new Date(task.scheduledEnd!);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = ((startHour - 6) / 16) * 100;
    const height = ((endHour - startHour) / 16) * 100;
    return { top: `${top}%`, height: `${Math.max(height, 3)}%` };
  }

  // Current time indicator position
  function getCurrentTimePosition(): number | null {
    const hour = currentTime.getHours() + currentTime.getMinutes() / 60;
    if (hour < 6 || hour > 22) return null;
    return ((hour - 6) / 16) * 100;
  }

  const today = new Date();
  const todayStr = today.toDateString();
  const timePosition = getCurrentTimePosition();

  if (loading) return <p>Loading...</p>;

  return (
    <div className="max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Calendar</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>
            ← Prev
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            Next →
          </Button>
        </div>
      </div>

      {/* Week range and filters */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
        </p>
        <div className="flex items-center gap-3">
          {unscheduledCount > 0 && (
            <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-xs text-amber-700">
              {unscheduledCount} unscheduled task{unscheduledCount > 1 ? "s" : ""} not shown
            </span>
          )}
          <select
            className="rounded-md border px-3 py-1.5 text-sm"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Calendar grid */}
      <div className="rounded-lg border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 border-b bg-muted/30">
          <div className="p-2 text-xs text-muted-foreground border-r" />
          {weekDates.map((date, i) => (
            <div
              key={i}
              className={`p-2 text-center text-sm border-r last:border-r-0 ${
                date.toDateString() === todayStr
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : ""
              }`}
            >
              <div>{DAYS[date.getDay()]}</div>
              <div className="text-xs text-muted-foreground">
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-8" style={{ minHeight: "640px" }}>
          {/* Hour labels */}
          <div className="border-r">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-b text-xs text-muted-foreground px-2 flex items-start pt-1"
                style={{ height: `${100 / 16}%` }}
              >
                {hour === 0
                  ? "12 AM"
                  : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                  ? "12 PM"
                  : `${hour - 12} PM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIndex) => {
            const dayTasks = getTasksForDay(dayIndex);
            const overlapMap = calculateOverlapColumns(dayTasks);
            const isToday = date.toDateString() === todayStr;

            return (
              <div
                key={dayIndex}
                className={`border-r last:border-r-0 relative ${
                  isToday ? "bg-blue-50/30" : ""
                }`}
              >
                {/* Hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b"
                    style={{ height: `${100 / 16}%` }}
                  />
                ))}

                {/* Current time indicator */}
                {isToday && timePosition !== null && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: `${timePosition}%` }}
                  >
                    <div className="flex items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1" />
                      <div className="flex-1 border-t-2 border-red-500" />
                    </div>
                  </div>
                )}

                {/* Task blocks */}
                {dayTasks.map((task) => {
                  const pos = getTaskPosition(task);
                  const color = task.department?.color || "#94A3B8";
                  const overlap = overlapMap.get(task.id) || { column: 0, totalColumns: 1 };
                  const widthPercent = 100 / overlap.totalColumns;
                  const leftPercent = overlap.column * widthPercent;

                  return (
                    <div
                      key={task.id}
                      className="absolute rounded px-1 py-0.5 text-xs cursor-pointer overflow-hidden hover:opacity-90 transition-opacity z-10"
                      style={{
                        top: pos.top,
                        height: pos.height,
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        backgroundColor: `${color}20`,
                        borderLeft: `3px solid ${color}`,
                        color: color,
                      }}
                      onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                    >
                      <div className="font-medium truncate" style={{ color }}>
                        {task.title}
                      </div>
                      {parseFloat(pos.height) > 8 && (
                        <div className="truncate text-muted-foreground" style={{ fontSize: "10px" }}>
                          {task.assignments.length}/{task.requiredHeadcount} staff
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        {departments.map((dept) => (
          <div key={dept.id} className="flex items-center gap-2 text-sm">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: dept.color || "#94A3B8" }}
            />
            <span className="text-muted-foreground">{dept.name}</span>
          </div>
        ))}
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {selectedTask.department && (
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: selectedTask.department.color || "#94A3B8",
                    }}
                  />
                )}
                {selectedTask.title}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTask(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Department: </span>
              {selectedTask.department?.name || "None"}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Status: </span>
              {selectedTask.status}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Priority: </span>
              {selectedTask.priority}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Schedule: </span>
              {selectedTask.scheduledStart &&
                new Date(selectedTask.scheduledStart).toLocaleString()}
              {selectedTask.scheduledEnd &&
                ` — ${new Date(selectedTask.scheduledEnd).toLocaleString()}`}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Staff: </span>
              {selectedTask.assignments.length}/{selectedTask.requiredHeadcount}
              {selectedTask.assignments.length > 0 && (
                <span>
                  {" — "}
                  {selectedTask.assignments
                    .map((a) => `${a.membership.user.name || "Unnamed"} (${a.status})`)
                    .join(", ")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}