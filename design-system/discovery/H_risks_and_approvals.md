# H. Risks and approval requirements

## Risks
1. **Prototype sample vs real behaviour.** Many prototype screens work only in memory; porting them as-is would show features that do not persist. (Memory rule: no dummy data in DB mode.)
2. **Super Admin security.** The 2-step sign-in and trusted device are front-end only; the DB checks `is_super_admin`. An exposed admin area in Next.js needs a decision on enforcement before build.
3. **Conflicting rules.** Prototype "CFP Page Review" gate vs DB rule that lets a chair publish directly; creator becomes chair before approval.
4. **Marketing claims** (proceedings, camera-ready, payments) that have no implementation.
5. **Unknown live DB state.** Which migrations are applied, bucket policies and RLS for admin reads were not verified (no live access allowed).
6. **Schema growth.** M7 needs ~15+ new tables; any change touches schema/RLS, which this task did not touch.
7. **Email wiring:** 53 of 72 templates are display-only; 5 server events are not triggered from Next.js.
8. **SSO** requires provider configuration in Supabase (not checked).
9. **Scale of prototype file** (40k lines): parity depends on QA harness; unaudited pages carry risk (only 7 pages audited field-by-field).
10. **Revision flow is undefined** in code (see F5).

## Items I could not verify (UTV)
Complete-profile gate, Profile and Settings pages, header pill, live auth flows, live DB policies, whether `my_emails`/`public_profile` migrations are applied.

## Approvals needed from you (before any development)
1. Approve this workflow documentation (A-F) as the baseline.
2. Approve or reorder the roadmap (G), especially M1-M2 first.
3. Decide per MEM-only module (M7 list): build with new tables / keep as "coming soon" / drop.
4. Decide Super Admin: build in Next.js now or later; enforcement of 2-step sign-in.
5. Answer the open business questions in F5 (at least revision, registered, licence, standalone CFPs, Committee).
6. Confirm schema/RLS work is allowed (and who applies migrations).
7. Confirm SSO providers and map/Places keys are available for Smart Fill / maps.
8. Confirm whether marketing home, Smart CFP and Publish with Us are in scope.

**No development will start until you approve.**
