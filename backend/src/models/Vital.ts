import mongoose, { Schema, type InferSchemaType } from "mongoose";

const vitalSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    recordedAt: { type: Date, required: true, index: true },
    heartRate: { type: Number, required: true },
    bloodPressureSys: { type: Number, required: true },
    bloodPressureDia: { type: Number, required: true },
    temperatureC: { type: Number, required: true },
    spo2: { type: Number, required: true },
    weightKg: { type: Number, default: null },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type VitalDocument = InferSchemaType<typeof vitalSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Vital = mongoose.model("Vital", vitalSchema);
