import { chromium } from "playwright";
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
pg.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
await pg.goto("http://localhost:3102/author/demo-dsai-2027/feedback"); await pg.waitForTimeout(3000);
console.log((await pg.locator("body").innerText()).replace(/\n/g, " | ").slice(120, 520));
await b.close();
