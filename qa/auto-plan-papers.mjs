// Per-paper comparison of the Auto-assign plan: which reviewers each paper gets in the prototype's dialog vs ours (same data).
import fs from "node:fs";
import { NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const proto = JSON.parse(fs.readFileSync("out/peer-review-proto.json", "utf8"));
const names = proto.pool.map((p) => p.name.replace(/\s+Invited.*$/, "").trim());
const pickedNames = (t) => names.filter((n) => t.includes(n)).sort();
const P = {}; for (const c of proto.auto.cards) P[c.head.split(" ")[0]] = c.picks.flatMap((p) => pickedNames(p));
const b = await launch(); const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage();
await openStable(pg, NEXT_SCREEN + "/chair/isbm2026/peer-review"); await pg.waitForSelector("tbody tr", { timeout: 90000 }); await pg.waitForTimeout(500);
await pg.locator("thead input[type=checkbox]").first().check(); await pg.getByRole("button", { name: "Auto-assign" }).click(); await pg.getByText("Auto-assign reviewers").first().waitFor(); await pg.waitForTimeout(500);
const show = pg.locator(".ui-accent-card").last().getByRole("button", { name: /^Show/ }); if (await show.count()) await show.first().click();
await pg.waitForTimeout(300);
const N = await pg.locator(".ui-accent-card").last().evaluate((m) => Object.fromEntries([...m.querySelectorAll("div.rounded-xl.bg-white")].filter((x) => x.querySelector("ul")).map((x) => [x.querySelector("div").innerText.trim().split(/\s+/)[0], [...x.querySelectorAll("li")].map((l) => l.innerText.replace(/\s+/g, " ").trim())])));
const Nn = Object.fromEntries(Object.entries(N).map(([k, v]) => [k, v.flatMap((p) => pickedNames(p))]));
let same = 0, diff = [], both = 0;
for (const id of Object.keys(P)) { if (!(id in Nn)) continue; both++; const a = JSON.stringify([...P[id]].sort()), z = JSON.stringify([...Nn[id]].sort()); if (a === z) same++; else diff.push([id, P[id], Nn[id]]); }
console.log("papers in the prototype's dialog:", Object.keys(P).length, "| in ours:", Object.keys(Nn).length, "| compared:", both, "| same reviewers:", same, "| different:", diff.length);
console.log("first differences:", JSON.stringify(diff.slice(0, 5)));
fs.writeFileSync("out/peer-review/auto-plan-papers.json", JSON.stringify({ compared: both, same, different: diff.length, diff }, null, 1));
await b.close();
