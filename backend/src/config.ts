/**
 * Central runtime config — prefer environment variables over code defaults.
 * Change behavior via `.env` / hosting env; avoid editing source for clinic setup.
 */

function env(name: string, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function envBool(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

function envList(name: string, fallback: string[] = []) {
  const raw = env(name);
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

export const config = {
  isProd,
  port: Number(env("PORT", "4821")),
  appName: env("APP_NAME", "Doctor Tracker"),
  appTagline: env("APP_TAGLINE", "Clinical operations desk"),
  mongodbUri: env("MONGODB_URI"),
  jwtSecret: env("JWT_SECRET", "change-me-to-a-long-random-string"),
  accessTokenTtl: env("ACCESS_TOKEN_TTL", "15m"),
  refreshTokenDays: Number(env("REFRESH_TOKEN_DAYS", "14")),
  cookieSecure: envBool("COOKIE_SECURE", isProd),
  seedOnStart: envBool("SEED_ON_START", true),
  /** When true, GET /api/auth/demo-accounts returns seeded demo users (for login UI). */
  showDemoAccounts: envBool(
    "SHOW_DEMO_ACCOUNTS",
    !isProd || envBool("SEED_ON_START", true)
  ),
  /** Include plaintext demo passwords in that response (turn off in real clinics). */
  showDemoPasswords: envBool(
    "SHOW_DEMO_PASSWORDS",
    envBool("SHOW_DEMO_ACCOUNTS", !isProd || envBool("SEED_ON_START", true))
  ),
  clientOrigins: envList("CLIENT_ORIGIN", [
    "http://127.0.0.1:4317",
    "http://localhost:4317",
  ]),
  /** Extra allowed browser origins (comma-separated). */
  extraOrigins: envList("CORS_EXTRA_ORIGINS", [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]),
  allowVercelPreviewCors: envBool("CORS_ALLOW_VERCEL_PREVIEWS", true),
  publicApiUrl: env("PUBLIC_API_URL", `http://127.0.0.1:${env("PORT", "4821")}`),
  admin: {
    name: env("ADMIN_NAME", "Clinic Admin"),
    email: env("ADMIN_EMAIL", "admin@doctortracker.com"),
    password: env("ADMIN_PASSWORD", "Admin@123"),
  },
  receptionist: {
    name: env("RECEPTIONIST_NAME", "Front Desk"),
    email: env("RECEPTIONIST_EMAIL", "front.desk@doctortracker.com"),
    password: env("RECEPTIONIST_PASSWORD", "Desk@123"),
  },
  emailFrom: env("EMAIL_FROM", "Doctor Tracker <noreply@doctortracker.local>"),
  redisUrl: env("REDIS_URL"),
  dashboardCacheTtl: Number(env("DASHBOARD_CACHE_TTL", "30")),
  rateLimitMax: Number(env("RATE_LIMIT_MAX", "400")),
  authRateLimitMax: Number(env("AUTH_RATE_LIMIT_MAX", "20")),
  loginRateLimitMax: Number(env("LOGIN_RATE_LIMIT_MAX", "10")),
  loginMaxAttempts: Number(env("LOGIN_MAX_ATTEMPTS", "5")),
  loginLockMs: Number(env("LOGIN_LOCK_MS", String(15 * 60 * 1000))),
};

export function allAllowedOrigins() {
  const set = new Set([...config.clientOrigins, ...config.extraOrigins]);
  return [...set];
}

export type DemoAccount = {
  role: string;
  label: string;
  email: string;
  password?: string;
};

export function demoAccounts(): DemoAccount[] {
  if (!config.showDemoAccounts) return [];
  const accounts: DemoAccount[] = [
    {
      role: "admin",
      label: "Admin",
      email: config.admin.email,
    },
    {
      role: "receptionist",
      label: "Receptionist",
      email: config.receptionist.email,
    },
  ];
  if (config.showDemoPasswords) {
    accounts[0].password = config.admin.password;
    accounts[1].password = config.receptionist.password;
  }
  return accounts;
}
