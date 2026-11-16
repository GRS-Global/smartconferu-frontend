// Phase 3B: the paper's own Initial Check / Plagiarism Check pages, prototype vs Next.js on the same data. Local only; nothing is sent.
// Usage: node screening-detail-qa.mjs <label> -> out/phase3b/<label>/detail-results.json
import fs from "node:fs";
import path from "node:path";
import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const label = process.argv[2] || "run";
const OUT = path.resolve("out/phase3b", label);
fs.mkdirSync(OUT, { recursive: true });
const results = []; let same = 0, differ = 0;
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const check = (what, got) => { const ok = JSON.stringify(got.prototype) === JSON.stringify(got.next); ok ? same++ : differ++; results.push({ what, same: ok, ...got }); console.log(`${ok ? "SAME " : "DIFF "} ${what.padEnd(58)} ${ok ? JSON.stringify(got.prototype) : "P " + JSON.stringify(got.prototype) + "  N " + JSON.stringify(got.next)}`.slice(0, 380)); };
const browser = await launch();
async function both(route, fn) {
  const got = {};
  for (const [side, url] of [["prototype", PROTO + "/prototype" + route], ["next", NEXT_SCREEN + route]]) {
    const ctx = await newContext(browser, VIEWPORTS[0], true); const pg = await ctx.newPage();
    await openStable(pg, url);
    try { got[side] = await fn(pg); } catch (e) { got[side] = "ERROR " + String(e).slice(0, 100); }
    await ctx.close();
  }
  return got;
}
const text = (pg, sel) => pg.evaluate((s) => document.querySelector(s)?.textContent.replace(/\s+/g, " ").trim() ?? null, sel);
const section = (pg, title) => pg.evaluate((t) => { const h = [...document.querySelectorAll("h3")].find((x) => x.textContent.trim() === t); return h ? h.closest("section").textContent.replace(/\s+/g, " ").trim().slice(0, 420) : null; }, title);
const urlPath = (pg) => pg.url().replace(/^https?:\/\/[^/]+/, "").replace(/^\/prototype/, "");

const IC = "/chair/isbm2026/initial-check/ISBM-726", IC2 = "/chair/isbm2026/initial-check/ISBM-752", PL = "/chair/isbm2026/plagiarism/ISBM-750";
check("initial detail: page title (h1 / hero)", await both(IC, async (pg) => ({ h1: await text(pg, "h1"), hero: await text(pg, "section[aria-label='Initial check'] h1") })));
check("initial detail: nav text (Paper n of N) + Prev/Next enabled", await both(IC, async (pg) => ({ nav: (await pg.getByText(/Paper \d+ of \d+/).first().innerText()).replace(/\s+/g, " "), prev: await pg.getByRole("button", { name: /Prev/ }).isDisabled(), next: await pg.getByRole("button", { name: /Next/ }).isDisabled() })));
check("initial detail: Next goes to the next paper", await both(IC, async (pg) => { await pg.getByRole("button", { name: /Next/ }).click(); await pg.waitForURL((u) => /ISBM-735/.test(u.href), { timeout: 25000 }).catch(() => undefined); return urlPath(pg); }));
check("initial detail: Initial check card (rows)", await both(IC, (pg) => section(pg, "Initial check")));
check("initial detail: Decision card", await both(IC, (pg) => section(pg, "Decision")));
check("initial detail: Email card (nothing to send)", await both(IC, (pg) => section(pg, "Email to the author")));
check("initial detail: Requirements card", await both(IC, (pg) => section(pg, "Requirements")));
check("initial detail: Read from the PDF card", await both(IC, (pg) => section(pg, "Read from the PDF")));
check("initial detail: Versions card (V2 paper)", await both(IC2, (pg) => section(pg, "Versions")));
check("initial detail: toggle PDF editable -> card header + warning", await both(IC, async (pg) => { await pg.getByRole("switch", { name: "PDF Editable" }).click(); await pg.waitForTimeout(250); return { header: (await section(pg, "Initial check"))?.slice(0, 120), decision: await section(pg, "Decision") }; }));
check("initial detail: set Revision -> Email card says what to fix", await both(IC, async (pg) => { await pg.getByRole("switch", { name: "PDF Editable" }).click(); await pg.locator("section select").last().selectOption("revision"); await pg.waitForTimeout(300); return section(pg, "Email to the author"); }));
check("initial detail: Send Email opens a dialog", await both(IC, async (pg) => { await pg.getByRole("switch", { name: "PDF Editable" }).click(); await pg.locator("section select").last().selectOption("revision"); await pg.waitForTimeout(200); await pg.getByRole("button", { name: /^Send Email$/ }).click(); await pg.waitForTimeout(400); return await pg.evaluate(() => !!document.querySelector("dialog[open], [role=dialog]")); }));
check("initial detail: Submission details button navigates", await both(IC, async (pg) => { await pg.getByRole("button", { name: /Submission details/ }).click(); await pg.waitForURL((u) => /submissions|detail|paper/.test(u.href) && !/initial-check/.test(u.href), { timeout: 25000 }).catch(() => undefined); return /initial-check/.test(pg.url()) ? "stayed" : "navigated"; }));
check("initial detail: back button returns to the table", await both(IC, async (pg) => { await pg.getByRole("button", { name: /Initial Check/ }).first().click(); await pg.waitForURL((u) => /initial-check$/.test(u.pathname), { timeout: 25000 }).catch(() => undefined); return urlPath(pg); }));
check("initial detail: unknown paper -> message", await both("/chair/isbm2026/initial-check/NOPE-1", async (pg) => ({ h: (await text(pg, "h3, h2")) })));

check("plag detail: title + chips", await both(PL, async (pg) => ({ h1: await text(pg, "h1"), hero: await text(pg, "section[aria-label='Plagiarism check'] h1") })));
check("plag detail: nav text", await both(PL, async (pg) => (await pg.getByText(/Paper \d+ of \d+/).first().innerText()).replace(/\s+/g, " ")));
check("plag detail: Initial check card", await both(PL, async (pg) => (await section(pg, "Initial check"))?.replace(/Conference Chair · [A-Za-z]{3} \d+, \d{4}/, "<who>")));
check("plag detail: Report files card", await both(PL, (pg) => section(pg, "Report files")));
check("plag detail: Decision card", await both(PL, async (pg) => (await section(pg, "Decision"))?.replace(/Decided by Conference Chair · [A-Za-z]{3} \d+, \d{4}/, "<decided>")));
check("plag detail: Limits card", await both(PL, (pg) => section(pg, "Limits")));
check("plag detail: Versions card", await both(PL, (pg) => section(pg, "Versions")));
check("plag detail: decision menu options", await both(PL, (pg) => pg.evaluate(() => [...document.querySelector("section select").options].map((o) => o.textContent.trim()))));
check("plag detail: Initial check details link goes to the initial check page", await both(PL, async (pg) => { await pg.getByRole("button", { name: /Initial check details/ }).click(); await pg.waitForURL((u) => /initial-check\/ISBM/.test(u.href), { timeout: 25000 }).catch(() => undefined); return urlPath(pg); }));
check("plag detail: view / download buttons on the report file", await both(PL, async (pg) => ({ view: await pg.getByRole("button", { name: "View" }).count() > 0, dl: await pg.getByRole("button", { name: "Download" }).count() > 0 })));
check("plag detail: upload button when under the limit", await both(PL, (pg) => pg.evaluate(() => [...document.querySelectorAll("label")].map((l) => l.textContent.replace(/\s+/g, " ").trim()).find((t) => /another file|Upload report/.test(t)))));

await browser.close();
fs.writeFileSync(path.join(OUT, "detail-results.json"), JSON.stringify(results, null, 1));
console.log(`\nSAME ${same}  DIFF ${differ}`);
