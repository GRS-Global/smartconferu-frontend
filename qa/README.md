# Visual QA (prototype vs Next.js)

Isolated package (own `package.json`; app deps untouched): Playwright (Chromium), pixelmatch, pngjs.

```
cd frontend/qa && npm install && npx playwright install chromium      # once
node gen-parity-fixtures.mjs                    # regenerate src/mocks/parity-conferences.ts from the prototype (read-only)
node run-compare.mjs [--page a,b] [--vp d1440]  # screenshots: prototype, next, side-by-side, overlay, diff + report.json
node run-audit.mjs   [--page a,b] [--workers 4] [--offline]   # computed styles + fields + scripted states -> out/audit.json, AUDIT.md
node page-state.mjs                             # what each page really renders (catches not-found / mock placeholders)
node summarize.mjs                              # out/SUMMARY.md, one row per page
node component-usage.mjs [--pages ui/field.tsx] # shared component -> dependent routes -> QA page ids (design-system/REGRESSION.md)
```
Servers and the three run modes (prototype 5180, Next mock+parity 3100, Next auth-pages 3101): see `../design-system/FIXTURES.md`.

Files: `pages.mjs` (page registry + blocked list; add every new page here), `lib.mjs` (frozen clock, UTC, DPR 1, reduced motion, animations off), `probe.mjs` (collectors + comparers), `states.mjs` (scripted states; no credentials are ever typed), `out/raw/` (collected data, so rules can be changed and re-applied with `--offline`).

Limits: see `../design-system/AUDIT_FINDINGS.md` section 6.
