import { chromium } from "playwright";
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto("http://localhost:3102/qa-settings"); await pg.waitForTimeout(2500);
await pg.screenshot({ path: "out/dd/set-next.png" });
await pg.getByRole("button", { name: /Change password/ }).click(); await pg.waitForTimeout(600);
await pg.screenshot({ path: "out/dd/set-next-pw.png" });
await b.close();
