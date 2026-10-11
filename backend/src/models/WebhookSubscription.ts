import mongoose, { Schema, type InferSchemaType } from "mongoose";

const webhookSubscriptionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    targetUrl: { type: String, required: true, trim: true },
    secret: { type: String, required: true },
    events: {
      type: [String],
      default: ["doctor.created", "patient.created", "appointment.created"],
    },
    active: { type: Boolean, default: true, index: true },
    lastDeliveryAt: { type: Date, default: null },
    lastStatus: { type: Number, default: null },
    failureCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type WebhookSubscriptionDocument = InferSchemaType<typeof webhookSubscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WebhookSubscription = mongoose.model(
  "WebhookSubscription",
  webhookSubscriptionSchema
);
