# Phase 1 corrections (2026-11-03)

QA: `qa/phase1-qa.mjs` (before: `qa/out/phase1/before/`, after: `qa/out/phase1/after/`, `results.json` in each), `qa/run-compare.mjs`, `qa/run-audit.mjs`. Prototype run in sample mode with its Google Maps key **forced empty** (`qa/start-prototype-nokey.mjs`: the key in `.env` is neither read nor used; the prototype showed its "not configured" panel, which only renders when the key is empty, so no Google service was contacted). Next.js on mock fixtures. Mock results only, nothing is production behaviour.

## Files changed (app)
- `src/features/conferences/components/create-conference-page.tsx` (venue visibility + panel, date validation, acronym chip)
- `src/styles/tokens.css` (+ `--warning-border: #fde68a`, the prototype token the panel uses)
- `src/features/notifications/components/notifications-page.tsx` (removed `pb-1` from "Mark all as read")
- `src/features/auth/components/login-form.tsx` (confirmed decisions: plain-text email input, no focus border change)
QA only: `qa/phase1-qa.mjs`, `qa/start-prototype-nokey.mjs`.

## Results
| Correction | Before | After |
|---|---|---|
| Venue visibility, nothing chosen (1440 / 1600 / 390) | 0.94 / 0.85 / 3.55 %, height +167 / +167 / +151 | 0.14 / 0.13 / 3.61 %, height 0 / 0 / -16 (Smart Fill helper, deferred) |
| In-Person (1440 / 1600) | 0.99 % (-7 px) | 0.17 % / 0.16 %, height 0 |
| Hybrid (1440 / 1600) | 0.99 % (-7 px) | 0.17 % / 0.16 %, height 0 |
| Virtual (1440 / 1600) | 0.15 % | 0.15 % / 0.14 % (hidden in both) |
| Empty submit validation, Ctrl+Enter (1440 / 1600 / 390) | 1.14 / 1.03 / 2.33 %, +167 px | 0.10 / 0.09 / 0.15 %, 0 px; the 10 messages identical and in the same order, same field focused (website), counter 0/10 |
| Dates: end only / start only / end before start | Next.js 0/10 for end-only | identical to prototype: end only 1/10, start only fills the end (1/10), end input `min` = start |
| Acronym chip: 6 cases (title, +start year, stop-words, one word, typed acronym, symbols and digits), 1440 / 1600 / 390 | chip absent | chip text identical in every case, computed style diffs `[]`, click fills the acronym and hides the chip identically, crop diff 0.54 % |
| Notifications button (1440 / 1600 / 390) | 23.5 px vs 19.5 px, padding-bottom 4 px, button 4 px higher | 19.5 px both, style diffs `[]`, same vertical position |
| Login | email `type` email; border turned primary on focus | `type` text; border identical on focus (226,232,240); no outline in both; full-page diff 0.17 / 0.16 / 0.50 %, height 0 |

## Remaining differences (all expected or deferred)
- Venue panel wording names this app's setting (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`) instead of the prototype's `VITE_GOOGLE_MAPS_API_KEY` in `.env`; the longer name wraps one extra line at 390 px (+20 px, In-Person / Hybrid only); at desktop widths the heights are equal. Using the prototype's literal text is a one-line change.
- Panel container `color` is inherited black in the prototype and ink in Next.js (no visible effect: the text sets its own colour).
- 390 px page-height gaps: -16 px (the prototype's longer Smart Fill helper) and -48 px once a field is edited (the prototype's "Clear form" button wraps to its own row); both are deferred items.
- Venue address now has no input at all (as in the prototype without a key), so `details.address` stays empty for new requests until the map picker exists (decision D6). The data mapping is unchanged.
- The Login email input has its spacing on a wrapper (the prototype puts a 12 px margin on the input itself): layout identical (0 px height difference).
- Reviewer Updates: the prototype shows no "Mark all as read" (its sample data has nothing unread) while Next.js shows it for its fixtures: data, not design. Author Updates: the button sits 25 px lower in the prototype because its header has a breadcrumb line (existing, outside this phase).

## Regression
- Full 36-page audit before / after: **0 new non-low style differences on any page outside this phase**; resolved: Notifications 2 -> 0, Author Updates 4 -> 2. Create Conference controls 26/28 -> 26/26.
- Shared component `NotificationsPage` serves `/notifications`, `/author/[slug]/updates` and `/reviewer/[slug]/updates`: all three measured (button style diffs `[]` where the button is shown on both sides).
- `tokens.css` change is additive. `login-form` / `create-conference-page` are used by one route each.

## Safety
Prototype source, `.env`, `.env.local`, Supabase, schema, migrations, RLS and auth untouched; Google Maps key never read, printed, copied or used; no commit or push.
