/**
 * Task Service (Control Layer)
 * 
 * Business logic for task management including:
 * - Task CRUD with schedule validation
 * - Staff assignment with headcount and conflict checks
 * - Department and staff task views
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

export class TaskService {
  private taskRepo = new TaskRepository();
  private assignmentRepo = new TaskAssignmentRepository();
  private membershipRepo = new MembershipRepository();
  private settingsRepo = new SettingsRepository();
  /**
   * Creates a new task in an organization.
   * Validates that end time is after start time if both are provided.
   */
  async create(input: CreateTaskInput, organizationId: string, createdById: string) {
    if (input.scheduledStart && input.scheduledEnd) {
      const start = new Date(input.scheduledStart);
      const end = new Date(input.scheduledEnd);
      if (end <= start) {
        throw new Error("End time must be after start time");
      }
    }

    return this.taskRepo.create({
      title: input.title,
      description: input.description,
      organizationId,
      departmentId: input.departmentId,
      requiredHeadcount: input.requiredHeadcount,
      priority: input.priority,
      scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
      scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
      isRecurring: input.isRecurring,
      recurringPattern: input.recurringPattern,
      createdById,
    });
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
  async update(taskId: string, organizationId: string, input: UpdateTaskInput) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error("Task not found");

    return this.taskRepo.update(taskId, {
      title: input.title,
      description: input.description,
      departmentId: input.departmentId,
      requiredHeadcount: input.requiredHeadcount,
      priority: input.priority,
      status: input.status,
      scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
      scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
    });
  }

  /** Deletes a task */
  async delete(taskId: string, organizationId: string) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error("Task not found");

    return this.taskRepo.delete(taskId);
  }

  /**
   * Assigns staff members to a task.
   * Checks:
   * 1. Task exists
   * 2. Total assignments won't exceed requiredHeadcount
   * 3. No scheduling conflicts for each member
   */
  async assignStaff(
    taskId: string,
    organizationId: string,
    membershipIds: string[],
    assignedById: string
  ) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error("Task not found");

    // Check headcount
    const currentCount = await this.assignmentRepo.countActiveByTaskId(taskId);
    if (currentCount + membershipIds.length > task.requiredHeadcount) {
      throw new Error(
        `Assignment exceeds required headcount of ${task.requiredHeadcount}`
      );
    }

    // Verify assigned members are not Company Admins
    for (const membId of membershipIds) {
      const membership = await this.membershipRepo.findById(membId);
      if (membership?.role === "company_admin") {
        throw new Error("Company Admins cannot be assigned to tasks");
      }
    }

    // Check scheduling conflicts for each member
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

    // Check task acceptance mode
    const settings = await this.settingsRepo.getOrCreate(organizationId);
    const assignmentStatus = settings.taskAcceptanceMode === "auto_accept" ? "accepted" : "pending";

    // Create assignments
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

    return assignments;
  }

  /** Cancels a task assignment — admin/manager action */
  async cancelAssignment(assignmentId: string) {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    if (assignment.status === "completed") {
      throw new Error("Cannot cancel a completed assignment");
    }

    return this.assignmentRepo.cancel(assignmentId);
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