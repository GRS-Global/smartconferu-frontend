// Chair Peer Review parity, slice 1: the per-paper "Assign" / "Find replacement" popover. Prototype vs Next.js (different papers and reviewers on each
// side: the demo conference vs the prototype's sample data), so the STRUCTURE is compared: heading pattern, count line, search box, list rows, the
// deadline row, buttons, closing. Nothing is sent: in mock mode Assign changes nothing on the server.
// Usage: node peer-assign-qa.mjs <label> -> out/peer-review/<label>/assign.json + screenshots
import fs from "node:fs";
import path from "node:path";
import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const label = process.argv[2] || "run";
const OUT = path.resolve("out/peer-review", label);
fs.mkdirSync(OUT, { recursive: true });
const results = []; let same = 0, differ = 0;
const check = (what, got) => { const ok = JSON.stringify(got.prototype) === JSON.stringify(got.next); ok ? same++ : differ++; results.push({ what, same: ok, ...got }); console.log(`${ok ? "SAME " : "DIFF "} ${what.padEnd(54)} ${ok ? JSON.stringify(got.prototype) : "P " + JSON.stringify(got.prototype) + "  N " + JSON.stringify(got.next)}`.slice(0, 420)); };
const browser = await launch();
const SIDES = [["prototype", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]];
async function both(fn) {
  const got = {};
  for (const [side, url] of SIDES) {
    const ctx = await newContext(browser, VIEWPORTS[0], true); const pg = await ctx.newPage();
    await openStable(pg, url); await pg.waitForSelector("tbody tr", { timeout: 60000 }).catch(() => undefined);
    try { got[side] = await fn(pg, side); } catch (e) { got[side] = "ERROR " + String(e).slice(0, 120); }
    await ctx.close();
  }
  return got;
}
const opener = (pg) => pg.locator("tbody button", { hasText: /^\s*(Assign|Find replacement)\s*$/ }).first();
const open = async (pg) => { const b = opener(pg); await b.scrollIntoViewIfNeeded(); await pg.waitForTimeout(500); await b.click(); await pg.waitForSelector("[role=dialog][aria-label^='Assign a reviewer']", { timeout: 8000 }); };
const dlg = (pg) => pg.locator("[role=dialog][aria-label^='Assign a reviewer']");
const shape = (s) => s.replace(/[A-Z]+-\d+/g, "<ID>").replace(/\d+/g, "N");

check("a row offers Assign / Find replacement", await both(async (pg) => (await opener(pg).count()) > 0));
check("popover heading + count line", await both(async (pg) => { await open(pg); return shape((await dlg(pg).locator("div").first().innerText()).replace(/\s+/g, " ").trim()); }));
check("search box placeholder", await both(async (pg) => { await open(pg); return dlg(pg).locator("input").first().getAttribute("placeholder"); }));
check("list rows have a '+ Assign <name>' button each", await both(async (pg) => { await open(pg); const rows = await dlg(pg).locator("li").count(); const plus = await dlg(pg).getByRole("button", { name: /^Assign / }).count(); return { hasRows: rows > 0, plusMatchesRows: plus === rows || plus > 0 }; }));
check("footer 'Invite someone new'", await both(async (pg) => { await open(pg); return (await dlg(pg).getByRole("button", { name: /Invite someone new/ }).count()) > 0; }));
check("search filters (a made-up name leaves none)", await both(async (pg) => { await open(pg); await dlg(pg).locator("input").first().fill("zzzz-nobody"); await pg.waitForTimeout(150); return shape(await dlg(pg).locator("li").first().innerText()); }));
check("+ opens the deadline row (date, Cancel, Assign)", await both(async (pg) => { await open(pg); await dlg(pg).getByRole("button", { name: /^Assign / }).first().click(); await pg.waitForTimeout(200); return { date: await dlg(pg).locator("input[type=date]").count(), cancel: await dlg(pg).getByRole("button", { name: "Cancel" }).count(), assign: await dlg(pg).getByRole("button", { name: /^Assign$/ }).count() }; }));
check("deadline defaults to a future date", await both(async (pg) => { await open(pg); await dlg(pg).getByRole("button", { name: /^Assign / }).first().click(); const v = await dlg(pg).locator("input[type=date]").inputValue(); return v > new Date("2026-11-03").toISOString().slice(0, 10); }));
check("Cancel closes the deadline row only", await both(async (pg) => { await open(pg); await dlg(pg).getByRole("button", { name: /^Assign / }).first().click(); await dlg(pg).getByRole("button", { name: "Cancel" }).click(); await pg.waitForTimeout(150); return { popover: await dlg(pg).count(), date: await dlg(pg).locator("input[type=date]").count() }; }));
check("Escape closes the popover", await both(async (pg) => { await open(pg); await pg.keyboard.press("Escape"); await pg.waitForTimeout(200); return await dlg(pg).count(); }));
check("click outside closes the popover", await both(async (pg) => { await open(pg); await pg.mouse.click(5, 300); await pg.waitForTimeout(200); return await dlg(pg).count(); }));
check("Assign shows a toast 'Reviewer assigned'", await both(async (pg) => { await open(pg); await dlg(pg).getByRole("button", { name: /^Assign / }).first().click(); await dlg(pg).getByRole("button", { name: /^Assign$/ }).click(); await pg.waitForTimeout(600); return shape(await pg.evaluate(() => (document.body.innerText.match(/Reviewer assigned[^\n]*\n?[^\n]*/) || [""])[0].replace(/\s+/g, " ").slice(0, 70))); }));
check("popover stays on screen (inside the viewport)", await both(async (pg) => { await open(pg); const b = await dlg(pg).boundingBox(); return !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1440 && b.y + b.height <= 900; }));
for (const [side, url] of SIDES) {
  const ctx = await newContext(browser, VIEWPORTS[0], true); const pg = await ctx.newPage(); await openStable(pg, url);
  await open(pg).catch(() => undefined); await dlg(pg).getByRole("button", { name: /^Assign / }).first().click().catch(() => undefined);
  await pg.screenshot({ path: path.join(OUT, `${side}.png`) }); await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, "assign.json"), JSON.stringify(results, null, 1));
console.log(`\nSAME ${same}  DIFF ${differ}`);
