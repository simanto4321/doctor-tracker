import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { connectDatabase } from "./config/db.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { doctorsRouter } from "./routes/doctors.js";
import { patientsRouter } from "./routes/patients.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { visitsRouter } from "./routes/visits.js";
import { prescriptionsRouter } from "./routes/prescriptions.js";
import { notificationsRouter } from "./routes/notifications.js";
import { searchRouter } from "./routes/search.js";
import { auditRouter } from "./routes/audit.js";
import { seedDatabase } from "./utils/seed.js";

const app = express();
const port = Number(process.env.PORT) || 4821;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://127.0.0.1:4317";

app.use(helmet());
app.use(
  cors({
    origin: [clientOrigin, "http://localhost:4317", "http://127.0.0.1:4317"],
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "doctor-tracker-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/visits", visitsRouter);
app.use("/api/prescriptions", prescriptionsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/search", searchRouter);
app.use("/api/audit", auditRouter);
app.use("/api/dashboard", dashboardRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error" });
});

async function start() {
  await connectDatabase();

  if (process.env.SEED_ON_START !== "false") {
    const seed = await seedDatabase();
    console.log(`[seed] Admin login → ${seed.adminEmail} / ${seed.adminPassword}`);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`[api] Doctor Tracker API listening on http://127.0.0.1:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
