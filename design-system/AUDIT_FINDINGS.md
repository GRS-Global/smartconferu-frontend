# Audit findings and correction plan (2026-11-03)

Evidence: `qa/out/` (git-ignored, regenerate with `node run-audit.mjs && node run-compare.mjs && node page-state.mjs && node summarize.mjs`). Prototype = reference. **No page has been changed**; nothing here is fixed yet.

Legend: **VERIFIED** = measured in both apps with matching state. **BLOCKED** = Next.js side could not render the real state in QA (reason given). **UNVERIFIED** = not measured.

## 1. Verified matches
| Item | Evidence |
|---|---|
| Reset password page (card, heading, text, button) | Screenshot diff **0.07 % @1440, 0.06 % @1600, 0.26 % @390** with the form enabled (port 3101). The earlier 3 %/10 % was the mock-mode notice, not design. |
| Design tokens (colours, radius 0.7rem, font family) | `theme.js` TOKENS == `tokens.css` for every token present in both; font Plus Jakarta Sans in both. |
| Login "Sign in" button colour | Prototype uses a gradient with two identical stops (#7C3AED) = Next.js solid #7C3AED. Equivalent. |
| Password show/hide toggle behaviour (login) | Same pressed/label state after click. |
| Page headings on all 36 compared routes | Every page renders the same page title in both apps (`page-state.json`); none is a not-found page. |

## 2. Verified mismatches: the four reported issues, with causes
Cause = what the source shows. Not fixed.

### Register  (`features/auth/components/register-form.tsx` vs prototype `RegisterPage`, `author-journey.jsx:4346`)
| # | Difference | Cause | Priority |
|---|---|---|---|
| R1 | Missing "You may also be interested in our policy for using personal information" line | Not implemented in `register-form.tsx` (prototype line 4471, `PRIVACY_URL`) | High |
| R2 | Missing "Sign up in one click with" SSO block (Google, ORCID, Microsoft, GR Connect + consent text) | Not implemented; the prototype renders `SsoButtons` here (line 4474), Next.js only has it on login | **Critical** (missing feature) |
| R3 | Missing "or fill in your details" divider | Not implemented | Medium |
| R4 | Missing profile photo upload (avatar, "Upload photo", "Profile photo (optional) · JPG or PNG, or drag & drop") | `PhotoUpload` (prototype line ~5483) has no Next.js counterpart | **Critical** |
| R5 | Form does not scroll inside a fixed-height card; Next.js card grows (+287 px @1440, +696 px @390) | Prototype's `.reg-page/.reg-card/.reg-form/.reg-scroll` CSS (lines ~4440-4447, `min-height:640px` media rule) not ported | High |
| R6 | Fields are placeholder-only in the prototype ("First name *"); Next.js shows a visible label above each field | Different component pattern (`Field` with labels) | High (design) |
| R7 | Country / region: custom searchable dropdown in the prototype; native `<select>` (196 options) in Next.js | Different control | High |
| R8 | Website input `type=url` vs `type=text` | - | Low |
| R9 | Next.js has extra Gender select and country-calling-code select; the prototype has a "+91" picker button and a different select (gender-like) at a different position; exact option lists not yet compared | Needs a manual field audit with options (probe cannot read custom dropdown options) | UNVERIFIED |
| R10 | Terms link font 11 px (prototype, second link) vs 14 px | Next.js uses default size | Low |
| R11 | Focus behaviour: prototype autofocuses "First name"; Next.js does not | - | Medium |
| R12 | "Fill in 9 more fields" disabled button, hover and submit-empty states | Identical (disabled, same colours) | match |

### Login  (`login-form.tsx` vs `LoginPage`, `author-journey.jsx:4167`)
| # | Difference | Cause | Priority |
|---|---|---|---|
| L1 | Conference tagline "World Conference on Information Systems for Business Management" under the logo is missing | Hard-coded and unconditional in the prototype (line 4226); Next.js shows none | High |
| L2 | "By continuing with Google, Microsoft, ORCID or GR Connect, you agree to the Smartconferu Terms of Service and Privacy Policy." line under the SSO buttons is missing | Inside the prototype's shared `SsoButtons` (line 3978); not in Next.js | High |
| L3 | Card sits ~19 px lower and page is 130 px shorter @1440 (236 px @390) | Consequence of L1/L2/L3-mode items | Medium |
| L4 | Email input `type="email"` (Next.js) vs `type="text"` (prototype) | - | Low (changes browser validation) |
| L5 | Demo-logins box and "clickable prototype with sample data" footer | **Mode difference, not a bug**: shown only when `!USE_DATABASE` (line 4279). The true counterpart is the prototype in database mode, which was **not compared** (it would need the real Supabase env). | UNVERIFIED |
| L6 | Visible label vs placeholder: both apps show a placeholder; Next.js also has an accessible label | Accessibility addition | Info |

### Reset password: **no design mismatch** (see section 1). Remaining differences: heading level `h2` (prototype) vs `h1` (Next.js), and "Back to sign in" is a `<button>` in the prototype vs a link in Next.js. Behaviour of the real set-password form (valid link) is UNVERIFIED: it needs a real recovery link.

### Create Conference  (`create-conference` page; 388 px shorter @1440, 208 px @390)
Measured on side-by-side + field probe. Next.js is shorter because it **lacks** and **changes** the following:
| # | Difference | Priority |
|---|---|---|
| C1 | "Emails this triggers" section (when you click Create → 2 emails; Super Admin decision → Approved / Declined, "View preview") replaced by a short "What happens next" note | **Critical** (missing section) ~200 px |
| C2 | "About the conference": prototype 1,200-word limit, tall box, placeholder "Scope, audience, what makes it worth submitting to…"; Next.js 300 words, shorter box, placeholder "Optional — a short description…" | High |
| C3 | Section 1 title "Basic details of the conference" + subtitle vs "Basics"; Website helper text and Smart Fill icon missing | High |
| C4 | Timezone: custom picker "Use my browser's timezone" (grouped list) vs native select "Select a timezone" | High |
| C5 | Dates: labelled STARTS / ENDS vs none | Medium |
| C6 | Primary / Secondary area and Country: custom dropdowns (country searchable) vs native selects | High |
| C7 | Next.js has **extra fields "Venue" and "Venue address"** not present in the prototype | High (invented fields) |
| C8 | Location & contact: field order differs (prototype City, Country / State, Postal / Contact email; Next.js Venue, Address / City, State, Postal / Country, Contact email) and labels differ ("State / province" vs "State / region", "Postal / ZIP code" vs "Postal code") | High |
| C9 | Contact email placeholder `info@yourconference.org` vs `queries@yourconference.org`; helper text differs | Medium |
| C10 | Primary action: "Create Conference  Ctrl ↵" vs "Send for approval"; live-preview card has a gradient top bar in the prototype only | Medium |
| C11 | Event-format cards 80 px high vs 61.5 px; type cards (Conference / Book …) 52 px vs 37 px; section-title layout `flex` vs `block` | High |
| C12 | Header shows "Profile complete" + avatar in the prototype only | BLOCKED (no profile in mock mode) |

## 3. Shared-component finding (largest lever)
**Top navigation** (`components/layout/app-header.tsx` / `nav-dropdown.tsx`) differs on **33 of 36** compared pages: nav buttons are **40 px high in Next.js vs 36 px**, vertical padding 0 vs 8 px, `display: inline-flex` vs `flex`, width 142.5 vs 145.2 px ("Calls for Papers"), and inactive item colour `#475569` (ink-soft) vs prototype navy `#0B1020`. One fix here clears the same 12 high + ~10 medium diffs on every page; it must then be re-checked on all 33 pages (see `REGRESSION.md`). Also: "Profile complete" pill + avatar are missing from the header in the QA run (BLOCKED, no profile in mock mode).

Container buttons (cards that wrap text) show `color` rgba(0,0,0) vs rgba(30,41,59): low confidence, probably not visible because child elements set their own colour. Treat height / layout rows as the signal.

## 4. Route-by-route result (36 compared routes; full table in `qa/out/SUMMARY.md`)
| Class | Pages |
|---|---|
| **Compared, real result** | login (L-items), register (R-items), reset-password (match), create-conference (C-items) |
| **Layout comparable, rows differ (DATA)** | dashboards A-D, notifications, my-requests, author dashboard / submissions / updates, new submission, reviewer papers / overview / reviews / updates, chair dashboard / submissions / manage / email / peer-review (+manage, reviewers) / initial-check / plagiarism / submit-behalf / settings (+submissions, review, decision, email-templates, email-logs). For these only **shared chrome** (section 3) and **structure** (`only-proto` / `only-next` element lists) are trustworthy; field counts are dominated by row counts (e.g. Chair Submissions 1,024 vs 45 controls, Initial Check 5,912 vs 44). |
| **BLOCKED in mock mode** | profile (19 controls vs 0), settings, complete-profile |
| **Not routable in QA** | `/submissions/[paper]/*`, `/reviewer/[slug]/review/[paper]`, public author profile (see `FIXTURES.md`) |

Scripted-state coverage (per page, 1440): default, focus first input, hover submit, submit empty, keyboard Tab path, open custom combobox, password toggle; list/view pages get default + keyboard Tab only. Results per page are in `qa/out/AUDIT.md` (Scripted states table). Not scripted yet: open modal, open tab, expanded section, loading and error states, empty states, open dropdown option lists for custom dropdowns on every page. Those remain **UNVERIFIED**.

## 5. Prioritised correction plan (awaiting your approval; nothing started)
1. **App header (shared)**: 36 → 40 px height, padding, colour, display: biggest payoff, affects 33 pages. Re-run all pages after.
2. **Register**: R2, R4 (SSO block, photo upload), R1/R3, R5 (scroll layout), R6/R7 (field pattern, country dropdown).
3. **Create Conference**: C1 (emails section), C7 (remove invented venue fields: *needs your confirmation, as it removes behaviour*), C2-C6, C8-C11.
4. **Login**: L1, L2 (+ L4).
5. Build the missing fixtures (prototype papers) and a fake-Supabase profile so the 14 BLOCKED/DATA pages can be audited at field level; then fix by page.
6. Extend scripted states (modals, tabs, loading/error/empty) before declaring any page complete.

Decisions I need from you before step 3: is the "Venue / Venue address" pair intentional (Next.js-only addition), and should Create Conference keep "Send for approval" or use the prototype's "Create Conference"?

## 6. Known limitations of the QA system
- Pixel diff is only meaningful for data-independent pages; DATA pages differ in rows by construction.
- Field matching is by (visible text, type); custom dropdown option lists (prototype buttons) cannot be read by the probe, so they are only reported as "control type differs".
- The probe compares computed styles of elements matched by role + text; duplicated or renamed labels reduce matching, and container `color` is noisy.
- Prototype compared in **sample-data mode only**; its database mode (the real counterpart of Next.js supabase mode) was not run because it needs the real Supabase configuration.
- No live Supabase, no real accounts, no emails were used. The auth instance uses an unreachable dummy URL.
- Next.js dev build used (HMR present); a production build may differ in timing only.
