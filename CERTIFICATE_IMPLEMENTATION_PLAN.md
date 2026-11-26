# Certificate Studio implementation plan

Each slice ships working, is tested with `tsc`, `eslint` and in the browser (mock data source), and is recorded in `CERTIFICATE_TEST_RESULTS.md` only after it was actually run.

## Slice 1 (P0, no dependencies, no migration): the editor core
1. `model/`: Design v2 + `migrateDesign` + token resolution (unit-tested pure functions).
2. Renderer generalised to elements; v1 designs render identically (visual check).
3. Studio shell at the existing design route: top bar, left sidebar, canvas, properties, layers.
4. Select / move / resize / rotate / multi-select / duplicate / delete / copy-paste / group / lock / hide / z-order / align.
5. Undo/redo, shortcuts (ignored while typing), zoom/fit, text and shape properties, add text/shapes/lines/borders.
6. Autosave status + local draft recovery.
7. Dynamic field chips on any text element, auto-fit, missing-field warnings.

## Slice 2 (P1, still no new dependency)
Rulers, guides, grid, margins, smart snapping; background panel; 12+ designed templates, gallery search/filter/favourites (favourites/recents in localStorage until a table exists); PNG/JPG export if achievable without a library; better print export.

## Slice 3 (P0/P1, needs your decision): storage + signatures + brand kit + versions
Needs a storage location and new tables (migration files). See questions below.

## Slice 4 (P2): bulk
CSV import (own small parser, no dependency), field mapping, per-recipient preview with overflow/duplicate/missing checks. Multi-page PDF / ZIP / XLSX need libraries (jspdf or pdf-lib, jszip, xlsx) or a backend renderer. Revoke/reissue needs a migration + verify-page change.

## Slice 5 (P3): PDF import (flattened background via the installed pdfjs), sharing. Real-time collaboration is not planned.

## Open decisions (blocking Slices 3-4)
1. Dependencies: approve jspdf (or pdf-lib) + jszip (+ xlsx)? Without them: no bulk PDF/ZIP/XLSX.
2. Storage for signatures/logos/assets: Supabase Storage (needs bucket + policy SQL you run) or the NestJS `POST /files` (needs a certificates module there)?
3. May I write new migration files (signatures, assets, revisions, brand kit, revoke status) for you to run? Note the existing 0046/0047 files are not in this repo.
4. Design rule conflict: `frontend/CLAUDE.md` says the prototype is the permanent design source of truth and to stop when it has no equivalent. A Canva-style studio has no prototype equivalent. Confirm the studio may depart from the prototype.
