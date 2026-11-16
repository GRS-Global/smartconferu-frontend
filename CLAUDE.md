# Project instructions (Next.js port of the prototype)

@AGENTS.md

The Vite prototype at `../src` (mounted at `/prototype/*`) is the **permanent source of truth** for design, fields, forms, components, layouts and interactions. Read `design-system/DESIGN_RULES.md` first.

## Before implementing or changing any UI
1. Read `design-system/DESIGN_RULES.md` and `design-system/COMPONENTS.md`; check `design-system/PAGE_INVENTORY.md` and `PORT-PLAN.md`.
2. **Inspect the prototype page first**: find it via `pathToRoute()` in `../src/author-journey.jsx` (or `../src/author-module/*`), read the component and its helpers, open it in a browser, try its interactions. Never build from a page name alone.
3. List exact fields: count, order, labels, placeholders, input types, required/optional, defaults, dropdown options, validation + error messages, helper text, widths/heights, button placement, disabled/loading states. Do not add, remove, rename or reorder.
4. Reuse `src/components/ui/*` and `src/components/layout/*`. A fix to a shared component needs a re-run of QA for every page that uses it. Do not fork per-page styling.
5. If the prototype has no equivalent, or something cannot be built (no DB table, security), **stop and ask**; never invent design or behaviour.

## QA before saying a page is done
- Add the page to `qa/pages.mjs`.
- Start both apps without editing env files: prototype `VITE_USE_DATABASE=false npx vite --port 5180 --strictPort` (from `..`), Next `NEXT_PUBLIC_DATA_SOURCE=mock NEXT_PUBLIC_PROTOTYPE_URL=http://localhost:5180 npx next dev -p 3100`.
- `cd qa && node run-compare.mjs --page <id>`; inspect side-by-side/overlay/diff at 1440, 1600, 390 (`qa/out/`). Fix mismatches, re-run. Also check fields, interactions, validation, loading/error/empty states by hand or test.
- Run `npx tsc --noEmit` and `npx eslint src`.
- Report honestly: diff % is only meaningful for `data: "independent"` pages; never claim parity without comparison evidence; document every mismatch you could not fix in `PORT-PLAN.md` and `PAGE_INVENTORY.md`.

## Safety (unchanged)
Do not modify the prototype, `.env*`, Supabase schema/migrations/RLS (new migration *files* only when the owner agreed), auth behaviour; no fake production data, no real emails or accounts; no commits/pushes unless asked; no new dependency without approval (QA tooling lives in the isolated `qa/` package).
