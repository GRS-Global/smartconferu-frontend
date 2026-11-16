// One-off edit helper: SettingLabel help on the Review and Decision settings labels (replacing the small info icons), as the prototype.
import fs from "node:fs";
let n = 0;
const edit = (f, pairs, imp) => { let s = fs.readFileSync(f, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", f.split("/").pop(), a.slice(0, 70)); continue; } s = s.replace(a, () => b); n++; } if (imp && !s.includes('from "./setting-label"')) s = s.replace(/(import [^\n]*from "\.\/sections-rail";\n)/, `$1import { HelpLabel } from "./setting-label";\n`); fs.writeFileSync(f, s); };
const d = "../src/features/chair/components/";
edit(d + "review-settings-page.tsx", [
  ['text-ink">Number of reviewers per paper <span title="A paper with fewer shows under “Needs reviewers” on Peer Review." className="text-ink-faint"><Info size={13} aria-hidden="true" /></span></div>', 'text-ink"><HelpLabel help="reviewersPerPaper">Number of reviewers per paper</HelpLabel></div>'],
  ['text-ink">Maximum papers per reviewer <span title="The most papers any one reviewer can be given." className="text-ink-faint"><Info size={13} aria-hidden="true" /></span></div>', 'text-ink"><HelpLabel help="maxPapersPerReviewer">Maximum papers per reviewer</HelpLabel></div>'],
], true);
edit(d + "policy-cards.tsx", [['<div className="text-[13.5px] font-bold text-navy">Fields visible to reviewers</div>', '<div className="text-[13.5px] font-bold text-navy"><HelpLabel help="fieldsVisibleToReviewers">Fields visible to reviewers</HelpLabel></div>']], false);
let p = fs.readFileSync(d + "policy-cards.tsx", "utf8"); if (!p.includes('from "./setting-label"')) { p = p.replace(/(import [^\n]*\n)(?!import)/, `$1import { HelpLabel } from "./setting-label";\n`); fs.writeFileSync(d + "policy-cards.tsx", p); }
edit(d + "decision-settings-page.tsx", [['<Check size={16} aria-hidden="true" className="text-primary" /> Decision types</h2>', '<Check size={16} aria-hidden="true" className="text-primary" /> <HelpLabel help="decisionTypes">Decision types</HelpLabel></h2>']], false);
let q = fs.readFileSync(d + "decision-settings-page.tsx", "utf8"); if (!q.includes('from "./setting-label"')) { q = q.replace('import { SectionsRail } from "./sections-rail";', 'import { SectionsRail } from "./sections-rail";\nimport { HelpLabel } from "./setting-label";'); fs.writeFileSync(d + "decision-settings-page.tsx", q); }
console.log("applied", n);
