// Phase 2 QA: Create Conference draft persistence, "Continue your draft?" offer, leave confirmation, "Clear form".
// Runs each scenario against the prototype and Next.js in fresh browser contexts and compares what each did. Local only: nothing is submitted
// (no request is ever created), no website is typed (the prototype would start its AI read), no Supabase / Google service is contacted.
// Usage: node phase2-qa.mjs <label> -> out/phase2/<label>/{*.png, results.json}
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const label = process.argv[2] || "run";
const OUT = path.resolve("out/phase2", label);
fs.mkdirSync(OUT, { recursive: true });
const KEY = "grs_create_conference_draft";
const SIDES = [["prototype", PROTO + "/prototype/create-conference"], ["next", NEXT + "/create-conference"]];
const results = [];
let pass = 0, differ = 0;
const check = (area, vp, what, got) => {
  const same = JSON.stringify(got.prototype) === JSON.stringify(got.next);
  same ? pass++ : differ++;
  results.push({ area, vp, what, same, prototype: got.prototype, next: got.next });
  console.log(`${same ? "SAME " : "DIFF "} ${area.padEnd(13)} ${vp.padEnd(6)} ${what.padEnd(46)} ${same ? JSON.stringify(got.prototype) : "P " + JSON.stringify(got.prototype) + "  N " + JSON.stringify(got.next)}`.slice(0, 420));
};
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const pad = (png, w, h) => { const o = new PNG({ width: w, height: h }); o.data.fill(255); PNG.bitblt(png, o, 0, 0, png.width, png.height, 0, 0); return o; };
const diffPct = (a, b, out) => { const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b)); const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height); const d = new PNG({ width: w, height: h }); const n = pixelmatch(pad(A, w, h).data, pad(B, w, h).data, d.data, w, h, { threshold: 0.1, includeAA: false }); if (out) fs.writeFileSync(out, PNG.sync.write(d)); return { percent: +(100 * n / (w * h)).toFixed(2), size: [A.width, A.height, B.width, B.height] }; };
const STYLE_PROPS = ["height", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "fontSize", "fontWeight", "lineHeight", "color", "backgroundColor", "backgroundImage", "borderTopStyle", "borderTopWidth", "borderTopColor", "borderBottomWidth", "borderBottomColor", "borderRadius", "boxShadow", "display", "gap", "justifyContent", "alignItems"];

const browser = await launch();
const ctxFor = async (vp) => newContext(browser, vp, true);
/** Runs fn(page, side) on both apps in fresh contexts and returns { prototype, next }. `setup` (optional) runs before the page loads. */
async function both(vp, fn, setup) {
  const got = {};
  for (const [side, url] of SIDES) {
    const ctx = await ctxFor(vp); const page = await ctx.newPage();
    if (setup) await setup(ctx, page, side);
    await openStable(page, url);
    got[side] = await fn(page, side, ctx);
    await ctx.close();
  }
  return got;
}
const policyBox = (page) => page.locator("label", { hasText: /I confirm that I have read/ }).locator("input[type=checkbox]");
const stored = (page) => page.evaluate((k) => { const raw = localStorage.getItem(k); return raw === null ? null : raw; }, KEY);
const storedForm = async (page) => { const raw = await stored(page); if (!raw) return null; try { return JSON.parse(raw); } catch { return "unparseable"; } };
const fillBasics = async (page) => { await page.locator("#cc-title").fill("Draft Test Conference"); await page.locator("#cc-acronym").fill("DTC"); await page.waitForTimeout(350); };
const offerText = (page) => page.evaluate(() => { const t = [...document.querySelectorAll("div")].find((d) => /^Continue your draft/.test(d.textContent.trim()) && d.children.length === 0); const card = t?.closest(".rounded-2xl"); return card ? card.textContent.replace(/\s+/g, " ").trim() : null; });
const modalText = (page, title) => page.evaluate((tt) => { const h = [...document.querySelectorAll("h3")].find((x) => x.textContent.trim() === tt); const m = h?.closest("[data-modal]"); return m ? { text: m.textContent.replace(/\s+/g, " ").trim(), buttons: [...m.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") || b.textContent).trim()).filter(Boolean) } : null; }, title);
const clickModal = (page, name) => page.locator("[data-modal]").getByRole("button", { name, exact: true }).click();
const styleOf = (page, finderSrc) => page.evaluate(({ props, src }) => { const el = new Function(`return (${src})()`)(); if (!el) return null; const cs = getComputedStyle(el); const o = {}; for (const p of props) o[p] = cs[p]; return o; }, { props: STYLE_PROPS, src: finderSrc });
const styleDiffs = (a, b) => (!a || !b ? ["missing on one side"] : STYLE_PROPS.filter((p) => a[p] !== b[p]).map((p) => `${p}: ${a[p]} -> ${b[p]}`));
const draftAgeIn = (ms) => (ctx, page) => ctx.addInitScript(({ k, ms }) => { try { if (!localStorage.getItem("__seeded")) { localStorage.setItem("__seeded", "1"); localStorage.setItem(k, JSON.stringify({ form: { title: "Aged draft", acronym: "AGD" }, savedAt: Date.now() - ms })); } } catch {} }, { k: KEY, ms });
const seed = (value) => (ctx) => ctx.addInitScript(({ k, v }) => { try { if (!localStorage.getItem("__seeded")) { localStorage.setItem("__seeded", "1"); localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } } catch {} }, { k: KEY, v: value });

// ---------------- behaviour (desktop width; the logic is the same at every width, widths are covered visually below)
const D = VIEWPORTS[0];

// 1. what is saved, and when
{
  const got = await both(D, async (page) => {
    const before = await stored(page);
    await fillBasics(page);
    const f = await storedForm(page);
    return { storedBeforeTyping: before, keyShape: f ? { hasForm: !!f.form, savedAtIsNumber: typeof f.savedAt === "number", title: f.form?.title, acronym: f.form?.acronym, type: f.form?.type, confirmPolicy: f.form?.confirmPolicy } : null, formKeys: f?.form ? Object.keys(f.form).sort() : null };
  });
  const keysP = got.prototype.formKeys, keysN = got.next.formKeys;
  check("save", "d1440", "nothing stored before typing; shape after typing", { prototype: [got.prototype.storedBeforeTyping, got.prototype.keyShape], next: [got.next.storedBeforeTyping, got.next.keyShape] });
  results.push({ area: "save", what: "form keys only in prototype / only in next", prototypeOnly: keysP.filter((k) => !keysN.includes(k)), nextOnly: keysN.filter((k) => !keysP.includes(k)) });
  console.log("INFO  save          form keys only in prototype:", JSON.stringify(keysP.filter((k) => !keysN.includes(k))), "| only in next:", JSON.stringify(keysN.filter((k) => !keysP.includes(k))));
}
// 2. refresh -> offer; Continue draft restores
{
  const got = await both(D, async (page) => {
    await page.locator("#cc-title").fill("Draft Test Conference");
    await page.locator("#cc-acronym").fill("DTC");
    await page.locator("input[type=date]").nth(1).fill("2027-05-02");
    await policyBox(page).check();
    await page.waitForTimeout(350);
    await page.reload({ waitUntil: "load" }); await page.waitForTimeout(900);
    const o = await offerText(page);
    const fieldsAfterReload = { title: await page.locator("#cc-title").inputValue(), acronym: await page.locator("#cc-acronym").inputValue() };
    const clearBtnBefore = await page.getByRole("button", { name: "Clear form" }).count();
    await page.getByRole("button", { name: "Continue draft" }).click(); await page.waitForTimeout(400);
    return { offer: o, fieldsAfterReload, clearBtnBeforeContinue: clearBtnBefore, restored: { title: await page.locator("#cc-title").inputValue(), acronym: await page.locator("#cc-acronym").inputValue(), end: await page.locator("input[type=date]").nth(1).inputValue(), policy: await policyBox(page).isChecked() }, offerAfter: await offerText(page), clearBtnAfter: await page.getByRole("button", { name: "Clear form" }).count(), stillStored: !!(await stored(page)) };
  });
  check("refresh+offer", "d1440", "offer text after reload", { prototype: got.prototype.offer, next: got.next.offer });
  check("refresh+offer", "d1440", "form is blank after reload (offer, not restore)", { prototype: got.prototype.fieldsAfterReload, next: got.next.fieldsAfterReload });
  check("continue", "d1440", "restored fields incl. end date and policy tick", { prototype: got.prototype.restored, next: got.next.restored });
  check("continue", "d1440", "offer gone, Clear form shown, draft kept", { prototype: [got.prototype.offerAfter, got.prototype.clearBtnAfter, got.prototype.stillStored], next: [got.next.offerAfter, got.next.clearBtnAfter, got.next.stillStored] });
  check("refresh+offer", "d1440", "no Clear form button while form is untouched", { prototype: got.prototype.clearBtnBeforeContinue, next: got.next.clearBtnBeforeContinue });
}
// 3. Start fresh
{
  const got = await both(D, async (page) => {
    await fillBasics(page); await page.reload({ waitUntil: "load" }); await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Start fresh" }).click(); await page.waitForTimeout(300);
    return { offer: await offerText(page), stored: await stored(page), title: await page.locator("#cc-title").inputValue() };
  });
  check("start fresh", "d1440", "offer gone, draft removed, form blank", got);
}
// 4. typing over an offered draft: the offer disappears and the new work becomes the draft; restoring can never overwrite typed input
{
  const got = await both(D, async (page) => {
    await fillBasics(page); await page.reload({ waitUntil: "load" }); await page.waitForTimeout(800);
    const offered = !!(await offerText(page));
    await page.locator("#cc-title").fill("Typed over it"); await page.waitForTimeout(400);
    const f = await storedForm(page);
    return { offered, offerAfterTyping: await offerText(page), continueButtons: await page.getByRole("button", { name: "Continue draft" }).count(), storedTitle: f?.form?.title, storedAcronym: f?.form?.acronym };
  });
  check("type over", "d1440", "offer hidden once typing starts; stored = new work", got);
}
// 5. blanking the form after an edit removes the draft; an untouched visit never wipes a waiting draft
{
  const got = await both(D, async (page) => {
    await page.locator("#cc-title").fill("Something"); await page.waitForTimeout(300);
    const withText = !!(await stored(page));
    await page.locator("#cc-title").fill(""); await page.waitForTimeout(300);
    return { storedWhileDirty: withText, storedAfterBlank: await stored(page) };
  });
  check("blank form", "d1440", "draft removed when the form is blank again", got);
  const untouched = await both(D, async (page) => ({ stillThere: !!(await stored(page)) }), seed({ form: { title: "Waiting draft" }, savedAt: Date.now() }));
  check("untouched", "d1440", "visiting without editing keeps the waiting draft", untouched);
}
// 6. leave confirmation (breadcrumb + Cancel), Keep editing / Leave keep draft / Discard draft
{
  const got = await both(D, async (page, side) => {
    const url0 = page.url();
    // clean form: leaving is immediate, no dialog
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Conferences").click(); await page.waitForTimeout(900);
    const cleanLeave = { dialog: !!(await modalText(page, "Leave without creating?")), left: page.url() !== url0 };
    await page.goto(url0, { waitUntil: "load" }); await page.waitForTimeout(700);
    await fillBasics(page);
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Conferences").click(); await page.waitForTimeout(400);
    const dirtyModal = await modalText(page, "Leave without creating?");
    await page.screenshot({ path: path.join(OUT, `leave-modal-d1440-${side}.png`) });
    await clickModal(page, "Keep editing"); await page.waitForTimeout(300);
    const keep = { dialogClosed: !(await modalText(page, "Leave without creating?")), stayed: page.url() === url0, titleKept: await page.locator("#cc-title").inputValue(), stored: !!(await stored(page)) };
    // Cancel button (rail, desktop): same dialog
    await page.getByRole("button", { name: "Cancel", exact: true }).click(); await page.waitForTimeout(300);
    const viaCancel = !!(await modalText(page, "Leave without creating?"));
    // overlay click = close
    await page.mouse.click(5, 5); await page.waitForTimeout(300);
    const overlayClosed = !(await modalText(page, "Leave without creating?"));
    await page.getByRole("button", { name: "Cancel", exact: true }).click(); await page.waitForTimeout(300);
    await clickModal(page, "Leave, keep draft"); await page.waitForTimeout(1200);
    const left = { left: page.url() !== url0, draftKept: !!(await stored(page)) };
    await page.goto(url0, { waitUntil: "load" }); await page.waitForTimeout(900);
    const back = { offer: await offerText(page) };
    return { cleanLeave, dirtyModal, keep, viaCancel, overlayClosed, left, back };
  });
  check("leave", "d1440", "clean form leaves at once, no dialog", { prototype: got.prototype.cleanLeave, next: got.next.cleanLeave });
  check("leave", "d1440", "dialog text and buttons (dirty form)", { prototype: got.prototype.dirtyModal, next: got.next.dirtyModal });
  check("leave", "d1440", "Keep editing: stays, input and draft kept", { prototype: got.prototype.keep, next: got.next.keep });
  check("leave", "d1440", "Cancel button opens it; backdrop click closes it", { prototype: [got.prototype.viaCancel, got.prototype.overlayClosed], next: [got.next.viaCancel, got.next.overlayClosed] });
  check("leave", "d1440", "Leave, keep draft: navigates, draft kept", { prototype: got.prototype.left, next: got.next.left });
  check("return", "d1440", "returning to the page offers the kept draft", { prototype: got.prototype.back, next: got.next.back });
}
{
  const got = await both(D, async (page) => {
    const url0 = page.url();
    await fillBasics(page);
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Conferences").click(); await page.waitForTimeout(400);
    await clickModal(page, "Discard draft"); await page.waitForTimeout(1200);
    const left = page.url() !== url0;
    const storedAfter = await stored(page);
    await page.goto(url0, { waitUntil: "load" }); await page.waitForTimeout(800);
    return { left, storedAfter, offerOnReturn: await offerText(page) };
  });
  check("leave", "d1440", "Discard draft: navigates, draft removed, no offer later", got);
}
// 7. Clear form
{
  const got = await both(D, async (page, side) => {
    await fillBasics(page);
    await policyBox(page).check();
    await page.waitForTimeout(300);
    const btn = await page.getByRole("button", { name: "Clear form" }).count();
    await page.getByRole("button", { name: "Clear form" }).click(); await page.waitForTimeout(300);
    const dlg = await modalText(page, "Clear the form?");
    await page.screenshot({ path: path.join(OUT, `clear-dialog-d1440-${side}.png`) });
    await clickModal(page, "Cancel"); await page.waitForTimeout(250);
    const afterCancel = { dialogClosed: !(await modalText(page, "Clear the form?")), title: await page.locator("#cc-title").inputValue(), stored: !!(await stored(page)) };
    await page.getByRole("button", { name: "Clear form" }).click(); await page.waitForTimeout(250);
    await page.mouse.click(5, 5); await page.waitForTimeout(250);
    const afterBackdrop = { dialogClosed: !(await modalText(page, "Clear the form?")), title: await page.locator("#cc-title").inputValue(), stored: !!(await stored(page)) };
    await page.getByRole("button", { name: "Clear form" }).click(); await page.waitForTimeout(250);
    await page.evaluate(() => window.scrollTo(0, 400));
    await clickModal(page, "Clear form"); await page.waitForTimeout(1100);
    const afterConfirm = { dialogClosed: !(await modalText(page, "Clear the form?")), title: await page.locator("#cc-title").inputValue(), acronym: await page.locator("#cc-acronym").inputValue(), policy: await policyBox(page).isChecked(), stored: await stored(page), clearBtn: await page.getByRole("button", { name: "Clear form" }).count(), scrollY: await page.evaluate(() => Math.round(window.scrollY)), offer: await offerText(page) };
    return { btn, dlg, afterCancel, afterBackdrop, afterConfirm };
  });
  check("clear form", "d1440", "button shown once the form is dirty", { prototype: got.prototype.btn, next: got.next.btn });
  check("clear form", "d1440", "confirmation text and buttons", { prototype: got.prototype.dlg, next: got.next.dlg });
  check("clear form", "d1440", "Cancel: nothing cleared, draft kept", { prototype: got.prototype.afterCancel, next: got.next.afterCancel });
  check("clear form", "d1440", "backdrop click = Cancel", { prototype: got.prototype.afterBackdrop, next: got.next.afterBackdrop });
  check("clear form", "d1440", "confirm: blank form, draft removed, scrolled to top", { prototype: got.prototype.afterConfirm, next: got.next.afterConfirm });
}
// 8. editing, then clearing, with an older draft on offer: the cleared draft must not come back
{
  const got = await both(D, async (page) => {
    await page.locator("#cc-title").fill("Newer work"); await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Clear form" }).click(); await page.waitForTimeout(250);
    await clickModal(page, "Clear form"); await page.waitForTimeout(900);
    return { offerAfterClear: await offerText(page), stored: await stored(page) };
  }, seed({ form: { title: "Older draft", acronym: "OLD" }, savedAt: Date.now() - 3600000 }));
  check("clear+older", "d1440", "older draft does not reappear after Clear form", got);
}
// 9. browser close / reload guard, and no prompt for in-app navigation (as in the prototype)
{
  const got = await both(D, async (page, side, ctx) => {
    const out = {};
    const close = async (p) => { let t = null; p.on("dialog", async (d) => { t = d.type(); await d.dismiss().catch(() => {}); }); await p.close({ runBeforeUnload: true }); await new Promise((r) => setTimeout(r, 400)); return t ?? "none"; };
    const clean = await ctx.newPage(); await openStable(clean, page.url()); out.cleanClose = await close(clean);
    await fillBasics(page);
    const dirty = await ctx.newPage(); await openStable(dirty, page.url()); await dirty.locator("#cc-title").fill("x"); out.dirtyClose = await close(dirty);
    await page.getByRole("button", { name: "Conferences" }).first().hover(); await page.waitForTimeout(400);
    const item = page.getByText("My Conferences", { exact: true }).first();
    const url0 = page.url();
    if (await item.count()) { await item.click(); await page.waitForTimeout(1200); }
    out.headerNavigation = { prompted: !!(await modalText(page, "Leave without creating?")), left: page.url() !== url0 };
    return out;
  });
  check("browser guard", "d1440", "no prompt for a clean page; browser prompt for a dirty one", { prototype: [got.prototype.cleanClose, got.prototype.dirtyClose], next: [got.next.cleanClose, got.next.dirtyClose] });
  check("header link", "d1440", "top-menu navigation is not intercepted (as in the prototype)", { prototype: got.prototype.headerNavigation, next: got.next.headerNavigation });
}
// 10. odd storage contents
{
  const legacy = await both(D, async (page) => { await page.getByRole("button", { name: "Continue draft" }).click(); await page.waitForTimeout(400); return { primary: await page.locator("#cc-primaryArea").inputValue(), secondary: await page.locator("#cc-secondaryArea").inputValue() }; }, seed({ form: { title: "Legacy", primaryArea: "Other", secondaryArea: "Not a real sub-area" }, savedAt: Date.now() }));
  check("old draft", "d1440", "old primary name 'Other' maps to Multidisciplinary", legacy);
  const unknown = await both(D, async (page) => { await page.getByRole("button", { name: "Continue draft" }).click(); await page.waitForTimeout(400); return { primary: await page.locator("#cc-primaryArea").inputValue(), secondary: await page.locator("#cc-secondaryArea").inputValue() }; }, seed({ form: { title: "Legacy 2", primaryArea: "Nonexistent Area", secondaryArea: "x" }, savedAt: Date.now() }));
  check("old draft", "d1440", "unknown primary area is dropped with its secondary", unknown);
  const notMeaningful = await both(D, async (page) => ({ offer: !!(await offerText(page)) }), seed({ form: { type: "book", eventType: "virtual" }, savedAt: Date.now() }));
  check("old draft", "d1440", "a draft with nothing typed is not offered", notMeaningful);
  const broken = await both(D, async (page) => ({ offer: !!(await offerText(page)), pageStillWorks: await page.locator("#cc-title").isVisible() }), seed("{not json"));
  check("old draft", "d1440", "unreadable storage entry: no offer, page works", broken);
  const nulls = await both(D, async (page) => ({ offer: !!(await offerText(page)) }), seed({ form: null, savedAt: 1 }));
  check("old draft", "d1440", "entry without a form: no offer", nulls);
}
// 11. age wording
for (const [name, ms] of [["30 s", 30000], ["5 min", 5 * 60000], ["2 hours", 2 * 3600000], ["1 day", 24 * 3600000], ["3 days", 3 * 86400000]]) {
  const got = await both(D, async (page) => ({ offer: await offerText(page) }), draftAgeIn(ms));
  check("age", "d1440", `draft ${name} old`, got);
}

// ---------------- visual comparison at every width (offer card, Clear form button, leave dialog, clear dialog)
for (const vp of VIEWPORTS) {
  const shots = { offer: {}, header: {}, leave: {}, clear: {} };
  const styles = {};
  for (const [side, url] of SIDES) {
    const ctx = await ctxFor(vp);
    await ctx.addInitScript(({ k }) => { try { if (!localStorage.getItem("__seeded")) { localStorage.setItem("__seeded", "1"); localStorage.setItem(k, JSON.stringify({ form: { title: "International Conference on Applied Intelligence", acronym: "ICAI 2027" }, savedAt: Date.now() - 2 * 3600000 })); } } catch {} }, { k: KEY });
    const page = await ctx.newPage(); await openStable(page, url); await page.waitForTimeout(500);
    // offer card
    const card = page.getByText(/^Continue your draft/).first().locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    shots.offer[side] = path.join(OUT, `offer-${vp.name}-${side}.png`); await card.screenshot({ path: shots.offer[side] });
    if (vp.name === "d1440") {
      styles.offer = styles.offer || {}; styles.offer[side] = {
        card: await styleOf(page, `() => [...document.querySelectorAll("div")].find((d) => /^Continue your draft/.test(d.textContent.trim()) && d.children.length === 0)?.closest(".rounded-2xl")`),
        title: await styleOf(page, `() => [...document.querySelectorAll("div")].find((d) => /^Continue your draft/.test(d.textContent.trim()) && d.children.length === 0)`),
        startFresh: await styleOf(page, `() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Start fresh")`),
        continueBtn: await styleOf(page, `() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Continue draft")`),
      };
    }
    // make the form dirty on a fresh page (the offer hides once typing starts)
    await page.getByRole("button", { name: "Start fresh" }).click(); await page.waitForTimeout(200);
    await page.locator("#cc-title").fill("International Conference on Applied Intelligence"); await page.waitForTimeout(300);
    shots.header[side] = path.join(OUT, `header-${vp.name}-${side}.png`); await page.screenshot({ path: shots.header[side], clip: { x: 0, y: 0, width: vp.width, height: 300 } });
    if (vp.name === "d1440") styles.clearBtn = { ...(styles.clearBtn || {}), [side]: await styleOf(page, `() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Clear form")`) };
    // leave dialog through the breadcrumb
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Conferences").click(); await page.waitForTimeout(400);
    shots.leave[side] = path.join(OUT, `leave-${vp.name}-${side}.png`); await page.screenshot({ path: shots.leave[side] });
    if (vp.name === "d1440") {
      const f = (sel) => `() => ${sel}`;
      styles.leave = { ...(styles.leave || {}), [side]: {
        box: await styleOf(page, f(`[...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "Leave without creating?")?.closest("[data-modal]")`)),
        head: await styleOf(page, f(`[...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "Leave without creating?")?.closest(".ui-modal-head")`)),
        title: await styleOf(page, f(`[...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "Leave without creating?")`)),
        foot: await styleOf(page, f(`document.querySelector("[data-modal] .ui-modal-foot")`)),
        discard: await styleOf(page, f(`[...document.querySelectorAll("[data-modal] button")].find((b) => b.textContent.trim() === "Discard draft")`)),
        keep: await styleOf(page, f(`[...document.querySelectorAll("[data-modal] button")].find((b) => b.textContent.trim() === "Keep editing")`)),
        leaveBtn: await styleOf(page, f(`[...document.querySelectorAll("[data-modal] button")].find((b) => b.textContent.trim() === "Leave, keep draft")`)),
      } };
    }
    await clickModal(page, "Keep editing"); await page.waitForTimeout(250);
    // clear dialog
    await page.getByRole("button", { name: "Clear form" }).click(); await page.waitForTimeout(400);
    shots.clear[side] = path.join(OUT, `clear-${vp.name}-${side}.png`); await page.screenshot({ path: shots.clear[side] });
    if (vp.name === "d1440") {
      const f = (sel) => `() => ${sel}`;
      styles.clear = { ...(styles.clear || {}), [side]: {
        box: await styleOf(page, f(`[...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "Clear the form?")?.closest("[data-modal]")`)),
        head: await styleOf(page, f(`[...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "Clear the form?")?.closest(".ui-modal-head")`)),
        iconCircle: await styleOf(page, f(`[...document.querySelectorAll("[data-modal] svg")].map((s) => s.parentElement).find((p) => p && p.className.toString().includes("rounded-full"))`)),
        message: await styleOf(page, f(`[...document.querySelectorAll("[data-modal] p")][0]`)),
        foot: await styleOf(page, f(`document.querySelector("[data-modal] .ui-modal-foot")`)),
        cancel: await styleOf(page, f(`[...document.querySelectorAll("[data-modal] button")].find((b) => b.textContent.trim() === "Cancel")`)),
        confirm: await styleOf(page, f(`[...document.querySelectorAll("[data-modal] button")].find((b) => b.textContent.trim() === "Clear form")`)),
      } };
    }
    await ctx.close();
  }
  for (const k of Object.keys(shots)) { const d = diffPct(shots[k].prototype, shots[k].next, path.join(OUT, `${k}-${vp.name}-diff.png`)); results.push({ area: "visual", vp: vp.name, what: `${k} pixel diff`, ...d }); console.log(`VISUAL ${k.padEnd(8)} ${vp.name.padEnd(6)} pixel diff ${d.percent}%  sizes P ${d.size[0]}x${d.size[1]}  N ${d.size[2]}x${d.size[3]}`); }
  if (vp.name === "d1440") for (const group of Object.keys(styles)) {
    const parts = styles[group];
    if (group === "clearBtn") { const dd = styleDiffs(parts.prototype, parts.next); results.push({ area: "style", what: group, diffs: dd }); console.log(`STYLE  ${group.padEnd(10)} ${dd.length ? dd.join(" | ") : "identical"}`); continue; }
    for (const part of Object.keys(parts.prototype)) { const dd = styleDiffs(parts.prototype[part], parts.next[part]); results.push({ area: "style", what: `${group}.${part}`, diffs: dd }); console.log(`STYLE  ${(group + "." + part).padEnd(20)} ${dd.length ? dd.join(" | ") : "identical"}`); }
  }
}
await browser.close();
console.log(`\nbehaviour checks: ${pass} same, ${differ} differ`);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
