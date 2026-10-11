import mongoose, { Schema, type InferSchemaType } from "mongoose";

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    specialization: { type: String, required: true, trim: true, index: true },
    hospital: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

doctorSchema.index({ createdAt: -1 });
doctorSchema.index({ name: "text", specialization: "text", hospital: "text", email: "text" });

export type DoctorDocument = InferSchemaType<typeof doctorSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Doctor = mongoose.model("Doctor", doctorSchema);
