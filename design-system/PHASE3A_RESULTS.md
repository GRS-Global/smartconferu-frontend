# Phase 3A: Submit and Chair page-specific label styling

Scope: label font size, weight, colour, margin and required-asterisk on Submit and the Chair pages. Prototype is the source of truth; prototype, `.env*`, Supabase, schema/RLS/auth untouched; nothing committed or deleted; Register photo cropper not started.

## Design decision
The shared `ui/field.tsx` label (12 px / 700, used by Register, Create Conference, Profile, Settings) was **not changed**: those pages already match their prototype. The Submit and Chair pages never used it; each has its own page-local `LABEL` constant, so each was corrected from its own prototype class, with no global style and no new override mechanism.

## What the prototype uses (read from `author-journey.jsx`)
| Page | Prototype label | Asterisk |
|---|---|---|
| New Submission (`EnhancedSchemaForm` ~29900) | 14 px / 600, mb 6, `--text`; turns `--danger` when a required field is missing | red |
| Conference Details (`ChairSettingsPage` `labelClass`, ~25526) | 12 px / 600, mb 6, `--text-soft` | **plain text, label colour** (not red) |
| Conference Details "Topics & research areas" (~25846) | 12 px / 600, mb 6, `--text-muted` | red |
| Review settings "From" / "To" (~26312) | 12 px / 600, mb 6, `--text-muted` | red |
| Peer Review > Manage form preview (`ReviewFormBody` ~27749) | row `mb-1.5`; label flex, gap 8, 14 px / 600, `--text` | red |

## Files changed (4, all page-local)
- `src/features/author/components/submit-paper-page.tsx`: `FIELD_LABEL` / `fieldLabel(missing)`; applied to Title, Abstract, Keywords, submission type, track, and the conference's extra questions. Author rows and the on-behalf block keep `LABEL` (prototype uses placeholders there).
- `src/features/chair/components/conference-details-page.tsx`: `LABEL` 12/600, mb 1.5; asterisks plain text; Topics label muted with red asterisk.
- `src/features/chair/components/review-settings-page.tsx`: `PERIOD_LABEL`; From / To get the red `*` (the reported missing asterisk).
- `src/features/chair/components/review-form-preview.tsx`: `heading()` replicates the prototype's field-heading row for long-text and single-choice fields (rating rows unchanged).
- QA tooling added in `qa/`: `labels.mjs`, `labels-extra.mjs`, `labels-states.mjs`, `on-dump.mjs`, `crop.mjs`.

## Results (computed style, 1440 / 1600 / 390)
| Check | Before | After |
|---|---|---|
| Label pairs compared (4 pages ×… at 1440) | 28 pairs, 25 differ (23 real + 2 "On") | all paired labels identical |
| Same at 1440 / 1600 / 390 | n/a | 84 pairs, 6 differ, all the same hidden "On" wrapper (see below) |
| Labels that are `<div>` in Next.js (type, track, Topics, Conference dates, Reviewer confidence) | Topics, Conference dates, type/track differed | identical at all three widths |
| Asterisk (From/To, Conference Details, Submit, preview) | From/To missing; Conference Details red vs plain | present / colour match |
| Required state on Submit after a submit attempt | n/a | Title and Abstract labels turn rgb(220,38,38), Keywords unchanged: identical to the prototype |
| TypeScript, ESLint (whole project) | clean | clean |

Page pixel diff (sample data dominates these pages, so read as layout only): Submit 3.36→3.37 % (1440), height gap −848→−818 px; Conference Details 2.79→2.69 %, gap −22→+4 px; Review settings 3.31→3.29 %; Peer Review Manage 2.69→2.70 %. Screenshots: `qa/out/phase3a/before/` and `qa/out/phase3a/after/` (`<page>/<viewport>/{prototype,next,side-by-side,overlay,diff}.png`); crop example `qa/out/phase3a/after-submit-d1440.png`.

## Regression
Changed files are page-local, so only their routes can change: `/submit/[slug]`, `/chair/[slug]/settings`, `/chair/[slug]/settings/review`, `/chair/[slug]/peer-review/manage` (the only importer of `review-form-preview`). All four re-captured at three widths. The shared Field/Switch/button components were not edited, so the other pages are unaffected by construction (a full 36-page re-run was not repeated).

## Differences found and NOT fixed (outside label styling)
1. Submit: required input border after a missing-field reveal: prototype keeps a soft red border (rgb(235,152,152)) even on focus; Next.js shows the normal border (and purple on focus). Focus-colour behaviour of inputs is a separate fix.
2. Submit: author rows use placeholders in the prototype; Next.js has visible labels (Full name, Email, Affiliation, Country).
3. Submit: prototype touches a field on blur (label turns red before a submit attempt); Next.js reveals only after a submit attempt.
4. Conference Details: the prototype labels carry a "?" help popover (not ported).
5. Settings > Submissions: label text case ("Required Layout", "Single Column · Min Pages" vs Next.js sentence case); the prototype's switch is 40 px wide, Next.js `Switch` 44 px (shared component, 8 routes).
6. Review settings: Next.js shows stacked labelled inputs for reviewers per paper / max papers; the prototype uses row text with an input at the right.
7. Confidential badge: prototype 11 px with a key icon; Next.js 10 px with a lock icon.
8. Chair Conference Details on mobile: page height gap rose from +50 to +86 px; label spacing is verified equal, so the gap comes from other, uninvestigated differences.

## Unverified
Signed-in (real Supabase) rendering; the Reviewer review form route (no QA coverage; it does not use the changed files); hover states of labels (none exist).

## Note on method
The first "after" probe re-ran against an unsynced QA copy and showed no change; the sync was repeated and the before state was rebuilt from the earlier file versions, so before and after come from the same server.
