/**
 * App Sidebar Component (Boundary Layer)
 *
 * Role-aware sidebar navigation with dark mode toggle.
 * Shows different links based on the user's role in
 * their current organization.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
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
  const { resolvedTheme, setTheme } = useTheme();

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
        href: `/org/${orgId}/work-rules`,
        label: "Work Rules",
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
    <aside className="flex w-64 flex-col border-r bg-muted/40 p-4 sticky top-0 h-screen overflow-y-auto">
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
                ? "bg-accent font-medium"
                : "hover:bg-accent/50"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="border-t pt-4 space-y-2">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}
