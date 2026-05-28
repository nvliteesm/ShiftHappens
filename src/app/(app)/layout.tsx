/**
 * App Layout (Boundary Layer)
 * 
 * Shared layout for all authenticated pages.
 * Validates session user still exists in database.
 * Fetches org and role for the role-aware sidebar.
 * Redirects unauthenticated or invalid users to /login.
 */
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OrganizationService } from "@/services/organization.service";
import { MembershipRepository } from "@/repositories/membership.repository";
import { UserRepository } from "@/repositories/user.repository";

const orgService = new OrganizationService();
const membershipRepo = new MembershipRepository();
const userRepo = new UserRepository();

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Platform admins have their own layout — redirect them
  const isPlatformAdmin = (session.user as unknown as Record<string, unknown>).isPlatformAdmin;
  if (isPlatformAdmin) {
    redirect("/platform-admin");
  }

  // Validate the session user still exists in the database
  const dbUser = await userRepo.findById(session.user.id);
  if (!dbUser) {
    await signOut({ redirect: false });
    redirect("/login");
  }

  // Get user's first organization and role for sidebar
  const orgs = await orgService.getUserOrganizations(session.user.id);
  let orgId: string | undefined;
  let role: string | undefined;

  if (orgs.length > 0) {
    orgId = orgs[0].id;

    // Redirect to suspended page if org is not active
    if (orgs[0].status !== "active") {
      redirect("/org-suspended");
    }

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