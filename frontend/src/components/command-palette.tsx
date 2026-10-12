"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { apiRequest, toQuery } from "@/lib/api";
import { Input } from "@/components/ui/input";

type Hit = { id: string; label: string; hint: string; href: string };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ doctors: Hit[]; patients: Hit[]; appointments: Hit[] }>({
    doctors: [],
    patients: [],
    appointments: [],
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("doctor-tracker:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("doctor-tracker:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      if (!q.trim()) {
        setResults({ doctors: [], patients: [], appointments: [] });
        return;
      }
      try {
        const data = await apiRequest<typeof results>(`/search${toQuery({ q })}`);
        setResults(data);
      } catch {
        setResults({ doctors: [], patients: [], appointments: [] });
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [q, open]);

  if (!open) return null;

  const groups = [
    { title: "Doctors", items: results.doctors },
    { title: "Patients", items: results.patients },
    { title: "Appointments", items: results.appointments },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-[2px]">
      <div className="animate-rise w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4">
          <Search className="h-4 w-4 text-[var(--muted)]" />
          <Input
            autoFocus
            className="border-0 shadow-none focus:ring-0"
            placeholder="Search doctors, patients, appointments…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)]">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-auto p-2">
          {!q.trim() ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">
              Type to search across the clinic registry
            </p>
          ) : (
            groups.map((group) =>
              group.items.length ? (
                <div key={group.title} className="mb-2">
                  <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {group.title}
                  </p>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-[var(--accent-soft)]"
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                        router.push(item.href);
                      }}
                    >
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span className="text-xs text-[var(--muted)]">{item.hint}</span>
                    </button>
                  ))}
                </div>
              ) : null
            )
          )}
        </div>
      </div>
      <button className="absolute inset-0 -z-10" onClick={() => setOpen(false)} aria-label="Close" />
    </div>
  );
}
