import { chromium } from "playwright";
const b = await chromium.launch(); const pg = await b.newPage();
pg.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log(m.type(), m.text().slice(0, 300)); });
pg.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 300)));
await pg.goto("http://localhost:3102/qa-settings"); await pg.waitForTimeout(3000);
await b.close();
