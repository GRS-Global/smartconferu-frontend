// Phase 3B: Screening module functional QA. Runs the same interaction on the prototype and on Next.js (mock data identical, see
// gen-screening-fixtures.mjs) in fresh browser contexts and compares what each shows. Local only: nothing is sent, no backend contacted.
// Usage: node screening-qa.mjs <label>  -> out/phase3b/<label>/results.json
import fs from "node:fs";
import path from "node:path";
import { PAGES, VIEWPORTS, PROTO, NEXT_SCREEN } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const label = process.argv[2] || "run";
const OUT = path.resolve("out/phase3b", label);
fs.mkdirSync(OUT, { recursive: true });
const results = [];
let same = 0, differ = 0;
const check = (area, what, got) => {
  const ok = JSON.stringify(got.prototype) === JSON.stringify(got.next);
  ok ? same++ : differ++;
  results.push({ area, what, same: ok, prototype: got.prototype, next: got.next });
  console.log(`${ok ? "SAME " : "DIFF "} ${area.padEnd(10)} ${what.padEnd(52)} ${ok ? JSON.stringify(got.prototype) : "P " + JSON.stringify(got.prototype) + "  N " + JSON.stringify(got.next)}`.slice(0, 330));
};
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const browser = await launch();
const VP = VIEWPORTS[0];

async function both(pageId, fn) {
  const page = PAGES.find((p) => p.id === pageId);
  const got = {};
  for (const [side, url] of [["prototype", PROTO + page.proto], ["next", NEXT_SCREEN + page.next]]) {
    const ctx = await newContext(browser, VP, true); const pg = await ctx.newPage();
    await openStable(pg, url);
    try { got[side] = await fn(pg, side); } catch (e) { got[side] = "ERROR " + String(e).slice(0, 100); }
    await ctx.close();
  }
  return got;
}
const chips = (pg) => pg.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /\d+$/.test(b.textContent.trim()) && b.className.includes("rounded-full") && b.className.includes("h-7")).map((b) => b.textContent.replace(/\s+/g, " ").trim()));
const rowIds = (pg, max = 6) => pg.evaluate((m) => [...document.querySelectorAll("tbody tr")].map((tr) => (tr.querySelector("td:nth-child(2) .text-\\[13px\\]") || tr.querySelector("td:nth-child(2) button"))?.textContent.trim()).filter(Boolean).slice(0, m), max);
const rowCount = (pg) => pg.evaluate(() => document.querySelectorAll("tbody tr").length);
const bodyText = (pg, sel) => pg.evaluate((s) => document.querySelector(s)?.textContent.replace(/\s+/g, " ").trim() ?? null, sel);
const modalText = (pg) => pg.evaluate(() => { const m = document.querySelector("[role=dialog]"); return m ? { title: m.querySelector("h3")?.textContent.trim(), text: m.textContent.replace(/\s+/g, " ").trim().slice(0, 700), buttons: [...m.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") || b.textContent).trim()).filter(Boolean) } : null; });
const firstEditableRow = (pg) => pg.locator("tbody tr").filter({ has: pg.locator("input[type=checkbox]") }).first();

for (const [pageId, area] of [["screen-initial", "initial"], ["screen-plag", "plag"]]) {
  check(area, "summary chips (labels and counts)", await both(pageId, chips));
  check(area, "first rows (order)", await both(pageId, (pg) => rowIds(pg, 6)));
  check(area, "sort ID: 1st click (highest first) rows", await both(pageId, async (pg) => { await pg.getByRole("button", { name: "Sort by ID" }).click(); return rowIds(pg); }));
  check(area, "sort ID: 2nd click (lowest first) rows", await both(pageId, async (pg) => { const b = pg.getByRole("button", { name: "Sort by ID" }); await b.click(); await b.click(); return rowIds(pg); }));
  check(area, "sort ID: 3rd click restores the order", await both(pageId, async (pg) => { const b = pg.getByRole("button", { name: "Sort by ID" }); await b.click(); await b.click(); await b.click(); return rowIds(pg); }));
  check(area, "chip: click the 2nd decision chip -> rows + chips", await both(pageId, async (pg) => { const c = await chips(pg); await pg.getByRole("button", { name: new RegExp("^" + c[1].replace(/\d+$/, "").trim()) }).first().click(); return { rows: await rowCount(pg), ids: await rowIds(pg, 3), chips: await chips(pg) }; }));
  check(area, "filter: Submitted = Last 7 days (row count)", await both(pageId, async (pg) => { await pg.locator("thead select").nth(0).selectOption("week").catch(() => undefined); const o = await pg.locator("thead select").nth(0).inputValue(); return { value: o, rows: await rowCount(pg) }; }));
  check(area, "filter: search ID 'ISBM-75' (rows)", await both(pageId, async (pg) => { await pg.getByPlaceholder("Search ID").fill("ISBM-75"); return { rows: await rowCount(pg), ids: await rowIds(pg, 4) }; }));
  check(area, "filter: no match -> empty text", await both(pageId, async (pg) => { await pg.getByPlaceholder("Search title").fill("zzzz-nothing"); return bodyText(pg, "table + div, tbody + div"); }));
  check(area, "clear filters button appears", await both(pageId, async (pg) => { await pg.getByPlaceholder("Search ID").fill("ISBM-75"); return (await pg.getByRole("button", { name: /Clear filters/ }).count()) > 0; }));
  check(area, "header info tooltip (hover 'Submitted')", await both(pageId, async (pg) => { await pg.locator("thead [aria-label='About Submitted']").hover(); return pg.evaluate(() => document.querySelector("[role=tooltip]:not([hidden])")?.textContent.trim().slice(0, 80)); }));
  check(area, "select all -> bar text + buttons", await both(pageId, async (pg) => { await pg.locator("thead input[type=checkbox]").first().check(); return pg.evaluate(() => { const bar = [...document.querySelectorAll("div")].find((d) => /selected/.test(d.textContent) && d.className.includes("rounded-xl") && getComputedStyle(d).backgroundColor === "rgb(11, 16, 32)"); return bar ? [...bar.querySelectorAll("button")].map((b) => b.textContent.trim()).filter(Boolean) : null; }); }));
  check(area, "select all -> count text ('N selected')", await both(pageId, async (pg) => { await pg.locator("thead input[type=checkbox]").first().check(); return pg.evaluate(() => (document.body.textContent.match(/(\d+) selected/) || [])[0]); }));
  check(area, "select 1 row -> header checkbox indeterminate", await both(pageId, async (pg) => { await firstEditableRow(pg).locator("input[type=checkbox]").first().click(); return pg.evaluate(() => document.querySelector("thead input[type=checkbox]").indeterminate); }));
  check(area, "shift-click range selects the rows between", await both(pageId, async (pg) => { const boxes = pg.locator("tbody tr input[type=checkbox]"); await boxes.nth(0).click(); await boxes.nth(3).click({ modifiers: ["Shift"] }); return pg.evaluate(() => (document.body.textContent.match(/(\d+) selected/) || [])[0]); }));
  check(area, "bulk: pick last decision -> confirm modal", await both(pageId, async (pg) => { await firstEditableRow(pg).locator("input[type=checkbox]").first().click(); const bar = pg.locator("div").filter({ hasText: /Set decision:/ }).last(); const btns = bar.locator("button"); await btns.nth(await btns.count() - 3).click().catch(() => undefined); return modalText(pg); }));
}

// ---- Initial check row actions
check("initial", "row: toggle PDF Editable switch (aria-checked)", await both("screen-initial", async (pg) => { const row = firstEditableRow(pg); const sw = row.locator("button[role=switch]").first(); const before = await sw.getAttribute("aria-checked"); await sw.click(); return { before, after: await sw.getAttribute("aria-checked") }; }));
check("initial", "row: set decision Revision -> warning under select", await both("screen-initial", async (pg) => { const row = firstEditableRow(pg); await row.locator("select").nth(1).selectOption("revision"); await pg.waitForTimeout(200); return norm(await row.locator("td").nth(8).innerText()); }));
check("initial", "row: set decision Passed with failing check -> warning", await both("screen-initial", async (pg) => { const row = pg.locator("tbody tr").filter({ has: pg.locator("input[type=checkbox]") }).filter({ hasText: /Too (short|long)/ }).first(); if (!(await row.count())) return "no such row"; await row.locator("select").nth(1).selectOption("passed"); await pg.waitForTimeout(200); return norm(await row.locator("td").nth(8).innerText()); }));
check("initial", "row: change decision while a filter is on -> moved note + refresh button", await both("screen-initial", async (pg) => { await pg.locator("thead select").nth(5).selectOption("reject"); await pg.waitForTimeout(200); const row = firstEditableRow(pg); await row.locator("select").nth(1).selectOption("hold"); await pg.waitForTimeout(300); return { moved: norm(await row.locator("td").nth(8).innerText()), refresh: (await pg.getByRole("button", { name: /Refresh list/ }).count()) > 0, rows: await rowCount(pg) }; }));
check("initial", "row: expand earlier versions -> rows + labels", await both("screen-initial", async (pg) => { const before = await rowCount(pg); await pg.locator("button[aria-label^='Show earlier versions']").first().click(); const after = await rowCount(pg); return { delta: after - before, label: await pg.locator("button[aria-label^='Hide earlier versions']").count() }; }));
check("initial", "row: click row body toggles earlier versions", await both("screen-initial", async (pg) => { const row = pg.locator("tbody tr").filter({ has: pg.locator("button[aria-label^='Show earlier versions']") }).first(); const before = await rowCount(pg); await row.locator("td").nth(3).click(); return (await rowCount(pg)) - before; }));
check("initial", "row: Send Email on a Revision row -> opens an email dialog", await both("screen-initial", async (pg) => { await pg.locator("thead select").nth(5).selectOption("revision"); await pg.waitForTimeout(200); const btn = pg.getByRole("button", { name: /^Send Email$/ }).first(); if (!(await btn.count())) return "none"; await btn.click(); await pg.waitForTimeout(300); const m = await modalText(pg); return { open: !!m, title: m?.title ?? null }; }));
check("initial", "decision menu options", await both("screen-initial", async (pg) => pg.evaluate(() => { const s = [...document.querySelectorAll("tbody tr select")][1]; return [...s.options].map((o) => o.textContent.trim()); })));
check("initial", "Paper Layout hint + page hint under controls (first row)", await both("screen-initial", async (pg) => norm(await firstEditableRow(pg).locator("td").nth(6).innerText() + " | " + await firstEditableRow(pg).locator("td").nth(7).innerText())));
check("initial", "PDF view/download + Check details links exist (first row)", await both("screen-initial", async (pg) => { const r = firstEditableRow(pg); return { view: await r.getByRole("button", { name: /View PDF/ }).count(), dl: await r.getByRole("button", { name: /Download paper/ }).count(), details: await r.getByRole("button", { name: /Check details/ }).count() }; }));
check("initial", "title click navigates to the submission details", await both("screen-initial", async (pg) => { await firstEditableRow(pg).locator("td").nth(2).locator("button").first().click(); await pg.waitForURL((u) => u.href.includes("/submissions") || u.href.includes("/detail") || u.href.includes("/paper"), { timeout: 25000 }).catch(() => undefined); return /submission|\/chair\/.*\/(detail|paper)|\/submissions\//.test(pg.url()) ? "navigated" : pg.url().replace(/^https?:\/\/[^/]+/, ""); }));
check("initial", "Check details navigates to the paper's initial check page", await both("screen-initial", async (pg) => { await firstEditableRow(pg).getByRole("button", { name: /Check details/ }).click(); await pg.waitForURL((u) => /ISBM-/.test(u.href), { timeout: 25000 }).catch(() => undefined); await pg.waitForTimeout(1500); return { url: pg.url().replace(/^https?:\/\/[^/]+/, "").replace(/^\/prototype/, ""), h1: norm(await pg.locator("h1").first().innerText().catch(() => "")) }; }));
check("initial", "Screening Settings button link", await both("screen-initial", async (pg) => { await pg.getByText("Screening Settings").first().click(); await pg.waitForURL((u) => u.href.includes("/settings"), { timeout: 25000 }).catch(() => undefined); return pg.url().replace(/^https?:\/\/[^/]+/, "").replace(/^\/prototype/, ""); }));

// ---- Plagiarism row actions
check("plag", "row: Initial Check chip opens the report modal", await both("screen-plag", async (pg) => { await firstEditableRow(pg).getByRole("button", { name: /Passed|Waiting/ }).first().click(); await pg.waitForTimeout(250); return modalText(pg); }));
check("plag", "row: decision menu options", await both("screen-plag", async (pg) => pg.evaluate(() => { const s = [...document.querySelectorAll("tbody tr select")][0]; return [...s.options].map((o) => o.textContent.trim()); })));
check("plag", "row: set Revision with no report -> warning", await both("screen-plag", async (pg) => { const row = pg.locator("tbody tr").filter({ has: pg.locator("input[type=checkbox]") }).filter({ hasText: /Upload report/ }).filter({ hasNotText: /\.pdf/ }).first(); await row.locator("select").first().selectOption("revision"); await pg.waitForTimeout(200); return norm(await row.locator("td").nth(6).innerText()); }));
check("plag", "row: upload button label (0 files vs 1 file)", await both("screen-plag", async (pg) => pg.evaluate(() => [...document.querySelectorAll("tbody tr label")].map((l) => l.textContent.replace(/\s+/g, " ").trim()).filter((t) => /report|another/i.test(t)).slice(0, 2))));
check("plag", "ZIP button present in the bulk bar", await both("screen-plag", async (pg) => { await firstEditableRow(pg).locator("input[type=checkbox]").first().click(); return (await pg.getByRole("button", { name: /Download for iThenticate/ }).count()) > 0; }));
check("plag", "'Not passed initial check' chip toggles a section row", await both("screen-plag", async (pg) => { const before = await rowCount(pg); await pg.getByRole("button", { name: /Not passed initial check/ }).first().click(); await pg.waitForTimeout(300); return { delta: (await rowCount(pg)) - before, text: norm(await pg.locator("tbody tr").last().innerText()).slice(0, 60) }; }));
check("plag", "Check details navigates to the paper's plagiarism check page", await both("screen-plag", async (pg) => { await firstEditableRow(pg).getByRole("button", { name: /Check details/ }).click(); await pg.waitForURL((u) => /ISBM-/.test(u.href), { timeout: 25000 }).catch(() => undefined); await pg.waitForTimeout(1500); return { url: pg.url().replace(/^https?:\/\/[^/]+/, "").replace(/^\/prototype/, ""), h1: norm(await pg.locator("h1").first().innerText().catch(() => "")) }; }));

await browser.close();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(`\nSAME ${same}  DIFF ${differ}  -> ${path.join(OUT, "results.json")}`);
