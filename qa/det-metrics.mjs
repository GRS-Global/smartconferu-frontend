import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(3500);
  out[k] = await pg.evaluate(() => {
    const r = (e) => { if (!e) return null; const x = e.getBoundingClientRect(); const s = getComputedStyle(e); return { box: [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)], pad: s.padding, bg: s.backgroundColor, fs: s.fontSize, fw: s.fontWeight, br: s.borderRadius }; };
    const txt = (t) => [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === t);
    const card = txt("Profile completeness")?.closest("section,div[class*=rounded]");
    const bar = card?.querySelector("[class*=rounded-full]");
    return { card: r(card), title: r(txt("Profile completeness")), bar: r(bar), pct: r(txt("75%") || txt("29%")), tab1: r(txt("Basic Details")?.closest("button")), tab2: r(txt("Format & Venue")?.closest("button")), tab3: r(txt("Branding")?.closest("button")), select: r(document.querySelector("select")), addBtn: r([...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Add")), ai: r([...document.querySelectorAll("button, span")].find((x) => /Suggest with AI/.test(x.textContent) && x.children.length <= 3)) };
  });
}
console.log(JSON.stringify(out, null, 1)); await b.close();
