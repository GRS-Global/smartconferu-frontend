import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(3500);
  out[k] = await pg.evaluate(() => {
    const st = (e) => { if (!e) return null; const s = getComputedStyle(e); return `${s.fontSize}/${s.fontWeight}/${s.lineHeight} ${s.color} ${s.letterSpacing !== "normal" ? "ls" + s.letterSpacing : ""}`; };
    const leaf = (t) => [...document.querySelectorAll("aside *, div *")].find((e) => e.children.length === 0 && e.textContent.trim() === t);
    const names = ["Sections", "Jump to a part of this page", "Title & identity", "Dates & deadlines", "Website & description", "Area, language & status", "Presentation types", "Incomplete", "Done", "CFP managers", "Who else can edit or publish this CFP"];
    const o = {}; for (const n of names) o[n] = st(leaf(n));
    const metas = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^(Dec 7|Feb 17|Feb 7|Website added|No website|ISBM|DSAI)/.test(e.textContent.trim())).slice(0, 4).map((e) => e.textContent.trim().slice(0, 18) + " => " + st(e));
    return { o, metas };
  });
}
console.log(JSON.stringify(out, null, 1)); await b.close();
