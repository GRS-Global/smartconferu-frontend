/* READ-ONLY real-session check of Login → Profile / Settings pages → Logout against YOUR Supabase project.
 *
 * Uses an EXISTING account you provide. It creates no users, changes no password, saves no form, uploads nothing:
 *   TEST_EMAIL=you@example.com TEST_PASSWORD=... APP_URL=http://localhost:3000 node scripts/verify-real-readonly.mjs
 * Run the frontend first (`npm run dev` or `npm run build && npm start`, supabase mode, .env.local filled in); Chrome
 * required (CHROME_PATH overrides the default Windows path). The password comes from the environment and is never printed.
 *
 * Everything this script does on the project, exactly:
 *   PRE-FLIGHT (supabase-js, anon key, no browser):
 *     1. two anonymous SELECTs (`profiles`, `profile_details`, limit 1): RLS must return nothing to a signed-out client;
 *     2. one sign-in with TEST_EMAIL / TEST_PASSWORD (Supabase Auth records the session and last_sign_in_at);
 *     3. reads the account's own metadata flag `signup_pending` and its own `profiles` / `profile_details` rows (SELECTs);
 *     4. one sign-out of that session (local scope).
 *     If `signup_pending` is set the script STOPS here (exit 3) and never opens the app: that account's first profile load
 *     would run `applySignupDetails`, which WRITES its own profile rows and metadata once, as the prototype does. To run
 *     anyway, set ALLOW_SIGNUP_APPLY=I_UNDERSTAND_THIS_WRITES_MY_OWN_PROFILE.
 *   BROWSER (the app, real session):
 *     one wrong-password sign-in attempt (rejected, writes nothing), one real sign-in, the Profile and Settings pages
 *     (SELECTs only), one sign-out. Token refresh by the proxy is Supabase-Auth-internal. It deliberately does NOT open
 *     the dashboard: that calls the existing `claim_my_papers` RPC, which can link papers to the account
 *     (see verify-real-dashboard.mjs). No form is submitted, no photo is uploaded.
 *
 * Checks: anonymous RLS, real sign-in, session in cookies (not localStorage), route protection, the profile gate matches the
 * stored data, the Profile page shows the account's own name / institution, the account menu shows its name and email,
 * Settings renders (forms NOT submitted), reload keeps the session, sign-out clears it and protects routes again. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "../../node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

// Project URL / anon key: from the environment, else frontend/.env.local (never printed).
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env.local: the environment must provide them */ }

const { TEST_EMAIL, TEST_PASSWORD, NEXT_PUBLIC_SUPABASE_URL: SB_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: SB_KEY } = process.env;
const APP = process.env.APP_URL || "http://localhost:3000";
if (!TEST_EMAIL || !TEST_PASSWORD) { console.error("Set TEST_EMAIL and TEST_PASSWORD."); process.exit(2); }
if (!SB_URL || !SB_KEY) { console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (environment or frontend/.env.local)."); process.exit(2); }

const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "  — " + detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- pre-flight (no browser) ---------------- */
const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = await Promise.all(["profiles", "profile_details"].map((t) => db.from(t).select("*").limit(1)));
check("anonymous (signed-out) client reads no profile rows (RLS)", anon.every((r) => r.error || (r.data ?? []).length === 0), anon.map((r) => r.error?.message ?? `${(r.data ?? []).length} rows`).join(" | "));

const signIn = await db.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
check("real sign-in with the supplied account works", !signIn.error, signIn.error?.message);
if (signIn.error) { console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed (REAL session, read-only)`); process.exit(1); }
const user = signIn.data.user;
const pending = user.user_metadata?.signup_pending === true;
if (pending && process.env.ALLOW_SIGNUP_APPLY !== "I_UNDERSTAND_THIS_WRITES_MY_OWN_PROFILE") {
  await db.auth.signOut({ scope: "local" });
  console.log("\nSTOPPED before opening the app: this account still has signup_pending set, so its first profile load would run");
  console.log("applySignupDetails and WRITE its own profiles / profile_details rows and metadata. Nothing was written.");
  console.log("Sign in to the prototype once with it (which clears the flag), or set ALLOW_SIGNUP_APPLY=I_UNDERSTAND_THIS_WRITES_MY_OWN_PROFILE.");
  process.exit(3);
}
const [{ data: row, error: rowError }, { data: details, error: detailsError }] = await Promise.all([
  db.from("profiles").select("id, email, first_name, last_name, designation, affiliation, country").eq("id", user.id).single(),
  db.from("profile_details").select("data").eq("user_id", user.id).maybeSingle(),
]);
check("the account's own profile rows are readable (no permission error)", !rowError && !detailsError, rowError?.message ?? detailsError?.message);
await db.auth.signOut({ scope: "local" });
if (rowError) { console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed (REAL session, read-only)`); process.exit(1); }
const d = details?.data ?? {};
const expectComplete = [row.first_name, row.last_name, row.email, row.affiliation, row.designation, row.country, d.gender].every((v) => String(v ?? "").trim());
const fullName = `${row.first_name} ${row.last_name}`.trim();
console.log(`      (expected from the stored data: profile ${expectComplete ? "complete → /settings" : "incomplete → /complete-profile"})`);

/* ---------------- browser ---------------- */
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.createBrowserContext();
const p = await ctx.newPage();
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(String(e)));
const path = () => new URL(p.url()).pathname + new URL(p.url()).search;
const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; };
const authCookies = async () => (await ctx.cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name));

try {
  await p.goto(`${APP}/settings`, { waitUntil: "networkidle0" });
  check("signed out: /settings redirects to /login?next=/settings", path() === "/login?next=%2Fsettings", path());

  await p.type("#login-email", TEST_EMAIL);
  await p.type("#login-password", "wrong-password-on-purpose");
  await p.click('button[type="submit"]');
  check("a wrong password gets the friendly message", await waitFor(async () => /Wrong email or password\./.test(await text())));

  await p.$eval("#login-password", (e) => { e.focus(); e.select(); });
  await p.keyboard.press("Backspace");
  await p.type("#login-password", TEST_PASSWORD);
  await p.click('button[type="submit"]');
  const landed = await waitFor(async () => /^\/(settings|complete-profile)/.test(path()));
  check("real sign-in returns to /settings (or /complete-profile when the profile is incomplete)", landed, path());
  const complete = path().startsWith("/settings");
  check("the profile gate agrees with the stored data (complete → /settings, incomplete → /complete-profile)", complete === expectComplete, `stored says ${expectComplete ? "complete" : "incomplete"}, app went to ${path()}`);

  check("session is in cookies; no tokens in localStorage", (await authCookies()).length > 0 && await p.evaluate(() => !Object.keys(localStorage).some((k) => /^sb-|auth-token|supabase/i.test(k))));

  if (complete) {
    check("Settings page renders for the real account (forms are not submitted)", await waitFor(async () => /Change password/.test(await text()) && !!(await p.$("#pw-current"))));
    check("Settings shows the stored notification preference (not an error)", await p.$eval("#notify-frequency", (e) => ["instant", "daily", "weekly", "off"].includes(e.value)).catch(() => false));
    await p.goto(`${APP}/profile`, { waitUntil: "networkidle0" });
    check("Profile page loads the account's own data (not an error state)", await waitFor(async () => !!(await p.$("#sec-about")) && !/Couldn.t load your profile/.test(await text())));
    check("Profile header shows the stored name", fullName !== "" && (await p.$eval("h1", (e) => e.innerText.replace(/\s+/g, " ").trim()).catch(() => "")).includes(fullName), fullName ? "" : "no name stored");
    if (row.affiliation) check("Profile shows the stored institution", (await text()).includes(row.affiliation));
    check("Profile has no horizontal overflow", await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await p.click('header button[aria-label^="Account menu"]').catch(() => null);
    check("account menu shows the account's name and email", await waitFor(async () => { const t = await p.evaluate(() => document.querySelector('[role="menu"]')?.innerText ?? ""); return t.includes(row.email) && t.includes(row.first_name); }, 5000));
    await p.keyboard.press("Escape");
  }
  await p.reload({ waitUntil: "networkidle0" });
  check("reload keeps the real session", /^\/(profile|settings|complete-profile)/.test(path()), path());
  check("no uncaught page errors during the run", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));

  await p.click('header button[aria-label^="Account menu"]').catch(() => null);
  await p.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].find((b) => /Sign out/.test(b.textContent))?.click());
  check("sign out returns to /login and clears the cookie", await waitFor(async () => path() === "/login") && (await authCookies()).length === 0);
  await p.goto(`${APP}/settings`, { waitUntil: "networkidle0" });
  check("after sign out /settings is protected again", path() === "/login?next=%2Fsettings", path());
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed (REAL session, read-only)`);
process.exit(results.every(Boolean) ? 0 : 1);
