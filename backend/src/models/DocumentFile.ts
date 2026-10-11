import mongoose, { Schema, type InferSchemaType } from "mongoose";

const documentFileSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["report", "id", "consent", "other"],
      default: "report",
      index: true,
    },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", default: null, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", default: null, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, default: "text/plain" },
    sizeBytes: { type: Number, default: 0 },
    // Demo storage: keep small text/base64 payloads in Mongo
    content: { type: String, required: true },
    uploadedBy: { type: String, default: "" },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type DocumentFileDocument = InferSchemaType<typeof documentFileSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DocumentFile = mongoose.model("DocumentFile", documentFileSchema);
