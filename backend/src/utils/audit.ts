import { AuditLog } from "../models/AuditLog.js";
import type { AuthPayload } from "../middleware/auth.js";

export async function writeAudit(
  auth: AuthPayload | undefined,
  action: string,
  entity: string,
  entityId = "",
  meta: Record<string, unknown> = {}
) {
  if (!auth) return;
  await AuditLog.create({
    actorId: auth.userId,
    actorEmail: auth.email,
    action,
    entity,
    entityId,
    meta,
  });
}
