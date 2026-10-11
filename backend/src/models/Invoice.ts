import mongoose, { Schema, type InferSchemaType } from "mongoose";

const lineItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new Schema(
  {
    visit: { type: Schema.Types.ObjectId, ref: "Visit", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    number: { type: String, required: true, unique: true, trim: true, index: true },
    lineItems: { type: [lineItemSchema], default: [] },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["draft", "issued", "paid", "void"],
      default: "draft",
      index: true,
    },
    issuedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true, maxlength: 500 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Invoice = mongoose.model("Invoice", invoiceSchema);
