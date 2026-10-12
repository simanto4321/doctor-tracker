import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDatabase } from "./config/db.js";
import { initCache } from "./utils/cache.js";
import { seedDatabase } from "./utils/seed.js";

const app = createApp();
const port = config.port;

let ready: Promise<void> | null = null;

export async function ensureReady() {
  if (!ready) {
    ready = (async () => {
      await connectDatabase();
      await initCache();
      if (config.seedOnStart) {
        const seed = await seedDatabase();
        console.log(`[seed] Admin login → ${seed.adminEmail} / ${seed.adminPassword}`);
      }
    })();
  }
  await ready;
}

export default app;

async function start() {
  await ensureReady();
  app.listen(port, "0.0.0.0", () => {
    console.log(`[api] ${config.appName} API listening on http://127.0.0.1:${port}`);
    console.log(`[api] Swagger docs → http://127.0.0.1:${port}/api/docs`);
  });
}

const isVercel = Boolean(process.env.VERCEL);
if (!isVercel) {
  start().catch((error) => {
    console.error("Failed to start API", error);
    process.exit(1);
  });
}
