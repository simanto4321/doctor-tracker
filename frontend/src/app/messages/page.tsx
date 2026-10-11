"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Peer = { id: string; name: string; email: string; role: string };
type Msg = {
  id: string;
  subject?: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  from?: { id?: string; name: string; role?: string };
  to?: { id?: string; name: string; role?: string };
  patient?: { name: string } | null;
};

export default function MessagesPage() {
  const [box, setBox] = useState<"inbox" | "sent">("inbox");
  const [items, setItems] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ to: "", subject: "", body: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Msg[]; unreadCount: number }>(
        `/messages${toQuery({ box, limit: 40 })}`
      );
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [box]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiRequest<{ items: Peer[] }>("/messages/peers")
      .then((data) => {
        setPeers(data.items);
        setForm((f) => ({ ...f, to: data.items[0]?.id || "" }));
      })
      .catch(() => undefined);
  }, []);

  async function onSend(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/messages", { method: "POST", body: form });
      toast.success("Message sent");
      setOpen(false);
      setForm((f) => ({ ...f, subject: "", body: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to send");
    }
  }

  async function markRead(id: string) {
    try {
      await apiRequest(`/messages/${id}/read`, { method: "POST" });
      await load();
    } catch {
      /* ignore */
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="messages"
        title="Messages"
        subtitle="Internal staff messaging for handoffs and clinic coordination."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Compose
          </Button>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Select value={box} onChange={(e) => setBox(e.target.value as "inbox" | "sent")}>
            <option value="inbox">Inbox</option>
            <option value="sent">Sent</option>
          </Select>
          {box === "inbox" ? <Badge tone="info">{unread} unread</Badge> : null}
        </div>

        {loading ? (
          <PageSkeleton />
        ) : items.length === 0 ? (
          <div className="panel p-8 text-sm text-[var(--muted)]">No messages in this folder.</div>
        ) : (
          <div className="space-y-3">
            {items.map((msg) => {
              const peer = box === "inbox" ? msg.from : msg.to;
              const unreadRow = box === "inbox" && !msg.readAt;
              return (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => unreadRow && markRead(msg.id)}
                  className="panel w-full p-4 text-left transition hover:border-[var(--accent)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {msg.subject || "No subject"}{" "}
                      {unreadRow ? <Badge tone="warning">Unread</Badge> : null}
                    </p>
                    <span className="text-xs text-[var(--muted)]">{formatDate(msg.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {box === "inbox" ? "From" : "To"}: {peer?.name || "Staff"} · {peer?.role || ""}
                    {msg.patient ? ` · Patient: ${msg.patient.name}` : ""}
                  </p>
                  <p className="mt-2 text-sm">{msg.body}</p>
                </button>
              );
            })}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="New message">
          <form className="space-y-3" onSubmit={onSend}>
            <Select
              required
              value={form.to}
              onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
            >
              {peers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </Select>
            <Input
              placeholder="Subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
            <Textarea
              required
              placeholder="Message"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            <Button type="submit" className="w-full">
              Send
            </Button>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
