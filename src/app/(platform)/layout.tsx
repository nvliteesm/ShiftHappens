/**
 * Platform Admin Layout (Boundary Layer)
 * 
 * Separate layout for platform administration pages.
 * Uses its own sidebar with platform-level navigation.
 * Only accessible to users with isPlatformAdmin flag.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PlatformSidebar } from "@/components/layout/platform-sidebar";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isPlatformAdmin = (session.user as unknown as Record<string, unknown>).isPlatformAdmin;
  if (!isPlatformAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <PlatformSidebar user={session.user} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}