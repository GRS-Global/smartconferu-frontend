/* Real-data verification of the Next.js dashboard against YOUR Supabase project.
 *
 * !! This WRITES to the database: it creates temporary, tagged records (3 users @example.com, 6
 * !! conferences "ZZD…", papers, reviews, invitations) with the SUPABASE_SERVICE_ROLE_KEY from the repo
 * !! root .env, drives the real UI in headless Chrome with a real session, then deletes everything it
 * !! created (same approach as ../../scripts/audit-sample-data.mjs). Run it only against a project where
 * !! that is acceptable.
 *
 * Needs: the frontend dev server running in supabase mode (default) — APP_URL=http://localhost:3000 —
 * and Chrome. From frontend/:  node scripts/verify-dashboard-realdata.mjs
 * Secrets are read from ../.env and never printed. */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
import puppeteer from "../../node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../../", import.meta.url)).replace(/[\\/]$/, "");
const env = Object.fromEntries(fs.readFileSync(`${ROOT}/.env`, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).trim()]));
const URL = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL || "http://localhost:3000";
import os from "node:os";
const OUT = os.tmpdir();

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const tag = `zzdash${String(Date.now()).slice(-7)}`;
const pw = "Tmp!" + Math.random().toString(36).slice(2) + "Aa1";
const made = { users: [], confs: [] };
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

async function mkUser(n, last) {
  const { data, error } = await admin.auth.admin.createUser({ email: `${tag}-${n}@example.com`, password: pw, email_confirm: true, user_metadata: { first_name: n, last_name: last } });
  if (error) throw error;
  made.users.push(data.user.id);
  return data.user.id;
}
async function mkConf(slug, acronym, createdBy, extra) {
  const row = must(await admin.from("conferences").insert({ slug: `${tag}${slug}`, acronym, title: `Temporary ${acronym}`, created_by: createdBy, status: "active", city: "Pune", country: "India", ...extra }).select("id").single(), `conference ${slug}`);
  made.confs.push(row.id);
  return row.id;
}
async function mkPaper(conf, submitter, fields) {
  const row = must(await admin.from("submissions").insert({ conference_id: conf, submitter_id: submitter, title: "Temp paper", abstract: "x", ...fields }).select("id, paper_no").single(), "submission");
  return row;
}

let browser;
try {
  const U = await mkUser("main", "Tester");   // the signed-in user
  const X = await mkUser("other", "Chair");   // chairs the other conferences
  await mkUser("fresh", "Empty");   // has nothing

  // C1: U chairs it, 5 papers (accept, registered, reject, undecided, withdrawn)
  const C1 = await mkConf("c1", "ZZD1 2027", U, { start_date: "2027-05-10", end_date: "2027-05-12", review_deadline: "2027-03-01T00:00:00Z" });
  for (const f of [{ outcome: "accept" }, { outcome: "registered" }, { outcome: "reject" }, { outcome: "upload_pending" }, { outcome: "no_decision", status: "withdrawn" }]) await mkPaper(C1, X, f);
  // C2: X chairs; U authors (accepted + told, plus a draft) and reviews (one submitted, one pending with a due date)
  const C2 = await mkConf("c2", "ZZD2 2026", X, { start_date: "2026-12-10", end_date: "2026-12-12", country: "United States", city: "Austin", review_deadline: "2026-11-15T00:00:00Z" });
  await mkPaper(C2, U, { outcome: "accept", notified_outcome: "accept" });
  await mkPaper(C2, U, { status: "draft" });
  const pR1 = await mkPaper(C2, X, {}); const pR2 = await mkPaper(C2, X, {});
  must(await admin.from("conference_members").insert({ conference_id: C2, user_id: U, role: "reviewer", status: "active" }), "member");
  const a1 = must(await admin.from("review_assignments").insert({ submission_id: pR1.id, reviewer_id: U, status: "submitted" }).select("id").single(), "assign1");
  must(await admin.from("review_assignments").insert({ submission_id: pR2.id, reviewer_id: U, status: "accepted", due_at: "2026-11-20T00:00:00Z" }), "assign2");
  must(await admin.from("reviews").insert({ assignment_id: a1.id, submission_id: pR1.id, reviewer_id: U, status: "submitted", score: 4, confidence: "high", recommendation: "accept" }), "review");
  // C3 and C5: pending committee invitations for U
  const C3 = await mkConf("c3", "ZZD3 2027", X, { start_date: "2027-08-01", end_date: "2027-08-03" });
  must(await admin.from("conference_members").insert({ conference_id: C3, user_id: U, role: "reviewer", status: "invited" }).select("id").single(), "invite3");
  const C5 = await mkConf("c5", "ZZD5 2027", X, { start_date: "2027-09-01", end_date: "2027-09-03" });
  must(await admin.from("conference_members").insert({ conference_id: C5, user_id: U, role: "reviewer", status: "invited" }).select("id").single(), "invite5");
  // C4: archived; U authored a registered paper
  const C4 = await mkConf("c4", "ZZD4 2025", X, { status: "archived", start_date: "2025-03-10", end_date: "2025-03-12" });
  await mkPaper(C4, U, { outcome: "registered", notified_outcome: "registered" });
  // a conference U has nothing to do with, to prove it never shows
  const C6 = await mkConf("c6", "ZZD6 2027", X, { start_date: "2027-10-01", end_date: "2027-10-02" });
  await mkPaper(C6, X, { outcome: "accept", notified_outcome: "accept" });

  // sessions
  const sessionFor = async (n) => {
    const c = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email: `${tag}-${n}@example.com`, password: pw });
    if (error) throw error;
    return data.session;
  };
  const sMain = await sessionFor("main"), sFresh = await sessionFor("fresh");
  const storageKey = `sb-${new URL(URL).hostname.split(".")[0]}-auth-token`;

  browser = await puppeteer.launch({ executablePath: (process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe"), headless: true });
  const open = async (session, path = "dashboard", { w = 1440, h = 900, block = false, delay = 0 } = {}) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.evaluate((k, s) => { localStorage.clear(); sessionStorage.clear(); if (s) localStorage.setItem(k, JSON.stringify(s)); }, storageKey, session);
    if (block || delay) {
      await page.setRequestInterception(true);
      page.on("request", async (req) => {
        if (!req.url().startsWith(URL)) return req.continue();
        if (block) return req.abort("failed");
        await sleep(delay); req.continue();
      });
    }
    await page.goto(`${APP}/${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    return page;
  };
  const text = (page) => page.evaluate(() => document.querySelector("main")?.innerText.replace(/\s+/g, " ") ?? "");
  const waitFor = async (page, pred, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(pred)) return true; await sleep(250); } return false; };

  /* ---- 1. no session → "sign in" state, never data ---- */
  let p = await open(null);
  check("no session: sign-in state", await waitFor(p, () => /Sign in to see your conferences/.test(document.body.innerText)));
  check("no session: no conference data shown", !/ZZD/.test(await text(p)));
  await p.close();

  /* ---- 2. loading state (responses delayed) ---- */
  p = await open(sMain, "dashboard", { delay: 2500 });
  check("loading: skeleton is shown while the request is in flight", await waitFor(p, () => !!document.querySelector('[role="status"][aria-label="Loading conferences"]'), 8000));
  await p.close();

  /* ---- 3. error state (network blocked) → retry control, no fake data ---- */
  p = await open(sMain, "dashboard", { block: true });
  check("error: shows a failure message and Try again", await waitFor(p, () => /Couldn.t load your conferences/.test(document.body.innerText) && !!([...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Try again")), 30000));
  check("error: no conference data shown", !/ZZD/.test(await text(p)));
  await p.close();

  /* ---- 4. empty account ---- */
  p = await open(sFresh);
  check("empty account: 'no conferences yet'", await waitFor(p, () => /You have no conferences yet/.test(document.body.innerText)));
  const emptyText = await text(p);
  check("empty account: no ZZD data and no sample names", !/ZZD|ISBM|ICTCS|ICICT/.test(emptyText));
  await p.screenshot({ path: `${OUT}/real-empty.png` });
  await p.close();

  /* ---- 5. real data ---- */
  p = await open(sMain);
  const ready = await waitFor(p, () => /ZZD1 2027/.test(document.body.innerText));
  check("real data: rows load", ready);
  await sleep(1800);
  const t = await text(p);
  const rowsText = await p.$$eval("tbody tr", (r) => r.map((x) => x.innerText.replace(/\s+/g, " ")));
  check("real data: exactly the 3 conferences with a role (C1, C2, C4)", rowsText.length === 3 && /ZZD1/.test(rowsText.join()) && /ZZD2/.test(rowsText.join()) && /ZZD4/.test(rowsText.join()), `${rowsText.length} rows`);
  check("real data: unrelated conference never shown", !/ZZD6/.test(t));
  check("real data: invitation conference (no role yet) is not a row", !/ZZD3 2027 Temporary/.test(rowsText.join()));
  const card = (name) => p.evaluate((n) => { const b = [...document.querySelectorAll("button[aria-pressed]")].find((x) => x.innerText.includes(n)); return b?.closest("div.flex.flex-col")?.innerText.replace(/\s+/g, " ") ?? ""; }, name);
  const chair = await card("As Chair"), author = await card("As Author"), reviewer = await card("As Reviewer");
  check("chair card: 1 conf, submissions 5, accepted 2, reject 1, no decision 1, withdrawn 1, registered 1", /1 conference.*Submissions 5 Accepted 2 Reject 1 No Decision 1 Withdrawn 1 Registered 1/.test(chair), chair.slice(0, 160));
  check("author card: 2 confs, submissions 2, pending 1, registered 1 (draft not counted)", /2 conferences.*Submissions 2 Accepted – Registration Pending 1 Registered 1 Not Accepted 0 Under Review 0/.test(author), author.slice(0, 200));
  check("reviewer card: 1 conf, assigned 2, reviewed 1, pending 1", /1 conference.*Papers assigned 2 Reviewed 1 Pending 1/.test(reviewer), reviewer.slice(0, 160));
  check("invitations: 2 pending shown", /Pending invitations\s*2/.test(t) && /ZZD3 2027/.test(t) && /ZZD5 2027/.test(t));
  check("committee card has no data (no tables)", /As Committee Member 0 conference/.test(await card("As Committee")) || /0 conferences/.test(await card("As Committee")));
  await p.screenshot({ path: `${OUT}/real-data.png`, fullPage: true });

  /* ---- 6. accept an invitation → RPC → role appears ---- */
  await p.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Accept")[0]?.click());
  await waitFor(p, () => !!document.querySelector("dialog[open]"));
  await p.evaluate(() => { const d = document.querySelector("dialog[open]"); d.querySelector('input[type="checkbox"]').click(); });
  await sleep(200);
  await p.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => /Join committee/.test(b.textContent))?.click());
  const joined = await waitFor(p, () => /You.re on the ZZD\d 2027 review committee/.test(document.body.innerText), 20000);
  check("accept: toast confirms", joined);
  const mem = must(await admin.from("conference_members").select("conference_id, status").eq("user_id", U).eq("role", "reviewer"), "members");
  const acceptedCount = mem.filter((m) => m.status === "active" && [C3, C5].includes(m.conference_id)).length;
  check("accept: database row is now active (RPC respond_to_invitation)", acceptedCount === 1);
  await sleep(1500);
  const rows2 = await p.$$eval("tbody tr", (r) => r.length);
  check("accept: dashboard reloads and the new conference becomes a row (4)", rows2 === 4, `${rows2} rows`);

  /* ---- 7. decline the other one with a reason ---- */
  await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Decline")?.click());
  await waitFor(p, () => !!document.querySelector("dialog[open] select"));
  await p.evaluate(() => { const s = document.querySelector("dialog[open] select"); s.value = "Outside my expertise"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await p.type("dialog[open] textarea", "not my area");
  await p.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => /Decline invitation/.test(b.textContent))?.click());
  await waitFor(p, () => /Invitation declined/.test(document.body.innerText), 20000);
  const mem2 = must(await admin.from("conference_members").select("status, decline_reason").eq("user_id", U).eq("role", "reviewer").eq("status", "declined"), "members2");
  check("decline: database row declined with the reason", mem2.length === 1 && /Outside my expertise — not my area/.test(mem2[0].decline_reason || ""), JSON.stringify(mem2));
  // History tab lists both answers
  await p.evaluate(() => [...document.querySelectorAll('[role="tab"]')].find((b) => /History/.test(b.textContent))?.click());
  await sleep(500);
  const hist = await text(p);
  check("History tab shows the accepted and the declined invitation", /Accepted/.test(hist) && /Declined/.test(hist) && /Outside my expertise/.test(hist));
  await p.screenshot({ path: `${OUT}/real-history.png` });

  /* ---- 8. variants render real data without errors ---- */
  for (const v of ["a", "b", "c"]) {
    const q = await open(sMain, `dashboard/${v}`);
    const ok = await waitFor(q, () => /ZZD/.test(document.body.innerText), 30000);
    check(`variant ${v}: renders real rows`, ok && q.errors.length === 0, q.errors.join("|").slice(0, 120));
    await q.screenshot({ path: `${OUT}/real-${v}.png` });
    await q.close();
  }
  check("no page errors on the main dashboard", p.errors.length === 0, p.errors.join("|").slice(0, 200));
  await p.close();
} catch (e) {
  console.error("SCRIPT ERROR:", e.message);
  results.push({ name: "script", ok: false, detail: e.message });
} finally {
  if (browser) await browser.close();
  // cleanup: conferences first (cascades to members, papers, reviews), then users
  for (const id of made.confs) await admin.from("conferences").delete().eq("id", id);
  for (const id of made.users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("conferences").select("id").like("slug", `${tag}%`);
  console.log(`cleanup: ${made.confs.length} conferences, ${made.users.length} users removed; leftover conferences: ${left.data?.length ?? "?"}`);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
