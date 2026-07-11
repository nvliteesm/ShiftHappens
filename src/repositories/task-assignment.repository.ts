/**
 * TaskAssignment Repository (Entity Layer)
 * 
 * Data access layer for task assignment operations.
 * Handles assignment creation, status transitions
 * (pending → accepted → clocked in → completed),
 * rejection with reason, and clock in/out tracking.
 * 
 * Security: Prisma parameterized queries prevent SQL injection.
 */
import { prisma } from "@/lib/prisma";

export class TaskAssignmentRepository {
  /** Creates a new task assignment with pending status */
  async create(data: {
    taskId: string;
    membershipId: string;
    assignedById: string;
    status?: string;
  }) {
    return prisma.taskAssignment.create({
      data: {
        taskId: data.taskId,
        membershipId: data.membershipId,
        assignedById: data.assignedById,
        status: data.status ?? "pending",
      },
    });
  }

  /** Finds an assignment by ID with full task and user details */
  async findById(id: string) {
    return prisma.taskAssignment.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            department: { select: { id: true, name: true } },
          },
        },
        membership: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        assignedBy: { select: { id: true, name: true } },
      },
    });
  }

  /** Lists all assignments for a specific task */
  async findByTaskId(taskId: string) {
    return prisma.taskAssignment.findMany({
      where: { taskId },
      include: {
        membership: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Lists all assignments for a member, optionally filtered by status.
   * Used for staff viewing their assigned tasks (US-56).
   */
  async findByMembershipId(membershipId: string, status?: string) {
    return prisma.taskAssignment.findMany({
      where: {
        membershipId,
        ...(status && { status }),
      },
      include: {
        task: {
          include: {
            department: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
        },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Updates an assignment's status */
  async updateStatus(id: string, status: string) {
    return prisma.taskAssignment.update({
      where: { id },
      data: { status },
    });
  }

  /** Rejects an assignment with a required reason */
  async reject(id: string, reason: string, notes?: string) {
    return prisma.taskAssignment.update({
      where: { id },
      data: {
        status: "rejected",
        rejectionReason: reason,
        rejectionNotes: notes,
      },
    });
  }

  /** Records clock-in time for an accepted assignment */
  async clockIn(id: string) {
    return prisma.taskAssignment.update({
      where: { id },
      data: { clockInTime: new Date() },
    });
  }

  /**
   * Records clock-out time and moves the assignment to "clocked_out".
   * The shift is worked but not yet confirmed done — the staff member
   * explicitly marks it completed afterwards (see `complete`).
   */
  async clockOut(id: string) {
    return prisma.taskAssignment.update({
      where: { id },
      data: {
        clockOutTime: new Date(),
        status: "clocked_out",
      },
    });
  }

  /** Marks a clocked-out assignment as completed (staff confirmation). */
  async complete(id: string) {
    return prisma.taskAssignment.update({
      where: { id },
      data: { status: "completed" },
    });
  }

  /** Records a staff withdrawal request with a reason. Slot stays reserved. */
  async requestWithdrawal(id: string, reason: string) {
    return prisma.taskAssignment.update({
      where: { id },
      data: {
        status: "withdrawal_requested",
        withdrawalReason: reason,
      },
    });
  }

  /** Manager denies a withdrawal request — assignment reverts to accepted. */
  async denyWithdrawal(id: string) {
    return prisma.taskAssignment.update({
      where: { id },
      data: {
        status: "accepted",
        withdrawalReason: null,
      },
    });
  }

  /**
   * Counts active (slot-occupying) assignments for a task.
   * pending, accepted, and withdrawal_requested all reserve a slot —
   * a pending withdrawal keeps the seat until a manager resolves it.
   * Used to check against requiredHeadcount before adding more.
   */
  async countActiveByTaskId(taskId: string): Promise<number> {
    return prisma.taskAssignment.count({
      where: {
        taskId,
        status: { in: ["pending", "accepted", "withdrawal_requested"] },
      },
    });
  }

  /** Cancels (deletes) an assignment — admin/manager action */
  async cancel(id: string) {
    return prisma.taskAssignment.delete({ where: { id } });
  }
}