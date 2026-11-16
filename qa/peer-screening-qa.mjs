// Phase 3B task 2: Peer Review's Initial check / Plagiarism columns, linked filters and the "View report" popup, prototype vs Next.js on the same
// 498 papers. Reviewer / review data is not mirrored (see FIXTURES), so only the screening columns, filters and popup are compared.
// Usage: node peer-screening-qa.mjs <label> -> out/phase3b/<label>/peer-screening.json
import fs from "node:fs";
import path from "node:path";
import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const label = process.argv[2] || "run";
const OUT = path.resolve("out/phase3b", label);
fs.mkdirSync(OUT, { recursive: true });
const results = []; let same = 0, differ = 0;
const check = (what, got) => { const ok = JSON.stringify(got.prototype) === JSON.stringify(got.next); ok ? same++ : differ++; results.push({ what, same: ok, ...got }); console.log(`${ok ? "SAME " : "DIFF "} ${what.padEnd(58)} ${ok ? JSON.stringify(got.prototype) : "P " + JSON.stringify(got.prototype) + "  N " + JSON.stringify(got.next)}`.slice(0, 520)); };
const browser = await launch();
async function both(fn) {
  const got = {};
  for (const [side, url] of [["prototype", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]]) {
    const ctx = await newContext(browser, VIEWPORTS[0], true); const pg = await ctx.newPage();
    await openStable(pg, url);
    try { got[side] = await fn(pg); } catch (e) { got[side] = "ERROR " + String(e).slice(0, 120); }
    await ctx.close();
  }
  return got;
}
const headers = (pg) => pg.evaluate(() => [...document.querySelectorAll("thead th")].map((t) => t.innerText.split("\n")[0].trim()));
// text of the two screening cells for the rows in the page, found by their header position
const cells = (pg, count = 8) => pg.evaluate((c) => {
  const heads = [...document.querySelectorAll("thead th")].map((t) => t.innerText.split("\n")[0].trim());
  const ic = heads.indexOf("INITIAL CHECK") >= 0 ? heads.indexOf("INITIAL CHECK") : heads.findIndex((h) => /^initial check$/i.test(h));
  const pl = heads.findIndex((h) => /^plagiarism$/i.test(h));
  const idc = heads.findIndex((h) => /^id/i.test(h));
  return [...document.querySelectorAll("tbody tr")].slice(0, c).map((tr) => { const td = tr.querySelectorAll(":scope > td"); const t = (i) => (i >= 0 && td[i] ? td[i].innerText.replace(/\s+/g, " ").trim() : null); return [t(idc), t(ic), t(pl)]; });
}, count);
const byIdCells = async (pg) => { const rows = await cells(pg, 5000); const m = {}; for (const [id, a, b] of rows) m[id] = [a, b]; return m; };
const selectOptions = (pg, name) => pg.evaluate((n) => { const s = [...document.querySelectorAll("thead select")].find((x) => x.getAttribute("aria-label") === n); return s ? [...s.options].map((o) => o.textContent.trim() + (o.disabled ? " (off)" : "")) : null; }, name);
const rowCount = (pg) => pg.evaluate(() => document.querySelectorAll("tbody tr").length);
const filterBy = async (pg, name, value) => pg.locator(`thead select[aria-label="${name}"]`).selectOption(value);

check("column headings", await both(async (pg) => (await headers(pg)).filter((h) => /initial|plagiarism/i.test(h)).map((h) => h.toLowerCase())));
check("every row: initial + plagiarism cell by paper id (498)", await both((pg) => byIdCells(pg)));
check("initial check filter options (counts, disabled)", await both((pg) => selectOptions(pg, "Initial check")));
check("plagiarism filter options (counts, disabled)", await both((pg) => selectOptions(pg, "Plagiarism check")));
check("filter Initial = passed: rows + plagiarism options", await both(async (pg) => { await filterBy(pg, "Initial check", "passed"); await pg.waitForTimeout(300); return { rows: await rowCount(pg), plag: await selectOptions(pg, "Plagiarism check") }; }));
check("filter Plagiarism = waiting: rows + initial options", await both(async (pg) => { await filterBy(pg, "Plagiarism check", "waiting"); await pg.waitForTimeout(300); return { rows: await rowCount(pg), initial: await selectOptions(pg, "Initial check") }; }));
check("both filters (Passed + Plag Cleared): rows", await both(async (pg) => { await filterBy(pg, "Initial check", "passed"); await filterBy(pg, "Plagiarism check", "clear"); await pg.waitForTimeout(300); return { rows: await rowCount(pg), ids: (await cells(pg, 5000)).map((r) => r[0]).sort().slice(0, 3) }; }));
check("View report links: how many (all rows)", await both((pg) => pg.evaluate(() => [...document.querySelectorAll("tbody tr")].slice(0, 5000).reduce((n, tr) => n + [...tr.querySelectorAll("button")].filter((b) => b.textContent.trim() === "View report").length, 0))));
check("Open Initial check / Open Plagiarism links (all rows)", await both((pg) => pg.evaluate(() => { const t = [...document.querySelectorAll("tbody tr")].slice(0, 5000).flatMap((tr) => [...tr.querySelectorAll("button")].map((b) => b.textContent.trim())); return { ic: t.filter((x) => x === "Open Initial check").length, pl: t.filter((x) => x === "Open Plagiarism").length }; })));
check("View report -> popup title, sections, buttons", await both(async (pg) => {
  await pg.locator("tbody tr", { hasText: "ISBM-735" }).first().getByRole("button", { name: "View report" }).click(); await pg.waitForTimeout(400);
  return pg.evaluate(() => { const m = document.querySelector("[role=dialog]"); return m ? { title: m.querySelector("h3")?.textContent.trim(), sub: m.querySelector("h3 + p")?.textContent.trim(), sections: [...m.querySelectorAll("h4")].map((h) => h.textContent.trim()), buttons: [...m.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") || b.textContent).trim()).filter(Boolean) } : null; });
}));
check("View report -> popup text (who/when removed)", await both(async (pg) => {
  await pg.locator("tbody tr", { hasText: "ISBM-735" }).first().getByRole("button", { name: "View report" }).click(); await pg.waitForTimeout(400);
  return pg.evaluate(() => document.querySelector("[role=dialog]")?.textContent.replace(/\s+/g, " ").replace(/Conference Chair · [A-Za-z]{3} \d+, \d{4}/g, "<who>").trim().slice(0, 900));
}));
check("popup closes with Close / X / Escape", await both(async (pg) => {
  const out = [];
  for (const how of ["close", "x", "esc"]) {
    await pg.getByRole("button", { name: "View report" }).first().click(); await pg.waitForTimeout(250);
    if (how === "close") await pg.locator("[role=dialog]").getByRole("button", { name: "Close", exact: true }).last().click();
    else if (how === "x") await pg.locator("[role=dialog]").getByRole("button", { name: "Close", exact: true }).first().click();
    else await pg.keyboard.press("Escape");
    await pg.waitForTimeout(250); out.push(await pg.evaluate(() => !document.querySelector("[role=dialog]")));
  }
  return out;
}));
check("Open Initial check navigates", await both(async (pg) => { await pg.getByRole("button", { name: "Open Initial check" }).first().click(); await pg.waitForURL((u) => u.href.includes("initial-check"), { timeout: 25000 }).catch(() => undefined); return pg.url().replace(/^https?:\/\/[^/]+/, "").replace(/^\/prototype/, ""); }));
check("Clear filters resets both screening filters", await both(async (pg) => { await filterBy(pg, "Initial check", "passed"); await pg.getByRole("button", { name: /Clear filters|Show all papers/ }).first().click().catch(() => undefined); await pg.waitForTimeout(300); return pg.evaluate(() => [...document.querySelectorAll("thead select")].filter((s) => /initial|plagiarism/i.test(s.getAttribute("aria-label") || "")).map((s) => s.value)); }));

await browser.close();
fs.writeFileSync(path.join(OUT, "peer-screening.json"), JSON.stringify(results, null, 1));
console.log(`\nSAME ${same}  DIFF ${differ}`);
