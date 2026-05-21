/**
 * App Layout (Boundary Layer)
 * 
 * Shared layout for all authenticated pages.
 * Fetches the user's organization and role to pass to the
 * role-aware sidebar. Redirects unauthenticated users to /login.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OrganizationService } from "@/services/organization.service";
import { MembershipRepository } from "@/repositories/membership.repository";

const orgService = new OrganizationService();
const membershipRepo = new MembershipRepository();

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Get user's first organization and role for sidebar
  const orgs = await orgService.getUserOrganizations(session.user.id);
  let orgId: string | undefined;
  let role: string | undefined;

  if (orgs.length > 0) {
    orgId = orgs[0].id;
    const membership = await membershipRepo.findByUserAndOrg(
      session.user.id,
      orgId
    );
    role = membership?.role;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar user={session.user} orgId={orgId} role={role} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}