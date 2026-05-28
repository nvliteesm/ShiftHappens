/**
 * Organization Access Guard
 * 
 * Validates that an organization is active before allowing access.
 * Used by API routes and layouts to enforce org suspension.
 */
import { prisma } from "@/lib/prisma";

/**
 * Checks if an organization is active.
 * Returns false if suspended or not found.
 */
export async function checkOrgActive(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { status: true },
  });

  if (!org) return false;
  return org.status === "active";
}