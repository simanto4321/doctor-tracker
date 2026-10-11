import mongoose, { Schema, type InferSchemaType } from "mongoose";

const visitSchema = new Schema(
  {
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    visitedAt: { type: Date, required: true, index: true },
    diagnosis: { type: String, required: true, trim: true },
    treatment: { type: String, default: "", trim: true },
    followUpAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type VisitDocument = InferSchemaType<typeof visitSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Visit = mongoose.model("Visit", visitSchema);
