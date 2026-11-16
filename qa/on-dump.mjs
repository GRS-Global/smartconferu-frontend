// Phase 3A helper: prints the markup and visibility of the label whose text is "On" on Settings > Submissions, in both apps.
import { PROTO, NEXT, PAGES, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const page = PAGES.find((p) => p.id === "chair-settings-submissions");
const browser = await launch();
for (const [side, url] of [["prototype", PROTO + page.proto], ["next", NEXT + page.next]]) {
  const ctx = await newContext(browser, VIEWPORTS[0], true);
  const pg = await ctx.newPage();
  await openStable(pg, url);
  const out = await pg.evaluate(() => [...document.querySelectorAll("label")].filter((l) => l.textContent.trim() === "On").map((l) => {
    const r = l.getBoundingClientRect();
    return { html: l.outerHTML.slice(0, 420), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], hasInput: Boolean(l.querySelector("input")) };
  }));
  console.log(side, JSON.stringify(out, null, 1));
  await ctx.close();
}
await browser.close();
