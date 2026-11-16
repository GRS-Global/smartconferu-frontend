// Usage: node run-compare.mjs [--page id[,id]] [--vp d1440,m390]
// Output: out/<page>/<vp>/{prototype,next,side-by-side,overlay,diff}.png + out/report.json + out/index.html
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { PAGES, VIEWPORTS, PROTO, NEXT } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1].split(",") : null; };
const onlyPages = arg("page"), onlyVps = arg("vp");
const OUT = path.resolve("out");
fs.mkdirSync(OUT, { recursive: true });
const THRESHOLD = 0.1; // pixelmatch per-pixel colour tolerance (anti-aliasing only). Not a pass/fail knob.

function pad(png, w, h) { // equal canvas so a height difference shows up as a diff instead of an error
  const out = new PNG({ width: w, height: h });
  out.data.fill(255);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

const browser = await launch();
const report = [];
for (const pg of PAGES.filter((p) => !onlyPages || onlyPages.includes(p.id))) {
  for (const vp of VIEWPORTS.filter((v) => !onlyVps || onlyVps.includes(v.name))) {
    const dir = path.join(OUT, pg.id, vp.name);
    fs.mkdirSync(dir, { recursive: true });
    const row = { page: pg.id, viewport: vp.name, data: pg.data, auth: pg.auth };
    try {
      const shots = {};
      for (const [side, base, p] of [["prototype", PROTO, pg.proto], ["next", pg.nextBase || NEXT, pg.next]]) {
        const ctx = await newContext(browser, vp, pg.auth);
        const page = await ctx.newPage();
        await openStable(page, base + p);
        row[`${side}FinalUrl`] = page.url().replace(base, "");
        row[`${side}HorizontalOverflow`] = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        const file = path.join(dir, `${side}.png`);
        await page.screenshot({ path: file, fullPage: true });
        shots[side] = PNG.sync.read(fs.readFileSync(file));
        await ctx.close();
      }
      const w = Math.max(shots.prototype.width, shots.next.width);
      const h = Math.max(shots.prototype.height, shots.next.height);
      const a = pad(shots.prototype, w, h), b = pad(shots.next, w, h);
      const diff = new PNG({ width: w, height: h });
      const n = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: THRESHOLD, includeAA: false });
      fs.writeFileSync(path.join(dir, "diff.png"), PNG.sync.write(diff));
      const sbs = new PNG({ width: w * 2 + 20, height: h }); sbs.data.fill(200);
      PNG.bitblt(a, sbs, 0, 0, w, h, 0, 0); PNG.bitblt(b, sbs, 0, 0, w, h, w + 20, 0);
      fs.writeFileSync(path.join(dir, "side-by-side.png"), PNG.sync.write(sbs));
      const ov = new PNG({ width: w, height: h });
      for (let i = 0; i < ov.data.length; i += 4) { for (let k = 0; k < 3; k++) ov.data[i + k] = (a.data[i + k] + b.data[i + k]) >> 1; ov.data[i + 3] = 255; }
      fs.writeFileSync(path.join(dir, "overlay.png"), PNG.sync.write(ov));
      Object.assign(row, {
        protoSize: [shots.prototype.width, shots.prototype.height], nextSize: [shots.next.width, shots.next.height],
        heightDelta: shots.next.height - shots.prototype.height,
        diffPixels: n, diffPercent: +(100 * n / (w * h)).toFixed(2),
      });
    } catch (e) { row.error = String(e).slice(0, 300); }
    report.push(row);
    console.log(row.page.padEnd(18), row.viewport.padEnd(6), row.error ? "ERROR " + row.error : `diff ${row.diffPercent}%  heightDelta ${row.heightDelta}  ${row.data}  proto->${row.prototypeFinalUrl}  next->${row.nextFinalUrl}`);
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), threshold: THRESHOLD, report }, null, 2));
const rows = report.map((r) => `<tr><td>${r.page}</td><td>${r.viewport}</td><td>${r.data}</td><td>${r.error || r.diffPercent + "%"}</td><td>${r.heightDelta ?? ""}</td><td>${r.error ? "" : `<a href="${r.page}/${r.viewport}/side-by-side.png">side-by-side</a> | <a href="${r.page}/${r.viewport}/overlay.png">overlay</a> | <a href="${r.page}/${r.viewport}/diff.png">diff</a>`}</td></tr>`).join("");
fs.writeFileSync(path.join(OUT, "index.html"), `<!doctype html><meta charset=utf-8><title>Parity report</title><style>body{font:14px system-ui;padding:20px}td,th{border:1px solid #ddd;padding:6px 10px}table{border-collapse:collapse}</style><h1>Prototype vs Next.js</h1><table><tr><th>page<th>viewport<th>data<th>diff<th>height delta (px)<th>images</tr>${rows}</table>`);
