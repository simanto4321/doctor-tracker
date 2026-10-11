import mongoose, { Schema, type InferSchemaType } from "mongoose";

const conditionEventSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    condition: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["onset", "worsening", "stable", "improving", "resolved"],
      default: "onset",
    },
    note: { type: String, default: "", trim: true },
    recordedAt: { type: Date, required: true, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type ConditionEventDocument = InferSchemaType<typeof conditionEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ConditionEvent = mongoose.model("ConditionEvent", conditionEventSchema);
