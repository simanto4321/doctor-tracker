import mongoose, { Schema, type InferSchemaType } from "mongoose";

const prescriptionSchema = new Schema(
  {
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    medication: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "completed", "refill_due", "cancelled"],
      default: "active",
      index: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type PrescriptionDocument = InferSchemaType<typeof prescriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Prescription = mongoose.model("Prescription", prescriptionSchema);
