/**
 * Cron Authorization (Boundary helper)
 *
 * The scheduled-jobs endpoint (/api/cron) is not protected by a user session —
 * it is invoked by an external scheduler (Vercel Cron or a GitHub Action) that
 * presents a shared secret as an `Authorization: Bearer <CRON_SECRET>` header.
 * Vercel Cron injects exactly this header automatically when a `CRON_SECRET`
 * environment variable is configured on the project.
 *
 * Fail-closed: if no `CRON_SECRET` is configured, NO request is authorized, so
 * the endpoint can never be left publicly triggerable by misconfiguration.
 */
export function isAuthorizedCron(authHeader: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
