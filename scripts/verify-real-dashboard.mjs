/* Real-session check of Login → My Conferences dashboard → Profile → Logout against YOUR Supabase project.
 *
 * NOT purely read-only. Loading the dashboard calls the existing `claim_my_papers` RPC (the prototype does the same on
 * load): it links papers that list this account's email as a co-author to the account. If nothing lists the email, it
 * changes nothing. Use verify-real-readonly.mjs when even that is not acceptable.
 *
 * Uses an EXISTING account you provide (creates and deletes nothing):
 *   TEST_EMAIL=you@example.com TEST_PASSWORD=... APP_URL=http://localhost:3000 node scripts/verify-real-dashboard.mjs
 * Run the frontend first (`npm run dev`, supabase mode, .env.local filled in); Chrome required (CHROME_PATH overrides
 * the default Windows path). The password comes from the environment and is never printed.
 *
 * Side effects, all on that one account: a real sign-in/sign-out, the `claim_my_papers` call above, and (only for an
 * account whose `signup_pending` flag is still set) the one-time `applySignupDetails` write of its own profile rows. */
import puppeteer from "../../node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

const { TEST_EMAIL, TEST_PASSWORD } = process.env;
const APP = process.env.APP_URL || "http://localhost:3000";
if (!TEST_EMAIL || !TEST_PASSWORD) { console.error("Set TEST_EMAIL and TEST_PASSWORD."); process.exit(2); }

const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "  — " + detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.createBrowserContext();
const p = await ctx.newPage();
const path = () => new URL(p.url()).pathname + new URL(p.url()).search;
const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; };

try {
  await p.goto(`${APP}/dashboard`, { waitUntil: "networkidle0" });
  check("signed out: /dashboard redirects to /login", path() === "/login", path());

  await p.type("#login-email", TEST_EMAIL);
  await p.type("#login-password", "wrong-password-on-purpose");
  await p.click('button[type="submit"]');
  check("real Supabase rejects a wrong password with the friendly message", await waitFor(async () => /Wrong email or password\./.test(await text())));

  await p.$eval("#login-password", (e) => { e.focus(); e.select(); });
  await p.keyboard.press("Backspace");
  await p.type("#login-password", TEST_PASSWORD);
  await p.click('button[type="submit"]');
  check("real sign-in lands on /dashboard", await waitFor(async () => path() === "/dashboard"), path());
  const loaded = await waitFor(async () => /My Conferences/.test(await text()) && !/Loading/.test(await text()) && (await p.$$("tbody tr")).length + Number(/You have no conferences yet/.test(await text())) > 0);
  const t = await text();
  check("dashboard loads for the real session (rows or the empty state — not an error)", loaded && !/Couldn.t load your conferences/.test(t), t.slice(0, 200));
  const cookies = (await ctx.cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name));
  check("session is stored in cookies; no tokens in localStorage", cookies.length > 0 && await p.evaluate(() => !Object.keys(localStorage).some((k) => /^sb-|auth-token|supabase/i.test(k))));
  await p.reload({ waitUntil: "networkidle0" });
  check("reload keeps the real session", path() === "/dashboard");

  // Profile (read-only): a complete account reaches /profile, an incomplete one is sent to /complete-profile — never an error screen.
  await p.goto(`${APP}/profile`, { waitUntil: "networkidle0" });
  const profileOk = await waitFor(async () => /^\/(profile|complete-profile)/.test(path()) && !/Couldn.t load your profile/.test(await text()));
  check("real profile loads: /profile (complete account) or /complete-profile (incomplete), not an error", profileOk, path());
  check("real profile: header shows the account's own name or email (no placeholder)", await p.evaluate(() => /Account menu, signed in as \S+/.test(document.querySelector('header button[aria-label^="Account menu"]')?.getAttribute("aria-label") ?? "")));

  await p.click('button[aria-label^="Account menu"]');
  await p.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].find((b) => /Sign out/.test(b.textContent)).click());
  check("sign out returns to /login and clears the cookie", await waitFor(async () => path() === "/login") && (await ctx.cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name)).length === 0);
  await p.goto(`${APP}/dashboard`, { waitUntil: "networkidle0" });
  check("after sign out /dashboard is protected again", path() === "/login", path());
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed (REAL session, read-mostly)`);
process.exit(results.every(Boolean) ? 0 : 1);
