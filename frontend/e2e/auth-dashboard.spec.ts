import { expect, test } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_URL || "http://127.0.0.1:4821/api";

test.describe("Doctor Tracker platform smoke", () => {
  test("health + openapi docs respond", async ({ request }) => {
    const health = await request.get(`${API.replace(/\/api$/, "")}/api/health`);
    expect(health.ok()).toBeTruthy();

    const docs = await request.get(`${API.replace(/\/api$/, "")}/api/openapi.json`);
    expect(docs.ok()).toBeTruthy();
    const spec = await docs.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.paths["/api/auth/login"]).toBeTruthy();
  });

  test("login sets session and opens dashboard", async ({ page, request }) => {
    const login = await request.post(`${API}/auth/login`, {
      data: { email: "admin@doctortracker.com", password: "Admin@123" },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe("admin@doctortracker.com");

    await page.addInitScript((session) => {
      localStorage.setItem(
        "doctor-tracker-auth",
        JSON.stringify({
          state: { token: session.token, user: session.user },
          version: 0,
        })
      );
    }, { token: body.token as string, user: body.user });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /dashboard|overview|caseload/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("FHIR-lite export requires auth and returns Bundle", async ({ request }) => {
    const denied = await request.get(`${API}/fhir/Bundle/$export`);
    expect(denied.status()).toBe(401);

    const login = await request.post(`${API}/auth/login`, {
      data: { email: "admin@doctortracker.com", password: "Admin@123" },
    });
    const { token } = await login.json();
    const exportRes = await request.get(`${API}/fhir/Bundle/$export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(exportRes.ok()).toBeTruthy();
    const bundle = await exportRes.json();
    expect(bundle.resourceType).toBe("Bundle");
    expect(Array.isArray(bundle.entry)).toBeTruthy();
  });
});
