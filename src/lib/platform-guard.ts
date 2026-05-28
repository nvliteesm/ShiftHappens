/**
 * Platform Admin Auth Guard
 * 
 * Validates that the current user is a platform admin.
 * Used by platform-level API routes that operate across all organizations.
 */
import { auth } from "@/lib/auth";

export async function getPlatformAdmin() {
  const session = await auth();
  if (!session?.user) return null;

  const isPlatformAdmin = (session.user as unknown as Record<string, unknown>).isPlatformAdmin;
  if (!isPlatformAdmin) return null;

  return session.user;
}