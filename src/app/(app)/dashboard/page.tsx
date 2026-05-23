/**
 * Dashboard Page (Boundary Layer)
 * 
 * Main landing page after login. Shows organization overview
 * including departments, members, and task counts.
 * BCE compliant: all data fetched through services.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OrganizationService } from "@/services/organization.service";
import { DepartmentService } from "@/services/department.service";
import { MembershipRepository } from "@/repositories/membership.repository";
import { TaskService } from "@/services/task.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const orgService = new OrganizationService();
const deptService = new DepartmentService();
const membershipRepo = new MembershipRepository();
const taskService = new TaskService();

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgs = await orgService.getUserOrganizations(session.user.id);

  if (orgs.length === 0) {
    redirect("/onboarding");
  }

  const org = orgs[0];
  const departments = await deptService.getByOrganization(org.id);
  const members = await membershipRepo.findByOrgId(org.id);
  const activeMembers = members.filter((m) => m.status === "active");
  const taskCounts = await taskService.getTaskCounts(org.id);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">{org.name}</h2>
      <p className="mb-6 text-muted-foreground">
        Role: {org.memberships[0]?.role}
      </p>

      <div className="mb-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader>
            <CardDescription>Departments</CardDescription>
            <CardTitle className="text-3xl">{departments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active members</CardDescription>
            <CardTitle className="text-3xl">{activeMembers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total tasks</CardDescription>
            <CardTitle className="text-3xl">{taskCounts.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Open</CardDescription>
            <CardTitle className="text-3xl">{taskCounts.open}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>In progress</CardDescription>
            <CardTitle className="text-3xl">{taskCounts.in_progress}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl">{taskCounts.completed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {departments.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Departments</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <Card key={dept.id}>
                <CardHeader>
                  <CardTitle className="text-base">{dept.name}</CardTitle>
                  {dept.description && (
                    <CardDescription>{dept.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {dept._count.departmentMemberships} member
                    {dept._count.departmentMemberships !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}