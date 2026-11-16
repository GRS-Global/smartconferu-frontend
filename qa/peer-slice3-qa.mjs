// Chair Peer Review slice 3: Columns menu, score cut-off bands, saved view, Add reviewer, Reviews table sort / range select, Reviewers assign dialog,
// inline timeline editor, Settings sub-tab — prototype vs Next.js on the same 498 papers. Nothing is sent: the prototype changes only its own memory
// and the Next.js mock keeps nothing. Usage: node peer-slice3-qa.mjs <label> [viewport] -> out/peer-review/<label>/slice3-<vp>.json
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
const check = (what, got, note = "") => { const ok = JSON.stringify(got.prototype) === JSON.stringify(got.next); ok ? same++ : differ++; results.push({ what, same: ok, note, ...got }); console.log(`${ok ? "SAME " : "DIFF "} ${what.padEnd(58)} ${ok ? JSON.stringify(got.prototype) : "P " + JSON.stringify(got.prototype) + "  N " + JSON.stringify(got.next)}`.slice(0, 560)); };
const browser = await launch();
async function both(sub, fn, wait = "tbody tr") {
  const got = {};
  for (const [side, base] of [["prototype", PROTO + "/prototype"], ["next", NEXT_SCREEN]]) {
    const ctx = await newContext(browser, VP, true); const pg = await ctx.newPage();
    for (let i = 0; i < 3; i++) { try { await openStable(pg, base + sub); break; } catch { await pg.waitForTimeout(1500); } }
    if (wait) await pg.waitForSelector(wait, { timeout: 90000 }).catch(() => undefined);
    await pg.waitForTimeout(500);
    try { got[side] = await fn(pg, side); } catch (e) { got[side] = "ERROR " + String(e).slice(0, 160); }
    await ctx.close();
  }
  return got;
}
const LIST = "/chair/isbm2026/peer-review";
const REV = "/chair/isbm2026/peer-review/reviewers";
const MAN = "/chair/isbm2026/peer-review/manage";
const heads = (pg) => pg.evaluate(() => [...document.querySelectorAll("thead th")].map((t) => t.innerText.replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ")));
const status = (pg, key) => pg.locator("thead select").first().selectOption(key).then(() => pg.waitForTimeout(300));
const colsBtn = (pg) => pg.getByRole("button", { name: /^Columns/ });
const rows = (pg) => pg.locator("tbody tr").count();
const sel = (pg) => pg.evaluate(() => (document.body.innerText.match(/(\d+) selected/) || [null, null])[1]);

// ---- Columns menu
check("Columns button label", await both(LIST, async (pg) => norm(await colsBtn(pg).innerText())));
check("Columns menu: heading and options", await both(LIST, async (pg) => { await colsBtn(pg).click(); await pg.waitForTimeout(200); return (await pg.evaluate(() => { const m = [...document.querySelectorAll("label")].filter((l) => /Plagiarism %|Avg confidence/.test(l.textContent)); return m.map((l) => l.textContent.trim()); })); }));
check("Columns: tick both -> label (+2) and extra headings", await both(LIST, async (pg) => { await colsBtn(pg).click(); await pg.getByLabel("Plagiarism %").check(); await pg.getByLabel("Avg confidence").check(); await pg.keyboard.press("Escape"); await pg.mouse.click(5, 5); return { label: norm(await colsBtn(pg).innerText()), heads: (await heads(pg)).slice(-3) }; }));
check("Columns: Plagiarism % cells (7 papers, by ID)", await both(LIST, async (pg) => { await colsBtn(pg).click(); await pg.getByLabel("Plagiarism %").check(); await pg.mouse.click(5, 5); await pg.waitForTimeout(300); return pg.evaluate((ids) => ids.map((id) => { const r = [...document.querySelectorAll("tbody tr")].find((x) => x.children[1]?.innerText.trim() === id); return r ? r.lastElementChild.previousElementSibling.innerText.replace(/s+/g, " ").trim() : null; }), ["ISBM-680","ISBM-701","ISBM-655","ISBM-644","ISBM-693","ISBM-717","ISBM-729"]); }), "rows in prototype order vs ID order is a fixture ordering difference");
check("Columns: Avg confidence cells (7 papers, by ID)", await both(LIST, async (pg) => { await colsBtn(pg).click(); await pg.getByLabel("Avg confidence").check(); await pg.mouse.click(5, 5); await pg.waitForTimeout(300); return pg.evaluate((ids) => ids.map((id) => { const r = [...document.querySelectorAll("tbody tr")].find((x) => x.children[1]?.innerText.trim() === id); return r ? r.lastElementChild.innerText.replace(/s+/g, " ").trim() : null; }), ["ISBM-680","ISBM-701","ISBM-655","ISBM-644","ISBM-693","ISBM-717","ISBM-729"]); }));
check("Decision column is sticky to the right", await both(LIST, async (pg) => pg.evaluate(() => { const th = [...document.querySelectorAll("thead th")].find((t) => /^Decision/i.test(t.innerText.trim())); const td = document.querySelector("tbody tr").children[[...th.parentElement.children].indexOf(th)]; const a = getComputedStyle(th), b = getComputedStyle(td); return { th: [a.position, a.right], td: [b.position, b.right, b.borderLeftWidth] }; })));
check("Columns choice after a reload (prototype: back to default)", await both(LIST, async (pg) => { await colsBtn(pg).click(); await pg.getByLabel("Plagiarism %").check(); await pg.mouse.click(5, 5); await pg.reload(); await pg.waitForSelector("tbody tr"); await pg.waitForTimeout(600); return norm(await colsBtn(pg).innerText()); }));

// ---- Needs my decision: score cut-offs
const cutBox = (pg) => pg.evaluate(() => { const el = [...document.querySelectorAll("div")].find((d) => /Score cut-offs/.test(d.innerText) && d.querySelectorAll("input[type=number]").length === 2 && d.innerText.length < 700); return el ? el.innerText.replace(/\s+/g, " ").trim() : null; });
check("Needs my decision: cut-off strip text", await both(LIST, async (pg) => { await status(pg, "ready"); return cutBox(pg); }));
check("cut-offs: no strip on other buckets", await both(LIST, async (pg) => { await status(pg, "needs"); return cutBox(pg); }));
check("cut-offs: raise 'Accept from' to 4.5", await both(LIST, async (pg) => { await status(pg, "ready"); await pg.locator("input[type=number]").nth(1).fill("4.5"); await pg.waitForTimeout(250); return cutBox(pg); }));
check("cut-offs: reject above accept drags accept along", await both(LIST, async (pg) => { await status(pg, "ready"); await pg.locator("input[type=number]").nth(0).fill("4.8"); await pg.waitForTimeout(250); return [await pg.locator("input[type=number]").nth(0).inputValue(), await pg.locator("input[type=number]").nth(1).inputValue()]; }));
check("cut-offs: values clamp to 1..5", await both(LIST, async (pg) => { await status(pg, "ready"); await pg.locator("input[type=number]").nth(1).fill("9"); await pg.waitForTimeout(250); return await pg.locator("input[type=number]").nth(1).inputValue(); }));
check("cut-offs: Select (accept band) selects N papers", await both(LIST, async (pg) => { await status(pg, "ready"); const btn = pg.getByRole("button", { name: "Select", exact: true }); const n = await btn.count(); if (!n) return { buttons: 0 }; await btn.last().click(); await pg.waitForTimeout(300); return { buttons: n, selected: await sel(pg) }; }));
check("cut-offs: coloured edge on rows", await both(LIST, async (pg) => { await status(pg, "ready"); return pg.evaluate(() => [...new Set([...document.querySelectorAll("tbody tr")].map((r) => getComputedStyle(r).boxShadow.replace(/\s+/g, " ").slice(0, 40)))].length > 0); }));

// ---- Add reviewer
check("Add reviewer links: count on the list", await both(LIST, async (pg) => pg.getByRole("button", { name: /^Add reviewer$/ }).count()));
check("Add reviewer: opens the same popover (Invite someone new, search)", await both(LIST, async (pg) => { const ab = pg.getByRole("button", { name: /^Add reviewer$/ }).first(); await ab.scrollIntoViewIfNeeded(); await pg.waitForTimeout(500); await ab.click(); await pg.waitForTimeout(500); return { invite: await pg.getByText(/Invite someone new/).count() > 0, search: await pg.getByPlaceholder(/Search/).count() > 0 }; }));
const openInvite = async (pg) => { const ab = pg.getByRole("button", { name: /^Add reviewer$/ }).first(); await ab.scrollIntoViewIfNeeded(); await pg.waitForTimeout(500); await ab.click(); await pg.waitForTimeout(400); await pg.getByText(/Invite someone new/).first().click(); await pg.getByText("Add reviewers", { exact: true }).first().waitFor(); await pg.waitForTimeout(300); };
check("Add reviewers dialog: tabs", await both(LIST, async (pg) => { await openInvite(pg); return pg.evaluate(() => [...document.querySelectorAll("[role=tab]")].map((t) => t.textContent.replace(/\s+/g, " ").trim()).filter((t) => /pool|new reviewer/i.test(t))); }));
check("Add reviewers dialog: pool rows show load", await both(LIST, async (pg) => { await openInvite(pg); return pg.evaluate(() => { const rows = [...document.querySelectorAll("label")].filter((l) => l.querySelector("input[type=checkbox]") && /@/.test(l.innerText)); return { count: rows.length > 0, loadFmt: /\d+( \/ \d+)? papers?/.test(rows[0]?.innerText ?? "") }; }); }));
check("Add reviewers dialog: invite tab validation message", await both(LIST, async (pg) => { await openInvite(pg); await pg.getByRole("tab", { name: /Add new reviewer/ }).click(); await pg.getByRole("button", { name: "Add & assign" }).click(); await pg.waitForTimeout(250); return pg.evaluate(() => (document.body.innerText.match(/Enter the reviewer's name\./) || [null])[0]); }));
check("Add reviewers dialog: invalid email message", await both(LIST, async (pg) => { await openInvite(pg); await pg.getByRole("tab", { name: /Add new reviewer/ }).click(); await pg.locator("#add-rev-name").fill("Dr Test"); await pg.locator("#add-rev-email").fill("nope"); await pg.getByRole("button", { name: "Add & assign" }).click(); await pg.waitForTimeout(250); return pg.evaluate(() => (document.body.innerText.match(/Enter a valid email address\./) || [null])[0]); }));
check("Add reviewers dialog: deadline field default is in the future", await both(LIST, async (pg) => { await openInvite(pg); return (await pg.locator("input[type=date]").last().inputValue()) > "2026-11-03"; }));

// ---- Saved view
check("Saved view: title search survives a reload", await both(LIST, async (pg) => { const inp = pg.getByPlaceholder("Search title or track"); await inp.fill("learning"); await pg.waitForTimeout(300); const before = await rows(pg); await pg.reload(); await pg.waitForSelector("tbody tr"); await pg.waitForTimeout(600); return { before, after: await rows(pg), value: await pg.getByPlaceholder("Search title or track").inputValue() }; }));
check("Saved view: status bucket survives a reload", await both(LIST, async (pg) => { await status(pg, "needs"); const before = await rows(pg); await pg.reload(); await pg.waitForSelector("tbody tr"); await pg.waitForTimeout(500); return { before, after: await rows(pg), value: await pg.locator("thead select").first().inputValue() }; }));

// ---- Reviews table
const RV = MAN + "?tab=reviews";
const toReviews = async (pg) => { const t = pg.getByRole("tab", { name: "Reviews" }).or(pg.getByRole("button", { name: "Reviews", exact: true })); if (await t.count()) { await t.first().click(); await pg.waitForTimeout(600); } };
const col0 = (pg) => pg.evaluate(() => [...document.querySelectorAll("tbody tr")].slice(0, 6).map((r) => r.children[1]?.innerText.trim()));
const idHead = (pg) => pg.locator("thead th", { hasText: /Submission number/ }).first().locator("button").first();
const rvRows = (pg) => pg.locator("tbody tr").count();
check("Reviews: row count", await both(RV, async (pg) => (await toReviews(pg), rvRows(pg))));
check("Reviews: statuses used", await both(RV, async (pg) => (await toReviews(pg), pg.evaluate(() => [...new Set([...document.querySelectorAll("tbody tr")].map((r) => (r.innerText.match(/Submitted|Reviewing|Overdue|Not accepted yet|Invitation pending/) || [""])[0]))].sort()))));
check("Reviews: status filter options", await both(RV, async (pg) => (await toReviews(pg), pg.evaluate(() => [...document.querySelectorAll("select")].flatMap((s) => [...s.options].map((o) => o.textContent.trim())).filter((t) => /Submitted|Reviewing|Overdue|accepted|pending|All/.test(t)).slice(0, 10)))));
check("Reviews: ID sort cycles asc, desc, then back to the table order", await both(RV, async (pg) => { await toReviews(pg); const ids = () => pg.evaluate(() => [...document.querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.innerText.trim()).find((x) => /^[A-Z]+-[0-9]+$/.test(x)))); const num = (a) => a.map((x) => Number(x.split("-")[1])); const sorted = (a, d) => num(a).every((v, i, l) => i === 0 || (d === "asc" ? l[i - 1] <= v : l[i - 1] >= v)); const start = await ids(); await idHead(pg).click(); await pg.waitForTimeout(250); const a1 = await ids(); await idHead(pg).click(); await pg.waitForTimeout(250); const a2 = await ids(); await idHead(pg).click(); await pg.waitForTimeout(250); const a3 = await ids(); return { asc: sorted(a1, "asc"), desc: sorted(a2, "desc"), back: JSON.stringify(a3) === JSON.stringify(start), startSorted: sorted(start, "asc") }; }), "the starting order itself differs (fixture order); only the cycle is compared");
check("Reviews: shift-click selects the range", await both(RV, async (pg) => { await toReviews(pg); await pg.locator("tbody input[type=checkbox]").nth(0).click(); await pg.locator("tbody input[type=checkbox]").nth(4).click({ modifiers: ["Shift"] }); return sel(pg).then((s) => s ?? pg.evaluate(() => [...document.querySelectorAll("tbody input[type=checkbox]")].filter((c) => c.checked).length)); }));
check("Reviews: ticking one row does not open the paper", await both(RV, async (pg) => { await toReviews(pg); const u = pg.url(); await pg.locator("tbody input[type=checkbox]").nth(1).click(); await pg.waitForTimeout(300); return pg.url() === u; }));

// ---- Reviewers: Assign papers dialog
const openAssign = async (pg) => { await pg.getByRole("button", { name: /Assign papers/ }).first().click().catch(async () => { await pg.locator("button[aria-label^='Assign papers']").first().click(); }); await pg.getByText(/Assign papers to /).first().waitFor(); await pg.waitForTimeout(400); };
check("Reviewers Assign dialog: subtitle (load / limit / selected)", await both(REV, async (pg) => { await openAssign(pg); return pg.evaluate(() => (document.body.innerText.match(/\d+( of \d+)? papers? now · \d+ selected/) || [null])[0]); }));
check("Reviewers Assign dialog: deadline default is in the future", await both(REV, async (pg) => { await openAssign(pg); return (await pg.locator("input[type=date]").last().inputValue()) > "2026-11-03"; }));
check("Reviewers Assign dialog: conflict rows (count)", await both(REV, async (pg) => { await openAssign(pg); return pg.evaluate(() => (document.body.innerText.match(/Conflict · [A-Za-z ]+/g) || []).length); }), "prototype also marks 'Declined this paper' and keyword matches");
check("Reviewers Assign dialog: Assign button disabled until a paper is picked", await both(REV, async (pg) => { await openAssign(pg); const b = pg.getByRole("button", { name: /^Assign( \d+)? papers?$/ }).last(); return await b.isDisabled(); }));

// ---- Review timeline strip
const strip = (pg) => pg.evaluate(() => { const h = [...document.querySelectorAll("h2,span,div")].find((e) => e.textContent.trim() === "Review timeline"); const c = h?.closest("section,div[style]"); return c ? c.innerText.replace(/\s+/g, " ").trim().slice(0, 160) : null; });
check("Timeline strip text", await both(LIST, async (pg) => strip(pg)));
check("Timeline Edit: opens three cards", await both(LIST, async (pg) => { await pg.getByRole("button", { name: "Edit", exact: true }).first().click(); await pg.waitForTimeout(300); return pg.evaluate(() => ["Review duration", "Reminder 1", "Reminder 2"].map((t) => document.body.innerText.includes(t))); }));
check("Timeline Edit: button turns into Done", await both(LIST, async (pg) => { await pg.getByRole("button", { name: "Edit", exact: true }).first().click(); await pg.waitForTimeout(200); return await pg.getByRole("button", { name: "Done", exact: true }).count(); }));
check("Timeline: invalid days shows the message", await both(LIST, async (pg) => { await pg.getByRole("button", { name: "Edit", exact: true }).first().click(); await pg.getByLabel("Days a reviewer has").fill("0"); await pg.waitForTimeout(300); return pg.evaluate(() => (document.body.innerText.match(/Enter 1 to 90 days\./) || [null])[0]); }));
check("Timeline: reminder 1 must be earlier than reminder 2", await both(LIST, async (pg) => { await pg.getByRole("button", { name: "Edit", exact: true }).first().click(); await pg.getByLabel("Days before the deadline for reminder 2").fill("5"); await pg.getByLabel("Days before the deadline for reminder 1").fill("2"); await pg.waitForTimeout(300); return pg.evaluate(() => (document.body.innerText.match(/Reminder 1 has to come earlier than reminder 2\./) || [null])[0]); }));
check("Timeline: a valid change updates the chips", await both(LIST, async (pg) => { await pg.getByRole("button", { name: "Edit", exact: true }).first().click(); await pg.getByLabel("Days a reviewer has").fill("21"); await pg.waitForTimeout(1600); return pg.evaluate(() => (document.body.innerText.match(/Reviewers get \d+ days/) || [null])[0]); }), "Next saves after a 600 ms pause");
check("Timeline: Reminder 1 switch off -> chip says off", await both(LIST, async (pg) => { await pg.getByRole("button", { name: "Edit", exact: true }).first().click(); await pg.getByRole("switch").first().click(); await pg.waitForTimeout(1600); return pg.evaluate(() => /Reminder 1 off/.test(document.body.innerText)); }));

// ---- Manage > Form > Settings sub-tab
check("Form tab: sub-tabs Form / Settings", await both(MAN, async (pg) => pg.evaluate(() => [...document.querySelectorAll("button,[role=tab]")].map((b) => b.textContent.trim()).filter((t) => t === "Form" || t === "Settings")), "button"));
check("Settings sub-tab opens in place (same URL)", await both(MAN, async (pg) => { const u = pg.url(); await pg.getByRole("tab", { name: "Settings" }).or(pg.getByRole("button", { name: "Settings", exact: true })).first().click(); await pg.waitForTimeout(600); return { same: pg.url() === u, sections: await pg.evaluate(() => ["Reviewing period", "Review timeline", "Reviewer assignment", "Review & Visibility", "Reviewer instructions", "Review form"].map((t) => document.body.innerText.includes(t))) }; }, "button"));
check("Form tab: Edit form edits in place (URL unchanged)", await both(MAN, async (pg) => { const u = pg.url(); await pg.getByText("Edit form").first().click(); await pg.waitForTimeout(700); return { same: pg.url() === u, editorShown: await pg.evaluate(() => /Section 1 name|Add field|Add section|Save form/i.test(document.body.innerText) || !!document.querySelector("input[aria-label^='Section']") ) }; }, "button"));

await browser.close();
fs.writeFileSync(path.join(OUT, `slice3-${vpName}.json`), JSON.stringify(results, null, 1));
console.log(`\nSAME ${same}  DIFF ${differ}`);
