/**
 * Platform Organizations Page (Boundary Layer)
 * 
 * Lists all organization tenants with management controls.
 * Platform admin can view details and suspend/activate orgs.
 */
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  status: string;
  createdAt: string;
  _count: {
    memberships: number;
    tasks: number;
  };
}

export default function PlatformOrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function fetchOrgs() {
    try {
      const res = await fetch("/api/platform/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      const data = await res.json();
      setOrgs(data.organizations);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrgs();
  }, []);

  async function handleToggleStatus(orgId: string) {
    setTogglingId(orgId);
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to update organization");
      await fetchOrgs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading organizations...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      {orgs.length === 0 ? (
        <p className="text-muted-foreground">No organizations found.</p>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <Card key={org.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{org.name}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        org.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {org.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {org.slug} · {org.industry || "No industry"} · {org._count.memberships} members · {org._count.tasks} tasks
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(org.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant={org.status === "active" ? "destructive" : "default"}
                  size="sm"
                  disabled={togglingId === org.id}
                  onClick={() => handleToggleStatus(org.id)}
                >
                  {togglingId === org.id
                    ? "Updating..."
                    : org.status === "active"
                    ? "Suspend"
                    : "Activate"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}