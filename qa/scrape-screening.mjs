// Phase 3B: reads what the prototype's Initial Check page really shows (every paper, earlier versions expanded) so a Next.js mock-only
// fixture can show the same data. Read-only on the prototype. Usage: node scrape-screening.mjs  -> out/screening-initial.json
import fs from "node:fs";
import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const browser = await launch();
const ctx = await newContext(browser, VIEWPORTS[0], true);
const page = await ctx.newPage();
await openStable(page, PROTO + "/prototype/chair/isbm2026/initial-check");
// expand every paper that has earlier versions
await page.evaluate(async () => {
  for (const b of document.querySelectorAll("button[aria-label^='Show earlier versions']")) b.click();
});
await page.waitForTimeout(800);
await page.evaluate(() => { for (const b of document.querySelectorAll("button[aria-label^='Show earlier versions']")) b.click(); });
await page.waitForTimeout(600);
const rows = await page.evaluate(() => {
  const txt = (e) => (e?.textContent || "").replace(/\s+/g, " ").trim();
  const out = [];
  for (const tr of document.querySelectorAll("tbody tr")) {
    const td = tr.querySelectorAll(":scope > td");
    if (td.length < 10) continue;
    const latest = Boolean(td[0].querySelector("input[type=checkbox]")) || !/^rgb\(248, 250, 252\)/.test(getComputedStyle(tr).backgroundColor) && tr.style.background !== "var(--canvas)";
    const idBtn = td[1].querySelector("button[title^='Open this paper'], div.text-\\[13px\\]");
    const id = txt(td[1].querySelector(".text-\\[13px\\]"));
    const ver = txt(td[1].querySelector("span.rounded"));
    const earlier = txt(td[1]).match(/\+(\d+) earlier/);
    const title = txt(td[2].querySelector("button"));
    const dates = td[3].querySelectorAll("div");
    const switches = [...tr.querySelectorAll("button[role=switch]")].map((b) => b.getAttribute("aria-checked") === "true");
    const sel = td[6].querySelector("select");
    const pagesIn = td[7].querySelector("input");
    const decSel = td[8].querySelector("select");
    out.push({
      id, ver, earlier: earlier ? Number(earlier[1]) : 0, title, locked: Boolean(td[8].textContent.includes("In peer review")),
      submitted: txt(dates[0]), ago: txt(dates[1]),
      autoNote: txt(td[3]).replace(txt(dates[0]), "").replace(txt(dates[1]), "").trim(),
      editable: switches.length ? switches[0] : /^Yes/.test(txt(td[4])), english: switches.length ? switches[1] : /^Yes/.test(txt(td[5])),
      column: sel ? sel.value : /Double/.test(txt(td[6])) ? "double" : "single",
      pages: pagesIn ? pagesIn.value : txt(td[7]).replace(/[^0-9]/g, ""),
      decision: decSel ? decSel.value : null, decisionText: txt(td[8]), email: txt(td[9]), selectable: Boolean(td[0].querySelector("input")),
      verify: /Verify/.test(txt(td[4]) + txt(td[5]) + txt(td[6]) + txt(td[7])), autoSet: /Set automatically/.test(txt(td[8])),
    });
  }
  return out;
});
await browser.close();
fs.writeFileSync("out/screening-initial.json", JSON.stringify(rows, null, 1));
const latest = rows.filter((r) => r.selectable || /V\d+/.test(r.ver));
console.log("rows", rows.length, "with selectable", rows.filter((r) => r.selectable).length, "sample", JSON.stringify(rows[0]), JSON.stringify(rows[rows.length - 1]));
const dec = {}; for (const r of rows) dec[r.decision || "locked"] = (dec[r.decision || "locked"] || 0) + 1; console.log(dec);
console.log("emails:", [...new Set(rows.map((r) => r.email.replace(/\d+/g, "N")))].slice(0, 12));
console.log("autoNotes:", [...new Set(rows.map((r) => r.autoNote))].slice(0, 12));
