/* WRITE tests against YOUR Supabase project: change password and notification preference, each restored afterwards.
 *
 * !! DO NOT RUN until you have read the plan below and approved it. Without ALLOW_REAL_WRITES it only prints the plan
 * !! (a dry run) and exits; nothing is contacted.
 *
 * TARGET: one existing test account you own (TEST_EMAIL). No users are created or deleted. No other account or record
 * is touched. Use a throwaway test account, not a real person's.
 *
 * PLAN (what will be written, in order):
 *   W1  Password: Settings › Change password, TEST_PASSWORD → TEST_TEMP_PASSWORD (Auth `updateUser`), verify the new
 *       password signs in, then change it BACK to TEST_PASSWORD and verify again.
 *       Side effects: two password changes on that account; two re-authentication sign-ins (new sessions); if the project's
 *       Auth settings enable "password changed" notification emails, Supabase emails that address twice; other devices'
 *       sessions are not revoked by this app.
 *       Recovery if the script stops between the two changes: the account is left on TEST_TEMP_PASSWORD. Sign in with it
 *       and change it back in Settings, or use "Forgot password?" on /login (the reset page is in the prototype).
 *   W2  Notification preference: reads the current "Email me about activity" value, saves a different one, reloads and
 *       checks it persisted, then saves the original value back.
 *       Side effects: two writes to that account's \`profile_details.data\` (merge, other keys untouched) and its
 *       updated_at. If the key had never been saved, the account ends with notifyFrequency:"instant" explicitly stored
 *       (the same value the app already shows as its default).
 *   NOT INCLUDED (needs separate approval): profile photo upload. The \`public\` bucket allows uploading into the user's
 *   own folder but not overwriting or deleting, so a test file would stay there until someone with the service role
 *   removes it.
 *
 * RUN (only after approval):
 *   ALLOW_REAL_WRITES=I_UNDERSTAND_THESE_WRITES TEST_EMAIL=... TEST_PASSWORD=... TEST_TEMP_PASSWORD=... \
 *     APP_URL=http://localhost:3000 node scripts/verify-real-writes.mjs
 * Passwords come from the environment and are never printed. */
import puppeteer from "../../node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

const { TEST_EMAIL, TEST_PASSWORD, TEST_TEMP_PASSWORD, ALLOW_REAL_WRITES } = process.env;
const APP = process.env.APP_URL || "http://localhost:3000";

console.log(`Plan: on ${TEST_EMAIL || "<TEST_EMAIL>"} via ${APP} — W1 password change and restore; W2 notification preference change and restore. See the header of this file for side effects and recovery.`);
if (ALLOW_REAL_WRITES !== "I_UNDERSTAND_THESE_WRITES") {
  console.log("Dry run: ALLOW_REAL_WRITES is not set, so nothing was contacted or changed.");
  process.exit(0);
}
if (!TEST_EMAIL || !TEST_PASSWORD || !TEST_TEMP_PASSWORD || TEST_TEMP_PASSWORD === TEST_PASSWORD || TEST_TEMP_PASSWORD.length < 8) {
  console.error("Set TEST_EMAIL, TEST_PASSWORD and a different TEST_TEMP_PASSWORD (8+ characters).");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => { results.push(Boolean(ok)); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "  — " + detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let leftOnTemp = false;

const text = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; };
const setVal = async (p, sel, v) => { await p.waitForSelector(sel); await p.$eval(sel, (e) => { e.focus(); e.select?.(); }); await p.keyboard.press("Backspace"); await p.type(sel, v); };

async function signIn(pw) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.goto(`${APP}/login?next=%2Fsettings`, { waitUntil: "networkidle0" });
  await setVal(p, "#login-email", TEST_EMAIL); await setVal(p, "#login-password", pw);
  await p.click('button[type="submit"]');
  const ok = await waitFor(async () => new URL(p.url()).pathname === "/settings");
  return { ctx, p, ok };
}
async function changePassword(p, from, to) {
  await p.waitForSelector("#pw-current");
  await setVal(p, "#pw-current", from); await setVal(p, "#pw-new", to); await setVal(p, "#pw-again", to);
  await p.click("#pw-title ~ form button[type=submit]");
  return waitFor(async () => /Password updated\./.test(await text(p)), 30000);
}

try {
  /* W1 */
  let s = await signIn(TEST_PASSWORD);
  check("W1 start: signed in with the current password", s.ok);
  const changed = await changePassword(s.p, TEST_PASSWORD, TEST_TEMP_PASSWORD);
  leftOnTemp = changed;
  check("W1: change to the temporary password reports success (Auth applied it)", changed);
  await s.ctx.close();
  s = await signIn(TEST_TEMP_PASSWORD);
  check("W1: the temporary password signs in", s.ok);
  const restored = await changePassword(s.p, TEST_TEMP_PASSWORD, TEST_PASSWORD);
  if (restored) leftOnTemp = false;
  check("W1: change back to the original password reports success", restored);
  await s.ctx.close();
  s = await signIn(TEST_PASSWORD);
  check("W1 end: the original password signs in again", s.ok);

  /* W2 */
  const { p } = s;
  await p.waitForSelector("#notify-frequency");
  const original = await p.$eval("#notify-frequency", (e) => e.value);
  const other = original === "weekly" ? "daily" : "weekly";
  const save = async (value) => {
    await p.select("#notify-frequency", value);
    await p.evaluate(() => document.querySelector("#notify-title").closest("section").querySelector('button[type="submit"]').click());
    return waitFor(async () => /Saved/.test(await text(p)), 20000);
  };
  check("W2: saving a different frequency reports 'Saved'", await save(other));
  await p.reload({ waitUntil: "networkidle0" });
  check("W2: after reload the new frequency is what the server returns", await p.$eval("#notify-frequency", (e) => e.value) === other);
  check("W2: restoring the original frequency reports 'Saved'", await save(original));
  await p.reload({ waitUntil: "networkidle0" });
  check("W2 end: the original frequency is back", await p.$eval("#notify-frequency", (e) => e.value) === original);
  await s.ctx.close();
} finally {
  if (leftOnTemp) console.error("\n!! The account may still be on TEST_TEMP_PASSWORD. Sign in with it and change it back in Settings, or use Forgot password? on /login.");
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed (REAL project, WRITES performed)`);
process.exit(results.every(Boolean) ? 0 : 1);
