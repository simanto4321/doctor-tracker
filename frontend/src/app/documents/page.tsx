"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { EntityHover } from "@/components/entity-hover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Doc = {
  id: string;
  title: string;
  category: string;
  fileName: string;
  sizeBytes?: number;
  createdAt: string;
  patient?: { name: string } | null;
};

export default function DocumentsPage() {
  const [items, setItems] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "report",
    patient: "",
    fileName: "note.txt",
    content: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Doc[] }>(
        `/documents${toQuery({ category, limit: 40 })}`
      );
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiRequest<{ items: Array<{ id: string; name: string }> }>("/patients?limit=50")
      .then((data) => {
        setPatients(data.items);
        setForm((f) => ({ ...f, patient: data.items[0]?.id || "" }));
      })
      .catch(() => undefined);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/documents", {
        method: "POST",
        body: {
          ...form,
          patient: form.patient || null,
        },
      });
      toast.success("Document uploaded");
      setOpen(false);
      setForm((f) => ({ ...f, title: "", content: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function openPreview(id: string) {
    try {
      const doc = await apiRequest<{ title: string; content: string }>(`/documents/${id}`);
      setPreview({ title: doc.title, content: doc.content });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to open document");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="documents"
        title="Documents"
        subtitle="Store reports, ID scans, and consent forms with the patient chart."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Upload
          </Button>
        }
      >
        <div className="panel mb-5 max-w-xs p-4">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="report">Report</option>
            <option value="id">ID</option>
            <option value="consent">Consent</option>
            <option value="other">Other</option>
          </Select>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((doc) => (
              <button
                key={doc.id}
                className="panel p-4 text-left hover:ring-2 hover:ring-[var(--accent)]"
                onClick={() => openPreview(doc.id)}
              >
                <EntityHover
                  title={doc.title}
                  badge={doc.category}
                  lines={[
                    { label: "File", value: doc.fileName },
                    { label: "Patient", value: doc.patient?.name || "Unlinked" },
                    { label: "Size", value: `${doc.sizeBytes || 0} bytes` },
                    { label: "Uploaded", value: formatDate(doc.createdAt) },
                  ]}
                >
                  <div>
                    <p className="font-semibold underline decoration-dotted">{doc.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{doc.fileName}</p>
                    <div className="mt-2 flex gap-2">
                      <Badge tone="info">{doc.category}</Badge>
                      <Badge tone="neutral">{doc.patient?.name || "No patient"}</Badge>
                    </div>
                  </div>
                </EntityHover>
              </button>
            ))}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Upload document">
          <form className="grid gap-3" onSubmit={onCreate}>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Title</span>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Category</span>
                <Select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="report">Report</option>
                  <option value="id">ID</option>
                  <option value="consent">Consent</option>
                  <option value="other">Other</option>
                </Select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Patient</span>
                <Select
                  value={form.patient}
                  onChange={(e) => setForm((f) => ({ ...f, patient: e.target.value }))}
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">File name</span>
              <Input
                required
                value={form.fileName}
                onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Content</span>
              <Textarea
                required
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Paste report text or consent notes (demo storage)."
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button>Upload</Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={Boolean(preview)}
          onClose={() => setPreview(null)}
          title={preview?.title || "Document"}
          wide
        >
          <pre className="whitespace-pre-wrap rounded-xl bg-[var(--surface-soft)] p-4 text-sm">
            {preview?.content}
          </pre>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
