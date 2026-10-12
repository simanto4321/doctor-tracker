/**
 * Frontend app settings — all overridable via NEXT_PUBLIC_* env vars.
 * Demo credentials are NOT hardcoded here; they load from GET /auth/demo-accounts.
 */

export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Doctor Tracker",
  appTagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ||
    "Sign in to manage doctors, patients, and clinic analytics from one calm operations desk.",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4821/api",
  /** Prefill login email from env when set (optional convenience for demos). */
  defaultLoginEmail: process.env.NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL || "",
  /** Prefill login password from env when set — leave empty in real deployments. */
  defaultLoginPassword: process.env.NEXT_PUBLIC_DEFAULT_LOGIN_PASSWORD || "",
};

export type DemoAccount = {
  role: string;
  label: string;
  email: string;
  password?: string;
};

export type DemoAccountsResponse = {
  enabled: boolean;
  appName: string;
  accounts: DemoAccount[];
};
