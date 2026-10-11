import { beforeEach, describe, expect, it } from "vitest";
import { bustCachePrefix, cachedJson, getCache, initCache } from "../src/utils/cache.js";

describe("cache", () => {
  beforeEach(async () => {
    process.env.REDIS_URL = "";
    await initCache();
    await bustCachePrefix("");
  });

  it("uses memory mode without REDIS_URL", () => {
    expect(getCache().mode).toBe("memory");
  });

  it("caches JSON payloads and reports hit/miss", async () => {
    let loads = 0;
    const first = await cachedJson("unit:stats", 60, async () => {
      loads += 1;
      return { total: 7 };
    });
    const second = await cachedJson("unit:stats", 60, async () => {
      loads += 1;
      return { total: 99 };
    });

    expect(first.total).toBe(7);
    expect(first._cache?.hit).toBe(false);
    expect(second.total).toBe(7);
    expect(second._cache?.hit).toBe(true);
    expect(loads).toBe(1);
  });

  it("busts keys by prefix", async () => {
    await cachedJson("dashboard:stats:a", 60, async () => ({ ok: 1 }));
    await bustCachePrefix("dashboard:stats:");
    let loads = 0;
    await cachedJson("dashboard:stats:a", 60, async () => {
      loads += 1;
      return { ok: 2 };
    });
    expect(loads).toBe(1);
  });
});
