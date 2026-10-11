import mongoose, { Schema, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["info", "warning", "success", "appointment", "follow_up"],
      default: "info",
      index: true,
    },
    href: { type: String, default: "", trim: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Notification = mongoose.model("Notification", notificationSchema);
