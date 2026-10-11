"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";

type AuditItem = {
  id: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId?: string;
  createdAt: string;
};

export default function AuditPage() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await apiRequest<{ items: AuditItem[] }>("/audit?limit=40");
        setItems(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit log");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.role]);

  return (
    <AuthGuard>
      <AppShell title="Audit log" subtitle="Admin trail of create, update, delete, and login events.">
        {user?.role !== "admin" ? (
          <div className="panel p-6 text-[var(--muted)]">Admin access required.</div>
        ) : loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-[var(--danger)]">
            {error}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.actorEmail}</td>
                    <td>
                      <Badge tone="accent">{item.action}</Badge>
                    </td>
                    <td className="text-sm text-[var(--muted)]">
                      {item.entity}
                      {item.entityId ? ` · ${item.entityId.slice(-6)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
