import mongoose, { Schema, type InferSchemaType } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

export type RefreshTokenDocument = InferSchemaType<typeof refreshTokenSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
