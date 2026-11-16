// Phase 3B: reads what the prototype's Plagiarism Check page really shows (every paper, earlier versions expanded). Read-only.
// Usage: node scrape-plagiarism.mjs  -> out/screening-plag.json
import fs from "node:fs";
import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const browser = await launch();
const ctx = await newContext(browser, VIEWPORTS[0], true);
const page = await ctx.newPage();
await openStable(page, PROTO + "/prototype/chair/isbm2026/plagiarism");
for (let i = 0; i < 2; i++) { await page.evaluate(() => { for (const b of document.querySelectorAll("button[aria-label^='Show earlier versions']")) b.click(); }); await page.waitForTimeout(700); }
const rows = await page.evaluate(() => {
  const txt = (e) => (e?.textContent || "").replace(/\s+/g, " ").trim();
  const out = [];
  for (const tr of document.querySelectorAll("tbody tr")) {
    const td = tr.querySelectorAll(":scope > td");
    if (td.length < 8) continue;
    const decSel = td[6].querySelector("select");
    out.push({
      id: txt(td[1].querySelector(".text-\\[13px\\]")), ver: txt(td[1].querySelector("span.rounded")), earlier: Number((txt(td[1]).match(/\+(\d+) earlier/) || [0, 0])[1]),
      title: txt(td[2].querySelector("button")), submitted: txt(td[3]), initial: txt(td[4]),
      files: [...td[5].querySelectorAll("button[title^='Download ']")].map((b) => b.getAttribute("title").replace(/^Download /, "")),
      decision: decSel ? decSel.value : null, decisionText: txt(td[6]), email: txt(td[7]), selectable: Boolean(td[0].querySelector("input")), locked: /In peer review/.test(txt(td[6])), latest: Boolean(td[2].querySelector("button + div + button, button[title^='Everything']")),
      waitingText: td[4].nextElementSibling && td[4].nextElementSibling.colSpan === 3 ? txt(td[4].nextElementSibling) : "",
    });
  }
  return out;
});
await browser.close();
fs.writeFileSync("out/screening-plag.json", JSON.stringify(rows, null, 1));
const dec = {}; for (const r of rows) dec[r.decision || (r.waitingText ? "waiting" : "text:" + r.decisionText.slice(0, 14))] = (dec[r.decision || (r.waitingText ? "waiting" : "text:" + r.decisionText.slice(0, 14))] || 0) + 1;
console.log("rows", rows.length, dec);
console.log("sample", JSON.stringify(rows[0]), "\nfiles", [...new Set(rows.flatMap((r) => r.files))].slice(0, 5));
console.log("emails:", [...new Set(rows.map((r) => r.email.replace(/\d+/g, "N")))].slice(0, 8));
