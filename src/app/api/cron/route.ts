/**
 * Scheduled Jobs Endpoint (Boundary Layer)
 * GET /api/cron
 *
 * Single entrypoint for an external scheduler (Vercel Cron or a GitHub Action)
 * to keep the whole platform current. On each call it, across every ACTIVE org:
 *   1. Generates upcoming recurring-task instances.
 *   2. Runs the hour-limit alert scan (notifies at-risk staff/managers).
 *
 * Auth: NOT a user session. The caller must present the shared secret as
 * `Authorization: Bearer <CRON_SECRET>`. Vercel Cron injects this automatically
 * when CRON_SECRET is set on the project. Fail-closed — if CRON_SECRET is not
 * configured, every request is rejected.
 *
 * Both jobs are idempotent and cooldown-guarded, so extra calls are harmless.
 */
import { NextRequest, NextResponse } from "next/server";
import { SchedulerService } from "@/services/scheduler.service";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fanning out across all tenants can take a while on larger datasets.
export const maxDuration = 60;

const scheduler = new SchedulerService();

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    const result = await scheduler.runAll();
    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[Cron] scheduled run failed:", error);
    return NextResponse.json(
      { ok: false, error: "Scheduled run failed" },
      { status: 500 }
    );
  }
}
