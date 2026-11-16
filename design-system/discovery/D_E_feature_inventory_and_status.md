# D. Feature inventory and E. Prototype vs Next.js status

**Status legend:** `FULL` fully implemented (no gap found in the Next.js source comments, the prototype comparison or my earlier audits); `PART` partially implemented; `NONE` not implemented in Next.js; `N/A` not applicable; `UTV` unable to verify (could not be exercised or compared; reason given).
**How status was decided:** route existence; Next.js source comments that list what a page leaves out ("Not ported…"); searches for the prototype's actions and RPCs in `frontend/src`; and the page-level QA done in earlier phases (field-level audit only for Login, Register, Reset password, Create Conference, header, Notifications button, draft / dialog behaviour). `FULL` therefore means "no known gap", **not** "audited field by field". Prototype route = page key in `pathToRoute`; component name with line in `src/author-journey.jsx` unless a file is given.
**Persistence column:** DB = Supabase backed in database mode; MEM = prototype memory / sample / localStorage only.

## D1. Visitor and account

| # | Feature | Prototype route / component | Actual behaviour | Persistence / dependencies | Next.js | Notes / evidence |
|---|---|---|---|---|---|---|
| 1 | Marketing home | `/` `index.html` | Landing: workflow, features, roles, pricing, security, FAQ; CTAs to `/prototype/` | none; claims features that do not exist (H) | NONE | Out of scope unless approved (decision D7) |
| 2 | Sign in (password) | `login` `LoginPage:4167` | Email + password, demo-logins box (sample only), resend confirmation | DB: Supabase Auth | FULL | audited 0.17 % diff |
| 3 | Login by emailed code | `login` modal `AccountEmailModal` | One-time code by email | DB: Supabase Auth | FULL | real flow UTV (no live auth) |
| 4 | Forgot / reset password | `reset-password` `ResetPasswordPage:4640` | Emailed link, set new password, expired-link state | DB | FULL | mock state compared; valid-link state UTV |
| 5 | SSO sign-in | `login`/`register` `SsoButtons` | Google, Microsoft (azure), ORCID real providers; GR Connect "coming soon"; consent line | DB + Supabase provider settings (UNKNOWN whether configured) | NONE | Next buttons only show "coming soon" |
| 6 | Register | `register` `RegisterPage:4346` | 11 fields, photo + cropper, SSO block, terms, confirmation email | DB | PART | photo cropper missing; SSO missing |
| 7 | Complete profile gate | `complete-profile` | Holds SSO users until required details are set | DB | UTV | exists in Next; blocked in mock QA |
| 8 | Profile (editors, share, verification) | `profile` `ProfilePage` (647 lines) | Intro, about, affiliations, lists, emails, phone, address, links with find / connect / confirm / request verification, share + QR + vCard, photo cropper | DB: `profiles`, `profile_details`; verification queue is MEM | UTV | exists in Next; changed shared pieces untested |
| 9 | Security & Settings | `profile` tab | Change password, linked sign-in methods, merge accounts, delete account, notification channels / frequency, display (timezone, colour-blind) | DB for password; others partly | UTV | Next `/settings` exists; merge / delete not confirmed |
| 10 | Notifications page + bell | `alerts` `NotificationsPage` (author-module) | Tabs, read / unread, dismiss, mark all, conference filter, actions | DB `notifications` (+ MEM alerts) | FULL | button height fixed in Phase 1 |
| 11 | Header profile pill + avatar menu | `TopNav`/`ProfileMenu` | "Profile complete" / progress pill, avatar, menu | DB profile | UTV | hidden in mock mode by design |
| 12 | My Emails | (email history `shared/emailHistory.jsx`) | Emails sent to the user, viewer | DB `my_emails()` | FULL | Next tab; migration 0026 applied? UNKNOWN |
| 13 | Terms, Privacy, Help | `terms`, `/terms`, `/privacy`, `help` | Static legal pages; Terms page also records acceptance (`saveMyProfile`) | none / DB | NONE | links go to prototype / static |
| 14 | Public author profile | `author-public` `AuthorPublicProfilePage:371` | Public page of a profile | DB `public_profile()` (0027) | FULL | applied in the live DB? UNKNOWN |
| 15 | Public CFP page | `cfp-public` `PublishedCFPPage:224` | The published call, views | DB `cfps` (+ conferences) | NONE | |
| 16 | Certificate verification | `certificate-verify` | Public check by serial / QR | MEM (no table) | NONE | needs a table first |
| 17 | Smart CFP directory | `/smart-cfp` `SmartCFPPage`, `CFPDetailPage` | Search / filter list of calls, detail page | DB `conferences` (cfps) | NONE | separate SPA |

## D2. Account-level workspace

| # | Feature | Prototype | Behaviour | Persistence | Next.js | Notes |
|---|---|---|---|---|---|---|
| 18 | My Conferences, layouts A-D | `dashboard`, `/a /b /c /d` `DashboardPage:179` + `author-dashboard/` | Role cards, filters, pinned, status, certificate badge | DB `conferences` + member roles | FULL | counts need fixtures to compare |
| 19 | Review invitations (list, accept / decline) | `DashboardPage` + `DeclineInvitationModal` | Pending + History, decline reason | DB `respond_to_invitation` | FULL | |
| 20 | Reviewer onboarding on accept | `ReviewerOnboardingModal:6185` | Pick expertise, optionally save to profile | DB (profile) | NONE | not found in Next |
| 21 | Role routing ("Enter") | `enterConferenceWithRole` | author / chair to conference, reviewer to overview, committee to coming soon | UI | PART | committee page not built (and is only a placeholder) |
| 22 | Create Conference | `create-conference` `:36207` | see B2 | DB `conferences` (pending_approval) | PART | missing Smart Fill, Places search, map; draft, leave guard, Clear form done |
| 23 | My Requests list | `my-conference-requests` | Pending / rejected requests | DB | FULL | |
| 24 | Request detail, correspondence, cancel | `conference-request-detail:356 lines` | Fields, history with the Super Admin, cancel | MEM bridge (DB has only `admin_note`) | NONE | needs design if kept |
| 25 | CFP list / create / wizard / content / draft | `cfp`, `create-cfp`, `new-cfp-form` (538 lines), `cfp-create-content`, `cfp-edit-content`, `cfp-draft` | Build a call: type, location, dates, areas, themes, committees, speakers, sponsors, guidelines; content from empty / template / copy | DB `cfps.content/theme` (jsonb) partly; standalone CFPs MEM | NONE | PORT-PLAN notes a decision on standalone CFPs (UNKNOWN) |
| 26 | Publish with Us | `publish` (769 lines) | Publishing proposals (person / organisation), series | MEM | NONE | no table |
| 27 | My Preprints + create | `preprints`, `create-preprint` | Turn a submission into a preprint, wizard | MEM | NONE | |
| 28 | My Slides + create | `slides`, `create-slides` | Slides record wizard | MEM | NONE | |
| 29 | My Receipts | `receipts` | Payment history, invoices | MEM | NONE | no payment table |
| 30 | My Certificates / My Achievements | `my-certificates`, `my-achievements` | Issued certificates, reviewer levels / badges | MEM | NONE | |
| 31 | CFP Watchlist | `watchlist` | Follow calls | MEM | NONE | |
| 32 | Global My Submissions | `submissions` | Across conferences | DB (derived) | NONE | |

## D3. Author

| # | Feature | Prototype | Behaviour | Persistence | Next.js | Notes |
|---|---|---|---|---|---|---|
| 33 | Author dashboard | `conference-detail` `AuthorConferenceOverview`, `AuthorHome*.jsx` | Key dates, status, announcements; 4 home layouts by URL | DB + MEM | PART | single overview in Next; layouts a-d not found |
| 34 | My Submissions | `author-submissions:264 lines` | Cards / table, filters, result badge | DB | FULL | |
| 35 | Paper page (author) | `detail` `SubmissionDetailPage` | Timeline, presentation panel, notices, shared reviews, files, chair note | DB | FULL | "book slot" leads nowhere (prototype dead route) |
| 36 | Edit details / authors, new version, supporting doc, withdraw | dialogs in `SubmissionDetailPage` | Chair / author edit rules | DB RPCs | FULL | |
| 37 | New Submission | `submit` `SubmitPaperPage:404 lines` | see B3 | DB | PART | no draft / "Continue editing", no AI form fill from the paper |
| 38 | Updates | `author-updates` | Per-conference notifications | DB | FULL | |
| 39 | Activity Log | `author-activity-logs` `ActivityLogsPage` | Role-aware log | MEM sample | NONE | no table |
| 40 | My flyer | `author-flyer` `FlyerPage` | Share-card for a paper, social share, QR, PDF / PNG | MEM | NONE | |
| 41 | Feedback | `author-feedback` | Conference feedback survey | MEM | NONE | |
| 42 | Certificates (author) | `author-certificates` | Issued certificates | MEM | NONE | |
| 43 | Registration form | `registration-form` `RegistrationFormPage:29249` | Type, schema-driven form, payment method | MEM | NONE | |
| 44 | Programme booking | `programme-booking` | Route exists; **no page renders** | n/a | N/A | prototype gap |

## D4. Reviewer

| # | Feature | Prototype | Behaviour | Persistence | Next.js | Notes |
|---|---|---|---|---|---|---|
| 45 | Dashboard | `reviewer-overview`/`reviewer-papers` `ReviewerConferenceOverview:84` | Waiting for response, assigned papers table | DB | FULL | compared |
| 46 | My Reviews | `reviewer-reviews` | Table view, status | DB | FULL | |
| 47 | Accept / decline assignment | `respondToAssignment` | Reasons, chair notified | DB | FULL | |
| 48 | Review form | `reviewer-review-form:420 lines` | see B5 | DB (`reviews`, drafts) | PART | no PDF reader, paper chat, AI help UI, extension request; iframe pane instead |
| 49 | Ask for more time | `RequestExtensionModal` | Extension request | MEM | NONE | no table / email event |
| 50 | Reviewer Journey (XP, levels, badges) | `ReviewerJourney*.jsx`, `CelebrationModal` | Gamification | MEM | NONE | |
| 51 | Updates | `reviewer-updates` | Reviewer notifications | DB | FULL | |
| 52 | Certificates / Activity Log (reviewer) | `reviewer-certificates`, `reviewer-activity-logs` | | MEM | NONE | |
| 53 | Review reminders (server) | `send-review-reminders` cron | "N days left" + "last day" emails | DB + email | N/A | server function shared |

## D5. Chair

| # | Feature | Prototype | Behaviour | Persistence | Next.js | Notes |
|---|---|---|---|---|---|---|
| 54 | Chair dashboard | `conference-detail` `ChairConferenceOverview` | see B4 | DB (+ MEM bits) | PART | People card, some registration numbers missing |
| 55 | Submissions list | `chair-submissions` | Columns picker, saved views, filters, bulk actions | DB | PART | "Add to sessions" missing (needs programme) |
| 56 | Manage submissions (form + settings) | `chair-submissions-manage:70` | Form editor, period, limits, guidelines (rich text), tracks, types | DB `conference_forms`, `conference_settings` (0028) | PART | rich-text editor not ported; fixed fields not editable |
| 57 | Email Communication | `chair-submissions-email` | Compose, templates, history | DB + `custom_email` | PART | check Templates / history tabs in Next (UTV) |
| 58 | Submit on behalf | `chair-submit-behalf` | Chair submits for an author | DB | FULL | |
| 59 | Initial Check | `chair-initial-check`, `-detail` | Table, per-paper page, emails, reopen | DB `submissions.screening` | PART | per-paper page, earlier versions, auto check missing |
| 60 | Plagiarism Check | `chair-plagiarism`, `-detail`, (`-v1` alternate) | iThenticate report upload, AI screening | DB + storage | PART | per-paper page, ZIP download missing; `-v1` intentionally skipped |
| 61 | Peer Review list | `chair-peer-review:809 lines` | Buckets, filters, assign / auto-assign / add reviewers / bulk assign, remind, notify, edit decisions | DB | PART | assign / auto-assign / reminders / cut-offs not ported |
| 62 | Peer Review > Reviewers | `chair-peer-review-reviewers` | Committee table, invite, edit, remove, assign papers | DB | PART | on-time rate / helpful columns missing |
| 63 | Peer Review > Manage | `chair-peer-review-manage` | Form preview, all reviews, CSV | DB | PART | form editor lives in Review settings |
| 64 | Chair paper page | `detail` (2 pages + `ChairAddReviewPage:92`) | Reviewers & scores, compare, decision, notify, share, desk reject, add / edit review, reminder, extend, message, replacement, ask-to-fix, manage submission, email authors | DB (+ MEM for reminders etc.) | PART | one page vs two; reminders / extend / message / replacement / ask-to-fix not ported |
| 65 | Registration | `chair-registration:504` | Registrations, period, form builder, pricing, confirmation, CSV | MEM | NONE | no tables |
| 66 | Programme (3 pages) | `chair-programme*` | Overview, full, manage sessions | MEM | NONE | no tables |
| 67 | Certificates (4 pages) | `chair-certificate*` | Design, designer, distribute, recipients | MEM | NONE | no tables |
| 68 | Speaker flyer | `chair-flyer` | Designer / publish | MEM | NONE | |
| 69 | Analytics (9 tabs) | `chair-analytics` | Charts over submissions / authors / reviews | MEM (could be computed from DB) | NONE | |
| 70 | Conference Details | `chair-settings:576` | 6 sections; archive / delete | DB `conferences` + `details` | PART | venue map, AI topics, licence, CFP managers tab, archive / delete missing |
| 71 | Settings > Submissions | `chair-settings-submissions` | Period, limits, tracks, types, screening toggles | DB 0028 | PART | |
| 72 | Settings > Review | `chair-settings-review` | Period, timeline, assignment, visibility, instructions, form | DB 0028 | PART | |
| 73 | Settings > Decision | `chair-settings-decision:386` | Decision types, author wording | DB `decision_types` | PART | "Author sees" wording column missing in table |
| 74 | Settings > Email Templates | `chair-settings-email-templates` | Platform copies per conference | DB `conference_email_templates` | PART | rich-text editor not ported; catalogue has more than the table |
| 75 | Settings > Activity Logs | `chair-settings-activity-logs` | Sample log with detail | MEM | NONE | |
| 76 | Settings > Email Logs | `chair-settings-email-logs` | Sent-email history | DB `email_log` | FULL | |
| 77 | CFP manager (7 pages) | `cfp-manager`, `cfp-edit-details`, `cfp-theme`, `cfp-publish`, `cfp-logo`, `cfp-managers`, `cfp-add-manager` | Publish / close, edit, theme, logo, managers | DB `publish_cfp`, `close_cfp`, `cfps` | NONE | **critical-path** (authors cannot submit until published) |
| 78 | Conference lifecycle | in `chair-settings` | Archive, request deletion, cancel, restore | DB RPCs | NONE | |
| 79 | Setup guide / tour | `setup-tour/`, dashboard card | Checklist + guided tour | partly DB | PART | tour not ported |
| 80 | Payment, Communications menu items | `CHAIR_SIDEBAR_SOON_ITEMS` | "Coming soon" | none | N/A | not built in the prototype either |

## D6. Super Admin (separate console; Next.js has none)

| # | Feature | Prototype | Behaviour | Persistence | Next.js | Notes |
|---|---|---|---|---|---|---|
| 81 | Sign-in (password + code) | `AdminLogin`, `data/adminAuth.js` | Two steps; trusted device 14 days; test code in dev | DB `is_super_admin`; 2-factor not enforced by DB | NONE | security note H |
| 82 | Dashboard | `DashboardPage` | Platform overview | DB (live) | NONE | |
| 83 | Conferences + detail | `PlatformPages`, `DetailPages` | List, detail, archive / restore | DB (live) | NONE | |
| 84 | Users + detail | `UsersPage`, `UserDetailPage` | List / detail | DB (live) | NONE | |
| 85 | Papers detail | `PaperDetailPage` | Admin paper view | DB (live) | NONE | |
| 86 | Queue: Conference Requests | `queues.jsx` | Approve / decline / ask info | DB (live) | NONE | **critical-path** |
| 87 | Queue: Deletion Requests | `DeletionRequestsPage` | Approve / reject | DB (live) | NONE | |
| 88 | Platform Email Templates | `MasterPages` | Edit platform templates, test send | DB `email_templates` | NONE | |
| 89 | Queues: License Extensions, CFP Page Review, Profile Verification, Claim Reports, Names & lists (6) | `queues.jsx` | Approve / decline / merge / correct / publish… | MEM | NONE | no tables; CFP review conflicts with DB rule |
| 90 | Billing, Announcements, Societies / Institutions / Research Areas, Team & Roles, Audit Log | `BillingPage`, `CommunicationPages`, `CataloguePages`, `MasterPages`, `TeamPage` | | MEM | NONE | no tables |
| 91 | Search palette, step-up dialog | `SearchPalette`, `StepUpDialog` | | UI | NONE | |

## D7. Shared / platform

| # | Feature | Behaviour | Next.js | Notes |
|---|---|---|---|---|
| 92 | Server emails (19 events + 1 cron) | `emailRequest.js`, `send-review-reminders` | PART | Next triggers 14 of 19 events; **not triggered from Next**: `invitation_answered`, `conference_decided`, `conference_deletion_decided`, `conference_restored`, `template_test` (search by event name; wrappers could hide some) |
| 93 | AI functions | extract-paper, extract-conference, suggest-topics, screen-paper, paper-chat, enhance-review, ingest | PART | Next proxies only ingest-paper, paper-chat, enhance-review |
| 94 | File storage (papers private, public bucket) | signed links, upload | FULL | |
| 95 | Dashboard / header design parity | | FULL for audited pages | design audit in `AUDIT_FINDINGS.md`, `CORRECTIONS.md` |

## Tally (counted from the status column of the 95 rows; one row may be miscounted by the pattern)
FULL 20 · PART 24 · NONE 43 · UTV 4 · N/A 3.
Reading: the Author and Reviewer paths, My Conferences, notifications and auth are largely done; the Chair side is partly done; **everything that makes a conference go live (Super Admin console, CFP suite) and everything after a decision (registration, programme, certificates, analytics) is not started.**

## Verified RPC usage from Next.js (search of `frontend/src`)
Used: respond_to_invitation, respond_to_assignment, record_decision, notify_decision, save_screening, set_review_shared, chair_edit_review, chair_submit_review, withdraw_submission, update_paper_details, save_paper_authors, delete_submissions, set_submission_track, claim_my_papers, my_emails, public_profile, check_duplicate_submission.
**Not found in Next.js:** publish_cfp, close_cfp, archive_conference, request_conference_deletion, restore_conference, decide_conference_request, decide_conference_deletion (and the cancel / restore deletion RPCs). All are on the conference-lifecycle critical path.
