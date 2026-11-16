// QA for the Phase 1 corrections. Local and safe: nothing is submitted (the empty-form check uses Ctrl+Enter on an invalid form, which only
// shows messages), no website is typed (that would start the prototype's AI read), no Supabase and no Google service is contacted
// (the prototype is run with its Maps key forced empty by start-prototype-nokey.mjs).
// Usage: node phase1-qa.mjs <label>   -> out/phase1/<label>/{*.png, results.json} and a printed summary
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const label = process.argv[2] || "run";
const OUT = path.resolve("out/phase1", label);
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (area, vp, what, value) => { results.push({ area, vp, what, value }); console.log(`${area.padEnd(14)} ${vp.padEnd(6)} ${what.padEnd(34)} ${typeof value === "string" ? value : JSON.stringify(value)}`); };

const pad = (png, w, h) => { const o = new PNG({ width: w, height: h }); o.data.fill(255); PNG.bitblt(png, o, 0, 0, png.width, png.height, 0, 0); return o; };
const diffPercent = (fileA, fileB, diffFile) => {
  const a = PNG.sync.read(fs.readFileSync(fileA)), b = PNG.sync.read(fs.readFileSync(fileB));
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  const d = new PNG({ width: w, height: h });
  const n = pixelmatch(pad(a, w, h).data, pad(b, w, h).data, d.data, w, h, { threshold: 0.1, includeAA: false });
  if (diffFile) fs.writeFileSync(diffFile, PNG.sync.write(d));
  return { percent: +(100 * n / (w * h)).toFixed(2), heightDelta: b.height - a.height };
};
const SIDES = (protoPath, nextPath) => [["prototype", PROTO + protoPath], ["next", NEXT + nextPath]];
const STYLE_PROPS = ["height", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "fontSize", "fontWeight", "lineHeight", "color", "backgroundColor", "borderTopStyle", "borderTopWidth", "borderTopColor", "borderRadius", "display", "gap"];
const styleOf = (page, finder) => page.evaluate(({ props, src }) => { const el = new Function(`return (${src})()`)(); if (!el) return null; const cs = getComputedStyle(el); const o = {}; for (const p of props) o[p] = cs[p]; return o; }, { props: STYLE_PROPS, src: finder });
const styleDiff = (a, b) => (!a || !b ? "element missing on one side" : STYLE_PROPS.filter((p) => a[p] !== b[p]).map((p) => `${p}: ${a[p]} -> ${b[p]}`));
const norm = (c) => c; // computed colours are already rgb() in Chromium

const browser = await launch();
const open = async (url, vp, auth = true) => { const ctx = await newContext(browser, vp, auth); const page = await ctx.newPage(); await openStable(page, url); return { ctx, page }; };

for (const vp of VIEWPORTS) {
  // ---- A. venue fields per event format
  for (const format of [null, "In-Person", "Hybrid", "Virtual"]) {
    const tag = format ?? "none";
    const shots = {}, info = {};
    for (const [side, url] of SIDES("/prototype/create-conference", "/create-conference")) {
      const { ctx, page } = await open(url, vp);
      if (format) { await page.getByRole("button", { name: new RegExp(`^${format}`) }).first().click(); await page.waitForTimeout(500); }
      shots[side] = path.join(OUT, `venue-${tag}-${vp.name}-${side}.png`);
      await page.screenshot({ path: shots[side], fullPage: true });
      info[side] = await page.evaluate(() => {
        const labels = ["Venue", "Venue address", "City", "Organizer city", "State / province", "Postal / ZIP code"].filter((l) => [...document.querySelectorAll("label")].some((x) => x.textContent.replace(/\s*\*/, "").trim() === l));
        const lab = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "Venue address");
        const c = lab?.nextElementSibling;
        return { labels, addressControl: c ? { tag: c.tagName.toLowerCase(), textInside: c.textContent.replace(/\s+/g, " ").trim().slice(0, 150), inputs: c.querySelectorAll("input,textarea").length } : null };
      });
      if (format === "In-Person" && vp.name === "d1440") {
        info[side].panelStyle = await styleOf(page, `() => { const p = [...document.querySelectorAll("p")].find((x) => /Map address picker isn't configured/.test(x.textContent)); return p?.parentElement; }`);
        info[side].panelTextStyle = await styleOf(page, `() => [...document.querySelectorAll("p")].find((x) => /Map address picker isn't configured/.test(x.textContent))`);
      }
      await ctx.close();
    }
    const d = diffPercent(shots.prototype, shots.next, path.join(OUT, `venue-${tag}-${vp.name}-diff.png`));
    rec("venue", vp.name, `${tag}: labels P | N`, { prototype: info.prototype.labels, next: info.next.labels });
    rec("venue", vp.name, `${tag}: address control P | N`, { prototype: info.prototype.addressControl, next: info.next.addressControl });
    rec("venue", vp.name, `${tag}: pixel diff / height delta`, d);
    if (info.prototype.panelStyle) rec("venue", vp.name, "panel container style diffs", styleDiff(info.prototype.panelStyle, info.next.panelStyle));
    if (info.prototype.panelTextStyle) rec("venue", vp.name, "panel text style diffs", styleDiff(info.prototype.panelTextStyle, info.next.panelTextStyle));
  }

  // ---- B. empty-form validation (Ctrl+Enter on an invalid form only shows messages)
  {
    const got = {}, shots = {};
    for (const [side, url] of SIDES("/prototype/create-conference", "/create-conference")) {
      const { ctx, page } = await open(url, vp);
      await page.locator("#cc-title").focus();
      await page.keyboard.press("Control+Enter");
      await page.waitForTimeout(700);
      got[side] = await page.evaluate(() => ({
        messages: [...document.querySelectorAll("p")].filter((p) => getComputedStyle(p).color === "rgb(220, 38, 38)" && p.getBoundingClientRect().height > 0 && p.textContent.trim()).map((p) => p.textContent.replace(/\s+/g, " ").trim()),
        focusedId: document.activeElement?.id || document.activeElement?.tagName.toLowerCase(),
        counter: ((document.body.innerText.match(/Required to create\s*(\d+\/\d+)/) || [])[1]) || null,
      }));
      shots[side] = path.join(OUT, `validation-${vp.name}-${side}.png`);
      await page.screenshot({ path: shots[side], fullPage: true });
      await ctx.close();
    }
    rec("validation", vp.name, "messages P | N", { prototype: got.prototype.messages, next: got.next.messages });
    rec("validation", vp.name, "same messages in same order", JSON.stringify(got.prototype.messages) === JSON.stringify(got.next.messages));
    rec("validation", vp.name, "focused field P | N / counter", { prototype: [got.prototype.focusedId, got.prototype.counter], next: [got.next.focusedId, got.next.counter] });
    rec("validation", vp.name, "pixel diff / height delta", diffPercent(shots.prototype, shots.next, path.join(OUT, `validation-${vp.name}-diff.png`)));
  }

  // ---- C. date rules (desktop only: same logic at every width)
  if (vp.name === "d1440") {
    const got = {};
    for (const [side, url] of SIDES("/prototype/create-conference", "/create-conference")) {
      const { ctx, page } = await open(url, vp);
      const counter = () => page.evaluate(() => ((document.body.innerText.match(/Required to create\s*(\d+\/\d+)/) || [])[1]) || null);
      const dateRow = () => page.evaluate(() => { const li = [...document.querySelectorAll("li")].find((x) => /^Conference dates/.test(x.textContent.trim())); const dot = li?.querySelector("span"); return dot ? { done: dot.textContent.trim() === "" ? !!li.querySelector("svg") : true } : null; });
      const out = { initial: await counter() };
      const dates = page.locator("input[type=date]");
      await dates.nth(1).fill("2027-04-16"); await page.waitForTimeout(200);          // end only
      out.endOnly = { counter: await counter(), dateRowDone: await dateRow(), startValue: await dates.nth(0).inputValue() };
      await dates.nth(1).fill(""); await dates.nth(0).fill("2027-04-14"); await page.waitForTimeout(200); // start only: fills the end
      out.startOnly = { counter: await counter(), endValue: await dates.nth(1).inputValue() };
      await dates.nth(1).fill("2027-04-10"); await page.waitForTimeout(200);          // end before start
      out.endBeforeStart = { endValue: await dates.nth(1).inputValue(), min: await dates.nth(1).getAttribute("min") };
      got[side] = out; await ctx.close();
    }
    rec("dates", vp.name, "P", got.prototype);
    rec("dates", vp.name, "N", got.next);
    rec("dates", vp.name, "same behaviour", JSON.stringify(got.prototype) === JSON.stringify(got.next));
  }

  // ---- D. acronym suggestion chip
  {
    const cases = [
      ["title with 2+ words, no start date", { title: "International Conference on Applied Intelligence" }],
      ["+ start date 2027-04-14", { title: "International Conference on Applied Intelligence", start: "2027-04-14" }],
      ["stop-words only left 1 word", { title: "The Conference" }],
      ["single word", { title: "Symposium" }],
      ["acronym already typed", { title: "International Conference on Applied Intelligence", acronym: "ABC" }],
      ["symbols and digits", { title: "6G & Beyond: Wireless Systems Forum", start: "2028-01-05" }],
    ];
    for (const [name, c] of cases) {
      const got = {};
      for (const [side, url] of SIDES("/prototype/create-conference", "/create-conference")) {
        const { ctx, page } = await open(url, vp);
        await page.locator("#cc-title").fill(c.title);
        if (c.start) await page.locator("input[type=date]").first().fill(c.start);
        if (c.acronym) await page.locator("#cc-acronym").fill(c.acronym);
        await page.waitForTimeout(250);
        const chip = page.getByRole("button", { name: /^Use “/ });
        const present = await chip.count();
        got[side] = { chip: present ? (await chip.first().textContent()).trim() : null };
        if (present && c.title.startsWith("International") && !c.acronym && c.start && vp.name === "d1440") {
          got[side].style = await styleOf(page, `() => [...document.querySelectorAll("button")].find((b) => /^Use “/.test(b.textContent.trim()))`);
          const clip = path.join(OUT, `chip-${vp.name}-${side}.png`); await chip.first().scrollIntoViewIfNeeded(); await page.screenshot({ path: clip, clip: { x: 80, y: 0, width: 640, height: 900 } });
          await chip.first().click(); await page.waitForTimeout(150);
          got[side].afterClick = { acronym: await page.locator("#cc-acronym").inputValue(), chipStillShown: await page.getByRole("button", { name: /^Use “/ }).count() };
        }
        await ctx.close();
      }
      rec("acronym", vp.name, `${name}: chip P | N`, { prototype: got.prototype.chip, next: got.next.chip, same: got.prototype.chip === got.next.chip });
      if (got.prototype.style && !got.next.style) rec("acronym", vp.name, "chip on Next.js", "absent: no style / click / crop comparison possible");
      if (got.prototype.style && got.next.style) { rec("acronym", vp.name, "chip style diffs", styleDiff(got.prototype.style, got.next.style)); rec("acronym", vp.name, "after click P | N", { prototype: got.prototype.afterClick, next: got.next.afterClick }); rec("acronym", vp.name, "chip crop pixel diff", diffPercent(path.join(OUT, `chip-${vp.name}-prototype.png`), path.join(OUT, `chip-${vp.name}-next.png`), path.join(OUT, `chip-${vp.name}-diff.png`))); }
    }
  }

  // ---- E. Notifications "Mark all as read" (+ the two routes that share the component)
  for (const [id, pp, np] of [["notifications", "/prototype/alerts", "/notifications"], ["author-updates", "/prototype/author/isbm2026/updates", "/author/isbm2026/updates"], ["reviewer-updates", "/prototype/reviewer/isbm2026/updates", "/reviewer/isbm2026/updates"]]) {
    const got = {}, shots = {};
    for (const [side, url] of SIDES(pp, np)) {
      const { ctx, page } = await open(url, vp);
      const finder = `() => [...document.querySelectorAll("button")].find((x) => /^Mark all as read/i.test(x.textContent.trim()))`;
      got[side] = { style: await styleOf(page, finder), box: await page.evaluate(`(${finder})()?.getBoundingClientRect().toJSON?.()`) };
      shots[side] = path.join(OUT, `notif-${id}-${vp.name}-${side}.png`);
      await page.screenshot({ path: shots[side], clip: { x: 0, y: 0, width: vp.width, height: Math.min(300, 900) } });
      await ctx.close();
    }
    rec("notifications", vp.name, `${id}: button height P | N`, { prototype: got.prototype.style?.height ?? "absent", next: got.next.style?.height ?? "absent" });
    if (got.prototype.style && got.next.style) {
      rec("notifications", vp.name, `${id}: style diffs`, styleDiff(got.prototype.style, got.next.style));
      rec("notifications", vp.name, `${id}: button top (P | N)`, { prototype: Math.round(got.prototype.box?.y), next: Math.round(got.next.box?.y) });
    }
    rec("notifications", vp.name, `${id}: header crop pixel diff`, diffPercent(shots.prototype, shots.next, path.join(OUT, `notif-${id}-${vp.name}-diff.png`)));
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
