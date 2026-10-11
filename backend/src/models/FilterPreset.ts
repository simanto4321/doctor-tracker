import mongoose, { Schema, type InferSchemaType } from "mongoose";

const filterPresetSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    scope: { type: String, enum: ["dashboard"], default: "dashboard", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    filters: {
      from: { type: String, default: "" },
      to: { type: String, default: "" },
      hospital: { type: String, default: "" },
      specialization: { type: String, default: "" },
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

filterPresetSchema.index({ userId: 1, name: 1 }, { unique: true });

export type FilterPresetDocument = InferSchemaType<typeof filterPresetSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FilterPreset = mongoose.model("FilterPreset", filterPresetSchema);
