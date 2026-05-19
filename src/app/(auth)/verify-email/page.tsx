"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const justRegistered = searchParams.get("registered");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "pending">(
    token ? "loading" : "pending"
  );

  useEffect(() => {
    if (!token) return;

    fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        setStatus(res.ok ? "success" : "error");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Verification</CardTitle>
        <CardDescription>
          {status === "pending" && justRegistered
            ? "We sent a verification link to your email"
            : "Verifying your email address"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "pending" && (
          <p className="text-sm text-muted-foreground">
            Please check your inbox and click the verification link to activate
            your account.
          </p>
        )}
        {status === "loading" && (
          <p className="text-sm text-muted-foreground">Verifying...</p>
        )}
        {status === "success" && (
          <>
            <p className="text-sm text-green-600">
              Your email has been verified successfully.
            </p>
            <Link href="/login" className="w-full">
                <Button className="w-full">Sign in to your account</Button>
            </Link>
          </>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600">
            Invalid or expired verification link. Please register again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <VerifyEmailContent />
    </Suspense>
  );
}