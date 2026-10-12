/**
 * Deep UI audit — mobile (primary) + desktop spot checks
 */
import { chromium, devices } from "playwright";
import fs from "fs";
import path from "path";

const FE = process.env.FE_URL || "http://127.0.0.1:4317";
const OUT = process.env.OUT_DIR || "/tmp/deep-ui-audit";
const EMAIL = "admin@doctortracker.com";
const PASS = "Admin@123";

fs.mkdirSync(OUT, { recursive: true });
const findings = [];

function find(sev, area, msg, meta = {}) {
  findings.push({ severity: sev, area, msg, ...meta });
  console.log(`[${sev}] ${area}: ${msg}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function login(page) {
  await page.goto(`${FE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  // clear any existing session
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');
  await email.fill(EMAIL);
  await password.fill(PASS);
  const submit = page.getByRole("button", { name: /enter portal|sign in|logging/i });
  await submit.click();
  await page.waitForURL(/\/(dashboard|doctors|patients)/, { timeout: 45000 }).catch(async () => {
    const err = await page.locator('[role="alert"]').textContent().catch(() => "");
    find("high", "auth/login", `Login did not navigate. Alert: ${err || "(none)"}`);
  });
  await page.waitForTimeout(900);
}

async function measureOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const sw = Math.max(doc.scrollWidth, body.scrollWidth);
    const cw = window.innerWidth;
    const offenders = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > cw + 12 && r.left < cw && r.width > 40 && r.height > 10) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className || "").toString().slice(0, 60);
        offenders.push({ tag, cls, right: Math.round(r.right), w: Math.round(r.width) });
      }
    });
    return { sw, cw, overflowX: sw > cw + 3, offenders: offenders.slice(0, 6) };
  });
  if (overflow.overflowX) {
    find("high", label, `Horizontal overflow scrollWidth=${overflow.sw} client=${overflow.cw}`, {
      offenders: overflow.offenders,
    });
  }
  return overflow;
}

async function checkTouchTargets(page, label) {
  const small = await page.evaluate(() => {
    const min = 40;
    const bad = [];
    document.querySelectorAll("a, button, [role='button'], select").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      // ignore inline text links in paragraphs
      if (el.tagName === "A" && el.closest("p, li, td")) return;
      if (r.height < min - 4 || (r.width < min - 4 && r.height < 36)) {
        const text = (el.getAttribute("aria-label") || el.innerText || "").trim().slice(0, 40);
        bad.push({
          text,
          w: Math.round(r.width),
          h: Math.round(r.height),
          tag: el.tagName.toLowerCase(),
        });
      }
    });
    return bad.slice(0, 15);
  });
  if (small.length) {
    find("medium", label, `${small.length}+ controls under ~40px touch target`, {
      samples: small.slice(0, 6),
    });
  }
  return small;
}

async function checkDarkWhites(page, label) {
  const whiteInDark = await page.evaluate(() => {
    const dark =
      document.documentElement.classList.contains("dark") ||
      localStorage.getItem("theme") === "dark" ||
      document.documentElement.dataset.theme === "dark";
    if (!dark) return { dark: false, whites: [] };
    const whites = [];
    document.querySelectorAll("button, [class*='chip'], [class*='badge'], header *").forEach((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg === "rgb(255, 255, 255)") {
        const r = el.getBoundingClientRect();
        if (r.width > 24 && r.height > 12) {
          whites.push({ text: (el.innerText || "").trim().slice(0, 24), tag: el.tagName.toLowerCase() });
        }
      }
    });
    return { dark: true, whites: whites.slice(0, 8) };
  });
  if (whiteInDark.dark && whiteInDark.whites.length) {
    find("medium", label, `White surfaces in dark mode (${whiteInDark.whites.length})`, {
      samples: whiteInDark.whites,
    });
  }
}

async function openMore(page) {
  const more = page.getByRole("button", { name: /^More$/i });
  if (await more.first().isVisible().catch(() => false)) {
    // Fixed bottom nav can fail Playwright actionability after scrollIntoView;
    // prefer a real tap at the button center, then force as fallback.
    try {
      const box = await more.first().boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await more.first().click({ force: true });
      }
    } catch {
      await more.first().click({ force: true });
    }
    await page.waitForTimeout(450);
    return true;
  }
  return false;
}

async function pageHealthy(page, label) {
  const bodyText = await page.locator("body").innerText();
  if (/something went wrong|application error|uncaught/i.test(bodyText)) {
    find("high", label, "Error boundary / crash visible");
    return false;
  }
  if (bodyText.trim().length < 30) {
    find("medium", label, "Nearly blank page");
    return false;
  }
  return true;
}

async function auditMobile(browser) {
  const iPhone = devices["iPhone 13"];
  const context = await browser.newContext({ ...iPhone, locale: "en-US" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e.message || e)));

  console.log("\n=== MOBILE LOGIN ===");
  await page.goto(`${FE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(page, "m-01-login");
  await measureOverflow(page, "mobile/login");
  if (!(await page.getByText(/Doctor Tracker/i).first().isVisible())) {
    find("high", "mobile/login", "Brand not visible");
  }
  await checkTouchTargets(page, "mobile/login");

  // show password toggle size
  const eye = page.getByLabel(/show password|hide password/i);
  if (await eye.isVisible()) {
    const box = await eye.boundingBox();
    if (box && (box.width < 40 || box.height < 40)) {
      find("medium", "mobile/login", `Password toggle ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }

  await login(page);
  await shot(page, "m-02-dashboard");
  await measureOverflow(page, "mobile/dashboard");
  await checkTouchTargets(page, "mobile/dashboard");
  await pageHealthy(page, "mobile/dashboard");

  const bottomNav = await page.evaluate(() => {
    const navs = [...document.querySelectorAll("nav, [role='navigation']")];
    return navs.some((n) => {
      const r = n.getBoundingClientRect();
      return r.bottom >= window.innerHeight - 12 && r.height >= 44 && r.height < 130;
    });
  });
  if (!bottomNav) find("high", "mobile/shell", "Bottom nav missing");

  // filters
  for (const label of ["7 days", "30 days", "90 days"]) {
    const chip = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") });
    if (await chip.first().isVisible().catch(() => false)) {
      await chip.first().click();
      await page.waitForTimeout(400);
    }
  }
  await shot(page, "m-03-filters");

  // theme
  const themeBtn = page.getByRole("button", { name: /theme|dark|light/i }).first();
  if (await themeBtn.isVisible().catch(() => false)) {
    await themeBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "m-04-dark");
    await checkDarkWhites(page, "mobile/dark");
    await themeBtn.click();
    await page.waitForTimeout(300);
  }

  // notifications
  const bell = page.getByRole("button", { name: /notification/i }).first();
  if (await bell.isVisible().catch(() => false)) {
    await bell.click();
    await page.waitForTimeout(400);
    await shot(page, "m-05-notifications");
    await measureOverflow(page, "mobile/notifications");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const still = await page.getByRole("dialog", { name: /notification/i }).isVisible().catch(() => false);
    if (still) find("medium", "mobile/notifications", "Escape did not close notifications");
  }

  // primary tabs
  for (const name of ["Doctors", "Patients", "Appointments"]) {
    const tab = page.locator('nav[aria-label*="mobile" i] a, nav[aria-label*="Primary mobile" i] a')
      .filter({ hasText: new RegExp(`^${name}$`, "i") })
      .first();
    if (await tab.isVisible().catch(() => false)) {
      const box = await tab.boundingBox();
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      else await tab.click({ force: true });
      await page.waitForTimeout(800);
      await shot(page, `m-route-${name.toLowerCase()}`);
      await measureOverflow(page, `mobile/${name.toLowerCase()}`);
      await checkTouchTargets(page, `mobile/${name.toLowerCase()}`);
      await pageHealthy(page, `mobile/${name.toLowerCase()}`);
    } else {
      find("medium", `mobile/${name}`, "Bottom tab missing");
    }
  }

  // More drawer
  const opened = await openMore(page);
  await shot(page, "m-06-drawer");
  if (!opened) find("high", "mobile/drawer", "More drawer failed to open");
  else {
    // stuck tooltip check
    const stickyTip = await page.locator('[role="tooltip"]').isVisible().catch(() => false);
    if (stickyTip) find("medium", "mobile/drawer", "Tooltip visible over drawer without intentional open");
    await measureOverflow(page, "mobile/drawer");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  const secondary = [
    "Prescriptions",
    "Labs",
    "Referrals",
    "Hospitals",
    "Wards",
    "Telemedicine",
    "Messages",
    "Billing",
    "Documents",
    "Audit",
    "Team",
  ];
  for (const name of secondary) {
    await openMore(page);
    await page.waitForTimeout(250);
    const link = page.getByRole("link", { name: new RegExp(`^${name}$`, "i") }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForTimeout(900);
      await shot(page, `m-sec-${name.toLowerCase()}`);
      await measureOverflow(page, `mobile/${name.toLowerCase()}`);
      await pageHealthy(page, `mobile/${name.toLowerCase()}`);
    } else {
      find("low", `mobile/${name}`, "Drawer link not found");
    }
  }

  // modal sheet on patients
  await page.goto(`${FE}/patients`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(600);
  const addBtn = page.getByRole("button", { name: /add|new|create/i }).first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "m-08-modal-sheet");
    await measureOverflow(page, "mobile/modal");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // doctor detail
  await page.goto(`${FE}/doctors`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(600);
  const doc = page.locator("a[href*='/doctors/']").first();
  if (await doc.isVisible().catch(() => false)) {
    await doc.click();
    await page.waitForTimeout(900);
    await shot(page, "m-07-doctor-detail");
    await measureOverflow(page, "mobile/doctor-detail");
    await pageHealthy(page, "mobile/doctor-detail");
  }

  await page.goto(`${FE}/forgot-password`, { waitUntil: "networkidle", timeout: 30000 });
  await shot(page, "m-09-forgot");
  await measureOverflow(page, "mobile/forgot");

  // landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(`${FE}/dashboard`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(700);
  await shot(page, "m-10-landscape");
  await measureOverflow(page, "mobile/landscape");

  // small phone
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`${FE}/dashboard`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(700);
  await shot(page, "m-11-small-phone");
  await measureOverflow(page, "mobile/360");
  await checkTouchTargets(page, "mobile/360");

  // pull content scroll under bottom nav
  const obscured = await page.evaluate(() => {
    const nav = [...document.querySelectorAll("nav")].find((n) => {
      const r = n.getBoundingClientRect();
      return r.bottom >= window.innerHeight - 8;
    });
    if (!nav) return null;
    const nr = nav.getBoundingClientRect();
    const main = document.querySelector("main") || document.body;
    const style = getComputedStyle(main);
    return { navH: Math.round(nr.height), pb: style.paddingBottom };
  });
  if (obscured && (!obscured.pb || parseInt(obscured.pb, 10) < 48)) {
    find("medium", "mobile/shell", `Main may sit under bottom nav (paddingBottom=${obscured.pb})`);
  }

  if (consoleErrors.length) {
    find("medium", "mobile/console", `${[...new Set(consoleErrors)].length} page errors`, {
      samples: [...new Set(consoleErrors)].slice(0, 8),
    });
  }

  await context.close();
}

async function auditDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e.message || e)));

  console.log("\n=== DESKTOP ===");
  await login(page);
  await shot(page, "d-01-dashboard");
  await measureOverflow(page, "desktop/dashboard");
  await pageHealthy(page, "desktop/dashboard");

  for (const p of [
    "/doctors",
    "/patients",
    "/appointments",
    "/prescriptions",
    "/labs",
    "/referrals",
    "/hospitals",
    "/wards",
    "/telemedicine",
    "/messages",
    "/billing",
    "/documents",
    "/audit",
    "/team",
    "/import",
    "/trash",
  ]) {
    await page.goto(`${FE}${p}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(450);
    const slug = p.slice(1);
    await shot(page, `d-${slug}`);
    await measureOverflow(page, `desktop/${slug}`);
    await pageHealthy(page, `desktop/${slug}`);
  }

  const themeBtn = page.getByRole("button", { name: /theme|dark|light/i }).first();
  if (await themeBtn.isVisible().catch(() => false)) {
    await themeBtn.click();
    await page.waitForTimeout(400);
    await page.goto(`${FE}/dashboard`, { waitUntil: "networkidle" });
    await shot(page, "d-dark-dashboard");
    await checkDarkWhites(page, "desktop/dark");
  }

  if (consoleErrors.length) {
    find("medium", "desktop/console", `${consoleErrors.length} page errors`, {
      samples: [...new Set(consoleErrors)].slice(0, 8),
    });
  }

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await auditMobile(browser);
  await auditDesktop(browser);
} catch (e) {
  find("high", "runner", String(e.message || e));
  console.error(e);
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify(findings, null, 2));
const by = { high: 0, medium: 0, low: 0 };
for (const f of findings) by[f.severity] = (by[f.severity] || 0) + 1;
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify({ total: findings.length, by, findings }, null, 2));
