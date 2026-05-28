/**
 * Single Department API Endpoint (Boundary Layer)
 * PATCH /api/organizations/[orgId]/departments/[deptId] — Update department
 * DELETE /api/organizations/[orgId]/departments/[deptId] — Delete department
 * 
 * Requires authentication and Company Admin role.
 * Delete is blocked if department has assigned members.
 */
import { NextRequest, NextResponse } from "next/server";
import { DepartmentService } from "@/services/department.service";
import { updateDepartmentSchema } from "@/lib/validations";
import { getAuthenticatedUser, unauthorizedResponse, checkOrgSuspended } from "@/lib/auth-guard";
import { MembershipRepository } from "@/repositories/membership.repository";

const deptService = new DepartmentService();
const membershipRepo = new MembershipRepository();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; deptId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { orgId, deptId } = await params;
    const suspended = await checkOrgSuspended(orgId);
    if (suspended) return suspended;

    const membership = await membershipRepo.findByUserAndOrg(user.id, orgId);
    if (!membership || membership.role !== "company_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateDepartmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await deptService.update(deptId, orgId, parsed.data, user.id);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Department name already exists") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; deptId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { orgId, deptId } = await params;
    const suspended = await checkOrgSuspended(orgId);
    if (suspended) return suspended;

    const membership = await membershipRepo.findByUserAndOrg(user.id, orgId);
    if (!membership || membership.role !== "company_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deptService.delete(deptId, orgId, user.id);
    return NextResponse.json({ message: "Department deleted" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot delete")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}