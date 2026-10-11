import { useAuthStore } from "./auth-store";

export async function downloadCsv(path: string, filename: string) {
  const token = useAuthStore.getState().token;
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4821/api";
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error("Export failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
