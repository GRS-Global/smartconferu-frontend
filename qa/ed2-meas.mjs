import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
const probe = () => {
  const q = (fn) => { try { const e = fn(); if (!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return `${c.fontSize}/${c.lineHeight} w${c.fontWeight} ${c.color.replace(/ /g, "")} h${Math.round(r.height)} w${Math.round(r.width)} top${Math.round(r.top + scrollY)}`; } catch { return "err"; } };
  const byText = (re, sel = "*") => [...document.querySelectorAll(sel)].filter((e) => e.children.length === 0 && re.test(e.textContent.trim())).pop();
  return {
    crumbBack: q(() => byText(/^Back to /)), allEmails: q(() => byText(/^All email templates$/)),
    name: q(() => byText(/^Activate your reviewer account$/)), pill: q(() => byText(/^Reviewer$/)), enabledLbl: q(() => byText(/^Enabled$/)),
    tabEdit: q(() => byText(/^Edit$/, "button")), subjectLbl: q(() => byText(/^Subject/)), subject: q(() => document.querySelector("input[value^='Reminder']")), bodyLbl: q(() => byText(/^Body$/)),
    toolbar: q(() => document.querySelector("[aria-label='Bold'],button[title='Bold']")?.parentElement),
    body: q(() => [...document.querySelectorAll("[contenteditable=true],.ck-content,[role=textbox]")][0]),
    infoTitle: q(() => byText(/^Email information$/)), infoCat: q(() => byText(/^Category$/)), infoVal: q(() => byText(/^Reviewer recruitment$/)), infoLbl: q(() => byText(/^MODULE$|^Module$/)),
    hfTitle: q(() => byText(/^Header & footer$/)), mfTitle: q(() => byText(/Merge fields/)), chip: q(() => byText(/^\{\{first_name\}\}$/)), groupLbl: q(() => byText(/^RECIPIENT$|^Recipient$/)),
  };
};
for (const [n, u, pre] of [["proto", PROTO + "/prototype/chair/isbm2026/settings/review", true], ["next", NEXT + "/chair/isbm2026/settings/email-templates?template=reviewerActivateReminder&back=%2Fchair%2Fisbm2026%2Fsettings%2Freview&backLabel=Review%20settings", false]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1500);
  if (pre) { await pg.getByText(/Edit template/).first().click(); await pg.waitForTimeout(5000); } else await pg.waitForTimeout(3000);
  const r = await pg.evaluate(probe); console.log("==", n); for (const [k, v] of Object.entries(r)) console.log(k.padEnd(11), v);
  await ctx.close();
}
await b.close();
