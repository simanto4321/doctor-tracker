import { Router } from "express";
import { z } from "zod";
import { Invoice } from "../models/Invoice.js";
import { Visit } from "../models/Visit.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

async function nextInvoiceNumber() {
  const count = await Invoice.countDocuments();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${stamp}-${String(count + 1).padStart(4, "0")}`;
}

invoicesRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const patient = typeof req.query.patient === "string" ? req.query.patient : "";
  const filter: Record<string, unknown> = { deletedAt: null };
  if (status) filter.status = status;
  if (patient) filter.patient = patient;

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .populate("patient", "name")
      .populate("doctor", "name specialization")
      .populate("visit", "visitedAt diagnosis")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((inv) => ({ ...inv, id: inv._id })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

invoicesRouter.post("/", requireRole("admin", "receptionist"), async (req, res) => {
  const schema = z.object({
    visit: z.string().min(1),
    lineItems: z
      .array(
        z.object({
          description: z.string().min(1).max(160),
          quantity: z.number().int().min(1).default(1),
          unitPrice: z.number().min(0),
        })
      )
      .min(1),
    notes: z.string().max(500).optional(),
    status: z.enum(["draft", "issued"]).optional(),
  });

  const body = {
    ...req.body,
    lineItems: Array.isArray(req.body?.lineItems)
      ? req.body.lineItems.map((item: Record<string, unknown>) => ({
          ...item,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice),
        }))
      : [],
  };
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const visit = await Visit.findOne({ _id: parsed.data.visit, deletedAt: null });
  if (!visit) return res.status(400).json({ message: "Visit not found" });

  const existing = await Invoice.findOne({ visit: visit._id, deletedAt: null });
  if (existing) {
    return res.status(409).json({ message: "Invoice already exists for this visit", id: existing._id });
  }

  const amount = parsed.data.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const status = parsed.data.status || "issued";
  const invoice = await Invoice.create({
    visit: visit._id,
    patient: visit.patient,
    doctor: visit.doctor,
    number: await nextInvoiceNumber(),
    lineItems: parsed.data.lineItems,
    amount: Math.round(amount * 100) / 100,
    status,
    issuedAt: status === "issued" ? new Date() : null,
    notes: parsed.data.notes || "",
  });

  await writeAudit(req.auth, "create", "invoice", invoice._id.toString(), {
    visit: String(visit._id),
    amount: invoice.amount,
  });

  const populated = await Invoice.findById(invoice._id)
    .populate("patient", "name")
    .populate("doctor", "name specialization")
    .populate("visit", "visitedAt diagnosis")
    .lean();

  return res.status(201).json({ ...populated, id: invoice._id });
});

invoicesRouter.patch("/:id/status", requireRole("admin", "receptionist"), async (req, res) => {
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!["draft", "issued", "paid", "void"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const invoice = await Invoice.findOne({ _id: req.params.id, deletedAt: null });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  invoice.status = status as typeof invoice.status;
  if (status === "issued" && !invoice.issuedAt) invoice.issuedAt = new Date();
  if (status === "paid") invoice.paidAt = new Date();
  if (status === "void") invoice.paidAt = null;
  await invoice.save();
  await writeAudit(req.auth, "update", "invoice", invoice._id.toString(), { status });
  return res.json({ id: invoice._id, status: invoice.status, paidAt: invoice.paidAt });
});
