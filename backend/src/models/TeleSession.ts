import mongoose, { Schema, type InferSchemaType } from "mongoose";

const teleSessionSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 30, min: 5, max: 180 },
    joinUrl: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled", "no_show"],
      default: "scheduled",
      index: true,
    },
    reason: { type: String, default: "", trim: true, maxlength: 240 },
    notes: { type: String, default: "", trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type TeleSessionDocument = InferSchemaType<typeof teleSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TeleSession = mongoose.model("TeleSession", teleSessionSchema);
