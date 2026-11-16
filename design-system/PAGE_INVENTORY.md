# Page inventory: prototype → Next.js

Prototype routes from `pathToRoute()` / `SIMPLE_PAGES` in `src/author-journey.jsx` (base `/prototype`). Next.js routes from `src/app/**/page.tsx`. Status taken from `PORT-PLAN.md` plus what exists on disk; **"visual parity" is only claimed where a comparison result exists** (see `qa/out/report.json`, regenerated on each run).

| Prototype page | Next.js route | Status |
|---|---|---|
| login / register / reset-password / complete-profile | `/login` `/register` `/reset-password` `/complete-profile` | Implemented. Login/register compared 2026-11-03: **differences found** (see audit) |
| dashboard (a/b/c/d) | `/dashboard`, `/dashboard/[variant]` | Implemented |
| alerts (notifications) | `/notifications` | Implemented |
| profile | `/profile` | Implemented |
| (settings inside profile area) | `/settings` | Implemented; prototype mapping unconfirmed |
| create-conference | `/create-conference` | Implemented |
| my-conference-requests | `/my-requests` | Implemented (request detail page `/my-conference-requests/:id`: not ported) |
| conference/:id/{author,chair,reviewer} | `/conference/[slug]/author`, `/chair` | Author, Chair implemented; reviewer entry via `/reviewer/[slug]` |
| author/:id/submissions, /updates | `/author/[slug]/submissions`, `/updates` | Implemented |
| author/:slug (public profile) | `/author/[slug]` | Implemented (needs migration 0027) |
| submissions/:id/author, /chair | `/submissions/[paper]/author`, `/chair` | Implemented; chair page is one page vs two in prototype (gap) |
| submit/:id, chair/:id/submit-behalf | `/submit/[slug]`, `/chair/[slug]/submit-behalf` | Implemented |
| reviewer/:id (+overview, reviews, updates, review/:paper) | `/reviewer/[slug]/...` | Implemented; review form's PDF reader differs (gap) |
| chair/:id (submissions), manage, email, peer-review (+manage, reviewers), initial-check, plagiarism, settings (+submissions, review, decision, email-templates, email-logs) | `/chair/[slug]/...` same names | Implemented (list/detail sub-pages of initial-check/plagiarism not ported) |
| **Not ported (still prototype):** author flyer/feedback/certificates/activity-logs; chair flyer/registration/analytics/programme/certificates*/activity-logs; verify/:serial; programme/:id; registration/:id; cfp/*, cfp-manager/*, cfp-draft/*; my-certificates, my-achievements, receipts, terms, preprints, create-preprint, slides, create-slides, watchlist, publish, help, role-coming-soon; initial/plagiarism detail; plagiarism-v1 (skipped by decision) | – | Pending (many parked by decision D1: no tables) |
| Super Admin, Smart CFP, marketing home | – | Out of scope / D7 undecided |
| – | `/api/ai/[name]`, `/api/send-email` | No prototype page (proxy routes) |

**Cannot currently be tested in the harness:** pages needing a real conference/paper id in mock vs sample data (chair/reviewer/author workspace pages): the two data sets use different ids (`demo-dsai-2027` etc. in Next mocks; prototype sample ids differ). Needs a shared fixture set (planned, requires approval to add fixtures to mock data only).
