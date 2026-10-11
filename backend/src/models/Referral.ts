import mongoose, { Schema, type InferSchemaType } from "mongoose";

const referralSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    fromDoctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    toDoctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "completed", "declined"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["routine", "urgent", "stat"],
      default: "routine",
      index: true,
    },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type ReferralDocument = InferSchemaType<typeof referralSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Referral = mongoose.model("Referral", referralSchema);
