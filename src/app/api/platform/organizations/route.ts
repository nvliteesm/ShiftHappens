/**
 * Platform Organizations API Endpoint (Boundary Layer)
 * GET /api/platform/organizations — List all organizations
 * 
 * Requires platform admin authentication.
 */
import { NextRequest, NextResponse } from "next/server";
import { PlatformService } from "@/services/platform.service";
import { getPlatformAdmin } from "@/lib/platform-guard";

const platformService = new PlatformService();

export async function GET(request: NextRequest) {
  try {
    const admin = await getPlatformAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await platformService.getOrganizations(limit, offset);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}