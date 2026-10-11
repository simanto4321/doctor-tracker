import type { VercelRequest, VercelResponse } from "@vercel/node";
import app, { ensureReady } from "../src/index.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureReady();
  return app(req as never, res as never);
}
