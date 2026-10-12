import nodemailer from "nodemailer";
import { EmailOutbox } from "../models/EmailOutbox.js";

type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  kind?: "verification" | "reset" | "digest" | "webhook_failure" | "other";
  meta?: Record<string, unknown>;
};

let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_URL) {
    transporter = nodemailer.createTransport(process.env.SMTP_URL);
    return transporter;
  }
  // Demo mode: no SMTP — log only and store in outbox
  return null;
}

export async function sendEmail(input: SendEmailInput) {
  const { config } = await import("../config.js");
  const from = config.emailFrom;
  const transport = await getTransporter();

  if (transport) {
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
  } else {
    console.log(`[email:demo] → ${input.to} | ${input.subject}`);
  }

  const record = await EmailOutbox.create({
    to: input.to,
    subject: input.subject,
    body: input.body,
    kind: input.kind || "other",
    meta: input.meta || {},
    sentAt: new Date(),
  });

  return {
    id: record._id,
    demo: !transport,
    preview: !transport ? input.body.slice(0, 280) : undefined,
  };
}
