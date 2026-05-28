/**
 * Platform Stats API Endpoint (Boundary Layer)
 * GET /api/platform/stats — Get platform-wide statistics
 * 
 * Requires platform admin authentication.
 */
import { NextResponse } from "next/server";
import { PlatformService } from "@/services/platform.service";
import { getPlatformAdmin } from "@/lib/platform-guard";

const platformService = new PlatformService();

export async function GET() {
  try {
    const admin = await getPlatformAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await platformService.getStats();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}