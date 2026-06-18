/**
 * Task Service (Control Layer)
 *
 * Business logic for task management including:
 * - Task CRUD with schedule validation
 * - Staff assignment with headcount and conflict checks
 * - Department and staff task views
 * - Notification triggers on assignment
 *
 * Enforces rules:
 * - End time must be after start time
 * - Cannot exceed required headcount
 * - Scheduling conflict detection for staff assignments
 */
import { TaskRepository } from "@/repositories/task.repository";
import { TaskAssignmentRepository } from "@/repositories/task-assignment.repository";
import { SettingsRepository } from "@/repositories/settings.repository";
import { MembershipRepository } from "@/repositories/membership.repository";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validations";
import { AuditLogService, ACTIONS } from "@/services/audit-log.service";
import { NotificationService, NOTIFICATION_TYPES } from "@/services/notification.service";

export class TaskService {
  private taskRepo = new TaskRepository();
  private assignmentRepo = new TaskAssignmentRepository();
  private membershipRepo = new MembershipRepository();
  private settingsRepo = new SettingsRepository();
  private auditService = new AuditLogService();
  private notificationService = new NotificationService();

  /**
   * Creates a new task in an organization.
   * Validates that end time is after start time if both are provided.
   */
  async create(input: CreateTaskInput, orgId: string, userId: string) {
    if ((input.scheduledStart && !input.scheduledEnd) || (!input.scheduledStart && input.scheduledEnd)) {
      throw new Error("Must provide both start and end time, or neither");
    }

    if (input.scheduledStart && input.scheduledEnd) {
      const start = new Date(input.scheduledStart);
      const end = new Date(input.scheduledEnd);
      if (end <= start) {
        throw new Error("End time must be after start time");
      }
    }

    const task = await this.taskRepo.create({
      title: input.title,
      description: input.description,
      organizationId: orgId,
      departmentId: input.departmentId,
      requiredHeadcount: input.requiredHeadcount,
      priority: input.priority,
      scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
      scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
      isRecurring: input.isRecurring,
      recurringPattern: input.recurringPattern,
      createdById: userId,
    });

    await this.auditService.log({
      organizationId: orgId,
      userId,
      action: ACTIONS.TASK_CREATED,
      entityType: "task",
      entityId: task.id,
      details: { title: task.title, department: task.departmentId },
    });

    return task;
  }

  /** Lists tasks for an organization with optional filters */
  async getByOrganization(
    organizationId: string,
    filters?: { status?: string; departmentId?: string; priority?: string }
  ) {
    return this.taskRepo.findByOrganizationId(organizationId, filters);
  }

  /** Gets a single task by ID */
  async getById(taskId: string) {
    return this.taskRepo.findById(taskId);
  }

  /** Updates a task's fields */
  async update(taskId: string, orgId: string, input: UpdateTaskInput) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error("Task not found");

    const startProvided = "scheduledStart" in input;
    const endProvided = "scheduledEnd" in input;
    const newStart = startProvided ? (input.scheduledStart || null) : (task.scheduledStart?.toISOString() ?? null);
    const newEnd = endProvided ? (input.scheduledEnd || null) : (task.scheduledEnd?.toISOString() ?? null);

    if ((newStart && !newEnd) || (!newStart && newEnd)) {
      throw new Error("Must provide both start and end time, or clear both");
    }

    if (newStart && newEnd) {
      const start = new Date(newStart);
      const end = new Date(newEnd);
      if (end <= start) {
        throw new Error("End time must be after start time");
      }
    }

    const updated = await this.taskRepo.update(taskId, {
      title: input.title,
      description: input.description,
      departmentId: input.departmentId,
      requiredHeadcount: input.requiredHeadcount,
      priority: input.priority,
      status: input.status,
      scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : null,
      scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null,
    });

    await this.auditService.log({
      organizationId: orgId,
      action: ACTIONS.TASK_UPDATED,
      entityType: "task",
      entityId: taskId,
      details: input,
    });

    return updated;
  }

  /** Deletes a task */
  async delete(taskId: string, orgId: string) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error("Task not found");

    await this.taskRepo.delete(taskId);

    await this.auditService.log({
      organizationId: orgId,
      action: ACTIONS.TASK_DELETED,
      entityType: "task",
      entityId: taskId,
      details: { title: task.title },
    });
  }

  /**
   * Assigns staff members to a task.
   * Checks headcount, admin guard, scheduling conflicts.
   * Notifies each assigned staff member (fire-and-forget).
   */
  async assignStaff(
    taskId: string,
    organizationId: string,
    membershipIds: string[],
    assignedById: string
  ) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error("Task not found");

    const currentCount = await this.assignmentRepo.countActiveByTaskId(taskId);
    if (currentCount + membershipIds.length > task.requiredHeadcount) {
      throw new Error(
        `Assignment exceeds required headcount of ${task.requiredHeadcount}`
      );
    }

    for (const membId of membershipIds) {
      const membership = await this.membershipRepo.findById(membId);
      if (membership?.role === "company_admin") {
        throw new Error("Company Admins cannot be assigned to tasks");
      }
    }

    if (task.scheduledStart && task.scheduledEnd) {
      for (const membId of membershipIds) {
        const conflicts = await this.taskRepo.findConflictingTasks(
          membId,
          task.scheduledStart,
          task.scheduledEnd,
          taskId
        );
        if (conflicts.length > 0) {
          throw new Error(
            `Staff has a scheduling conflict with "${conflicts[0].title}"`
          );
        }
      }
    }

    const settings = await this.settingsRepo.getOrCreate(organizationId);
    const assignmentStatus = settings.taskAcceptanceMode === "auto_accept" ? "accepted" : "pending";

    const assignments = [];
    for (const membId of membershipIds) {
      const assignment = await this.assignmentRepo.create({
        taskId,
        membershipId: membId,
        assignedById,
        status: assignmentStatus,
      });
      assignments.push(assignment);
    }

    await this.auditService.log({
      organizationId,
      userId: assignedById,
      action: ACTIONS.TASK_ASSIGNED,
      entityType: "task",
      entityId: taskId,
      details: { membershipIds, status: assignmentStatus },
    });

    // Notify each assigned staff member (fire-and-forget)
    for (const membId of membershipIds) {
      const membership = await this.membershipRepo.findById(membId);
      if (membership) {
        void this.notificationService.notify(
          membership.userId,
          NOTIFICATION_TYPES.TASK_ASSIGNED,
          "New task assignment",
          `You've been assigned to "${task.title}"`,
          "assignment",
          taskId
        );
      }
    }

    return assignments;
  }

  /** Cancels a task assignment — admin/manager action */
  async cancelAssignment(assignmentId: string, userId?: string) {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    if (assignment.status === "completed") {
      throw new Error("Cannot cancel a completed assignment");
    }

    const result = await this.assignmentRepo.cancel(assignmentId);

    await this.auditService.log({
      organizationId: assignment.task.organizationId,
      userId,
      action: ACTIONS.TASK_UNASSIGNED,
      entityType: "assignment",
      entityId: assignmentId,
    });

    return result;
  }

  /** Gets tasks for a specific department (manager view) */
  async getTasksByDepartment(departmentId: string) {
    return this.taskRepo.findByDepartmentId(departmentId);
  }

  /** Gets task assignments for a specific staff member */
  async getStaffTasks(membershipId: string, status?: string) {
    return this.assignmentRepo.findByMembershipId(membershipId, status);
  }

  /** Gets task counts grouped by status for the dashboard */
  async getTaskCounts(organizationId: string) {
    const tasks = await this.taskRepo.findByOrganizationId(organizationId);

    const counts = {
      total: tasks.length,
      open: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const task of tasks) {
      if (task.status === "open") counts.open++;
      else if (task.status === "in_progress") counts.in_progress++;
      else if (task.status === "completed") counts.completed++;
      else if (task.status === "cancelled") counts.cancelled++;
    }

    return counts;
  }
}