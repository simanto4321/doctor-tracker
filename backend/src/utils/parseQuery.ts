export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 8));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function parseDateRange(query: Record<string, unknown>) {
  const filter: { createdAt?: { $gte?: Date; $lte?: Date } } = {};

  if (typeof query.from === "string" && query.from.trim()) {
    const from = new Date(query.from);
    if (!Number.isNaN(from.getTime())) {
      filter.createdAt = { ...(filter.createdAt || {}), $gte: from };
    }
  }

  if (typeof query.to === "string" && query.to.trim()) {
    const to = new Date(query.to);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      filter.createdAt = { ...(filter.createdAt || {}), $lte: to };
    }
  }

  return filter;
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
