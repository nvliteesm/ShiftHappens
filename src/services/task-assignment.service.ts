/**
 * TaskAssignment Service (Control Layer)
 * 
 * Business logic for task assignment lifecycle:
 * - Accept/reject assignments (staff actions)
 * - Clock in/out (time tracking)
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

export class TaskAssignmentService {
  private assignmentRepo = new TaskAssignmentRepository();

  /**
   * Accepts a pending task assignment.
   * Only the assigned member can accept.
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

    return this.assignmentRepo.updateStatus(assignmentId, "accepted");
  }

  /**
   * Rejects a pending task assignment with a required reason.
   * Only the assigned member can reject.
   */
  async reject(assignmentId: string, membershipId: string, reason: string) {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    if (assignment.membershipId !== membershipId) {
      throw new Error("Not authorized to manage this assignment");
    }

    if (assignment.status !== "pending") {
      throw new Error("Can only reject pending assignments");
    }

    return this.assignmentRepo.reject(assignmentId, reason);
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

    return this.assignmentRepo.clockIn(assignmentId);
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

    return this.assignmentRepo.clockOut(assignmentId);
  }
}