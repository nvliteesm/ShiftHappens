/**
 * Company Settings Page (Boundary Layer)
 * 
 * Company Admin can configure organization-wide settings:
 * - Task allocation mode (manual, suggested, auto)
 * - Task acceptance mode (auto-accept or require confirmation)
 * - Break rules (hours worked before break, break duration)
 * - Notification preferences
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface Settings {
  allocationMode: string;
  taskAcceptanceMode: string;
  breakRuleHoursWorked: number;
  breakRuleBreakHours: number;
  notificationPreferences: string | null;
}

export default function SettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [allocationMode, setAllocationMode] = useState("manual");
  const [taskAcceptanceMode, setTaskAcceptanceMode] = useState("auto_accept");
  const [breakHoursWorked, setBreakHoursWorked] = useState(6);
  const [breakHours, setBreakHours] = useState(1);
  const [notifPrefs, setNotifPrefs] = useState({
    emailNotifications: true,
    taskAssignment: true,
    taskRejection: true,
    hourLimitWarning: true,
    certificationExpiry: true,
  });
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [orgId]);

  async function fetchSettings() {
    try {
      const res = await fetch(`/api/organizations/${orgId}/settings`);
      const data = await res.json();
      setSettings(data);
      setAllocationMode(data.allocationMode);
      setTaskAcceptanceMode(data.taskAcceptanceMode);
      setBreakHoursWorked(data.breakRuleHoursWorked);
      setBreakHours(data.breakRuleBreakHours);
      if (data.notificationPreferences) {
        setNotifPrefs({
          ...notifPrefs,
          ...JSON.parse(data.notificationPreferences),
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load settings" });
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/organizations/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocationMode,
          taskAcceptanceMode,
          breakRuleHoursWorked: breakHoursWorked,
          breakRuleBreakHours: breakHours,
          notificationPreferences: notifPrefs,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          text: result.error || "Failed to update settings",
        });
        return;
      }

      setSettings(result);
      setMessage({ type: "success", text: "Settings updated successfully" });
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setLoading(false);
    }
  }

  if (!settings) return <p>Loading...</p>;

  return (
    <div className="max-w-2xl">
      <h2 className="mb-6 text-2xl font-bold">Company Settings</h2>

      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Task Allocation</CardTitle>
            <CardDescription>
              Configure how tasks are allocated to staff
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && (
              <div
                className={`rounded-md p-3 text-sm ${
                  message.type === "success"
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="allocationMode">Allocation Mode</Label>
              <select
                id="allocationMode"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={allocationMode}
                onChange={(e) => setAllocationMode(e.target.value)}
              >
                <option value="manual">
                  Manual — Admin assigns staff directly
                </option>
                <option value="suggested">
                  Suggested — AI recommends, admin confirms
                </option>
                <option value="auto">
                  Auto — AI assigns automatically
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskAcceptanceMode">Task Acceptance</Label>
              <select
                id="taskAcceptanceMode"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={taskAcceptanceMode}
                onChange={(e) => setTaskAcceptanceMode(e.target.value)}
              >
                <option value="auto_accept">
                  Auto Accept — Staff auto-assigned
                </option>
                <option value="require_acceptance">
                  Require Acceptance — Staff must confirm
                </option>
              </select>
            </div>

            <Separator />

            <p className="text-base font-medium">Break Rules</p>
            <p className="text-sm text-muted-foreground">
              Mandatory break requirements after consecutive hours worked
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breakRuleHoursWorked">
                  Hours before break required
                </Label>
                <Input
                  id="breakRuleHoursWorked"
                  type="number"
                  min={1}
                  max={24}
                  value={breakHoursWorked}
                  onChange={(e) => setBreakHoursWorked(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakRuleBreakHours">
                  Minimum break duration (hours)
                </Label>
                <Input
                  id="breakRuleBreakHours"
                  type="number"
                  min={1}
                  max={24}
                  value={breakHours}
                  onChange={(e) => setBreakHours(Number(e.target.value))}
                />
              </div>
            </div>

            <Separator />

            <p className="text-base font-medium">Notifications</p>
            <p className="text-sm text-muted-foreground">
              Configure which notifications are enabled
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifPrefs.emailNotifications}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, emailNotifications: e.target.checked })
                  }
                />
                Email notifications
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifPrefs.taskAssignment}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, taskAssignment: e.target.checked })
                  }
                />
                Task assignment notifications
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifPrefs.taskRejection}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, taskRejection: e.target.checked })
                  }
                />
                Task rejection notifications
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifPrefs.hourLimitWarning}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, hourLimitWarning: e.target.checked })
                  }
                />
                Hour limit warning notifications
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifPrefs.certificationExpiry}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, certificationExpiry: e.target.checked })
                  }
                />
                Certification expiry notifications
              </label>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}