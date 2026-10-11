import mongoose, { Schema, type InferSchemaType } from "mongoose";

const emailOutboxSchema = new Schema(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    kind: {
      type: String,
      enum: ["verification", "reset", "digest", "webhook_failure", "other"],
      default: "other",
      index: true,
    },
    meta: { type: Schema.Types.Mixed, default: {} },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type EmailOutboxDocument = InferSchemaType<typeof emailOutboxSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const EmailOutbox = mongoose.model("EmailOutbox", emailOutboxSchema);
