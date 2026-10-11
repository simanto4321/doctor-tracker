import mongoose, { Schema, type InferSchemaType } from "mongoose";

const appointmentSchema = new Schema(
  {
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "checked_in", "completed", "cancelled", "no_show"],
      default: "scheduled",
      index: true,
    },
    reason: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ startsAt: 1, doctor: 1 });

export type AppointmentDocument = InferSchemaType<typeof appointmentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Appointment = mongoose.model("Appointment", appointmentSchema);
