/**
 * Eligibility Check API Endpoint (Boundary Layer)
 * GET /api/organizations/[orgId]/tasks/[taskId]/eligibility
 * 
 * Returns eligibility status for all staff against a specific task.
 * Shows which staff are eligible and reasons for any blocks.
 * Requires admin/manager role.
 */
import { NextRequest, NextResponse } from "next/server";
import { EligibilityService } from "@/services/eligibility.service";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { MembershipRepository } from "@/repositories/membership.repository";

const eligibilityService = new EligibilityService();
const membershipRepo = new MembershipRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; taskId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { orgId, taskId } = await params;

    const membership = await membershipRepo.findByUserAndOrg(user.id, orgId);
    if (!membership || !["company_admin", "manager"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const eligibility = await eligibilityService.checkEligibilityForTask(
      taskId,
      orgId
    );
    return NextResponse.json(eligibility);
  } catch (error) {
    if (error instanceof Error && error.message === "Task not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}