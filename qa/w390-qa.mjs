import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [k, base, path] of [["next", NEXT, "/chair/isbm2026/peer-review/manage"], ["proto", PROTO, "/prototype/chair/isbm2026/peer-review/manage"]]) {
  const ctx = await newContext(b, VIEWPORTS[2], true); const pg = await ctx.newPage();
  await openStable(pg, base + path); await pg.waitForTimeout(2500);
  out[k] = await pg.evaluate(() => {
    const w = (e) => Math.round(e.getBoundingClientRect().width * 10) / 10;
    const chain = (el) => { const a = []; for (let e = el; e && e !== document.body; e = e.parentElement) a.push(`${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}:${w(e)}`); return a.slice(0, 9); };
    const ta = document.querySelector("textarea");
    const btn = [...document.querySelectorAll("button")].find((x) => /edit form/i.test(x.textContent));
    return { ta: ta && chain(ta), btn: btn && chain(btn), btnText: btn?.textContent.trim(), sbw: window.innerWidth - document.documentElement.clientWidth };
  });
}
console.log(JSON.stringify(out, null, 1)); await b.close();
