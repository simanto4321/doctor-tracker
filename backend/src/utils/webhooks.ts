import crypto from "crypto";
import { WebhookSubscription } from "../models/WebhookSubscription.js";

export async function dispatchWebhook(
  event: string,
  payload: Record<string, unknown>
) {
  const subs = await WebhookSubscription.find({
    deletedAt: null,
    active: true,
    events: event,
  }).lean();

  await Promise.all(
    subs.map(async (sub) => {
      const body = JSON.stringify({
        id: crypto.randomUUID(),
        event,
        createdAt: new Date().toISOString(),
        data: payload,
      });
      const signature = crypto
        .createHmac("sha256", sub.secret)
        .update(body)
        .digest("hex");

      try {
        const response = await fetch(sub.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Doctor-Tracker-Event": event,
            "X-Doctor-Tracker-Signature": signature,
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        await WebhookSubscription.updateOne(
          { _id: sub._id },
          {
            lastDeliveryAt: new Date(),
            lastStatus: response.status,
            failureCount: response.ok ? 0 : (sub.failureCount || 0) + 1,
          }
        );
      } catch {
        await WebhookSubscription.updateOne(
          { _id: sub._id },
          {
            lastDeliveryAt: new Date(),
            lastStatus: 0,
            failureCount: (sub.failureCount || 0) + 1,
          }
        );
      }
    })
  );
}
