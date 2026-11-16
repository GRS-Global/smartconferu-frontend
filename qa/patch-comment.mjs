import fs from "node:fs";
const f = "../src/features/settings/components/settings-modal.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf("Not here: Merge accounts"); const b = s.indexOf("*/", a);
if (a < 0) throw new Error("x");
s = s.slice(0, a) + "Merge accounts and \"Show my reviewer level and badges\" are the prototype's design only: merging is not switched on (pressing the button says so\n   and changes nothing) and the badge setting is only kept (this app has no peer review recognition on the profile for it to show) " + s.slice(b);
fs.writeFileSync(f, s); console.log("ok");
