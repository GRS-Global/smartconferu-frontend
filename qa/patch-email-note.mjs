import fs from "node:fs";
const f = "src/lib/email-note.ts";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 70)); return; } s = s.replace(a, () => b); n++; };
rep(`module: "account" | "setup"; role`, `module: "account" | "setup" | "reviewing"; role`);
rep(`/** The prototype's EMAIL_SAMPLE_VALUES`, `const CONF_SIGN = "Best regards,\nThe {{conference_name}} Team";
CATALOG.push(
  {
    key: "reviewThanks", module: "reviewing", role: "custom", sendType: "auto", label: "Thank you for your review", trigger: "Reviewer submits a review", to: "Reviewer",
    subject: "Thank you for your review of \\"{{paper_title}}\\"",
    body: para(\`Dear {{first_name}},\n\nThank you for reviewing "{{paper_title}}". A copy of your review is below for your records:\n\n{{review_copy}}\n\nYou can edit it until the decision is made.\n\n\${CONF_SIGN}\`),
  },
  {
    key: "reviewSubmittedChair", module: "reviewing", role: "chair", sendType: "auto", label: "Review submitted", trigger: "Reviewer submits", to: "Conference Chair",
    subject: "New review on \\"{{paper_title}}\\" — score {{score}}",
    body: para(\`Hi {{first_name}},\n\n{{reviewer_name}} submitted a review of "{{paper_title}}".\n\nScore: <b>{{score}}</b>\n\n\${CONF_SIGN}\`),
  },
  {
    key: "chairDecisionReady", module: "reviewing", role: "chair", sendType: "auto", label: "Paper ready for decision", trigger: "Last required review arrives", to: "Conference Chair",
    subject: "Ready for decision: \\"{{paper_title}}\\"",
    body: para(\`Hi {{first_name}},\n\nAll required reviews are in for "{{paper_title}}".\n\nAverage score: <b>{{avg_score}}</b>\nSpread: {{score_spread}}\n\nRecord a decision: {{submission_link}}\n\n\${CONF_SIGN}\`),
  },
);

/** The prototype's EMAIL_SAMPLE_VALUES`);
rep(`dashboard_link: "https://smartconferu.com/chair/ictcs2026",
};`, `dashboard_link: "https://smartconferu.com/chair/ictcs2026",
  paper_title: "Cloud-Native Architecture Patterns for Edge Computing", submission_link: "https://smartconferu.com/s/ictcs-142", reviewer_name: "Dr. Priya Nair",
  review_copy: "Score 4 / 5 · Clear methodology; the evaluation could compare against one more baseline.", score: "4 / 5", avg_score: "3.8 / 5", score_spread: "3 – 5",
};`);
rep(`  to?: string | string[];
  recipientName?: string;`, `  to?: string | string[];
  /** More recipients of the same email (the prototype's "also"): they add to the count. */
  also?: string[];
  /** Merge fields filled for this email only (undefined ones keep the sample value). */
  values?: Record<string, string | undefined>;
  recipientName?: string;`);
rep(`  const to = asList(item.to).length ? asList(item.to) : [meta?.to ?? "Recipient"];`, `  const to = [...(asList(item.to).length ? asList(item.to) : [meta?.to ?? "Recipient"]), ...(item.also ?? [])];`);
rep(`    ...(conference ? { conference_name: conference.name, conference_acronym: conference.acronym } : {}),
  };`, `    ...(conference ? { conference_name: conference.name, conference_acronym: conference.acronym } : {}),
    ...Object.fromEntries(Object.entries(item.values ?? {}).filter(([, v]) => v != null)) as Record<string, string>,
  };`);
fs.writeFileSync(f, s); console.log("applied", n);
