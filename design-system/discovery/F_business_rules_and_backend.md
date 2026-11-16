# F. Business rules and backend dependencies

Source: `supabase/migrations/0001-0030` (read from files only; **no live database was contacted**). Whether each migration is applied in the live project is **UNKNOWN**.

## F1. Tables (21 found in migrations)
profiles, profile_details, conferences, conference_members, conference_settings, conference_forms, conference_email_templates, email_templates, cfps, tracks, decision_types, decision_events, submissions, submission_authors, submission_files, review_assignments, reviews, pending_review_assignments, conference_deletion_requests, notifications, email_log; AI support: ai_usage, paper_chunks, paper_digests (24 total).
**No table exists for:** registration, payments / receipts, programme / sessions, certificates, flyers, feedback, activity log, preprints, slides, watchlist, extension requests, request correspondence, licences, billing, announcements, profile verification, claim reports, societies / institutions / research-area catalogues, admin team, admin audit log. These are prototype-memory only.

## F2. Roles and permissions
- Author: derived (a `submission_authors` row linked to the account). No role row.
- Reviewer, Chair, Track chair, CFP manager: `conference_members.role` with a state (invited / active / declined / removed). Helpers `is_chair`, `has_conf_role`, `is_conf_member`, `is_assigned_reviewer`, `is_submission_author`.
- Super Admin: `profiles.is_super_admin` (`is_super_admin()`).
- Committee: no database concept.
- Creator of a conference becomes an active chair at once (`handle_new_conference`), before approval.
- Admin 2-step sign-in and 14-day trusted device exist only in the front-end; **the database checks only the flag**. UNKNOWN whether a server step enforces the code.

## F3. Business rules found in the database
| Rule | Where |
|---|---|
| Conference starts `pending_approval`; only Super Admin moves it to `active` / `rejected` (`decide_conference_request`) | 0001 |
| Author can insert a submission only if conference `active` AND CFP `published` AND now ≤ `submission_deadline` | 0006 policy |
| `publish_cfp` requires an active conference; `close_cfp` only from `published` | 0006, 0011 |
| Chair may submit on behalf even after the deadline | 0021 |
| Paper number assigned by trigger per conference prefix | `assign_paper_no` |
| `upload_pending` → `no_decision` when a paper / revision / camera-ready file is added | `handle_paper_uploaded` |
| Decisions are recorded silently; authors see them only after `notify_decision` (`notified_*`) | 0001/0002 |
| Reviews private to chairs until `set_review_shared`; review locked after decision | `author_reviews` view |
| Author cannot withdraw after being told a rejection; chair cannot withdraw a rejected paper | 0007 |
| Withdrawal removes assignments (status `removed`), submitted reviews stay | 0007 |
| Decline of a reviewer invitation returns waiting papers; accept converts queued assignments | 0019 |
| Duplicate submission check (title / similar) | 0010 |
| Chair may edit unclaimed / any paper and delete submissions | 0022, 0029, 0030 |
| Archive, then request deletion; Super Admin decides; restore possible | 0012-0015 |
| Email templates copied from platform to a conference when it goes active | `handle_conference_live`, 0005 |
| Eight default decision types seeded per conference | `handle_new_conference` |

## F4. Rules that exist only in the prototype UI (not enforced by the DB)
Licence trial / extensions; payment surcharge; registration fee by type; programme slots; certificate issuing; reviewer XP / levels; extension requests; request correspondence; admin "ask for info"; CFP Page Review by Super Admin; step-up dialog; word limits and some field checks (UI-only validation). **UNKNOWN** which of these the owner wants as real, enforced rules.

## F5. Open business questions (not answered by the code)
1. Revision: does a revised paper return to review automatically? Is there a revision round limit?
2. What decides `registered`? Is it set by payment, or only by the chair?
3. Is the licence model (trial, extension, billing) real or a mock?
4. Standalone CFPs (not tied to a conference): real feature or demo?
5. Are Committee members a real role, separate from Reviewer?
6. Who owns the final "camera-ready / proceedings" step?
7. Should Super Admin CFP review gate publication (the DB currently does not)?

## F6. Storage and limits
Bucket `papers` private (PDF / Word, 25 MB, signed links); public bucket for logos / photos (names and limits taken from migrations / front-end; **live bucket policies UNKNOWN**).

## F7. Server functions (Netlify) and email
10 functions: send-email, send-review-reminders (daily cron), extract-paper, extract-conference, suggest-topics, screen-paper, paper-chat, enhance-review, ingest-paper-background, orcid-link. Email catalogue 72 templates; 19 server events wired; 53 shown in UI but not sent. Needs secrets (email provider, AI key) held only in Netlify env — **not inspected**.
Notification kinds: conference_request, new_submission, member_invited, review_assigned, conference_decision, invitation_answer, assignment_declined, withdrawn, review_edited, coauthor_added (+ decision).

## F8. Dependencies the Next.js work needs and does not yet have
- Super Admin: a separate auth gate and the RPCs `decide_*`, plus RLS for admin reads (lists of all conferences / users). RLS completeness for admin reads: **UNKNOWN** (not audited).
- Any new table above requires **schema work, which is outside this task and needs your decision**.
- Netlify functions are reachable from Next.js only if the routes are proxied; today 3 are proxied.
