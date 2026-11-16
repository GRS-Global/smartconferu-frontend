import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import { makePdf } from "./qa-pdf.mjs";
const paper = process.argv[2] || "ISBM-732";
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/reviewer/isbm2026/review/${paper}`], ["next", `${NEXT}/reviewer/isbm2026/review/${paper}`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true);
  await ctx.route("**/__qa-paper.pdf", (r) => r.fulfill({ status: 200, contentType: "application/pdf", body: makePdf(1) }));
  const pg = await ctx.newPage(); await openStable(pg, url); await pg.waitForTimeout(3500);
  const sc = () => pg.evaluate((y) => { const els = [...document.querySelectorAll("div")].filter((d) => /auto|scroll/.test(getComputedStyle(d).overflowY) && d.scrollHeight > d.clientHeight + 50 && d.textContent.includes("Your review")); const el = els.sort((a, b) => a.scrollHeight - b.scrollHeight)[0]; if (el) { el.scrollTop = y; return el.scrollHeight; } window.scrollTo(0, y); return -1; }, 0);
  for (const y of [0, 560, 1120, 1700]) {
    await pg.evaluate((y) => { const els = [...document.querySelectorAll("div")].filter((d) => /auto|scroll/.test(getComputedStyle(d).overflowY) && d.scrollHeight > d.clientHeight + 50 && d.textContent.includes("Your review")); const el = els.sort((a, b) => a.scrollHeight - b.scrollHeight)[0]; if (el) el.scrollTop = y; }, y);
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: `out/dd/rs-${paper}-${k}-${y}.png`, clip: { x: 880, y: 70, width: 560, height: 830 } });
  }
}
await b.close();
