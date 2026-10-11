import { describe, expect, it } from "vitest";
import { createRefreshTokenValue, hashToken } from "../src/utils/tokens.js";

describe("token helpers", () => {
  it("hashes refresh tokens deterministically", () => {
    const raw = "abc123-refresh-token";
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toBe(hashToken("different"));
    expect(hashToken(raw)).toHaveLength(64);
  });

  it("creates high-entropy refresh values", () => {
    const a = createRefreshTokenValue();
    const b = createRefreshTokenValue();
    expect(a).toHaveLength(96);
    expect(a).not.toBe(b);
  });
});
