# Workflow discovery – index

Read-only investigation. No application source, prototype, env file, migration or Supabase resource was changed; no secrets read; no commit, push or deploy.

| File | Deliverable |
|---|---|
| A_B_overview_and_role_workflows.md | A overview, B role workflows |
| C_cross_role_workflows.md | C cross-role workflow diagram + sequences |
| D_E_feature_inventory_and_status.md | D feature inventory, E prototype vs Next.js |
| F_business_rules_and_backend.md | F business rules and backend |
| G_corrected_roadmap.md | G roadmap |
| H_risks_and_approvals.md | H risks and approvals |

**Method:** prototype routes, components, data calls and `supabase/migrations` read from files; Next.js `src` searched for routes and RPCs; helper scripts (outside the repo) indexed components.
**Limits:** statuses mean "no known gap", not field-level audit (only Login, Register, Reset password, Create Conference, header, Notifications were audited). Some descriptions came from earlier-session notes and were cross-checked for presence only. Live DB state, Netlify env and provider settings were not inspected.
