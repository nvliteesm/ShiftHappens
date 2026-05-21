/**
 * Members Management Page (Boundary Layer)
 * 
 * Company Admin can view all org members, invite new users,
 * update roles, assign departments, and activate/deactivate members.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Member {
  id: string;
  role: string;
  status: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  departmentMemberships: {
    department: { id: string; name: string };
  }[];
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  acceptedAt: string | null;
  expires: string;
  invitedBy: { name: string | null; email: string };
}

export default function MembersPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [orgId]);

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`);
      const data = await res.json();
      setMembers(data);
    } catch {
      setError("Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvitations() {
    try {
      const res = await fetch(`/api/organizations/${orgId}/invitations`);
      const data = await res.json();
      setInvitations(data);
    } catch {
      // Silently fail — invitations are secondary
    }
  }

  async function onInviteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);

    try {
      const res = await fetch(`/api/organizations/${orgId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          role: formData.get("role"),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to send invitation");
        return;
      }

      setSuccess(`Invitation sent to ${formData.get("email")}`);
      setShowInvite(false);
      (event.target as HTMLFormElement).reset();
      fetchInvitations();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onToggleStatus(userId: string) {
    setError(null);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/members/${userId}/toggle-status`,
        { method: "POST" }
      );

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Failed to update status");
        return;
      }

      fetchMembers();
    } catch {
      setError("Something went wrong");
    }
  }

  async function onUpdateRole(userId: string, newRole: string) {
    setError(null);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Failed to update role");
        return;
      }

      fetchMembers();
    } catch {
      setError("Something went wrong");
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Members</h2>
        <Button onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? "Cancel" : "Invite User"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      {/* Invite user form */}
      {showInvite && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Invite User</CardTitle>
            <CardDescription>
              Send an invitation email to add a new member
            </CardDescription>
          </CardHeader>
          <form onSubmit={onInviteUser}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  name="role"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  defaultValue="staff"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <Button type="submit">Send Invitation</Button>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Members list */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Active Members ({members.filter((m) => m.status === "active").length})
        </h3>
        {members.map((member) => (
          <Card key={member.id}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="font-medium">
                  {member.user.name || "Unnamed"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {member.user.email}
                </p>
                <div className="mt-1 flex gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      member.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {member.status}
                  </span>
                  <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {member.role}
                  </span>
                </div>
                {member.departmentMemberships.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Departments:{" "}
                    {member.departmentMemberships
                      .map((dm) => dm.department.name)
                      .join(", ")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  className="rounded-md border px-2 py-1 text-sm"
                  value={member.role}
                  onChange={(e) =>
                    onUpdateRole(member.user.id, e.target.value)
                  }
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="company_admin">Admin</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleStatus(member.user.id)}
                >
                  {member.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending invitations */}
      {invitations.filter((i) => !i.acceptedAt).length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold">Pending Invitations</h3>
          {invitations
            .filter((i) => !i.acceptedAt)
            .map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: {invitation.role} · Invited by{" "}
                      {invitation.invitedBy.name || invitation.invitedBy.email}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Expires{" "}
                    {new Date(invitation.expires).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}