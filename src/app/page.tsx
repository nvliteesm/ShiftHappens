/**
 * Root Page (Boundary Layer)
 *
 * Entry point of the application.
 * - Authenticated users → redirect to /dashboard
 * - Unauthenticated users → show the public landing page
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LandingPage from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
