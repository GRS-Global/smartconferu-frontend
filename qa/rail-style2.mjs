import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(3500);
  out[k] = await pg.evaluate(() => {
    let side = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "Jump to a part of this page"); while (side && !(side.getBoundingClientRect().width >= 290 && side.children.length >= 2 && side.getBoundingClientRect().height > 600)) side = side.parentElement; if (side && side.getBoundingClientRect().height < 600) side = null;
    const rows = [];
    const walk = (el) => { for (const c of el.children) { if (c.children.length === 0 && c.textContent.trim()) { const s = getComputedStyle(c); const r = c.getBoundingClientRect(); rows.push(`${c.textContent.trim().slice(0, 26).padEnd(26)} ${s.fontSize}/${s.fontWeight} ${s.color} @${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`); } else walk(c); } };
    if (side) walk(side);
    const cards = side ? [...side.children].map((c) => { const r = c.getBoundingClientRect(); const s = getComputedStyle(c); return `card ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} pad ${s.padding} br ${s.borderRadius}`; }) : [];
    return { cards, rows };
  });
}
console.log(out.proto.cards.join("\n")); console.log(out.proto.rows.join("\n")); console.log("=============="); console.log(out.next.cards.join("\n")); console.log(out.next.rows.join("\n")); await b.close();
