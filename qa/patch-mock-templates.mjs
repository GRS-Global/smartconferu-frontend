// One-off edit helper: QA mock — the review-side email templates (the real ones are seeded by migrations 0005 / 0018), so "See how email looks" and "Edit template" can be tried.
import fs from "node:fs";
const f = "../src/mocks/chair.ts"; let s = fs.readFileSync(f, "utf8");
const a = "  ], mine: {} }; },";
if (!s.includes(a)) { console.log("MISSING"); process.exit(1); }
s = s.replace(a, () => `    ...REVIEW_STUBS,
  ], mine: {} }; },`);
const b = "export const mockChair";
const i = s.indexOf("\nconst PAPERS");
if (i < 0) { console.log("MISSING PAPERS"); process.exit(1); }
const stubs = `
/** The review-side email templates of the platform (stand-ins for the database's), for trying the settings pages in mock mode. */
const REVIEW_STUBS = ([
  ["reviewerActivateReminder", "recruitment", "reviewer", "Activate your reviewer account", "Reminder: activate your {{conference_acronym}} reviewer account"],
  ["reviewersInactiveChair", "recruitment", "chair", "Reviewers not yet active", "Reviewers who have not activated their account"],
  ["reviewerProfileReminder", "recruitment", "reviewer", "Complete your reviewer profile", "Please complete your reviewer profile"],
  ["reviewDueSoon", "reviewing", "reviewer", "Review reminder 1 — days left", "Your review is due soon"],
  ["reviewLastDay", "reviewing", "reviewer", "Review reminder 2 — last day", "Last day to submit your review"],
  ["reviewOverdue", "reviewing", "reviewer", "Review overdue", "Your review is overdue"],
  ["overdueDigestChair", "reviewing", "chair", "Overdue reviews: daily list", "Overdue reviews today"],
  ["reviewFormLocked", "reviewing", "reviewer", "Grace period over: review form locked", "The review form is now locked"],
  ["missedReviewsChair", "reviewing", "chair", "Papers need action: missed reviews", "Papers with missed reviews"],
  ["reviewProgressDigest", "reviewing", "chair", "Review progress digest", "Review progress"],
  ["chairDecisionReady", "reviewing", "chair", "Paper ready for decision", "A paper is ready for your decision"],
] as const).map(([key, module, role, label, subject]) => ({ key, module, role, label, sendType: "scheduled", trigger: "Sent by the system on a timer", recipients: role === "chair" ? "Conference Chair" : "The reviewer", subject, body: "<p>Hi {{first_name}},</p><p>" + subject + " — {{conference_name}}.</p>" }));
`;
s = s.slice(0, i) + stubs + s.slice(i);
fs.writeFileSync(f, s); console.log("ok");
