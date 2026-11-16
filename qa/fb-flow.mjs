import { chromium } from "playwright";
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
pg.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
for (const slug of ["ictcs2026", "demo-dsai-2027", "isbm2026"]) {
  await pg.goto(`http://localhost:3102/author/${slug}/feedback`); await pg.waitForTimeout(2500);
  const t = await pg.locator("main, body").first().innerText();
  console.log(slug, "→", /opens on/.test(t) ? "not open" : /How was/.test(t) ? "form open" : t.slice(0, 80).replace(/\n/g, " "));
}
await pg.goto("http://localhost:3102/author/ictcs2026/feedback"); await pg.waitForTimeout(2500);
if (await pg.getByRole("radio", { name: /Poor/ }).count()) {
  await pg.getByRole("radio", { name: /Poor/ }).click(); await pg.getByRole("button", { name: "Venue" }).click(); await pg.getByRole("button", { name: "Send feedback" }).click(); await pg.waitForTimeout(1200);
  console.log("after send:", (await pg.getByText("Thanks for your feedback").count()) ? "thanks shown" : "no thanks");
  await pg.screenshot({ path: "out/dd/fb-sent.png" });
}
await b.close();
