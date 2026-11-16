// Chair Peer Review slice 2: screenshots of the selection bar and the three bulk dialogs, prototype and Next.js side by side, plus a pixel difference
// of each pair. Usage: node peer-bulk-shots.mjs [d1440|d1600|m390] -> out/peer-review/slice2-shots/<vp>/<name>-{prototype,next,side}.png + shots.json
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const vpName = process.argv[2] || "d1440";
const VP = VIEWPORTS.find((v) => v.name === vpName) || VIEWPORTS[0];
const OUT = path.resolve("out/peer-review/slice2-shots", vpName);
fs.mkdirSync(OUT, { recursive: true });
const IDS = JSON.parse(fs.readFileSync("out/peer-review-proto.json", "utf8")).rows.filter((r) => r.assignLink).slice(0, 3).map((r) => r.id);
const SIDES = [["prototype", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]];
const modal = (pg) => pg.locator(".ui-accent-card").last();
const browser = await launch();
const names = ["bar", "auto", "same", "decide", "confirm"];
for (const [side, url] of SIDES) {
  const ctx = await newContext(browser, VP, true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForSelector("tbody tr", { timeout: 90000 }); await pg.waitForTimeout(500);
  const shot = (n) => pg.screenshot({ path: path.join(OUT, `${n}-${side}.png`) });
  for (const id of IDS) await pg.locator("tbody tr", { hasText: id }).first().locator("input[type=checkbox]").click();
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300);
  await shot("bar");
  await pg.getByRole("button", { name: "Auto-assign" }).click(); await pg.getByText("Auto-assign reviewers").first().waitFor(); await pg.waitForTimeout(500); await shot("auto"); await pg.keyboard.press("Escape"); await modal(pg).getByRole("button", { name: "Cancel" }).click().catch(() => undefined); await pg.waitForTimeout(300);
  await pg.getByRole("button", { name: "Assign same reviewers" }).click(); await pg.getByText("Assign Reviewers").first().waitFor(); await pg.waitForTimeout(300); await modal(pg).locator("input[type=checkbox]").first().check(); await shot("same"); await modal(pg).getByRole("button", { name: "Close" }).click(); await pg.waitForTimeout(300);
  await pg.getByRole("button", { name: "Edit decisions" }).click(); await pg.getByText(/Apply to \d+ selected/).waitFor(); await pg.waitForTimeout(300); await modal(pg).locator("button[aria-pressed]").nth(2).click(); await shot("decide");
  await modal(pg).getByRole("button", { name: "Apply", exact: true }).click(); await pg.waitForTimeout(300); await shot("confirm");
  await ctx.close();
}
await browser.close();
const out = {};
for (const n of names) {
  const A = PNG.sync.read(fs.readFileSync(path.join(OUT, `${n}-prototype.png`))), B = PNG.sync.read(fs.readFileSync(path.join(OUT, `${n}-next.png`)));
  const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
  const pad = (p) => { const o = new PNG({ width: w, height: h }); o.data.fill(255); PNG.bitblt(p, o, 0, 0, p.width, p.height, 0, 0); return o; };
  const d = new PNG({ width: w, height: h });
  out[n] = +(100 * pixelmatch(pad(A).data, pad(B).data, d.data, w, h, { threshold: 0.1, includeAA: false }) / (w * h)).toFixed(2);
  const s = new PNG({ width: A.width + B.width, height: Math.max(A.height, B.height) }); PNG.bitblt(A, s, 0, 0, A.width, A.height, 0, 0); PNG.bitblt(B, s, 0, 0, B.width, B.height, A.width, 0);
  fs.writeFileSync(path.join(OUT, `${n}-side.png`), PNG.sync.write(s));
}
fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(out));
console.log(vpName, JSON.stringify(out));
