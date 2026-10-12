import { appConfig } from "./app-config";
import { useAuthStore } from "./auth-store";

export async function downloadCsv(path: string, filename: string) {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${appConfig.apiUrl}${path}`, {
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
