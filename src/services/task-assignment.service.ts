/**
 * TaskAssignment Service (Control Layer)
 *
 * Business logic for task assignment lifecycle:
 * - Accept/reject assignments (staff actions)
 * - Clock in/out (time tracking)
 * - Notification triggers on accept/reject
 *
 * Enforces status transition rules:
 * - pending → accepted (accept)
 * - pending → rejected (reject, requires reason)
 * - accepted → clocked in (clockIn)
 * - clocked in → completed (clockOut)
 *
 * Authorization: Only the assigned member can perform
 * accept, reject, clockIn, and clockOut actions.
 */
import { TaskAssignmentRepository } from "@/repositories/task-assignment.repository";
import { AuditLogService, ACTIONS } from "@/services/audit-log.service";
import { NotificationService, NOTIFICATION_TYPES } from "@/services/notification.service";

export class TaskAssignmentService {
  private assignmentRepo = new TaskAssignmentRepository();
  private auditService = new AuditLogService();
  private notificationService = new NotificationService();

  /**
   * Accepts a pending task assignment.
   * Notifies the admin/manager who assigned the task.
   */
  async accept(assignmentId: string, membershipId: string) {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    if (assignment.membershipId !== membershipId) {
      throw new Error("Not authorized to manage this assignment");
    }

    if (assignment.status !== "pending") {
      throw new Error("Can only accept pending assignments");
    }

    const result = await this.assignmentRepo.updateStatus(assignmentId, "accepted");

    await this.auditService.log({
      organizationId: assignment.task.organizationId,
      userId: assignment.membership.userId,
      action: ACTIONS.ASSIGNMENT_ACCEPTED,
      entityType: "assignment",
      entityId: assignmentId,
      details: { taskTitle: assignment.task.title },
    });

    // Notify the admin/manager who assigned the task
    const staffName = assignment.membership.user?.name || "A staff member";
    void this.notificationService.notify(
      assignment.assignedById,
      NOTIFICATION_TYPES.ASSIGNMENT_ACCEPTED,
      "Assignment accepted",
      `${staffName} accepted "${assignment.task.title}"`,
      "task",
      assignment.task.id
    );

    return result;
  }

  /**
   * Rejects a pending task assignment with a required reason.
   * Notifies the admin/manager who assigned the task.
   */
  async reject(assignmentId: string, membershipId: string, reason: string, notes?: string) {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    if (assignment.membershipId !== membershipId) {
      throw new Error("Not authorized to manage this assignment");
    }

    if (assignment.status !== "pending") {
      throw new Error("Can only reject pending assignments");
    }

    const result = await this.assignmentRepo.reject(assignmentId, reason, notes);

    await this.auditService.log({
      organizationId: assignment.task.organizationId,
      userId: assignment.membership.userId,
      action: ACTIONS.ASSIGNMENT_REJECTED,
      entityType: "assignment",
      entityId: assignmentId,
      details: { reason, notes, taskTitle: assignment.task.title },
    });

    // Notify the admin/manager who assigned the task
    const staffName = assignment.membership.user?.name || "A staff member";
    void this.notificationService.notify(
      assignment.assignedById,
      NOTIFICATION_TYPES.ASSIGNMENT_REJECTED,
      "Assignment rejected",
      `${staffName} rejected "${assignment.task.title}" — ${reason.replace(/_/g, " ")}`,
      "task",
      assignment.task.id
    );

    return result;
  }

  /**
   * Records clock-in for an accepted assignment.
   * Must be accepted and not already clocked in.
   */
  async clockIn(assignmentId: string, membershipId: string) {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    if (assignment.membershipId !== membershipId) {
      throw new Error("Not authorized to manage this assignment");
    }

    if (assignment.status !== "accepted") {
      throw new Error("Can only clock in to accepted assignments");
    }

    if (assignment.clockInTime) {
      throw new Error("Already clocked in");
    }

    const result = await this.assignmentRepo.clockIn(assignmentId);

    await this.auditService.log({
      organizationId: assignment.task.organizationId,
      userId: assignment.membership.userId,
      action: ACTIONS.ASSIGNMENT_CLOCKED_IN,
      entityType: "assignment",
      entityId: assignmentId,
      details: { taskTitle: assignment.task.title },
    });

    return result;
  }

  /**
   * Records clock-out and marks assignment as completed.
   * Must be clocked in and not already clocked out.
   */
  async clockOut(assignmentId: string, membershipId: string) {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    if (assignment.membershipId !== membershipId) {
      throw new Error("Not authorized to manage this assignment");
    }

    if (!assignment.clockInTime) {
      throw new Error("Must clock in before clocking out");
    }

    if (assignment.clockOutTime) {
      throw new Error("Already clocked out");
    }

    const result = await this.assignmentRepo.clockOut(assignmentId);

    await this.auditService.log({
      organizationId: assignment.task.organizationId,
      userId: assignment.membership.userId,
      action: ACTIONS.ASSIGNMENT_CLOCKED_OUT,
      entityType: "assignment",
      entityId: assignmentId,
      details: { taskTitle: assignment.task.title },
    });

    return result;
  }
}