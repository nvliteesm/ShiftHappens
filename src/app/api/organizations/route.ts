/**
 * Organizations API Endpoint (Boundary Layer)
 * POST /api/organizations — Create a new organization
 * GET /api/organizations — List user's organizations
 * 
 * Both endpoints require authentication.
 * Organization creation assigns the authenticated user as company_admin.
 * 
 * Returns:
 * - 201: Organization created (POST)
 * - 200: List of organizations (GET)
 * - 400: Validation failed
 * - 401: Unauthorized
 * - 500: Internal server error
 */
import { NextRequest, NextResponse } from "next/server";
import { OrganizationService } from "@/services/organization.service";
import { createOrganizationSchema } from "@/lib/validations";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";

const orgService = new OrganizationService();

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createOrganizationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Delegate to OrganizationService (Control layer)
    const org = await orgService.create(parsed.data, user.id);

    return NextResponse.json(org, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const orgs = await orgService.getUserOrganizations(user.id);

    return NextResponse.json(orgs);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}