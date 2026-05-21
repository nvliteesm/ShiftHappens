/**
 * Auth Guard Utility (Boundary Layer)
 * 
 * Helper functions for protecting API routes.
 * Used by route handlers to verify authentication
 * before processing requests.
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

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