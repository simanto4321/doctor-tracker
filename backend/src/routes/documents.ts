import { Router } from "express";
import { z } from "zod";
import { DocumentFile } from "../models/DocumentFile.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

const documentSchema = z.object({
  title: z.string().min(2).max(160),
  category: z.enum(["report", "id", "consent", "other"]).default("report"),
  patient: z.string().optional().nullable(),
  doctor: z.string().optional().nullable(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().optional(),
  content: z.string().min(1).max(400000),
});

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof req.query.patient === "string" && req.query.patient) filter.patient = req.query.patient;
  if (typeof req.query.category === "string" && req.query.category) filter.category = req.query.category;

  const [items, total] = await Promise.all([
    DocumentFile.find(filter)
      .select("-content")
      .populate("patient", "name")
      .populate("doctor", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DocumentFile.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

documentsRouter.get("/:id", async (req, res) => {
  const doc = await DocumentFile.findOne({ _id: req.params.id, deletedAt: null })
    .populate("patient", "name")
    .populate("doctor", "name")
    .lean();
  if (!doc) return res.status(404).json({ message: "Document not found" });
  return res.json({ ...doc, id: doc._id });
});

documentsRouter.post("/", requireRole("admin", "receptionist", "doctor"), async (req, res) => {
  const parsed = documentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const doc = await DocumentFile.create({
    ...parsed.data,
    patient: parsed.data.patient || null,
    doctor: parsed.data.doctor || null,
    mimeType: parsed.data.mimeType || "text/plain",
    sizeBytes: Buffer.byteLength(parsed.data.content, "utf8"),
    uploadedBy: req.auth?.email || "",
  });
  await writeAudit(req.auth, "create", "document", doc._id.toString(), {
    category: doc.category,
    fileName: doc.fileName,
  });

  const lean = doc.toObject();
  delete (lean as { content?: string }).content;
  return res.status(201).json({ ...lean, id: doc._id });
});

documentsRouter.delete("/:id", requireRole("admin", "receptionist"), async (req, res) => {
  const doc = await DocumentFile.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "Document not found" });
  await writeAudit(req.auth, "soft_delete", "document", doc._id.toString());
  return res.json({ message: "Document archived" });
});
