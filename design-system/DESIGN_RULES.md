# Design rules (permanent)

**The Vite prototype is the single source of truth** for design, fields, forms, components, layouts and interactions.

- Prototype: `author-journey/src/` (entry `src/main.jsx` → `src/author-journey.jsx`, a ~40k-line file; mounted at `/prototype/*`).
- Next.js app: `author-journey/frontend/src/` (App Router, TypeScript, Tailwind v4).
- Tokens: prototype `src/shared/theme.js` (`TOKENS`) ↔ Next.js `src/styles/tokens.css`. Verified identical for brand, structural, text, status and category colours (2026-11-03). Edit values only in the prototype first, then mirror.

## Never
1. Redesign, modernise or "improve" a prototype page.
2. Invent, remove, rename or reorder fields, labels, placeholders, buttons, sections.
3. Replace a prototype interaction with a simpler one without approval.
4. Fork a shared component's styling per page.
5. Change business rules/backend to get visual similarity.
6. Break an approved page while building another (run regression QA, see `qa/README.md`).

## Always
1. Read the prototype page and its helpers before writing Next.js code; open it in a browser.
2. Reuse `src/components/ui/*` and `src/components/layout/*`; see `COMPONENTS.md`.
3. Record anything the DB/backend cannot supply as a known gap (`PORT-PLAN.md` log + `PAGE_INVENTORY.md`).
4. Run `qa/run-compare.mjs` for the page at 1440, 1600 and 390 and fix mismatches before calling it done.
5. If the prototype has no equivalent page, ask before designing.

## Known comparison caveat
Prototype (sample data) and Next.js (mock fixtures or live DB) show **different rows**. Pixel diff % is therefore only a *score for data-independent pages* (`data: "independent"` in `qa/pages.mjs`); for `sample` pages use the side-by-side/overlay images for layout, and the computed-style probe for component sizes. A low diff % is not proof of parity and a high one is not proof of a bug.
