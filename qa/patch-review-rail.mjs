import fs from "node:fs";
let n = 0;
const f = "../src/features/chair/components/review-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 70)); return; } s = s.replace(a, () => b); n++; };
rep('meta: lim.reviewMode === "double_blind" ? "Double-blind" : lim.reviewMode === "single_blind" ? "Single-blind" : "Open" }', 'meta: [lim.reviewMode === "double_blind" ? "Double-blind" : "Authors visible", pol.unassignedAccess ? "all submissions" : "own papers only", pol.hiddenFields.length ? `${pol.hiddenFields.length} field${pol.hiddenFields.length > 1 ? "s" : ""} hidden` : null].filter(Boolean).join(" · ") }');
rep('{ label: "Email Templates", desc: "The reminder and assignment emails", href: emails },', '{ label: "Review Form", desc: "The rubric reviewers fill out per paper", href: `/chair/${e}/peer-review/manage` },');
rep('<ReviewSettingsPanel slug={slug} conferenceId={conference.id} conferenceName={conference.name} acronym={conference.acronym} settings={settings} setup={setup} reload={reload} />', '<ReviewSettingsPanel slug={slug} conferenceId={conference.id} conferenceName={conference.name} acronym={conference.acronym} settings={settings} setup={setup} reload={reload} withForm={false} />');
fs.writeFileSync(f, s); console.log(n);
