// Phase 3B task 3: how the Profile / Settings "default state" pixel difference depends on WHEN the prototype page is captured.
import fs from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const vp = VIEWPORTS[0];
const b = await launch();
const shot = async (url, early) => {
  const c = await newContext(b, vp, true); const pg = await c.newPage(); const out = [];
  if (early) {
    await pg.goto(url, { waitUntil: "commit" });
    for (const ms of [0, 200, 600, 1500, 4000]) { await pg.waitForTimeout(ms === 0 ? 0 : ms - (out.last ?? 0)); out.last = ms; out.push([ms, PNG.sync.read(await pg.screenshot())]); }
    delete out.last;
  } else { await openStable(pg, url); out.push(["stable", PNG.sync.read(await pg.screenshot())]); }
  await c.close(); return out;
};
const next = (await shot(NEXT + "/profile", false))[0][1];
const diff = (a, b2) => { const d = new PNG({ width: a.width, height: a.height }); return +(100 * pixelmatch(a.data, b2.data, d.data, a.width, a.height, { threshold: 0.1, includeAA: false }) / (a.width * a.height)).toFixed(2); };
const settled = (await shot(PROTO + "/prototype/profile", false))[0][1];
console.log("settled prototype vs Next:", diff(settled, next), "%");
for (const [ms, png] of await shot(PROTO + "/prototype/profile", true)) console.log(`prototype ${ms} ms after navigation commit vs Next:`, diff(png, next), "%  (vs settled prototype:", diff(png, settled), "%)");
await b.close();
