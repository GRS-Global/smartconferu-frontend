import { chromium } from "playwright";
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
pg.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
await pg.goto("http://localhost:3102/qa-settings"); await pg.waitForTimeout(2500);
await pg.getByRole("button", { name: /Merge accounts/ }).click(); await pg.waitForTimeout(600);
await pg.getByRole("button", { name: "Merge Accounts", exact: true }).click(); await pg.waitForTimeout(300);
await pg.screenshot({ path: "out/dd/set-merge.png" });
await pg.keyboard.press("Escape");
await b.close();
