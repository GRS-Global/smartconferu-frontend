// Chair Peer Review slice 2: row selection and the bulk bar (Assign same reviewers, Auto-assign, Edit decisions), prototype vs Next.js on the same 498
// papers, the same committee and the same assignments (qa/gen-peer-fixtures.mjs). Nothing is sent: the prototype changes only its own memory and the
// Next.js mock keeps nothing. Usage: node peer-bulk-qa.mjs <label> -> out/peer-review/<label>/bulk.json
import fs from "node:fs";
import path from "node:path";
import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const label = process.argv[2] || "run";
const vpName = process.argv[3] || "d1440";
const VP = VIEWPORTS.find((v) => v.name === vpName) || VIEWPORTS[0];
const OUT = path.resolve("out/peer-review", label);
fs.mkdirSync(OUT, { recursive: true });
const results = []; let same = 0, differ = 0;
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const check = (what, got, note = "") => { const ok = JSON.stringify(got.prototype) === JSON.stringify(got.next); ok ? same++ : differ++; results.push({ what, same: ok, note, ...got }); console.log(`${ok ? "SAME " : "DIFF "} ${what.padEnd(58)} ${ok ? JSON.stringify(got.prototype) : "P " + JSON.stringify(got.prototype) + "  N " + JSON.stringify(got.next)}`.slice(0, 520)); };
const browser = await launch();
const SIDES = [["prototype", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]];
async function both(fn) {
  const got = {};
  for (const [side, url] of SIDES) {
    const ctx = await newContext(browser, VP, true); const pg = await ctx.newPage();
    for (let i = 0; i < 3; i++) { try { await openStable(pg, url); break; } catch { await pg.waitForTimeout(1500); } }
    await pg.waitForSelector("tbody tr", { timeout: 90000 }).catch(() => undefined);
    await pg.waitForTimeout(500);
    try { got[side] = await fn(pg, side); } catch (e) { got[side] = "ERROR " + String(e).slice(0, 140); }
    await ctx.close();
  }
  return got;
}
const rowBoxes = (pg) => pg.locator("tbody input[type=checkbox]");
const selText = (pg) => pg.evaluate(() => (document.body.innerText.match(/(\d+) selected/) || [null, null])[1]);
const bar = (pg) => pg.evaluate(() => { const b = [...document.querySelectorAll("div")].find((d) => /\d+ selected/.test(d.firstElementChild?.textContent || "") && getComputedStyle(d).backgroundColor === "rgb(11, 16, 32)"); return b ? [...b.querySelectorAll("button")].map((x) => x.textContent.trim()) : null; });
const modal = (pg) => pg.locator(".ui-accent-card").last();
const toast = (pg) => pg.evaluate(() => { const t = document.querySelector("[role=status]"); return t ? t.innerText.replace(/\s+/g, " ").trim() : null; });
const filterStatus = async (pg, key) => { await pg.locator("thead select").first().selectOption(key); await pg.waitForTimeout(300); };
const selectNeeds = async (pg) => { await filterStatus(pg, "needs"); await pg.locator("thead input[type=checkbox]").first().check(); await pg.waitForTimeout(200); };

// ---- selection
check("no bulk bar before anything is selected", await both(async (pg) => ({ count: await selText(pg), bar: await bar(pg) })));
check("one row selected: count text", await both(async (pg) => { await rowBoxes(pg).nth(0).click(); return selText(pg); }));
check("one row selected: bar buttons (prototype also has Send reminder)", await both(async (pg) => { await rowBoxes(pg).nth(0).click(); return (await bar(pg))?.filter((t) => t !== "Send reminder"); }), "Send reminder is blocked on the backend and not shown in Next.js");
check("select all shown: count", await both(async (pg) => { await pg.locator("thead input[type=checkbox]").first().check(); return selText(pg); }));
check("select all shown, then untick one row: header unticks", await both(async (pg) => { await pg.locator("thead input[type=checkbox]").first().check(); await rowBoxes(pg).nth(0).click(); return { header: await pg.locator("thead input[type=checkbox]").first().isChecked(), count: await selText(pg) }; }));
check("shift-click selects the range", await both(async (pg) => { await rowBoxes(pg).nth(0).click(); await rowBoxes(pg).nth(3).click({ modifiers: ["Shift"] }); return selText(pg); }));
check("selection survives a filter change", await both(async (pg) => { await rowBoxes(pg).nth(0).click(); await rowBoxes(pg).nth(1).click(); await filterStatus(pg, "needs"); return selText(pg); }));
check("select all under a filter adds only the shown rows", await both(async (pg) => { await filterStatus(pg, "needs"); await pg.locator("thead input[type=checkbox]").first().check(); return { count: await selText(pg), rows: await pg.locator("tbody > tr").count() }; }));
check("Clear empties the selection and hides the bar", await both(async (pg) => { await rowBoxes(pg).nth(0).click(); await pg.getByRole("button", { name: "Clear", exact: true }).click(); return { count: await selText(pg), bar: await bar(pg) }; }));
check("row checkbox does not open the paper", await both(async (pg) => { const u = pg.url(); await rowBoxes(pg).nth(2).click(); await pg.waitForTimeout(400); return pg.url() === u; }));

// ---- auto-assign
const openAuto = async (pg) => { await pg.locator("thead input[type=checkbox]").first().check(); await pg.getByRole("button", { name: "Auto-assign" }).click(); await pg.getByText("Auto-assign reviewers").first().waitFor({ timeout: 20000 }); await pg.waitForTimeout(400); };
const summary = (pg) => modal(pg).evaluate((m) => ({ sub: m.querySelector("h3 + p")?.textContent.trim(), line: (m.innerText.match(/(\d+) papers? (\d+) reviewers? to assign/) || []).slice(1, 3), button: [...m.querySelectorAll("button")].map((b) => b.textContent.trim()).find((t) => /^Assign \d+ reviewer/.test(t)), slots: (m.innerText.match(/slots? empty/g) || []).length, picks: m.querySelectorAll("li button[aria-label^='Remove']").length }));
check("auto-assign (all selected): subtitle, totals, button", await both(async (pg) => { await openAuto(pg); return summary(pg); }));
check("auto-assign: nothing to assign for papers that already have reviewers", await both(async (pg) => { await filterStatus(pg, "decided"); await pg.locator("thead input[type=checkbox]").first().check(); await pg.getByRole("button", { name: "Auto-assign" }).click(); await pg.getByText("Auto-assign reviewers").first().waitFor({ timeout: 20000 }); return norm(await modal(pg).innerText()).replace(/Auto-assign reviewers/, "").slice(0, 160); }));
check("auto-assign: who-gets-what names (sorted)", await both(async (pg) => { await openAuto(pg); return modal(pg).evaluate((m) => (m.innerText.match(/Who gets what:([\s\S]*?)Picked by/) || ["", ""])[1].replace(/\s+/g, " ").replace(/\+\d+/g, "").trim().split(/\s{1}(?=[A-Z][a-z]+ [A-Z])/).sort()); }), "ranking differs: the prototype matches expertise first, which the database cannot");
check("auto-assign: remove a pick gives an empty slot", await both(async (pg) => { await openAuto(pg); const before = await summary(pg); await modal(pg).locator("li button[aria-label^='Remove']").first().click(); await pg.waitForTimeout(200); const after = await summary(pg); return { slotsBefore: before.slots, slotsAfter: after.slots, totalDelta: Number(before.line[1]) - Number(after.line[1]) }; }));
check("auto-assign: Cancel closes", await both(async (pg) => { await openAuto(pg); await modal(pg).getByRole("button", { name: "Cancel" }).click(); await pg.waitForTimeout(250); return await pg.getByText("Auto-assign reviewers").count(); }));
check("auto-assign: deadline defaults to a future date", await both(async (pg) => { await openAuto(pg); const v = await modal(pg).locator("input[type=date]").inputValue(); return v > "2026-11-03"; }));
check("auto-assign: Assign shows the toast", await both(async (pg) => { await openAuto(pg); await modal(pg).getByRole("button", { name: /^Assign \d+ reviewer/ }).click(); await pg.waitForTimeout(1500); return (await toast(pg))?.replace(/\d+ papers · \d+ reviewers? emailed.*$/, "<detail>"); }));

// ---- assign same reviewers
const IDS = JSON.parse(fs.readFileSync("out/peer-review-proto.json", "utf8")).rows.filter((r) => r.assignLink).slice(0, 3).map((r) => r.id);
const openSame = async (pg, n = 3) => { for (const id of IDS.slice(0, n)) await pg.locator("tbody tr", { hasText: id }).first().locator("input[type=checkbox]").click(); await pg.getByRole("button", { name: "Assign same reviewers" }).click(); await pg.getByText("Assign Reviewers").first().waitFor({ timeout: 15000 }); await pg.waitForTimeout(250); };
check("assign same: title, text, reviewers", await both(async (pg) => { await openSame(pg); return modal(pg).evaluate((m) => ({ title: m.querySelector("h3")?.textContent.trim(), text: m.querySelector("p")?.textContent.trim(), reviewers: [...m.querySelectorAll("label")].map((l) => l.textContent.replace(/\s+/g, " ").trim()).filter((t) => t && !/Review deadline/.test(t)).map((t) => t.replace(/ ?Suggested.*$/, "").replace(/ Invited$/, "")).sort() })); }));
check("assign same: Assign is disabled until a reviewer is ticked", await both(async (pg) => { await openSame(pg); const b = modal(pg).getByRole("button", { name: /^Assign$/ }); const off = await b.isDisabled(); await modal(pg).locator("input[type=checkbox]").first().check(); return { before: off, after: await b.isDisabled() }; }));
check("assign same: deadline field", await both(async (pg) => { await openSame(pg); return { has: await modal(pg).locator("input[type=date]").count(), future: (await modal(pg).locator("input[type=date]").inputValue()) > "2026-11-03" }; }));
check("assign same: singular text for one paper", await both(async (pg) => { await openSame(pg, 1); return modal(pg).evaluate((m) => m.querySelector("p")?.textContent.trim()); }));
const tick = (pg, name) => modal(pg).locator("label", { hasText: name }).locator("input[type=checkbox]").first().check();
check("assign same: a reviewer free for all 3 papers -> 3 assignments", await both(async (pg) => { await openSame(pg, 3); await tick(pg, "Priya Ramanathan"); await modal(pg).getByRole("button", { name: /^Assign$/ }).click(); await pg.waitForTimeout(1500); return toast(pg); }));
check("assign same: a reviewer already on one paper is skipped for it -> 2", await both(async (pg) => { await openSame(pg, 3); await tick(pg, "Devon Marsh"); await modal(pg).getByRole("button", { name: /^Assign$/ }).click(); await pg.waitForTimeout(1500); return toast(pg); }));
check("assign same: two reviewers on 3 papers -> assignments made", await both(async (pg) => { await openSame(pg, 3); await tick(pg, "Priya Ramanathan"); await tick(pg, "Liu Wei"); await modal(pg).getByRole("button", { name: /^Assign$/ }).click(); await pg.waitForTimeout(1500); return toast(pg); }));
check("assign same: the dialog closes and the selection is cleared after Assign", await both(async (pg) => { await openSame(pg, 3); await tick(pg, "Priya Ramanathan"); await modal(pg).getByRole("button", { name: /^Assign$/ }).click(); await pg.waitForTimeout(1500); return { open: await pg.locator(".ui-accent-card").count(), selected: await selText(pg) }; }));
check("assign same: closes with the X and keeps the selection", await both(async (pg) => { await openSame(pg, 2); await modal(pg).getByRole("button", { name: "Close" }).click(); await pg.waitForTimeout(250); return { open: await pg.locator(".ui-accent-card").count(), selected: await selText(pg) }; }));

// ---- edit decisions
const openDecide = async (pg, n = 2) => { for (let i = 0; i < n; i++) await rowBoxes(pg).nth(i).click(); await pg.getByRole("button", { name: "Edit decisions" }).click(); await pg.getByText(/Apply to \d+ selected/).waitFor({ timeout: 15000 }); await pg.waitForTimeout(250); };
check("edit decisions: heading and options", await both(async (pg) => { await openDecide(pg); return modal(pg).evaluate((m) => ({ title: m.querySelector("h3")?.textContent.trim(), text: m.querySelector("p")?.textContent.trim(), options: [...m.querySelectorAll("button[aria-pressed]")].map((b) => b.innerText.replace(/\s+/g, " ").trim()) })); }));
check("edit decisions: Apply disabled until a type is picked", await both(async (pg) => { await openDecide(pg); const b = modal(pg).getByRole("button", { name: "Apply", exact: true }); const off = await b.isDisabled(); await modal(pg).locator("button[aria-pressed]").nth(3).click(); return { before: off, after: await b.isDisabled() }; }));
check("edit decisions: a stage type says it only moves the papers", await both(async (pg) => { await openDecide(pg); await modal(pg).locator("button[aria-pressed]").nth(2).click(); return norm(await modal(pg).locator("p", { hasText: "only moves" }).first().innerText()); }));
check("edit decisions: confirm step (stage type)", await both(async (pg) => { await openDecide(pg); await modal(pg).locator("button[aria-pressed]").nth(2).click(); await modal(pg).getByRole("button", { name: "Apply", exact: true }).click(); await pg.waitForTimeout(250); return modal(pg).evaluate((m) => ({ title: m.querySelector("h3")?.textContent.trim(), buttons: [...m.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) => t && t !== "Close"), bullets: [...m.querySelectorAll("li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()) })); }));
check("edit decisions: confirm step (a real decision) wording", await both(async (pg) => { await openDecide(pg); await modal(pg).locator("button[aria-pressed]").nth(5).click(); await modal(pg).getByRole("button", { name: "Apply", exact: true }).click(); await pg.waitForTimeout(250); return modal(pg).evaluate((m) => [...m.querySelectorAll("li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()).slice(0, 1)); }), "by design: the prototype says the authors are emailed; Next.js records silently (migration 0002)");
check("edit decisions: Back returns to the list of types", await both(async (pg) => { await openDecide(pg); await modal(pg).locator("button[aria-pressed]").nth(5).click(); await modal(pg).getByRole("button", { name: "Apply", exact: true }).click(); await modal(pg).getByRole("button", { name: "Back" }).click(); await pg.waitForTimeout(200); return modal(pg).locator("button[aria-pressed]").count(); }));
check("edit decisions: confirm shows 'already has this decision'", await both(async (pg) => { await filterStatus(pg, "decided"); await rowBoxes(pg).nth(0).click(); await pg.getByRole("button", { name: "Edit decisions" }).click(); await pg.getByText(/Apply to \d+ selected/).waitFor({ timeout: 15000 }); const label = await pg.evaluate(() => document.querySelector("tbody tr select")?.selectedOptions[0]?.textContent.trim()); await modal(pg).locator("button[aria-pressed]", { hasText: new RegExp("^\\s*" + label) }).first().click(); await modal(pg).getByRole("button", { name: "Apply", exact: true }).click(); await pg.waitForTimeout(250); return modal(pg).evaluate((m) => [...m.querySelectorAll("li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()).filter((t) => /already/.test(t))); }));
check("edit decisions: Yes, change N decisions shows the toast", await both(async (pg) => { await openDecide(pg, 2); await modal(pg).locator("button[aria-pressed]").nth(2).click(); await modal(pg).getByRole("button", { name: "Apply", exact: true }).click(); await modal(pg).getByRole("button", { name: /^Yes, change/ }).click(); await pg.waitForTimeout(1200); return toast(pg); }));
check("edit decisions: closes with X and keeps the selection", await both(async (pg) => { await openDecide(pg, 2); await modal(pg).getByRole("button", { name: "Close" }).click(); await pg.waitForTimeout(250); return { open: await pg.getByText(/Apply to \d+ selected/).count(), selected: await selText(pg) }; }));

await browser.close();
fs.writeFileSync(path.join(OUT, `bulk-${vpName}.json`), JSON.stringify(results, null, 1));
console.log(`\nSAME ${same}  DIFF ${differ}`);
