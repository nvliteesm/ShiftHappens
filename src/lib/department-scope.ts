/**
 * Department Scoping (Boundary/Control helper)
 *
 * Company Admins have organization-wide access. Managers (and other non-admin
 * roles) are scoped to the department(s) they belong to — they can only see
 * and act on tasks, members, and allocations within those departments
 * (PRD §2.2, §4.5).
 *
 * A `null` scope means "unrestricted" (company admin). An array scopes to those
 * department IDs. A resource with no department is out of scope for anyone who
 * is scoped (only admins can touch org-wide, department-less resources).
 *
 * These helpers are framework-free (aside from Prisma) so they can be unit
 * tested and reused by both routes (Boundary) and services (Control).
 */
import { prisma } from "@/lib/prisma";

export interface ScopableMembership {
  role: string;
  departmentMemberships?: { department: { id: string } }[];
}

/**
 * The department IDs a member is scoped to, or `null` when unrestricted.
 * Company admins are unrestricted; everyone else is limited to their
 * assigned departments (which may be an empty list).
 */
export function departmentScopeFor(membership: ScopableMembership): string[] | null {
  if (membership.role === "company_admin") return null;
  return (membership.departmentMemberships ?? []).map((dm) => dm.department.id);
}

/**
 * Whether a department is within a scope. `null` scope allows everything;
 * a resource with no department is never in scope for a scoped member.
 */
export function isDepartmentInScope(
  departmentId: string | null | undefined,
  scope: string[] | null
): boolean {
  if (scope === null) return true;
  if (!departmentId) return false;
  return scope.includes(departmentId);
}

/**
 * Boundary check: can this member act on the given task under department
 * scoping? Admins always can. Scoped members can only touch tasks in one of
 * their departments. A missing task returns false (caller responds 404).
 */
export async function isTaskInScope(
  taskId: string,
  membership: ScopableMembership
): Promise<boolean> {
  const scope = departmentScopeFor(membership);
  if (scope === null) return true;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { departmentId: true },
  });
  if (!task) return false;
  return isDepartmentInScope(task.departmentId, scope);
}

/**
 * Boundary check for assignment-level routes: resolves the assignment's task
 * department and applies the same scoping rule.
 */
export async function isAssignmentTaskInScope(
  assignmentId: string,
  membership: ScopableMembership
): Promise<boolean> {
  const scope = departmentScopeFor(membership);
  if (scope === null) return true;

  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: assignmentId },
    select: { task: { select: { departmentId: true } } },
  });
  if (!assignment) return false;
  return isDepartmentInScope(assignment.task.departmentId, scope);
}
