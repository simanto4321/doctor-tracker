"use client";

import { toast } from "sonner";
import { apiRequest } from "./api";

type SoftDeleteOptions = {
  label: string;
  deletePath: string;
  restorePath: string;
  onDone: () => void | Promise<void>;
  undoLabel?: string;
};

/** Soft-delete with toast undo that calls restore within a few seconds. */
export async function softDeleteWithUndo({
  label,
  deletePath,
  restorePath,
  onDone,
  undoLabel = "Undo",
}: SoftDeleteOptions) {
  await apiRequest(deletePath, { method: "DELETE" });
  await onDone();

  toast(label, {
    duration: 6000,
    action: {
      label: undoLabel,
      onClick: async () => {
        try {
          await apiRequest(restorePath, { method: "POST" });
          await onDone();
          toast.success("Restored");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Restore failed");
        }
      },
    },
  });
}
