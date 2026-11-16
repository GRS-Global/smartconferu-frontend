import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage"], ["next", NEXT + "/chair/isbm2026/peer-review/manage"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1500);
  console.log(n, JSON.stringify(await pg.evaluate(() => {
    const top = (re) => { const e = [...document.querySelectorAll("h1,h2,h3,h4,div,span,label")].find((x) => x.children.length < 3 && re.test(x.textContent.trim()) && x.textContent.trim().length < 60); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; };
    return { hero: top(/^Review a .* paper$/), instr: top(/^Reviewer instructions$/), deadline: top(/^Deadline$/), review: top(/^Review$/), reviewOfSub: top(/^Review of the submission/), ratings: top(/^Ratings/), confidence: top(/^Reviewer confidence/), comments: top(/^Comments$/), commentsTo: top(/^Comments to author/), bottom: document.documentElement.scrollHeight };
  })));
  await ctx.close();
}
await b.close();
