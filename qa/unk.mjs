// Phase 3B helper: does an unknown paper label show the "isn't in the initial check" message in both apps?
import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const kind of ["initial-check", "plagiarism"]) {
  for (const [side, url] of [["proto", `${PROTO}/prototype/chair/isbm2026/${kind}/NOPE-1`], ["next", `${NEXT_SCREEN}/chair/isbm2026/${kind}/NOPE-1`]]) {
    const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage(); await openStable(pg, url);
    console.log(kind, side, await pg.evaluate(() => (document.body.innerText.match(/This paper isn.t in the [a-z ]+/) || [null])[0]));
    await ctx.close();
  }
}
await b.close();
