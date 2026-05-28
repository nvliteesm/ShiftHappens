/**
 * Platform Admin Sidebar Component (Boundary Layer)
 * 
 * Dedicated sidebar for platform administration.
 * Shows platform-level navigation only — no org-specific links.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface PlatformSidebarProps {
  user: {
    name: string | null;
    email: string;
  };
}

const links = [
  { href: "/platform-admin", label: "Dashboard" },
  { href: "/platform-admin/organizations", label: "Organizations" },
];

export function PlatformSidebar({ user }: PlatformSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-gray-900 text-white p-4 sticky top-0 h-screen overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-lg font-bold">Platform Admin</h1>
        <p className="text-xs text-gray-400">Smart Task Allocation</p>
      </div>
      <nav className="flex-1 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded-md px-3 py-2 text-sm ${
              pathname === link.href
                ? "bg-gray-700 font-medium"
                : "hover:bg-gray-800 text-gray-300"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-700 pt-4">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-gray-400">{user.email}</p>
        <Link
          href="/dashboard"
          className="block text-xs text-gray-400 hover:text-white mt-1"
        >
          ← Back to App
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full border-gray-600 text-gray-300 hover:bg-gray-800"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}