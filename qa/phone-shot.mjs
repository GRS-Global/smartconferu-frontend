import { chromium } from "playwright";
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 900, height: 700 } });
pg.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
await pg.goto("http://localhost:3102/qa-phone"); await pg.waitForTimeout(2500);
await pg.screenshot({ path: "out/dd/phone-next.png" });
await b.close();
