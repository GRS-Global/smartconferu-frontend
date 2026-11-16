# Phase 2: Create Conference draft, leave confirmation, Clear form (2026-11-03)

Scope (approved): saved-draft persistence, "Continue your draft?" offer, leave-page confirmation, "Clear form" with confirmation, prototype wording / visibility / styling / interaction. Nothing else.
QA: `qa/phase2-qa.mjs` (screenshots, diff images and `results.json` in `qa/out/phase2/after/`), `qa/phase1-qa.mjs` (re-run), `qa/run-compare.mjs`, `qa/run-audit.mjs`. Prototype run in sample mode with its Maps key forced empty; Next.js on mock fixtures. Mock results only.

## Files changed (Next.js app)
- `src/features/conferences/components/create-conference-page.tsx`: draft state, offer card, Clear form button, leave guard (Cancel + breadcrumb), clears the draft after a successful create.
- NEW `src/features/conferences/create-conference-draft.ts`: read / write / clear / age wording; same key and shape as the prototype.
- NEW `src/components/ui/confirm-dialog.tsx` and `src/components/ui/modal.tsx`: the prototype's ConfirmDialog and Modal (the existing `Dialog` is untouched).
- `src/lib/research-areas.ts`: `normalizeResearchArea` (old area names in old drafts).
- `src/app/globals.css`: `.ui-modal-foot`. `src/styles/tokens.css`: `--danger-hover` (both additive).
- QA only: `qa/phase2-qa.mjs`.

## What was built (all from the prototype source)
- Storage: `localStorage["grs_create_conference_draft"] = { form, savedAt }`; the form is every field plus the policy tick (`confirmPolicy`). Local only: no table, no Supabase.
- Written on every change while the form differs from blank; removed when it returns to blank after an edit in the visit; an untouched visit never wipes a waiting draft; cleared after a successful create.
- Offered (never restored silently) only if something real was typed (title, acronym, city, contact email, dates, venue, website, about or primary area). Card: "Continue your draft - {acronym or title}?", "You started this {a moment / N min / N hour(s) / N day(s)} ago and didn't finish. Pick up where you left off.", Start fresh / Continue draft. Old primary-area names are mapped; unknown ones are dropped with their secondary area.
- The offer is shown only while the form is untouched, so Continue draft can never overwrite what was typed since; typing over an offered draft makes the new work the draft (as in the prototype).
- Leave: Cancel and the breadcrumb ask first when the form is dirty ("Leave without creating?" - Discard draft / Keep editing / Leave, keep draft); closing or reloading the tab raises the browser's own prompt; top-menu links are not intercepted (as in the prototype). Nothing is cleared before the person confirms (Discard draft is the only way out that deletes it).
- Clear form: button in the header only when dirty; "Clear the form?" confirmation; confirming resets the form, errors and timezone state, removes the draft and scrolls to the top.

## Results
| Check | Result |
|---|---|
| Behaviour vs prototype (35 checks: save shape, refresh, offer, Continue, Start fresh, type-over, blank-after-edit, untouched visit, leave via breadcrumb and Cancel, Keep editing, Leave keep draft, Discard, return to page, Clear form incl. Cancel / backdrop / confirm, browser-close prompt, header navigation, old / unknown / empty / unreadable drafts, age wording x5) | **33 identical, 2 deliberate differences** (below) |
| Offer card pixel diff, 1440 / 1600 / 390 | **0% / 0% / 0%** |
| Header with Clear form button | 0.63 / 0.56 / 1.17 % (rest is header avatar / pill and sample data; the button's computed styles are identical) |
| Leave dialog full-screen | 0.20 / 0.18 / 1.13 % |
| Clear dialog full-screen | 0.20 / 0.18 / 1.13 % |
| Computed styles (1440) | offer title, both offer buttons, Clear form button, both dialog titles, all dialog buttons, message: identical; containers differ only by inherited text colour |
| Regression, full 36-page audit vs saved baseline | **0 new non-low style differences, 0 changed control counts** |
| Create Conference vs prototype (default state) | 0.14 / 0.13 / 3.61 %, height 0 / 0 / -16 px (the prototype's longer Smart Fill helper, deferred) |
| Phase 1 checks re-run on the route | still identical (venue visibility, dates, acronym chip, validation) |
| Auth pages (not touched, share the CSS) | login 0.17 / 0.16 / 0.50 %, register 0.16 / 0.16 / 0.34 %, reset-password 0.23 / 0.21 / 0.58 % |
| TypeScript, ESLint | clean |

## Deliberate differences from the prototype
1. The Clear dialog's close (X) button carries an invisible `aria-label="Close"` (the prototype's has none).
2. When an older draft is on offer, the person types something new and then uses Clear form (or blanks the form), the prototype brings the *older* draft back as an offer even though it was already removed from storage; here it does not (the offer is dropped as soon as the stored draft is replaced or cleared).

## Remaining differences / gaps
- The draft holds this form's fields only: no street number / street name / map position (they belong to the deferred map picker). A prototype draft that has them still restores (extra keys ignored).
- The policy tick is saved and restored with the draft, as in the prototype.
- Dialogs behave like the prototype's: backdrop click and the X close them; Escape does not, and focus is not trapped (an accessibility gap shared with the prototype, not added without approval).
- 390 px page height is 16 px shorter than the prototype (Smart Fill helper text, deferred).
- Header avatar / "Profile complete" pill cannot be compared in mock mode.

## Not tested
- Behaviour scenarios ran at 1440 px only (the logic does not depend on width); widths 1600 and 390 were compared visually.
- Clearing the draft after a successful create is covered by code reading only (no request may be created in QA).
- Real (production) mode: nothing here was run against Supabase.
- reset-password measured 0.23 / 0.21 / 0.58 % now against 0.07 / 0.06 / 0.26 % in an earlier measurement; style differences are zero and the height is identical. Not investigated (the background-image block was added between the two measurements, which is a likely but unverified cause).

## Safety
Prototype source, `.env`, `.env.local`, Supabase, schema, migrations, RLS and auth untouched by this phase; no API key read, printed, copied or used; no commit or push of the Next.js app (it is a separate repository with no commits).
Two QA runs had to be repeated because a QA server was not running (the prototype's dev server once, the auth-pages instance once); neither affected results.
