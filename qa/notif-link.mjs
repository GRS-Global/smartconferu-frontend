import { VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage();
await openStable(pg, "http://localhost:3100/notifications"); await pg.waitForTimeout(1500);
console.log(await pg.evaluate(() => ({ hasText: document.body.innerText.includes("New version to check"), actions: [...document.querySelectorAll("a,button")].filter((e) => /Initial Check/i.test(e.textContent)).map((e) => ({ tag: e.tagName, text: e.textContent.trim(), href: e.getAttribute("href") })) })));
await pg.getByRole("button", { name: /Open Initial Check/ }).click(); await pg.waitForTimeout(4000); console.log("after click ->", pg.url());
await b.close();
