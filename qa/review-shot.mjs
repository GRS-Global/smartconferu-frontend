import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import { makePdf } from "./qa-pdf.mjs";
const paper = process.argv[2] || "ISBM-680"; const paperNext = process.argv[3] || paper;
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/reviewer/isbm2026/review/${paper}`], ["next", `${NEXT}/reviewer/isbm2026/review/${paperNext}`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true);
  await ctx.route("**/__qa-paper.pdf", (r) => r.fulfill({ status: 200, contentType: "application/pdf", body: makePdf(1) }));
  const pg = await ctx.newPage(); await openStable(pg, url); await pg.waitForTimeout(4000);
  await pg.screenshot({ path: `out/dd/rv-${paper}-${k}.png` });
  await pg.screenshot({ path: `out/dd/rv-${paper}-${k}-full.png`, fullPage: true });
}
await b.close();
