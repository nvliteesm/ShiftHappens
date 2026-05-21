/**
 * Auth Layout (Boundary Layer)
 * 
 * Shared layout for all authentication pages (login, register,
 * verify-email, forgot-password, reset-password).
 * Centers content vertically and horizontally with a max-width container.
 * No sidebar or navigation — clean, focused auth experience.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}