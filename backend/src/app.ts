import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
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
import { messagesRouter } from "./routes/messages.js";
import { telemedicineRouter } from "./routes/telemedicine.js";
import { bedsRouter } from "./routes/beds.js";
import { invoicesRouter } from "./routes/invoices.js";

function allowedOrigins() {
  const fromEnv = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    ...fromEnv,
    "http://localhost:4317",
    "http://127.0.0.1:4317",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  const origins = allowedOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin) || /\.vercel\.app$/.test(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "4mb" }));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
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
  app.use("/api/messages", messagesRouter);
  app.use("/api/telemedicine", telemedicineRouter);
  app.use("/api/beds", bedsRouter);
  app.use("/api/invoices", invoicesRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "Unexpected server error" });
  });

  return app;
}
