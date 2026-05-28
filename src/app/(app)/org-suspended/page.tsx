/**
 * Organization Suspended Page (Boundary Layer)
 * 
 * Shown when a user's organization has been suspended by a platform admin.
 * Provides a clear message and sign-out option.
 */
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrgSuspendedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center text-red-600">
            Organization Suspended
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your organization has been suspended by a platform administrator.
            Please contact support for more information.
          </p>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}