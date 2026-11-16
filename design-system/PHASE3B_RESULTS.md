# Phase 3B results

Only item 9 of Phase 3B (the Chair Screening module audit and fixes) was provided, so this file holds that item alone. The other Phase 3B tasks are not covered here.

Restrictions kept: prototype, `.env*`, Supabase, schema / RLS / auth untouched; no commit, push, or deletion; no secrets used.

---

# 9. Chair Screening module: prototype vs Next.js

## 9.1 What each side has

| | Prototype (source of truth) | Next.js |
|---|---|---|
| Initial Check table | `chair-initial-check` · `InitialCheckPage` (`src/chair-plagiarism/ScreeningTables.jsx` 867-1164) | `/chair/[slug]/initial-check` · `features/chair/components/initial-check-page.tsx` |
| Initial Check, one paper | `chair-initial-check-detail` · `InitialCheckDetailPage` (1231-1525) | `/chair/[slug]/initial-check/[paper]` · `initial-check-detail-page.tsx` (**new**) |
| Plagiarism Check table | `chair-plagiarism` · `PlagiarismCheckPage` (1530-1873) | `/chair/[slug]/plagiarism` · `plagiarism-check-page.tsx` |
| Plagiarism Check, one paper | `chair-plagiarism-detail` · `PlagiarismDetailPage` (1888-2183) | `/chair/[slug]/plagiarism/[paper]` · `plagiarism-detail-page.tsx` (**new**) |
| Shared pieces | `ScreeningTables.jsx` helpers, `shared/{idSort,useRangeSelect,Loader}`, `chair-plagiarism/{data,autoCheck,zip}.js` | `screening-ui.tsx`, `screening-detail-ui.tsx`, `lib/{use-id-sort,use-range-select,zip}.ts`, `features/chair/{screening,stage,use-screening-save}.ts` |
| Data | in-memory records per version (`data.js`) | `submissions.screening[n]` via `save_screening`; `submission_files.auto_check`; email through `screening_notified` (`services/chair.ts`, `services/action-emails.ts`) |
| Alternate page | `chair-plagiarism-v1` (older design) | not ported on purpose |

Workflow (both sides): a paper's newest version goes through the Initial Check (editable / English / layout / page count → Passed, Hold, Revision, Reject), then the Plagiarism Check (iThenticate report files → Plag Cleared, Hold, Revision, Reject). Revision and Reject are emailed to the author with what to fix and a due date. A paper with reviewers is locked. Earlier versions stay as history.

## 9.2 Comparison and status

Status key: **Fixed**, **Not Reproducible**, **Blocked** (needs a backend / contract / data decision), **Intentionally Different**, **Not done** (feasible, not done in this pass).

| # | Difference found | Status | Notes |
|---|---|---|---|
| 1 | Table inside a scrolling frame (650 px, sticky header); Next.js grew the page by ~45,000 px | Fixed | `TableFrame` |
| 2 | Summary chips: outline style, "Overdue" chip, counts | Fixed | 8 counts identical on 498 papers |
| 3 | Yes/No toggle (sliding thumb), selects, inputs, red states | Fixed | prototype classes; cell borders stay inline like the prototype |
| 4 | Column header (i) tooltips; ID heading sort (3-click cycle); Submitted column + filter (7 days / 8-30 / older, "36 days ago", "Resubmitted") | Fixed | |
| 5 | ID cell (version pill, "+n earlier", expand arrow), title cell (View PDF, Download paper, Check details), click-row-to-expand, earlier-version rows | Fixed | opens signed links from the papers bucket; mock rows have no file, so a message shows |
| 6 | Paper link: title → submission page; ID / Check details → the paper's own page | Fixed | new routes |
| 7 | Selection: header "indeterminate", Shift-click range, drag select | Fixed | |
| 8 | Rows stay in place after an edit; "Moved out of this filter" note; "N changed rows… Refresh list"; Clear filters | Fixed | |
| 9 | Decision warnings ("N checks failing: …", "No check failed — give the reason in the email", "No report uploaded", "Length not entered"), "Set automatically" label | Fixed | label shows only for a record that carries it |
| 10 | Reopen confirmation when a passed paper with a plagiarism result goes back (resets the plagiarism decision) | Fixed | |
| 11 | Bulk: confirmation modal with notes, "email the authors now" option and due date | Fixed | emails go through `screening_notified`, one per paper |
| 12 | "Sending…" full-screen overlay | Fixed | |
| 13 | Plagiarism: "Initial Check" chip opens the initial check report; "Not passed initial check" section; waiting rows; initial-check email line | Fixed | |
| 14 | Plagiarism: report upload (up to 2 files), view, remove, "Add another file (n/2)" | Fixed | real upload to the papers bucket |
| 15 | Plagiarism: "Download for iThenticate (ZIP)" for the selection, marks each paper "Sent to iThenticate" | Fixed | in-browser ZIP; skips papers with no stored file |
| 16 | Plagiarism: inline Similarity % / AI % boxes in the table (Next.js only) | Intentionally Different | moved to the paper's page "Scores" card; the prototype has no such boxes in the table, and reads the scores from the report, which nothing does here |
| 17 | Screening Settings button size (36 px, soft text); page padding on phones (32 px) | Fixed | the shared `hd-page` rule had shrunk it to 16 px |
| 18 | Paper pages: header, Prev / Next with "Paper n of N", checks list, "Read from the PDF", Versions with View / Download, Decision, Email, Requirements / Limits | Fixed (new) | |
| 19 | Email: editable subject / body, reminder and last-chance emails, extra corresponding authors, email history ("N emails sent · history") | Blocked | the server writes the email from what is saved (`screening_notified`); no body / reminder / history contract. Needs an API change and approval |
| 20 | Automatic initial check ("Set automatically" runs, paid plan feature, setting for failures) | Blocked | no plan feature and no `autoInitialCheck` / `autoInitialFail` setting in the database |
| 21 | Conference logo in the paper pages' header tile | Blocked | the Next.js data model has no conference logo; the header component has no logo slot (affects every header) |
| 22 | Open a table already filtered to one paper from a notification (`screeningSearch`) | Not done | needs the notification to carry the search; not wired |
| 23 | Track chip under the title in the header | Not Reproducible | shown when the paper has a track; the QA fixture papers have none |
| 24 | Peer Review's own "Screening report" popup (`ScreeningReportModal`) | Not done | belongs to the Peer Review page, outside this module |
| 25 | Unknown paper id: Next.js shows "This paper isn't in the initial check" with a back button; the prototype shows no message | Intentionally Different | |
| 26 | "Who and when" lines (Decided by Conference Chair · date) and iThenticate scores in the prototype fixtures | Not Reproducible | the QA fixture does not carry them; the rendering is the same code path |
| 27 | Loading / error states | Not Reproducible against the prototype | the prototype loads instantly from memory; Next.js shows its standard loading, "not found" and error screens (same gate as the other chair pages) |
| 28 | Roles | Matches | chair only (`workspaceGate`); a paper with reviewers is read-only on both sides |
| 29 | Modal header X button label ("Close") and native `<dialog>` for the email form | Intentionally Different | accessibility; the email form is the server-written one (see 19) |

## 9.3 Test data

QA only, in Next.js mocks: `qa/scrape-screening.mjs` and `qa/scrape-plagiarism.mjs` read what the prototype shows (498 papers; 542 rows with earlier versions), `qa/gen-screening-fixtures.mjs` writes `src/mocks/parity-screening.ts`, used only when `NEXT_PUBLIC_MOCK_SCREENING=parity` (third QA server, port 3102). The other 36 pages keep their data.

## 9.4 Visual results (identical data, frozen clock)

| Page | Before | After 1440 | After 1600 | After 390 |
|---|---|---|---|---|
| Initial Check table | 2.15 % (page 45,667 px too tall), chips / toggles / header unlike | **0.33 %** | **0.29 %** | **0.35 %** |
| Plagiarism Check table | not captured on the same data (3.21 % on demo data earlier) | **0.36 %** | **0.32 %** | **0.35 %** |
| Initial Check, one paper (ISBM-726 / ISBM-752 with 2 versions) | page did not exist (404) | 1.64 % / 4.19 % | 3.73 % / 3.73 % | 5.69 % / 5.70 % |
| Plagiarism Check, one paper (ISBM-750) | page did not exist (404) | 3.93 % | 3.97 % | 5.96 % |

The table residue (0.3 %) is the profile pill / avatar in the header (hidden in mock mode by design). The paper pages' residue is the conference logo tile (item 21), the track chip and the fixture's missing "who / when" and score values (items 23, 26): everything below the header lines up row for row (checked on screenshots). Screenshots: `qa/out/phase3b/before/screen-initial/`, `qa/out/screen-*/<viewport>/` (prototype, next, side-by-side, overlay, diff).

## 9.5 Functional results (prototype vs Next.js, same data)

- `qa/screening-qa.mjs` (tables): **50 same, 2 different.** Same: chip counts; ID sort 3 clicks; chip filter; Submitted filter; text filters; empty text; clear filters; tooltips; select all (count 479 / 248+231); range select; indeterminate; bulk bar buttons; bulk confirm modal; toggle switch; decision warnings (Revision with nothing failing, Passed while failing); moved note + refresh; earlier-version rows; row click; decision menus; hints; links; navigation to the paper pages; ZIP button; "Not passed" section. The 2 differences: the email form (item 19: different title, by design; the dialog does open) and the report modal's "who / when" line (item 26).
- `qa/screening-detail-qa.mjs` (paper pages): **21 same, 5 different**: all five are fixture data ("Decided by … · date", the 41 % similarity, the initial check "who / when") or the unknown-paper message (item 25).
- Not exercised against real Supabase (not allowed): saving, uploads, emails and signed links. They use the existing service functions unchanged (`saveScreening`, `uploadScreeningReport`, `fileUrl`, `sendActionEmails('screening_notified')`).

## 9.6 Regression

- TypeScript: clean. ESLint: clean (whole project).
- `qa/regress.mjs before-phase3b-audit.json audit.json`: full 36-page computed-style audit vs the saved baseline (end of Phase 2): **0 pages with more missing controls.** What changed:
  - `submit`, `chair-peer-review-manage`, `chair-settings`: fixed (Phase 3A labels).
  - `chair-initial-check`, `chair-plagiarism` (rewritten here): new matched elements; the 28 "new" differences are the switch buttons' inherited colour (black in the prototype, ink in Next.js; invisible, the switch text is white).
  - `chair-settings-review`: 3 width differences of 3-5 % on one button and two headings: the prototype's late web-font swap documented in Phase 1 (same value pattern 125.8 vs 129.1 px).
  - `profile`, `settings`: default-state pixel diff 0.3 % → 2.76 % / 0.48 % → 2.93 %. Neither page was touched; Next.js shows the mock-mode placeholder; the prototype side differs between runs. Two further compares gave identical numbers (1.71 % / 1.76 %), so it is stable, not random. Cause not traced; **unverified whether it comes from the prototype dev server I restarted**.
  - `login`, `register`, `reset-password`: **not re-run** (they need the auth QA server on 3101, whose folder is now used by the screening server). Nothing they use was changed.
- New / changed shared files: `screening.ts` (adds `value` to check items), `mocks/chair.ts` (env-gated), `lib/*` (new), `screening-ui.tsx` (new). No shared UI component (`field`, `button`, `dialog`, …) was edited.

## 9.7 Remaining gaps

Items 19-22 and 24 above: the email draft / history / reminders and the auto initial check need backend or plan decisions; the logo needs a data-model decision; the notification deep link and the Peer Review popup were not done. Nothing here changes schema, RLS or auth, so none of it was started.

## 9.8 Files

New: `src/lib/{use-id-sort,use-range-select,zip}.ts`, `src/features/chair/use-screening-save.ts`, `components/{screening-ui,screening-detail-ui,initial-check-detail-page,plagiarism-detail-page}.tsx`, `src/app/(authed)/(app)/chair/[slug]/{initial-check,plagiarism}/[paper]/page.tsx`, `src/mocks/parity-screening.ts` (generated).
Rewritten: `initial-check-page.tsx`, `plagiarism-check-page.tsx`. Edited: `screening.ts`, `mocks/chair.ts`.
QA: `qa/{scrape-screening,scrape-plagiarism,gen-screening-fixtures,screening-qa,screening-detail-qa,regress,hgt,chain,dlg,unk,crop}.mjs`, `qa/pages.mjs` (5 new page ids, port 3102).

---

# 10. Follow-up: the four remaining tasks

This section replaces two statements in 9.6: the auth pages **were** re-run (10.4) and the Profile / Settings difference **was** traced (10.3).

## 10.1 Task 1: notification deep link into the screening tables

- **Prototype:** a chair notification about a new version (`notifyChairNewVersion`, `author-journey.jsx` ~23747) carries `screeningSearch = <paper id>`; opening it sets the ID filter of Initial Check (or Plagiarism) once, as the table's starting state (`initialSearch`, `pendingScreeningSearch`). The address does not change, so a refresh shows the whole table. The prototype's database-backed notification opens the plain table (no search).
- **Next.js before:** `new_version` went to the prototype (`/prototype/chair/<c>/initial-check`).
- **Now:** `features/notifications/destinations.ts` opens the ported route `/chair/<c>/initial-check`, adding `?search=<paper label>` when the notification knows its paper. `components/screening-search-param.tsx` (new, used by both tables) applies the filter once, then removes `?search=` from the address, as the prototype keeps it only in memory. Only a paper label (`ISBM-680` form) is accepted; anything else is ignored. The existing safe-link rules are untouched (slug and label are still checked and encoded).
- **Tested** (`qa/deeplink-qa.mjs`, `qa/notif-link.mjs`): a direct link with `?search=ISBM-750` gives exactly the rows the prototype gives for the same ID filter (1 row, ID box set), on both tables; the address is cleaned; Clear filters works; after a refresh the whole table is back (also what the prototype does); a bad value (`<script>`) is ignored and removed; a second link to another paper re-applies the filter; the mock notification "Open Initial Check" now lands on `/chair/demo-dsai-2027/initial-check` inside the app.
- Not covered: the prototype can also send the chair to Plagiarism Check when Initial Check is off. The notification does not know the conference's screening settings, so it always opens Initial Check (as the prototype's database notification does).

## 10.2 Task 2: Peer Review "View report" popup

- **Prototype:** the popup (`ScreeningReportModal`) opens from the "View report" link under the chip in the Peer Review list's **Initial check** and **Plagiarism** columns (`ChairPeerReviewPage` ~24540). The columns, with linked filters, are the only way to reach it, and Next.js did not have them, so they were added exactly as the prototype has them: chip ("Not decided" / "Not started" / label, a tick when done), "View report" (or "Open Initial check" / "Open Plagiarism" when nothing is decided), linked filters with counts and greyed-out empty options. A paper in peer review counts as passed at both steps.
- **Popup:** "Screening Report — V<n>", the paper under it, numbered sections "Initial check" (decision, checklist, correction note) and "Plagiarism check" (decision, scores, report file, email note, or "Starts once the initial check is passed."), a Close button; closes with the X, the backdrop and Escape.
- **Files:** `components/screening-report-modal.tsx` (new), `components/peer-review-page.tsx` (columns, filters, popup), `screening.ts` (`screeningStatusOf`, `screeningMeta`).
- **Before / after:** before: no such columns or popup (`qa/out/phase3b/before-pr/`). After, on the same 498 papers (`qa/peer-screening-qa.mjs`): **12 same, 2 different.** Same: column headings; both filters' options, counts and disabled options; one filter updating the other's counts; filtered row counts; **all 498 cells equal by paper id (0 value differences)**; 213 "View report" links; 116 "Open Initial check" and 113 "Open Plagiarism" links; popup title, subtitle, section headings and buttons; the three ways to close; navigation; Clear filters. The 2 differences are only the fixture (the popup text lacks the prototype's "who / when" and written reasons, which the QA data does not carry, and the key order of the by-id list). Screenshots: `qa/out/phase3b/peer-popup/`.
- The rest of the Peer Review page (track filter, Columns menu, selection, assign / auto-assign, reviewer rows on the QA data) is an older gap and was not touched; the page's pixel difference stays about 3 % for that reason (2.92 % before, 3.01 % after; not a screening difference).

## 10.3 Task 3: Profile and Settings pixel difference

**Root cause: the old baseline was wrong; Next.js did not regress.**
- Every saved audit shows the "default state" difference at **2.76 % (Profile) / 2.93 % (Settings)**: 05:24, 05:59, 06:53, 07:06, 08:07, and again 12:13 and 17:43. Only the one run at 09:36 (the baseline compared against) shows 0.3 % / 0.48 %. No other page moved in that run, and the structure of the two pages (matched elements, missing controls, counts) is identical in all runs.
- `qa/profile-timing.mjs`: the prototype's Profile page captured 0 ms and 200 ms after navigation commit differs from Next.js by **exactly 0.3 %** (an unrendered shell); at 600 ms 2.88 %; once rendered (1.5 s and later) **2.76 %**, identical to the settled capture. So the 09:36 run captured the prototype before it had rendered (its dev server had just been restarted, so the first load was slow).
- Neither page nor any shared component was changed (the Next.js side is the mock-mode "Profiles aren't available" placeholder, unchanged), so no page change was made.
- **Harness fix:** `qa/lib.mjs` `openStable` now waits until the page shows some text before capturing, so a blank shell can no longer be saved as a baseline.
- Regression compare of Profile and Settings against the earlier correct baseline (08:07): **0 changes.**
- Profile and Settings still cannot be compared signed in (mock mode has no accounts); only the placeholder is compared.

## 10.4 Task 4: Login, Register, Reset Password

Re-run on the auth QA server (dummy unreachable Supabase URL, sample-mode UI on; port 3101). Computed-style audit against the saved baseline: **0 new differences, 0 fixed, 0 control-count changes, nothing newly missing.** Full-page comparison with the prototype: Login **0.17 / 0.16 / 0.50 %**, Register **0.16 / 0.16 / 0.34 %**, Reset Password **0.23 / 0.21 / 0.58 %** at 1440 / 1600 / 390: the same values as the earlier phases.

## 10.5 Full regression

- **40 pages audited** with the computed-style audit: the 33 non-auth pages of the 36, the four Chair Screening pages (two tables, two per-paper pages, one with 2 versions), Peer Review on the 498-paper data and the **Reviewer review form**; plus the 3 auth pages above. No errors; **0 pages with more missing controls.**
- Differences against the Phase-2 baseline, all explained: `submit`, `chair-peer-review-manage`, `chair-settings`, `chair-settings-review`: fixed (Phase 3A labels). `chair-initial-check`, `chair-plagiarism`, `chair-peer-review`: control counts rise (Next.js now has the prototype's controls); the Initial Check "new" differences are the toggle buttons' inherited text colour (invisible). `chair-peer-review-manage`: 2 width differences with the same value pair as in Phase 1 (125.8 vs 129.1 px, the prototype's late web-font swap); it showed on a different single page in each run, so it is an intermittent capture effect, not Next.js.
- Reviewer review form (`reviewer-review-form`): the reviewer mock only has a different conference (`demo-nets-2026`), so it compares the form layout of the prototype's ISBM-732 with NETS-121: **3.16 / 3.00 / 3.82 %** at 1440 / 1600 / 390 (data differs, layout comparable). Saving and submitting a review were not exercised.
- Screening suites after all changes: tables **50 same / 2 different**, per-paper pages **21 same / 5 different**, Peer Review columns and popup **12 same / 2 different**; every difference is the by-design email form or fixture data, as in section 9.
- Screening full-page numbers (1440 / 1600 / 390): Initial Check table 0.33 / 0.29 / 0.35 %, Plagiarism table 0.36 / 0.32 / 0.35 %, Initial Check paper pages 1.64 to 5.70 %, Plagiarism paper page 3.93 to 5.96 %.
- TypeScript clean. ESLint clean (whole project).

## 10.6 Files changed in this follow-up

New: `components/{screening-search-param,screening-report-modal}.tsx`.
Edited: `features/notifications/destinations.ts`, `components/{initial-check-page,plagiarism-check-page,peer-review-page}.tsx`, `features/chair/screening.ts`.
QA: `qa/{deeplink-qa,notif-link,peer-screening-qa,popup-shot,profile-timing,regress,patch-peer-review,rv-ids}.mjs`, `qa/lib.mjs` (waits for rendered content), `qa/pages.mjs` (adds `screen-peer-review`, `reviewer-review-form`).

## 10.7 Still blocked or open

- **Blocked on the backend (not started):** editable email draft, reminders, sent-email history, automatic initial check, conference logo in the header.
- **Not exercised (not allowed or not possible here):** anything against real Supabase (saving, uploads, signed links, emails), signed-in Profile / Settings, saving a review in the reviewer form.
- **Open, outside this task:** the rest of the Peer Review page (assign, auto-assign, selection, Columns menu), and the prototype's "Initial Check off, so open Plagiarism" notification variant.
- No unexplained regression remains. Phase 3B is **not** marked complete: the items above are open, and the critical save / upload / email workflows were only verified at the code and mock level.
