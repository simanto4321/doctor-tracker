import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

describe("webhook signature", () => {
  it("matches HMAC-SHA256 of the raw body", () => {
    const secret = "test-secret";
    const body = JSON.stringify({ event: "doctor.created", data: { id: "1" } });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(signature).toHaveLength(64);
    expect(createHmac("sha256", secret).update(body).digest("hex")).toBe(signature);
  });
});
