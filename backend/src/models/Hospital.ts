import mongoose, { Schema, type InferSchemaType } from "mongoose";

const hospitalSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    city: { type: String, required: true, trim: true, index: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    departments: [{ type: String, trim: true }],
    bedCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type HospitalDocument = InferSchemaType<typeof hospitalSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Hospital = mongoose.model("Hospital", hospitalSchema);
