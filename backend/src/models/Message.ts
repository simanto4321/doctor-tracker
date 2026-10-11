import mongoose, { Schema, type InferSchemaType } from "mongoose";

const messageSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    subject: { type: String, default: "", trim: true, maxlength: 160 },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", default: null },
    readAt: { type: Date, default: null, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

messageSchema.index({ createdAt: -1 });

export type MessageDocument = InferSchemaType<typeof messageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Message = mongoose.model("Message", messageSchema);
