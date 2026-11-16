import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const NEXTB = process.env.NEXT_URL || NEXT;
const b = await launch(); const out = {};
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", NEXTB + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2500);
  const rows = [];
  await pg.getByRole("button", { name: /Take a tour/i }).first().click().catch(() => {}); await pg.waitForTimeout(1500);
  let last = "";
  for (let i = 1; i <= 45; i++) {
    const pop = pg.locator("[data-tour-popover]");
    if (!(await pop.count())) { rows.push(`#${i} (no popover) url=${pg.url().replace(/^https?:\/\/[^/]+/, "")}`); await pg.waitForTimeout(800); if (!(await pg.locator("[data-tour-popover]").count())) break; continue; }
    const info = await pop.evaluate((e) => { const r = e.getBoundingClientRect(); const t = (e.querySelector("h4")?.textContent ?? "").trim(); const btns = [...e.querySelectorAll("button")].map((x) => x.textContent.trim()).filter(Boolean).join("/"); const badge = e.innerText.match(/Required|Recommended|Good to know/)?.[0]; return `${t} [${badge}] side=${e.getAttribute("data-side")} box=${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)} btns=${btns} url=${location.pathname}`; });
    rows.push(`#${i} ${info}`);
    if (i <= 40) await pg.screenshot({ path: `out/det/tour-${k}-${String(i).padStart(2, "0")}.png` });
    const later = pop.getByRole("button", { name: /I'll do this later/ });
    const open = pop.getByRole("button", { name: /^Open / });
    const target = (await later.count()) ? later : (await open.count()) ? open : pop.getByRole("button", { name: /^(Next|Finish)$/ });
    await target.first().click().catch(() => {}); await pg.waitForTimeout(3200);
    if (info === last) { rows.push("(stuck)"); break; } last = info;
  }
  out[k] = rows;
}
console.log(out.proto.join("\n")); console.log("=========="); console.log(out.next.join("\n")); await b.close();
