// Page registry for prototype-vs-Next.js comparison. EVERY new Next.js page must be added here (see ../CLAUDE.md).
// auth: false = public page; true = signed-in. proto/next are paths (the prototype is mounted under /prototype).
// data: "independent" pages show no database/sample rows, so a pixel diff is meaningful as-is.
//       "sample"      pages show rows that differ between prototype sample data and Next mock fixtures:
//                     read the diff for LAYOUT, not for text/number differences.
export const PROTO = process.env.PROTO_URL || "http://localhost:5180";
export const NEXT = process.env.NEXT_URL || "http://localhost:3100";
// Auth pages are rendered by a second Next instance (data source "supabase" with a dummy unreachable URL) so their forms are enabled;
// in mock mode Next.js disables the whole login/register/reset form. No real backend is ever contacted.
// Screening pages: a third Next instance with the prototype's own 498 screening papers (NEXT_PUBLIC_MOCK_SCREENING=parity), so both apps show the same data.
export const NEXT_SCREEN = process.env.NEXT_SCREEN_URL || "http://localhost:3102";
export const NEXT_AUTH = process.env.NEXT_AUTH_URL || "http://localhost:3101";

export const VIEWPORTS = [
  { name: "d1440", width: 1440, height: 900 },
  { name: "d1600", width: 1600, height: 900 },
  { name: "m390", width: 390, height: 844 },
];

export const PAGES = [
  { id: "screen-initial-detail", nextBase: NEXT_SCREEN, proto: "/prototype/chair/isbm2026/initial-check/ISBM-726", next: "/chair/isbm2026/initial-check/ISBM-726", auth: true, data: "independent" },
  { id: "screen-initial-detail-v2", nextBase: NEXT_SCREEN, proto: "/prototype/chair/isbm2026/initial-check/ISBM-752", next: "/chair/isbm2026/initial-check/ISBM-752", auth: true, data: "independent" },
  { id: "screen-plag-detail", nextBase: NEXT_SCREEN, proto: "/prototype/chair/isbm2026/plagiarism/ISBM-750", next: "/chair/isbm2026/plagiarism/ISBM-750", auth: true, data: "independent" },
  { id: "reviewer-review-form", proto: "/prototype/reviewer/isbm2026/review/ISBM-732", next: "/reviewer/demo-nets-2026/review/NETS-121", auth: true, data: "sample", note: "different paper and conference on each side (the reviewer mock only covers demo-nets-2026): compares the form layout, not its content" },
  { id: "chair-paper-details", proto: "/prototype/submissions/ISBM-680/chair", next: "/submissions/DSAI-4/chair", auth: true, data: "sample", note: "different paper on each side: compares the page layout, not its content" },
  { id: "chair-paper-review", proto: "/prototype/submissions/ISBM-680/chair/review", next: "/submissions/DSAI-4/chair/review", auth: true, data: "sample", note: "different paper on each side: compares the page layout, not its content" },
  { id: "screen-peer-review", nextBase: NEXT_SCREEN, proto: "/prototype/chair/isbm2026/peer-review", next: "/chair/isbm2026/peer-review", auth: true, data: "independent" },
  { id: "screen-plag", nextBase: NEXT_SCREEN, proto: "/prototype/chair/isbm2026/plagiarism", next: "/chair/isbm2026/plagiarism", auth: true, data: "independent" },
  { id: "screen-initial", nextBase: NEXT_SCREEN, proto: "/prototype/chair/isbm2026/initial-check", next: "/chair/isbm2026/initial-check", auth: true, data: "independent" },
  { id: "login", nextBase: NEXT_AUTH, proto: "/prototype/login", next: "/login", auth: false, data: "independent" },
  { id: "register", nextBase: NEXT_AUTH, proto: "/prototype/register", next: "/register", auth: false, data: "independent" },
  { id: "reset-password", nextBase: NEXT_AUTH, proto: "/prototype/reset-password", next: "/reset-password", auth: false, data: "independent" },
  { id: "dashboard", proto: "/prototype/dashboard", next: "/dashboard", auth: true, data: "sample" },
  { id: "dashboard-b", proto: "/prototype/dashboard/b", next: "/dashboard/b", auth: true, data: "sample" },
  { id: "dashboard-c", proto: "/prototype/dashboard/c", next: "/dashboard/c", auth: true, data: "sample" },
  { id: "dashboard-d", proto: "/prototype/dashboard/d", next: "/dashboard/d", auth: true, data: "sample" },
  { id: "notifications", proto: "/prototype/alerts", next: "/notifications", auth: true, data: "sample" },
  { id: "profile", proto: "/prototype/profile", next: "/profile", auth: true, data: "sample" },
  { id: "settings", proto: "/prototype/profile", next: "/settings", auth: true, data: "sample", note: "prototype Settings is inside the profile page; mapping to be confirmed" },
  { id: "create-conference", proto: "/prototype/create-conference", next: "/create-conference", auth: true, data: "independent" },
  { id: "my-requests", proto: "/prototype/my-conference-requests", next: "/my-requests", auth: true, data: "sample" },
  // Workspace pages for conference "isbm2026" (id exists in both apps once NEXT_PUBLIC_MOCK_FIXTURES=parity).
  // Paper / review rows are NOT mirrored: compare layout and components, not row content.
  { id: "author-dashboard", proto: "/prototype/conference/isbm2026/author", next: "/conference/isbm2026/author", auth: true, data: "sample" },
  { id: "author-submissions", proto: "/prototype/author/isbm2026/submissions", next: "/author/isbm2026/submissions", auth: true, data: "sample" },
  { id: "author-updates", proto: "/prototype/author/isbm2026/updates", next: "/author/isbm2026/updates", auth: true, data: "sample" },
  { id: "submit", proto: "/prototype/submit/isbm2026", next: "/submit/isbm2026", auth: true, data: "sample" },
  { id: "reviewer-papers", proto: "/prototype/reviewer/isbm2026", next: "/reviewer/isbm2026", auth: true, data: "sample" },
  { id: "reviewer-overview", proto: "/prototype/reviewer/isbm2026/overview", next: "/reviewer/isbm2026/overview", auth: true, data: "sample" },
  { id: "reviewer-reviews", proto: "/prototype/reviewer/isbm2026/reviews", next: "/reviewer/isbm2026/reviews", auth: true, data: "sample" },
  { id: "reviewer-updates", proto: "/prototype/reviewer/isbm2026/updates", next: "/reviewer/isbm2026/updates", auth: true, data: "sample" },
  { id: "chair-dashboard", proto: "/prototype/conference/isbm2026/chair", next: "/conference/isbm2026/chair", auth: true, data: "sample" },
  { id: "chair-submissions", proto: "/prototype/chair/isbm2026", next: "/chair/isbm2026", auth: true, data: "sample" },
  { id: "chair-manage", proto: "/prototype/chair/isbm2026/manage", next: "/chair/isbm2026/manage", auth: true, data: "sample" },
  { id: "chair-email", proto: "/prototype/chair/isbm2026/email", next: "/chair/isbm2026/email", auth: true, data: "sample" },
  { id: "chair-peer-review", proto: "/prototype/chair/isbm2026/peer-review", next: "/chair/isbm2026/peer-review", auth: true, data: "sample" },
  { id: "chair-peer-review-manage", proto: "/prototype/chair/isbm2026/peer-review/manage", next: "/chair/isbm2026/peer-review/manage", auth: true, data: "sample" },
  { id: "chair-reviewers", proto: "/prototype/chair/isbm2026/peer-review/reviewers", next: "/chair/isbm2026/peer-review/reviewers", auth: true, data: "sample" },
  { id: "chair-initial-check", proto: "/prototype/chair/isbm2026/initial-check", next: "/chair/isbm2026/initial-check", auth: true, data: "sample" },
  { id: "chair-plagiarism", proto: "/prototype/chair/isbm2026/plagiarism", next: "/chair/isbm2026/plagiarism", auth: true, data: "sample" },
  { id: "chair-submit-behalf", proto: "/prototype/chair/isbm2026/submit-behalf", next: "/chair/isbm2026/submit-behalf", auth: true, data: "sample" },
  { id: "chair-settings", proto: "/prototype/chair/isbm2026/settings", next: "/chair/isbm2026/settings", auth: true, data: "sample" },
  { id: "chair-settings-submissions", proto: "/prototype/chair/isbm2026/settings/submissions", next: "/chair/isbm2026/settings/submissions", auth: true, data: "sample" },
  { id: "chair-settings-review", proto: "/prototype/chair/isbm2026/settings/review", next: "/chair/isbm2026/settings/review", auth: true, data: "sample" },
  { id: "chair-settings-decision", proto: "/prototype/chair/isbm2026/settings/decision", next: "/chair/isbm2026/settings/decision", auth: true, data: "sample" },
  { id: "chair-settings-email-templates", proto: "/prototype/chair/isbm2026/settings/email-templates", next: "/chair/isbm2026/settings/email-templates", auth: true, data: "sample" },
  { id: "chair-settings-email-logs", proto: "/prototype/chair/isbm2026/settings/email-logs", next: "/chair/isbm2026/settings/email-logs", auth: true, data: "sample" },
  { id: "chair-settings-activity-logs", nextBase: NEXT_SCREEN, proto: "/prototype/chair/ictcs2026/settings/activity-logs", next: "/chair/isbm2026/settings/activity-logs", auth: true, data: "sample", note: "the prototype keeps its sample log on ictcs2026; the mock shows the same 27 rows on isbm2026" },
];

// Implemented Next.js routes that cannot be compared yet, with the exact reason (kept in sync with PAGE_INVENTORY.md).
export const BLOCKED = [
  { next: "/complete-profile", reason: "Prototype shows it only to an SSO user with grs_profile_pending set; reachable by setting that localStorage flag, not yet scripted." },
  { next: "/author/[slug] (public profile)", reason: "Next.js reads a DB function (migration 0027) that mock mode does not provide; needs a mock for ProfileService.loadPublic." },
  { next: "/submissions/[paper]/author", reason: "Needs matching paper ids: prototype uses in-source sample papers (~100), Next.js mocks use invented ones. Fixture copy of the prototype papers not built." },
  { next: "/submissions/[paper]/chair", reason: "Same as above; also prototype has 2 pages (/chair and /chair/review) vs 1 in Next.js." },
  { next: "/reviewer/[slug]/review/[paper]", reason: "Needs matching paper ids (see above)." },
  { next: "/dashboard (counts)", reason: "Conference rows are mirrored (50, generated from prototype source); per-conference paper/review counts are not, so numeric cells differ." },
];
