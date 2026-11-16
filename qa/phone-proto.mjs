import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, `${PROTO}/prototype/profile`); await pg.waitForTimeout(2500);
const names = await pg.evaluate(() => [...document.querySelectorAll("button[aria-label]")].map((e) => e.getAttribute("aria-label")).filter((l) => /phone|mobile|number/i.test(l)));
console.log(names);
await pg.getByRole("button", { name: /mobile number|phone/i }).first().click(); await pg.waitForTimeout(900);
await pg.screenshot({ path: "out/dd/phone-proto.png" });
await b.close();
