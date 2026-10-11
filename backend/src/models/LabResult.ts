import mongoose, { Schema, type InferSchemaType } from "mongoose";

const labResultSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    testName: { type: String, required: true, trim: true, index: true },
    value: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    refLow: { type: Number, required: true },
    refHigh: { type: Number, required: true },
    abnormal: { type: Boolean, default: false, index: true },
    collectedAt: { type: Date, required: true, index: true },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type LabResultDocument = InferSchemaType<typeof labResultSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const LabResult = mongoose.model("LabResult", labResultSchema);
