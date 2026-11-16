import fs from "node:fs";
const f = "../src/features/chair/components/decision-settings-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 60)); return; } s = s.replace(a, () => b); n++; };
rep('        <section id="dc-types" style={CARD} className="min-w-0 scroll-mt-24 rounded-2xl bg-white p-6">', '        <div className="min-w-0 space-y-5">\n        <section id="dc-types" style={CARD} className="min-w-0 scroll-mt-24 rounded-2xl bg-white p-6">');
rep('        </section>\n        <SectionsRail', '        </section>\n        <EmailsPanel id="dc-emails" title="Decision emails" desc="Sent when you record a decision on a paper. Authors and co-authors get the decision; each reviewer gets the final result." items={DECISION_EMAILS} href={`/chair/${encodeURIComponent(conference.id)}/settings/email-templates`} slug={slug} conferenceName={conference.name} acronym={conference.acronym} backLabel="Decision settings" backHref={`/chair/${encodeURIComponent(conference.id)}/settings/decision`} />\n        </div>\n        <SectionsRail');
rep(', { label: "Email Templates", desc: "The emails sent when you record a decision", href: `/chair/${encodeURIComponent(conference.id)}/settings/email-templates` }]}', ']}');
fs.writeFileSync(f, s); console.log(n);
