import { NEXT, PROTO } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [n, u, pre] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage", true], ["next", NEXT + "/chair/isbm2026/peer-review/manage", true]]) {
  const ctx = await newContext(b, { name: "w1920", width: 1920, height: 1000 }, true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1200);
  await pg.getByRole("button", { name: "Settings", exact: true }).or(pg.getByRole("tab", { name: "Settings", exact: true })).first().click(); await pg.waitForTimeout(800);
  await pg.getByText(/Edit template/).first().click(); await pg.waitForTimeout(4500);
  const r = await pg.evaluate(() => { const card = (re) => { const e = [...document.querySelectorAll("div,section")].find((x) => x.children.length && re.test(x.firstElementChild?.textContent?.trim() ?? "") && x.getBoundingClientRect().width > 200); return e ? Math.round(e.getBoundingClientRect().width) : null; }; return { info: card(/^Email information/), crumbs: [...document.querySelectorAll("nav, [aria-label*=readcrumb]")].map((x) => x.innerText.replace(/\s+/g, " ")).filter((t) => /My Conferences/.test(t)).slice(0, 1) }; });
  console.log(n, pg.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 150), JSON.stringify(r), "back:", await pg.getByText(/Back to /).first().innerText().catch(() => "-"));
  await ctx.close();
}
await b.close();
