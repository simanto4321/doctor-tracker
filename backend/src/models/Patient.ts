import mongoose, { Schema, type InferSchemaType } from "mongoose";

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
      index: true,
    },
    condition: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

patientSchema.index({ createdAt: -1 });
patientSchema.index({ name: "text", condition: "text", email: "text", phone: "text" });

export type PatientDocument = InferSchemaType<typeof patientSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Patient = mongoose.model("Patient", patientSchema);
