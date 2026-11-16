// Chair Peer Review slice 2: reads what the prototype's Peer Review pages show so a Next.js mock-only fixture can carry the same committee, assignments,
// conflicts and decision types, and so the prototype's own Auto-assign plan can be compared with ours. Read-only on the prototype.
// Usage: node scrape-peer-review.mjs -> out/peer-review-proto.json
import fs from "node:fs";
import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const b = await launch();
const ctx = await newContext(b, VIEWPORTS[0], true);
const pg = await ctx.newPage();
const out = {};
const open = async (url) => { for (let i = 0; i < 4; i++) { try { await openStable(pg, url); return; } catch (e) { await pg.waitForTimeout(1500); } } throw new Error("could not open " + url); };

// 1. committee
await open(PROTO + "/prototype/chair/isbm2026/peer-review/reviewers");
await pg.waitForSelector("tbody tr", { timeout: 60000 });
out.pool = await pg.evaluate(() => [...document.querySelectorAll("tbody > tr")].map((tr) => {
  const t = tr.innerText.replace(/\s+/g, " ").trim();
  const email = (t.match(/[\w.+-]+@[\w.-]+\.[a-z]+/i) || [""])[0];
  const name = t.replace(/^[A-Z]{2}\s+/, "").split(email)[0].trim();
  return { name, email, text: t.slice(0, 160), invited: /Invited|Invitation/i.test(t), declined: /Declined/i.test(t) };
}));

// 2. the list
await open(PROTO + "/prototype/chair/isbm2026/peer-review");
await pg.waitForSelector("tbody tr", { timeout: 60000 });
await pg.getByRole("button", { name: /^Columns/ }).click();
await pg.getByLabel("Plagiarism %").check();
await pg.getByLabel("Avg confidence").check();
await pg.mouse.click(5, 5);
await pg.waitForTimeout(300);
const heads = await pg.evaluate(() => [...document.querySelectorAll("thead th")].map((t) => t.innerText.split("\n")[0].trim().toLowerCase()));
out.heads = heads;
out.rows = await pg.evaluate((H) => {
  const col = (name) => H.findIndex((h) => h === name);
  const idc = col("id"), rvc = col("reviewer"), rwc = col("review"), duec = col("due"), stc = col("status"), dcc = col("decision"), scc = col("score"), plc = col("plagiarism %"), cfc = col("confidence");
  return [...document.querySelectorAll("tbody > tr")].map((tr) => {
    const td = tr.querySelectorAll(":scope > td");
    const lines = (i) => [...(td[i]?.children ?? [])].map((c) => c.innerText.replace(/\s+/g, " ").trim()).filter(Boolean);
    const sel = td[dcc]?.querySelector("select");
    return {
      id: td[idc]?.innerText.trim(), status: td[stc]?.innerText.replace(/\s+/g, " ").trim(),
      reviewers: [...(td[rvc]?.querySelectorAll(":scope > div") ?? [])].map((d) => ({ text: d.innerText.replace(/\s+/g, " ").trim(), struck: !!d.querySelector(".line-through") || getComputedStyle(d.querySelector("span:last-child") || d).textDecorationLine.includes("line-through") })),
      reviewCol: lines(rwc), dueCol: lines(duec), scoreCol: lines(scc), plag: td[plc]?.innerText.replace(/s+/g, " ").trim() ?? "", conf: td[cfc]?.innerText.replace(/s+/g, " ").trim() ?? "",
      decision: sel ? { value: sel.value, text: sel.options[sel.selectedIndex]?.textContent, disabled: sel.disabled } : null,
      assignLink: [...tr.querySelectorAll("button")].map((x) => x.textContent.trim()).find((t) => t === "Assign" || t === "Find replacement") || null,
    };
  });
}, heads);

// 3. decision types (the Edit decisions dialog lists them)
await pg.locator("tbody input[type=checkbox]").first().click();
await pg.getByRole("button", { name: "Edit decisions" }).click();
await pg.getByText(/Apply to \d+ selected/).waitFor({ timeout: 15000 });
out.decisionTypes = await pg.evaluate(() => [...document.querySelectorAll(".ui-accent-card button[aria-pressed]")].map((x) => ({ label: x.querySelector("span.truncate")?.textContent.trim(), outcome: x.querySelector("span.block + span, span.block:last-child")?.textContent.trim(), color: x.querySelector("span[class*='rounded-full']")?.style.background })));
await pg.keyboard.press("Escape");

// 4. conflicts, popover by popover (only papers that offer Assign / Find replacement)
await open(PROTO + "/prototype/chair/isbm2026/peer-review");
await pg.waitForSelector("tbody tr", { timeout: 60000 });
out.popovers = {};
const ids = out.rows.filter((r) => r.assignLink).map((r) => r.id);
for (const id of ids) {
  const btn = pg.locator("tbody tr", { hasText: id }).first().locator("button", { hasText: /^\s*(Assign|Find replacement)\s*$/ }).first();
  await btn.scrollIntoViewIfNeeded(); await pg.waitForTimeout(250); await btn.click();
  const dlg = pg.locator("[role=dialog][aria-label^='Assign a reviewer']");
  await dlg.waitFor({ timeout: 5000 }).catch(() => undefined);
  out.popovers[id] = await pg.evaluate(() => { const d = document.querySelector("[role=dialog][aria-label^='Assign a reviewer']"); if (!d) return null; return { head: d.querySelector("div")?.innerText.replace(/\s+/g, " ").trim(), items: [...d.querySelectorAll("li")].map((li) => li.innerText.replace(/\s+/g, " ").trim()) }; });
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(120);
}

// 5. the prototype's own Auto-assign plan for every paper that needs reviewers
await pg.locator("thead input[type=checkbox]").first().check();
await pg.getByRole("button", { name: "Auto-assign" }).click();
await pg.getByText("Auto-assign reviewers").first().waitFor({ timeout: 15000 });
await pg.waitForTimeout(600);
out.auto = await pg.evaluate(() => {
  const d = [...document.querySelectorAll(".ui-accent-card")].pop();
  const cards = [...d.querySelectorAll("div.rounded-xl.bg-white")].filter((x) => x.querySelector("ul")).map((c) => ({
    head: c.querySelector("div")?.innerText.replace(/\s+/g, " ").trim(),
    picks: [...c.querySelectorAll("ul > li")].map((li) => li.innerText.replace(/\s+/g, " ").trim()),
  }));
  return { subtitle: d.querySelector("h3 + p")?.textContent.trim(), summary: d.innerText.replace(/\s+/g, " ").slice(0, 700), cards, buttons: [...d.querySelectorAll("button")].map((x) => x.textContent.trim()).filter(Boolean).slice(-4) };
});
await b.close();
fs.writeFileSync("out/peer-review-proto.json", JSON.stringify(out, null, 1));
console.log("pool", JSON.stringify(out.pool.map((p) => p.name + " <" + p.email + ">")));
console.log("rows", out.rows.length, "assign links", ids.length, "popovers", Object.keys(out.popovers).length);
console.log("decision types", JSON.stringify(out.decisionTypes));
console.log("auto subtitle", out.auto.subtitle, "| cards", out.auto.cards.length);
