/**
 * Organization Profile API Endpoint (Boundary Layer)
 * PATCH /api/organizations/[orgId] — Update organization profile
 * 
 * Requires authentication and Company Admin role.
 * Org-scoped for tenant isolation.
 */
import { NextRequest, NextResponse } from "next/server";
import { updateOrganizationSchema } from "@/lib/validations";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { MembershipRepository } from "@/repositories/membership.repository";
import { prisma } from "@/lib/prisma";

const membershipRepo = new MembershipRepository();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { orgId } = await params;

    // Verify user is a company_admin of this org
    const membership = await membershipRepo.findByUserAndOrg(user.id, orgId);
    if (!membership || membership.role !== "company_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateOrganizationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}