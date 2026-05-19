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