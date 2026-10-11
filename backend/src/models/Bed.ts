import mongoose, { Schema, type InferSchemaType } from "mongoose";

const bedSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    ward: { type: String, required: true, trim: true, index: true },
    bedNumber: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["available", "occupied", "cleaning", "reserved"],
      default: "available",
      index: true,
    },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", default: null },
    admittedAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true, maxlength: 300 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

bedSchema.index({ hospital: 1, ward: 1, bedNumber: 1 }, { unique: true });

export type BedDocument = InferSchemaType<typeof bedSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Bed = mongoose.model("Bed", bedSchema);
