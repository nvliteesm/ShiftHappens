/**
 * Platform Admin Dashboard (Boundary Layer)
 * 
 * Overview page showing platform-wide statistics.
 * Only accessible to platform admins.
 */
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
  totalTasks: number;
}

export default function PlatformAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/platform/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading platform stats...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!stats) return null;

  const cards = [
    { title: "Total Organizations", value: stats.totalOrganizations },
    { title: "Active Organizations", value: stats.activeOrganizations },
    { title: "Total Users", value: stats.totalUsers },
    { title: "Total Tasks", value: stats.totalTasks },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Platform Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}