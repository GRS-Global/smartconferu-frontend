import { chromium } from "playwright";
import { PROTO, NEXT } from "./pages.mjs";

// Freeze everything that makes two screenshots of the same UI differ for non-design reasons.
const FREEZE_CSS = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}nextjs-portal{display:none!important}";

export async function newContext(browser, vp, auth = true) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  // Both apps derive "archived/active", "in N days" etc. from today's date: freeze it (must match gen-parity-fixtures.mjs FROZEN_NOW).
  await ctx.clock.setFixedTime(new Date("2026-11-03T10:00:00Z"));
  // The sign-in/register background is a remote stock photo; whether it has loaded when the screenshot is taken is network luck.
  // Block it in BOTH apps so they fall back to the same navy + scrim and the comparison is deterministic.
  await ctx.route(/images.pexels.com/, (r) => r.abort());
  // Prototype sign-in is a localStorage flag (src/shared/auth.js: grs_logged_in / grs_auth_mode).
  if (auth) await ctx.addInitScript(() => {
    try {
      localStorage.setItem("grs_logged_in", "true");
      localStorage.setItem("grs_auth_mode", "demo");
    } catch {}
  });
  return ctx;
}

export async function openStable(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready);
  // A page whose script has not rendered yet is a blank shell: wait until something is on screen (the Profile baseline of 0.3% was such a capture).
  await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 40, null, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(600);
}

export async function launch() {
  return chromium.launch();
}
export { PROTO, NEXT };
