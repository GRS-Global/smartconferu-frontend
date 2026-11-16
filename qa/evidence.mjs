// Interaction evidence for the verification phase. Local, synthetic and read-only: a generated PNG is the only file used, nothing is submitted,
// no website is typed into Create Conference (that would start the prototype's real AI read), and no Supabase is contacted.
// Usage: node evidence.mjs  -> out/evidence/*.png and a printed observation list (also out/evidence/observations.json)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { PROTO, NEXT, NEXT_AUTH, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const OUT = path.resolve("out/evidence");
fs.mkdirSync(OUT, { recursive: true });
const obs = [];
const note = (area, side, what, value) => { obs.push({ area, side, what, value }); console.log(`${area.padEnd(22)} ${side.padEnd(10)} ${what.padEnd(46)} ${typeof value === "string" ? value : JSON.stringify(value)}`); };

// A 600x400 gradient PNG (not a real person's photo).
const png = new PNG({ width: 600, height: 400 });
for (let y = 0; y < 400; y++) for (let x = 0; x < 600; x++) { const i = (y * 600 + x) * 4; png.data[i] = x % 256; png.data[i + 1] = y % 256; png.data[i + 2] = 180; png.data[i + 3] = 255; }
const IMG = path.join(os.tmpdir(), "qa-evidence-image.png");
fs.writeFileSync(IMG, PNG.sync.write(png));

const b = await launch();
const vp = VIEWPORTS[0];
const sides = (id, protoPath, nextPath, nextBase = NEXT) => [["prototype", PROTO + protoPath], ["next", nextBase + nextPath]];
const open = async (url, auth) => { const ctx = await newContext(b, vp, auth); const page = await ctx.newPage(); await openStable(page, url); return { ctx, page }; };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const texts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.textContent.replace(/\s+/g, " ").trim()).filter(Boolean), sel);

// 1. Register: pick a photo
for (const [side, url] of sides("reg", "/prototype/register", "/register", NEXT_AUTH)) {
  const { ctx, page } = await open(url, false);
  await page.setInputFiles("input[type=file]", IMG);
  await page.waitForTimeout(900);
  await shot(page, `register-photo-${side}`);
  note("register photo", side, "controls after picking an image", await page.evaluate(() => [...document.querySelectorAll("button,[role=button],input[type=range],[role=application]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.getAttribute("aria-label") || e.textContent || e.type || "").replace(/\s+/g, " ").trim()).filter((t) => /zoom|rotate|apply|cancel|adjust|crop|remove|change photo|drag|photo/i.test(t)).slice(0, 12)));
  note("register photo", side, "crop area / zoom slider present", await page.evaluate(() => ({ cropArea: !!document.querySelector("[role=application]"), slider: !!document.querySelector("input[type=range]") })));
  await ctx.close();
}
// 2. Register: the email note and its preview
for (const [side, url] of sides("reg", "/prototype/register", "/register", NEXT_AUTH)) {
  const { ctx, page } = await open(url, false);
  await page.getByText(/This action sends/).first().click();
  await page.getByText(/See how email looks/).first().click();
  await page.waitForTimeout(500);
  await page.getByText(/Subject:/).first().scrollIntoViewIfNeeded();
  await shot(page, `register-email-preview-${side}`);
  note("register email preview", side, "frame pieces in the preview", await page.evaluate(() => { const t = document.body.innerText; return { logoImg: !!document.querySelector("img[alt=Smartconferu][height='40']"), titleH2: !![...document.querySelectorAll("h2")].some((h) => /Verify your email/i.test(h.textContent)), signOff: /Best regards,\s*The Smartconferu Team|The Smartconferu Team/.test(t), footerSentWith: /Sent with\s+Smartconferu/.test(t), footerContact: /To contact Smartconferu/.test(t) }; }));
  await ctx.close();
}
// 3. Create Conference: event format -> which fields appear
for (const [side, url] of sides("cc", "/prototype/create-conference", "/create-conference")) {
  for (const format of ["In-Person", "Virtual", "Hybrid"]) {
    const { ctx, page } = await open(url, true);
    await page.getByRole("button", { name: new RegExp(`^${format}`) }).first().click();
    await page.waitForTimeout(400);
    const seen = await page.evaluate(() => ["Venue", "Venue address", "City", "Organizer city", "State / province", "Postal / ZIP code", "Country / region"].filter((l) => [...document.querySelectorAll("label")].some((x) => x.textContent.replace(/\s*\*/, "").trim() === l)));
    note("cc event format", side, `${format}: labels shown`, seen);
    if (format === "In-Person") {
      note("cc venue address", side, "venue-address control", await page.evaluate(() => { const lab = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "Venue address"); const next = lab?.nextElementSibling; return next ? { tag: next.tagName.toLowerCase(), text: next.textContent.replace(/\s+/g, " ").trim().slice(0, 130), inputs: next.querySelectorAll("input,textarea").length } : null; }));
      await shot(page, `cc-in-person-${side}`);
    }
    await ctx.close();
  }
}
// 4. Create Conference: Clear form, draft offer (local storage only), email-count wording
for (const [side, url] of sides("cc", "/prototype/create-conference", "/create-conference")) {
  const { ctx, page } = await open(url, true);
  const clearBefore = await page.getByRole("button", { name: /Clear form/ }).count();
  await page.locator("#cc-title").fill("Evidence Conference");
  await page.waitForTimeout(500);
  const clearAfter = await page.getByRole("button", { name: /Clear form/ }).count();
  note("cc clear form", side, "'Clear form' button before / after typing a title", { before: clearBefore, after: clearAfter });
  const draftKey = await page.evaluate(() => Object.keys(localStorage).filter((k) => /draft/i.test(k)));
  note("cc draft", side, "local-storage draft key after typing", draftKey);
  await shot(page, `cc-dirty-${side}`);
  await page.reload({ waitUntil: "load" }); await page.waitForTimeout(900);
  note("cc draft", side, "'Continue your draft' offer after reload", await page.getByText(/Continue your draft/).count());
  note("cc leave guard", side, "beforeunload handler registered while dirty", await page.evaluate(() => typeof window.onbeforeunload));
  await ctx.close();
}
// 5. Create Conference: the email counts in the compact rows (sample mode)
for (const [side, url] of sides("cc", "/prototype/create-conference", "/create-conference")) {
  const { ctx, page } = await open(url, true);
  note("cc email count", side, "compact rows text", await texts(page, "div").then((t) => t.filter((x) => /^Email: Conference (Approved|Declined)/.test(x)).slice(0, 2).map((x) => x.slice(0, 70))));
  await ctx.close();
}
await b.close();
fs.writeFileSync(path.join(OUT, "observations.json"), JSON.stringify(obs, null, 2));
