import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { connectDatabase } from "./config/db.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { openApiSpec } from "./openapi.js";
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
import { labsRouter } from "./routes/labs.js";
import { referralsRouter } from "./routes/referrals.js";
import { documentsRouter } from "./routes/documents.js";
import { hospitalsRouter } from "./routes/hospitals.js";
import { vitalsRouter } from "./routes/vitals.js";
import { importRouter } from "./routes/import.js";
import { insightsRouter } from "./routes/insights.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { fhirRouter } from "./routes/fhir.js";
import { platformRouter } from "./routes/platform.js";
import { initCache } from "./utils/cache.js";
import { seedDatabase } from "./utils/seed.js";

const app = express();
const port = Number(process.env.PORT) || 4821;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://127.0.0.1:4317";

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: [clientOrigin, "http://localhost:4317", "http://127.0.0.1:4317"],
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(globalLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "doctor-tracker-api" });
});

app.get("/api/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));

app.use("/api/auth", authRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/visits", visitsRouter);
app.use("/api/prescriptions", prescriptionsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/search", searchRouter);
app.use("/api/audit", auditRouter);
app.use("/api/labs", labsRouter);
app.use("/api/referrals", referralsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/hospitals", hospitalsRouter);
app.use("/api/vitals", vitalsRouter);
app.use("/api/import", importRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/fhir", fhirRouter);
app.use("/api/platform", platformRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error" });
});

async function start() {
  await connectDatabase();
  await initCache();

  if (process.env.SEED_ON_START !== "false") {
    const seed = await seedDatabase();
    console.log(`[seed] Admin login → ${seed.adminEmail} / ${seed.adminPassword}`);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`[api] Doctor Tracker API listening on http://127.0.0.1:${port}`);
    console.log(`[api] Swagger docs → http://127.0.0.1:${port}/api/docs`);
  });
}

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
