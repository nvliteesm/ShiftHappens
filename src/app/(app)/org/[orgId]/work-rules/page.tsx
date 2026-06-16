/**
 * Work Rules Page (Boundary Layer)
 *
 * Company Admin page for managing custom work rules.
 * Supports three rule types:
 * - break_interval: mandatory break after X hours worked
 * - max_hours_daily: cap daily hours for a role or all staff
 * - max_hours_weekly: cap weekly hours for a role or all staff
 *
 * Each rule can optionally target a specific custom role.
 * Rules can be toggled active/inactive without deleting.
 */
"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ============================================================
// Types
// ============================================================

interface WorkRule {
  id: string;
  name: string;
  type: string;
  roleId: string | null;
  hoursThreshold: number | null;
  breakHours: number | null;
  maxHours: number | null;
  isActive: boolean;
  role: { id: string; name: string; displayLabel: string } | null;
}

interface OrgRole {
  id: string;
  name: string;
  displayLabel: string;
}

const RULE_TYPES = [
  { value: "break_interval", label: "Break interval", description: "Require break after X hours worked" },
  { value: "max_hours_daily", label: "Max hours (daily)", description: "Cap daily working hours" },
  { value: "max_hours_weekly", label: "Max hours (weekly)", description: "Cap weekly working hours" },
];

const TYPE_LABELS: Record<string, string> = {
  break_interval: "Break interval",
  max_hours_daily: "Daily limit",
  max_hours_weekly: "Weekly limit",
};

const TYPE_COLORS: Record<string, string> = {
  break_interval: "bg-blue-100 text-blue-700",
  max_hours_daily: "bg-amber-100 text-amber-700",
  max_hours_weekly: "bg-purple-100 text-purple-700",
};

// ============================================================
// Main component
// ============================================================

export default function WorkRulesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const [orgId, setOrgId] = useState<string>("");
  const [rules, setRules] = useState<WorkRule[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkRule | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("break_interval");
  const [formRoleId, setFormRoleId] = useState("");
  const [formHoursThreshold, setFormHoursThreshold] = useState("");
  const [formBreakHours, setFormBreakHours] = useState("");
  const [formMaxHours, setFormMaxHours] = useState("");

  useEffect(() => {
    params.then(({ orgId: id }) => {
      setOrgId(id);
    });
  }, [params]);

  useEffect(() => {
    if (orgId) {
      fetchRules();
      fetchRoles();
    }
  }, [orgId]);

  async function fetchRules() {
    try {
      setLoading(true);
      const res = await fetch(`/api/organizations/${orgId}/work-rules`);
      if (!res.ok) throw new Error("Failed to load work rules");
      setRules(await res.json());
      setError(null);
    } catch {
      setError("Failed to load work rules");
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      const res = await fetch(`/api/organizations/${orgId}/roles`);
      if (res.ok) {
        const data = await res.json();
        setRoles(Array.isArray(data) ? data : []);
      }
    } catch {
      // Roles are optional for the form — fail silently
    }
  }

  function resetForm() {
    setFormName("");
    setFormType("break_interval");
    setFormRoleId("");
    setFormHoursThreshold("");
    setFormBreakHours("");
    setFormMaxHours("");
    setFormError(null);
    setEditingRule(null);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(rule: WorkRule) {
    setFormName(rule.name);
    setFormType(rule.type);
    setFormRoleId(rule.roleId || "");
    setFormHoursThreshold(rule.hoursThreshold?.toString() || "");
    setFormBreakHours(rule.breakHours?.toString() || "");
    setFormMaxHours(rule.maxHours?.toString() || "");
    setFormError(null);
    setEditingRule(rule);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  async function handleSubmit() {
    setFormError(null);

    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }

    const body: Record<string, unknown> = {
      name: formName.trim(),
      type: formType,
      roleId: formRoleId || null,
    };

    if (formType === "break_interval") {
      if (!formHoursThreshold || !formBreakHours) {
        setFormError("Hours threshold and break hours are required");
        return;
      }
      body.hoursThreshold = parseFloat(formHoursThreshold);
      body.breakHours = parseFloat(formBreakHours);
    } else {
      if (!formMaxHours) {
        setFormError("Max hours is required");
        return;
      }
      body.maxHours = parseFloat(formMaxHours);
    }

    try {
      setSaving(true);
      const url = editingRule
        ? `/api/organizations/${orgId}/work-rules/${editingRule.id}`
        : `/api/organizations/${orgId}/work-rules`;

      const res = await fetch(url, {
        method: editingRule ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Failed to save rule");
        return;
      }

      closeForm();
      fetchRules();
    } catch {
      setFormError("Failed to save rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: WorkRule) {
    try {
      await fetch(`/api/organizations/${orgId}/work-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      fetchRules();
    } catch {
      // Silently fail — user can retry
    }
  }

  async function handleDelete(rule: WorkRule) {
    if (!confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;

    try {
      await fetch(`/api/organizations/${orgId}/work-rules/${rule.id}`, {
        method: "DELETE",
      });
      fetchRules();
    } catch {
      // Silently fail
    }
  }

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">Work Rules</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Work Rules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure break intervals and hour limits for your team
          </p>
        </div>
        {!showForm && (
          <Button onClick={openCreateForm}>Add rule</Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
          <button onClick={fetchRules} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              {editingRule ? "Edit rule" : "New work rule"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Rule name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Standard break, Chef daily limit"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Rule type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} — {t.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type-specific fields */}
              {formType === "break_interval" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      After every (hours)
                    </label>
                    <input
                      type="number"
                      value={formHoursThreshold}
                      onChange={(e) => setFormHoursThreshold(e.target.value)}
                      placeholder="e.g. 6"
                      min="1"
                      step="0.5"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Require break (hours)
                    </label>
                    <input
                      type="number"
                      value={formBreakHours}
                      onChange={(e) => setFormBreakHours(e.target.value)}
                      placeholder="e.g. 1"
                      min="0.5"
                      step="0.5"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Maximum hours
                  </label>
                  <input
                    type="number"
                    value={formMaxHours}
                    onChange={(e) => setFormMaxHours(e.target.value)}
                    placeholder={
                      formType === "max_hours_daily"
                        ? "e.g. 10"
                        : "e.g. 48"
                    }
                    min="1"
                    step="0.5"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              )}

              {/* Role (optional) */}
              {roles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Applies to (optional)
                  </label>
                  <select
                    value={formRoleId}
                    onChange={(e) => setFormRoleId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                  >
                    <option value="">All staff</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.displayLabel}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Error */}
              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editingRule
                    ? "Update rule"
                    : "Create rule"}
                </Button>
                <Button variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      {rules.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-2">
              No work rules configured yet
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Work rules enforce break intervals and hour limits during task
              assignment. Staff who would violate a rule are automatically
              marked as ineligible.
            </p>
            <Button onClick={openCreateForm}>Create your first rule</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                rule.isActive ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                    TYPE_COLORS[rule.type] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {TYPE_LABELS[rule.type] || rule.type}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.type === "break_interval"
                      ? `Every ${rule.hoursThreshold}h → ${rule.breakHours}h break`
                      : `Max ${rule.maxHours}h per ${
                          rule.type === "max_hours_daily" ? "day" : "week"
                        }`}
                    {rule.role
                      ? ` · ${rule.role.displayLabel} only`
                      : " · All staff"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggle(rule)}
                >
                  {rule.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditForm(rule)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(rule)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
