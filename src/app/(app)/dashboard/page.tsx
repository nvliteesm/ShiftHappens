/**
 * Dashboard Page (Boundary Layer)
 * 
 * Main landing page after login. Displays the user's organizations.
 * If the user has no organizations, redirects to /onboarding
 * to create their first one.
 * 
 * This page will be enhanced in later phases with:
 * - Department overview (Phase 2)
 * - Task activity and status (Phase 4)
 * - Eligibility alerts (Phase 5)
 * - Role-specific metrics and charts (Phase 6)
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OrganizationService } from "@/services/organization.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgService = new OrganizationService();
  const orgs = await orgService.getUserOrganizations(session.user.id);

  // New users with no organization are directed to create one
  if (orgs.length === 0) {
    redirect("/onboarding");
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {orgs.map((org) => (
          <Card key={org.id}>
            <CardHeader>
              <CardTitle>{org.name}</CardTitle>
              <CardDescription>{org.slug}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Role: {org.memberships[0]?.role}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}