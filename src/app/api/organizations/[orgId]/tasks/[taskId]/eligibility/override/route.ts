/**
 * Eligibility Override API Endpoint (Boundary Layer)
 * POST /api/organizations/[orgId]/tasks/[taskId]/eligibility/override
 * 
 * Creates an eligibility override for a blocked staff member.
 * Requires admin/manager role and a documented reason.
 */
import { NextRequest, NextResponse } from "next/server";
import { EligibilityService } from "@/services/eligibility.service";
import { createEligibilityOverrideSchema } from "@/lib/validations";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { MembershipRepository } from "@/repositories/membership.repository";

const eligibilityService = new EligibilityService();
const membershipRepo = new MembershipRepository();

export async function POST(
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

    const body = await request.json();
    const parsed = createEligibilityOverrideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const override = await eligibilityService.createOverride(
      taskId,
      parsed.data.membershipId,
      user.id,
      parsed.data.reason,
      parsed.data.ruleOverridden
    );

    return NextResponse.json(override, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}