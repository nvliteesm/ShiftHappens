/**
 * Auth Guard Utility (Boundary Layer)
 * 
 * Helper functions for protecting API routes.
 * Used by route handlers to verify authentication
 * and organization access before processing requests.
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { checkOrgActive } from "@/lib/org-guard";

/**
 * Retrieves the authenticated user from the session.
 * Returns null if no valid session exists.
 */
export async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

/** Returns a standardized 401 Unauthorized JSON response */
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Returns a standardized 403 response for suspended organizations */
export function orgSuspendedResponse() {
  return NextResponse.json(
    { error: "Organization is suspended" },
    { status: 403 }
  );
}

/**
 * Checks if an organization is active. Returns a 403 response
 * if suspended, or null if the org is active (proceed normally).
 * 
 * Usage in API routes:
 *   const suspended = await checkOrgSuspended(orgId);
 *   if (suspended) return suspended;
 */
export async function checkOrgSuspended(orgId: string) {
  const isActive = await checkOrgActive(orgId);
  if (!isActive) return orgSuspendedResponse();
  return null;
}