# Correction phase (2026-11-03): Header, Register, Create Conference, Login

Measured with `qa/` against the prototype in sample mode (1440, 1600, 390 px). Diff % = pixelmatch share of differing pixels (threshold 0.1, background photo blocked in both apps, clock frozen). "Before" figures were measured earlier the same day without the photo block, so they carry some network noise.

## Results
| Page | Diff before (1440 / 1600 / 390) | Diff after | Height delta before -> after (1440) | Controls P/N after |
|---|---|---|---|---|
| Register | 9.25 / 8.29 / 12.76 % | **0.16 / 0.16 / 0.34 %** | +287 -> **0** | 24 / 24 |
| Login | 10.52 / 9.44 / 24.44 % | **0.17 / 0.16 / 0.50 %** | -130 -> **0** | 13 / 13 |
| Create Conference | 2.76 / 2.57 / 4.35 % | **0.94 / 0.85 / 3.55 %** | -388 -> **+167** (the preserved Venue fields) | 26 / 28 |
| Header (all 36 pages) | 1,065 nav-button style diffs (1440 + 390) | **1** (a flaky width, gone on re-run) | - | - |

## Corrections to my earlier audit (found while reading the prototype source)
- **"Venue" / "Venue address" are not invented.** The prototype has them (shown once a non-Virtual event format is chosen, with Places search and a map). See `VENUE_FIELDS.md`.
- **"Emails this triggers" and the demo-logins box are sample-mode aids in the prototype** (hidden when it runs on the real database: `TriggeredEmailNote` returns an empty block when `USE_DATABASE`; the demo logins and the "clickable prototype" footer sentence are guarded by `!USE_DATABASE`). They are therefore implemented for mock / sample mode only (`lib/sample-mode.ts`).
- The primary button text in the prototype is mode-dependent: `live ? "Send for approval" : "Create Conference"`.
- The prototype's login inputs set their border inline, which overrides their own `focus:border-primary` class, so the prototype shows no focus indication there.

## Files changed (Next.js app only)
Header: `components/layout/nav-dropdown.tsx`.
Register: `features/auth/components/register-form.tsx` (rewritten), `app/register/page.tsx`, `features/profile/components/{photo-field,phone-field,profile-avatar,institution-fields}.tsx`, `components/ui/{combobox,password-field}.tsx`.
Create Conference: `features/conferences/components/create-conference-page.tsx` (rewritten), `features/chair/components/conference-details-page.tsx` (shows a saved timezone that is not in its short list instead of blanking it).
Login: `features/auth/components/login-form.tsx`.
New shared pieces: `components/ui/{searchable-select,country-select,dial-code-select,timezone-select,triggered-email-note}.tsx`, `features/auth/components/sso-buttons.tsx`, `features/auth/{legal-links,demo-accounts}.ts`, `lib/{sample-mode,focus,email-note}.ts`.
Styles: `app/globals.css` (+`.smart-field`, `.reg-*` fixed-height register layout, `.field-no-outline`), `styles/tokens.css` (+`--gradient-accent`).
QA only: `qa/` (probe fixes, `sync-qa-copy.ps1`, background-image block), `design-system/*`.

## Behaviour decisions to confirm
1. **Create Conference button**: "Create Conference" in sample / mock mode, "Send for approval" for real accounts (prototype's own rule). Using "Create Conference" for real accounts is a one-line change but misdescribes what happens (the request goes to approval).
2. **Emails card**: shown only in sample / mock mode. The prototype shows the card's headings with empty notes in database mode; I did not copy that.
3. **Photo on Register**: uploaded after sign-up through the existing profile service when a session exists (as the prototype does); with "Confirm email" on there is no session, so (as in the prototype) it is not kept.
4. **Login focus**: kept a primary-colour border on focus (accessibility) where the prototype shows none.
5. **Terms / privacy links** now open `/terms` and `/privacy` (as the prototype does) instead of the signed-in `/prototype/terms` page.

## Remaining mismatches (not fixed)
- Register: "Adjust photo" cropper (Next.js centre-crops automatically); email-note preview has no email frame (header / footer).
- Create Conference: Smart Fill (helper text and behaviour), venue Places search + map, saved-draft offer, "Clear form"; the note rows count "1 email" where the prototype shows "2 emails" (a quirk of the prototype's own catalogue lookup); Venue fields visible immediately (see `VENUE_FIELDS.md`); "Profile complete" pill and avatar in the header (blocked: mock mode has no profile).
- Login: email input is `type=email` (prototype: text); accessible labels were added (invisible).
- Page content outside scope that still differs, e.g. Notifications "Mark all as read" button height (19.5 vs 23.5 px).
- Header: the prototype's "All roles" and submenu (child) items are not used by the current menus; hover-open was added while keeping click and keyboard.

## Not tested / blocked
- Profile, Settings, Complete-profile (consumers of `PhoneField`, `PhotoField`, `ProfileAvatar`, `Combobox` pickers, the header avatar): mock mode has no accounts. These shared components changed and **have not been visually regression-tested there**.
- Real submit of Register / Login / Create Conference (no live Supabase by instruction), the photo upload after sign-up, and the production (database mode) rendering of the prototype's pages.
- Probe note (**corrected in `VERIFICATION.md` section 3b**): the label differences on submit, chair-settings, chair-peer-review-manage and chair-settings-review are **not regressions** (the baseline held the same diffs under asterisk-suffixed keys) but they are also **not harmless artefacts**: DOM inspection shows they are real, pre-existing mismatches of the shared `Field` label style against the prototype's per-page label styles. My earlier wording ("probe-pairing artefacts") was misleading.
