/**
 * App Sidebar Component (Boundary Layer)
 *
 * Role-aware sidebar navigation with dark mode toggle,
 * subscription-based feature gating, and user context display.
 *
 * Displays:
 * - Subscription tier badge (Free/Pro/Enterprise)
 * - Navigation links filtered by role and subscription
 * - User info with system role + employment type (row 1)
 *   and custom role if assigned (row 2)
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getSystemRoleLabel } from "@/lib/role-config";

interface AppSidebarProps {
  user: {
    name: string | null;
    email: string;
  };
  orgId?: string;
  role?: string;
  employmentType?: string;
  customRoleLabel?: string;
}

export function AppSidebar({
  user,
  orgId,
  role,
  employmentType,
  customRoleLabel,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);
  const [tier, setTier] = useState<{ name: string; displayName: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch subscription features for sidebar gating
  useEffect(() => {
    if (orgId) {
      fetch(`/api/organizations/${orgId}/subscription`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.features) setFeatures(data.features);
          if (data?.tier) setTier({ name: data.tier, displayName: data.displayName });
        })
        .catch(() => {});
    }
  }, [orgId]);

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
      // Roles: only show if custom_roles feature is available (Pro+)
      if (features === null || features.custom_roles !== false) {
        links.push({
          href: `/org/${orgId}/roles`,
          label: "Roles",
        });
      }
      links.push({
        href: `/org/${orgId}/settings`,
        label: "Settings",
      });
      links.push({
        href: `/org/${orgId}/work-rules`,
        label: "Work Rules",
      });
      links.push({
        href: `/org/${orgId}/auto-schedule`,
        label: "Auto-Schedule",
      });
      // Audit Log: only show if audit_log feature is available (Enterprise)
      if (features === null || features.audit_log !== false) {
        links.push({
          href: `/org/${orgId}/audit-log`,
          label: "Audit Log",
        });
      }
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
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Smart Task Allocation</h1>
          {tier && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                tier.name === "enterprise"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  : tier.name === "pro"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {tier.displayName}
            </span>
          )}
        </div>
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
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{user.name}</p>
          <NotificationBell orgId={orgId} />
        </div>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        {role && (
          <p className="text-xs text-muted-foreground">
            {getSystemRoleLabel(role, employmentType)}
          </p>
        )}
        {customRoleLabel && (
          <p className="text-xs text-muted-foreground">{customRoleLabel}</p>
        )}
        <div className="flex gap-2">
          {mounted && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </Button>
          )}
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
