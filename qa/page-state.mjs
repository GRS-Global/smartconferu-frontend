// Records what each page actually renders (first heading + opening text) in both apps, to tell a real page
// from a not-found / empty / mock-mode-blocked state BEFORE reading any diff. Output: out/page-state.json
import fs from "node:fs";
import { PAGES, PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const b = await launch();
const rows = [];
for (const pg of PAGES) {
  const row = { page: pg.id };
  for (const [side, base, key] of [["prototype", PROTO, "proto"], ["next", pg.nextBase || NEXT, "next"]]) {
    const ctx = await newContext(b, VIEWPORTS[0], pg.auth); const page = await ctx.newPage();
    await openStable(page, base + pg[key]);
    row[side] = await page.evaluate(() => {
      const h = document.querySelector("main h1, h1, main h2, h2");
      const main = document.querySelector("main") || document.body;
      return { url: location.pathname, heading: h?.textContent?.trim().slice(0, 70) || null, text: main.innerText.replace(/\s+/g, " ").trim().slice(0, 160), height: document.documentElement.scrollHeight };
    });
    await ctx.close();
  }
  rows.push(row);
  console.log(pg.id.padEnd(30), "| P:", (row.prototype.heading || "-").padEnd(34), "| N:", row.next.heading || "-", "|", row.next.url !== pg.next ? "N-URL " + row.next.url : "");
}
await b.close();
fs.writeFileSync("out/page-state.json", JSON.stringify(rows, null, 2));
