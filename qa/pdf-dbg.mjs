import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import { makePdf } from "./qa-pdf.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true);
await ctx.route("**/__qa-paper.pdf", (r) => r.fulfill({ status: 200, contentType: "application/pdf", body: makePdf(3) }));
const pg = await ctx.newPage(); pg.on("console", (m) => { if (/error|warn|PDF|pdf/i.test(m.text())) console.log("console:", m.text().slice(0, 200)); }); pg.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 300)));
await openStable(pg, NEXT + "/submissions/DSAI-6/chair/review/add"); await pg.waitForTimeout(9000);
console.log((await pg.evaluate(() => document.querySelector("[aria-label='Paper']")?.innerText ?? "no paper section")).replace(/\s+/g, " ").slice(0, 300));
await pg.screenshot({ path: "out/det/pdf-dbg.png" }); await b.close();
