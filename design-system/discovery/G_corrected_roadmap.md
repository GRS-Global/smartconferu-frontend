# G. Corrected development roadmap (proposal, not started)

Principle: build in the order the **conference lifecycle** actually needs, not by role. A chair cannot run anything until Super Admin approves the conference and the CFP is published; nothing after that works without submissions flowing. Each milestone ends with the existing QA gate (visual parity, functional QA, 36-page regression) and **waits for your approval**. Frontend and backend work are separated; any backend/schema work is flagged for your decision.

| M | Milestone | Frontend work | Backend dependency | Exit criteria |
|---|---|---|---|---|
| M0 | Finish what is half-done in the Author path | Register photo cropper; Create Conference Smart Fill / Places / map (needs keys, decision); Submit draft + "Continue editing"; reviewer onboarding modal; role "Enter" routing | None new (Smart Fill uses existing functions) | Parity diffs under threshold on those pages |
| M1 | **Conference lifecycle core** | CFP suite (7 pages: publish, close, edit, theme, logo, managers); Conference lifecycle (archive, request deletion, cancel, restore) in Conference Details; My Request detail (view only) | RPCs exist (publish_cfp, close_cfp, archive_*, request_*, restore_*) — no schema change | A fresh conference can be published and closed from Next.js |
| M2 | **Super Admin console (own area, own auth)** | Login (two-step), Dashboard, Conferences, Users, Conference Requests + Deletion Requests queues, Platform Email Templates | `decide_conference_request`, `decide_conference_deletion`, admin read RLS (**audit needed**); 2-step enforcement (**decision**) | A request can be approved/rejected end-to-end; user decides the MEM-only queues' fate |
| M3 | Chair: complete the peer-review loop | Assign / auto-assign / bulk, reminders, extend, replacement, message, ask-to-fix, per-paper Initial Check and Plagiarism pages, paper page parity, reviewer stats columns, review-form PDF/chat if kept | existing RPCs; extension requests need a table (decision) | Chair can run screening to decision with no prototype link |
| M4 | Chair settings parity | Rich-text editor (guidelines, templates), venue map, AI topics, CFP managers tab, decision "Author sees" column, Setup tour | none | Settings pages match prototype fields |
| M5 | Reviewer parity | Review form advanced panes (PDF reader, paper chat, AI help), extension modal, Reviewer Journey (if kept) | gamification needs tables (decision) | Reviewer path parity |
| M6 | Server email completeness | Wire the 5 missing events (invitation_answered, conference_decided, conference_deletion_decided, conference_restored, template_test) | existing functions | Every wired event verified |
| M7 | **Needs your decision before any work:** post-decision modules (Registration, Programme, Certificates, Analytics, Flyers, Feedback, Activity logs, Preprints, Slides, Receipts, Watchlist, Publish with Us) | Each is a separate module | **New tables for each (schema work)** | Per-module approval |
| M8 | Public surfaces | Public CFP page, Smart CFP directory, Terms/Privacy/Help, certificate verification, marketing home | Certificate table (M7) | Public pages match prototype |
| M9 | Profile & Settings verification | Test safely with a dummy Supabase (method already documented), merge/delete accounts | none | Profile/Settings audited |

**Change vs the old six-milestone plan:** the CFP suite and Super Admin approvals move to the front (M1-M2); post-decision modules move to the end behind a decision gate (M7), because they have no database.

Parallelism: M3/M4 can run alongside M2 after M1; M5-M6 are small.
