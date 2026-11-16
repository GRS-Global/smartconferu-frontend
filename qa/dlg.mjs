import { PAGES, VIEWPORTS, NEXT_SCREEN } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const page = PAGES.find((p) => p.id === "screen-initial");
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, NEXT_SCREEN + page.next);
await pg.locator("thead select").nth(5).selectOption("revision"); await pg.waitForTimeout(300);
await pg.getByRole("button", { name: /^Send Email$/ }).first().click(); await pg.waitForTimeout(500);
console.log(JSON.stringify(await pg.evaluate(() => { const d = document.querySelector("dialog[open], [role=dialog], [aria-modal=true]"); return d ? { tag: d.tagName, text: d.textContent.replace(/\s+/g, " ").trim().slice(0, 240) } : null; })));
await b.close();
