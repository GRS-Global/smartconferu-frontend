// Chair Peer Review slice 2: the Auto-assign plan on the same data. Prototype (read from out/peer-review-proto.json, taken from its own dialog) vs Next.js.
// The prototype matches expertise first; the database has no expertise, so the plans are compared on what both rules guarantee.
import fs from "node:fs";
import { NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const proto = JSON.parse(fs.readFileSync("out/peer-review-proto.json", "utf8"));
const who = (text) => Object.fromEntries([...text.matchAll(/([A-Z][a-z]+(?: [A-Z][a-z]+)*) \+(\d+)/g)].map((m) => [m[1], Number(m[2])]));
const P = who((proto.auto.summary.match(/Who gets what:(.*?)Picked by/) || ["", ""])[1]);
const b = await launch(); const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage();
await openStable(pg, NEXT_SCREEN + "/chair/isbm2026/peer-review"); await pg.waitForSelector("tbody tr", { timeout: 90000 }); await pg.waitForTimeout(500);
await pg.locator("thead input[type=checkbox]").first().check(); await pg.getByRole("button", { name: "Auto-assign" }).click(); await pg.getByText("Auto-assign reviewers").first().waitFor(); await pg.waitForTimeout(500);
const text = await pg.locator(".ui-accent-card").last().innerText();
const N = who((text.replace(/\s+/g, " ").match(/Who gets what:(.*?)Picked by/) || ["", ""])[1]);
const sum = (o) => Object.values(o).reduce((a, x) => a + x, 0);
const spread = (o) => `${Math.min(...Object.values(o))}..${Math.max(...Object.values(o))}`;
console.log("prototype who gets what:", JSON.stringify(P), "total", sum(P), "spread", spread(P));
console.log("next      who gets what:", JSON.stringify(N), "total", sum(N), "spread", spread(N));
// papers still short of reviewers and their slots in the plan
const cards = await pg.locator(".ui-accent-card").last().evaluate((m) => [...m.querySelectorAll("div.rounded-xl.bg-white")].filter((x) => x.querySelector("ul")).map((x) => ({ head: x.querySelector("div")?.innerText.replace(/\s+/g, " ").trim(), picks: x.querySelectorAll("li button[aria-label^='Remove']").length, empty: (x.innerText.match(/slots? empty/g) || []).length })));
console.log("next cards shown:", cards.length, "empty slots:", cards.reduce((a, x) => a + x.empty, 0));
fs.writeFileSync("out/peer-review/auto-plan-compare.json", JSON.stringify({ prototype: P, next: N, nextCards: cards.length }, null, 1));
await b.close();
