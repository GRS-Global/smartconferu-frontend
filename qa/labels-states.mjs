// Phase 3A: required-field and focus states on Submit. Opens the form empty, clicks "Show what's missing" (the prototype's way to reveal
// required gaps; Next.js has the same control once a submit was attempted), then reads the Title / Abstract label colour and the input
// focus border. Nothing is submitted. Usage: node labels-states.mjs
import { PROTO, NEXT, PAGES, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const page = PAGES.find((p) => p.id === "submit");
const read = (pg) => pg.evaluate(() => {
  const lab = (t) => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.replace(/\s+/g, " ").trim().replace(/\s*\*$/, "") === t); return l ? getComputedStyle(l).color : null; };
  return { title: lab("Title"), abstract: lab("Abstract"), keywords: lab("Keywords") };
});
const browser = await launch();
const out = {};
for (const [side, url] of [["prototype", PROTO + page.proto], ["next", NEXT + page.next]]) {
  const ctx = await newContext(browser, VIEWPORTS[0], true);
  const pg = await ctx.newPage();
  await openStable(pg, url);
  const r = { initial: await read(pg) };
  const reveal = side === "next" ? pg.getByRole("button", { name: /^submit paper$/i }).first() : pg.getByRole("button", { name: /show what.s missing/i }).first();
  const link = pg.getByText(/show what.s missing/i).first();
  try { (await reveal.count()) ? await reveal.click({ timeout: 3000 }) : await link.click({ timeout: 3000 }); } catch (e) { r.revealError = String(e).slice(0, 120); }
  await pg.waitForTimeout(500);
  r.afterReveal = await read(pg);
  // focus border of the Title input
  const input = pg.locator("input[placeholder='Title'], #p-title").first();
  const before = await input.evaluate((e) => getComputedStyle(e).borderTopColor);
  await input.focus();
  r.titleBorder = { blurred: before, focused: await input.evaluate((e) => getComputedStyle(e).borderTopColor) };
  out[side] = r;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
