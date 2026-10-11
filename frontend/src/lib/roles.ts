import type { User } from "./types";

export function canManageRecords(user?: User | null) {
  return user?.role === "admin" || user?.role === "receptionist";
}

export function isAdmin(user?: User | null) {
  return user?.role === "admin";
}
