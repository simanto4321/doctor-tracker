import Redis from "ioredis";

type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  mode: "redis" | "memory";
};

const memory = new Map<string, { value: string; expiresAt: number }>();

const memoryStore: CacheStore = {
  mode: "memory",
  async get(key) {
    const hit = memory.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      memory.delete(key);
      return null;
    }
    return hit.value;
  },
  async set(key, value, ttlSeconds) {
    memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
  async del(key) {
    memory.delete(key);
  },
};

let store: CacheStore = memoryStore;
let redisClient: Redis | null = null;

export async function initCache() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("[cache] Using in-memory cache (set REDIS_URL for Redis)");
    store = memoryStore;
    return store;
  }

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    await redisClient.connect();
    await redisClient.ping();
    store = {
      mode: "redis",
      get: (key) => redisClient!.get(key),
      set: async (key, value, ttlSeconds) => {
        await redisClient!.set(key, value, "EX", ttlSeconds);
      },
      del: async (key) => {
        await redisClient!.del(key);
      },
    };
    console.log(`[cache] Connected to Redis at ${url}`);
  } catch (error) {
    console.warn("[cache] Redis unavailable — falling back to memory", error);
    redisClient?.disconnect();
    redisClient = null;
    store = memoryStore;
  }
  return store;
}

export function getCache() {
  return store;
}

export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T & { _cache?: { hit: boolean; mode: string } }> {
  const hit = await store.get(key);
  if (hit) {
    const parsed = JSON.parse(hit) as T;
    return { ...parsed, _cache: { hit: true, mode: store.mode } };
  }
  const fresh = await loader();
  await store.set(key, JSON.stringify(fresh), ttlSeconds);
  return { ...fresh, _cache: { hit: false, mode: store.mode } };
}

export async function bustCachePrefix(prefix: string) {
  if (store.mode === "memory") {
    for (const key of memory.keys()) {
      if (key.startsWith(prefix)) memory.delete(key);
    }
    return;
  }
  if (!redisClient) return;
  const keys = await redisClient.keys(`${prefix}*`);
  if (keys.length) await redisClient.del(...keys);
}
