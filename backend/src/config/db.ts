import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer: MongoMemoryServer | null = null;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    await mongoose.connect(uri);
    console.log(`[db] Connected to MongoDB at ${uri}`);
    return { mode: "external" as const, uri };
  }

  memoryServer = await MongoMemoryServer.create();
  const memoryUri = memoryServer.getUri("doctor-tracker");
  await mongoose.connect(memoryUri);
  console.log("[db] Connected to in-memory MongoDB (set MONGODB_URI for a real instance)");
  return { mode: "memory" as const, uri: memoryUri };
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
