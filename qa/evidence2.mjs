// Follow-up evidence (see evidence.mjs): one controlled Maps load, a valid leave-guard test, and the email-count wording.
import fs from "node:fs";
import path from "node:path";
import { PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const OUT = path.resolve("out/evidence");
const b = await launch();
const vp = VIEWPORTS[0];
const out = [];
const say = (k, side, v) => { out.push({ k, side, v }); console.log(k.padEnd(28), side.padEnd(10), typeof v === "string" ? v : JSON.stringify(v)); };

// (a) prototype only, ONE Maps load: what the venue controls show once Google has (or has not) loaded
{
  const ctx = await newContext(b, vp, true); const page = await ctx.newPage();
  const requests = [];
  page.on("request", (r) => { if (/maps\.googleapis|maps\.gstatic/.test(r.url())) requests.push(new URL(r.url()).host); });
  await openStable(page, PROTO + "/prototype/create-conference");
  await page.getByRole("button", { name: /^In-Person/ }).first().click();
  await page.waitForTimeout(7000);
  say("venue controls after 7 s", "prototype", await page.evaluate(() => { const lab = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "Venue address"); const c = lab?.nextElementSibling; const venueLab = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "Venue"); return { venueNextTag: venueLab?.nextElementSibling?.tagName.toLowerCase(), venueInputs: venueLab?.parentElement.querySelectorAll("input").length, addressBlock: c ? c.textContent.replace(/\s+/g, " ").trim().slice(0, 190) : null, hasMapCanvas: !!c?.querySelector("canvas, .gm-style"), searchPlaceholder: c?.querySelector("input")?.placeholder || null }; }));
  say("google hosts contacted", "prototype", [...new Set(requests)]);
  await page.screenshot({ path: path.join(OUT, "cc-venue-after-7s-prototype.png") });
  await ctx.close();
}
// (b) valid leave-guard test: closing a dirty page with runBeforeUnload raises a beforeunload dialog only if a guard is registered
for (const [side, url] of [["prototype", PROTO + "/prototype/create-conference"], ["next", NEXT + "/create-conference"]]) {
  const ctx = await newContext(b, vp, true); const page = await ctx.newPage();
  await openStable(page, url);
  await page.locator("#cc-title").fill("Leave guard probe");
  let dialog = null;
  page.on("dialog", async (d) => { dialog = d.type(); await d.dismiss().catch(() => {}); });
  await page.close({ runBeforeUnload: true });
  await new Promise((r) => setTimeout(r, 500));
  say("beforeunload dialog when dirty", side, dialog ?? "none");
  await ctx.close();
}
// (c) email-count wording in the compact rows (sample mode)
for (const [side, url] of [["prototype", PROTO + "/prototype/create-conference"], ["next", NEXT + "/create-conference"]]) {
  const ctx = await newContext(b, vp, true); const page = await ctx.newPage();
  await openStable(page, url);
  say("compact email rows", side, await page.evaluate(() => [...document.querySelectorAll("div")].filter((d) => /Email:/.test(d.textContent) && /Conference (Approved|Declined)/.test(d.textContent) && d.children.length <= 3 && d.textContent.length < 120).map((d) => d.textContent.replace(/\s+/g, " ").trim()).filter((v, i, a) => a.indexOf(v) === i)));
  await ctx.close();
}
await b.close();
fs.writeFileSync(path.join(OUT, "observations2.json"), JSON.stringify(out, null, 2));
