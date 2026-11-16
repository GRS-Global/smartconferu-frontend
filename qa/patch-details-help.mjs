// One-off edit helper: the help popover on the Conference Details labels, as the prototype's SettingLabel.
import fs from "node:fs";
const f = "../src/features/chair/components/conference-details-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const map = [["Website", "webPage"], ["Conference title", "name"], ["Acronym", "acronym"], ["Timezone", "timezone"], ["Conference dates", "dates"], ["Abstract deadline", "abstractDeadline"], ["Submission deadline", "submissionDeadline"], ["Summary", "summary"], ["About the conference", "about"], ["Primary area", "primaryArea"], ["Secondary area", "secondaryArea"], ["Language", "language"], ["Status", "status"], ["Contact email address", "contactEmail"], ["Reply &amp; forwarding email", "replyForwardingEmail"], ["SmartConf email", "smartConfEmail"], ["Venue name", "venue"]];
for (const [text, key] of map) {
  const re = new RegExp(`(className=\\{LABEL\\}>)${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?(?=<)`);
  if (!re.test(s)) { console.log("MISSING", text); continue; }
  s = s.replace(re, (_, a, star) => `${a}<HelpLabel help="${key}">${text}</HelpLabel>${star ?? ""}`); n++;
}
const t = 'text-ink-muted">Topics &amp; research areas <span className="text-danger">*</span></div>';
if (s.includes(t)) { s = s.replace(t, 'text-ink-muted"><HelpLabel help="topics">Topics &amp; research areas</HelpLabel> <span className="text-danger">*</span></div>'); n++; } else console.log("MISSING topics");
if (!s.includes('from "./setting-label"')) { s = s.replace(/(import [^\n]*\n)(?!import)/, `$1import { HelpLabel } from "./setting-label";\n`); }
fs.writeFileSync(f, s); console.log("applied", n);
