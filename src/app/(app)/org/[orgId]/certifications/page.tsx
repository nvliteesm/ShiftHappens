/**
 * Certifications Management Page (Boundary Layer)
 * 
 * Admin/Manager view: lists all certifications across the org
 * with ability to verify or reject pending submissions.
 * Staff can submit their own certifications from My Tasks page.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Certification {
  id: string;
  name: string;
  issuedDate: string;
  expiryDate: string | null;
  documentUrl: string | null;
  status: string;
  verifiedBy: { name: string | null } | null;
  verifiedAt: string | null;
  membership: {
    user: { id: string; name: string | null; email: string };
  };
}

export default function CertificationsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCertifications();
  }, [orgId, filterStatus]);

  async function fetchCertifications() {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(
        `/api/organizations/${orgId}/certifications?${params}`
      );
      const data = await res.json();
      setCertifications(data);
    } catch {
      setError("Failed to load certifications");
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(certId: string, status: string) {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/certifications/${certId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Failed to update certification");
        return;
      }

      setSuccess(`Certification ${status}`);
      fetchCertifications();
    } catch {
      setError("Something went wrong");
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-700";
      case "verified": return "bg-green-100 text-green-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-600";
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Certifications</h2>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {certifications.length === 0 ? (
        <p className="text-muted-foreground">No certifications found.</p>
      ) : (
        <div className="space-y-4">
          {certifications.map((cert) => (
            <Card key={cert.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {cert.name}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(cert.status)}`}>
                        {cert.status}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {cert.membership.user.name || cert.membership.user.email}
                      {" · Issued: "}
                      {new Date(cert.issuedDate).toLocaleDateString()}
                      {cert.expiryDate && (
                        <>
                          {" · Expires: "}
                          {new Date(cert.expiryDate).toLocaleDateString()}
                        </>
                      )}
                    </CardDescription>
                  </div>
                  {cert.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onVerify(cert.id, "verified")}
                      >
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onVerify(cert.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              {cert.verifiedBy && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {cert.status === "verified" ? "Verified" : "Rejected"} by{" "}
                    {cert.verifiedBy.name}
                    {cert.verifiedAt && ` on ${new Date(cert.verifiedAt).toLocaleDateString()}`}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}