/**
 * App Sidebar Component (Boundary Layer)
 * 
 * Role-aware sidebar navigation. Shows different links
 * based on the user's role in their current organization.
 * - Company Admin: Dashboard, Departments, Members, Profile
 * - Manager: Dashboard, Departments, Profile
 * - Staff: Dashboard, Profile
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  user: {
    name: string | null;
    email: string;
  };
  orgId?: string;
  role?: string;
}

export function AppSidebar({ user, orgId, role }: AppSidebarProps) {
  const pathname = usePathname();

  // Base links visible to all authenticated users
  const links: { href: string; label: string }[] = [
    { href: "/dashboard", label: "Dashboard" },
  ];

  // Add org-specific links based on role
  if (orgId && role) {
    if (role === "company_admin" || role === "manager") {
      links.push({
        href: `/org/${orgId}/tasks`,
        label: "Tasks",
      });
      links.push({
        href: `/org/${orgId}/departments`,
        label: "Departments",
      });
      links.push({
        href: `/org/${orgId}/certifications`,
        label: "Certifications",
      });
      links.push({
        href: `/org/${orgId}/calendar`,
        label: "Calendar",
      });
    }
    if (role === "company_admin") {
      links.push({
        href: `/org/${orgId}/members`,
        label: "Members",
      });
      links.push({
        href: `/org/${orgId}/roles`,
        label: "Roles",
      });
      links.push({
        href: `/org/${orgId}/settings`,
        label: "Settings",
      });
      links.push({
        href: `/org/${orgId}/audit-log`,
        label: "Audit Log",
      });
    }
    // Staff and managers can manage their own availability
    if (role === "staff" || role === "manager") {
      links.push({
        href: `/org/${orgId}/availability`,
        label: "My Availability",
      });
    }
    if (role === "staff") {
      links.push({
        href: `/org/${orgId}/my-tasks`,
        label: "My Tasks",
      });
    }
  }

  // Profile is always last
  links.push({ href: "/settings/profile", label: "Profile" });

  return (
    <aside className="flex w-64 flex-col border-r bg-gray-50 p-4 sticky top-0 h-screen overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-lg font-bold">Smart Task Allocation</h1>
      </div>
      <nav className="flex-1 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded-md px-3 py-2 text-sm ${
              pathname.startsWith(link.href)
                ? "bg-gray-200 font-medium"
                : "hover:bg-gray-100"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="border-t pt-4">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}