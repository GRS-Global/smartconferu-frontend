# Certificate Studio test results (Slice 1)

Date: 2026-11-24. Only what was actually run is marked as passed.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Passed |
| `npx eslint src/features/certificates` | Passed (after one `prefer-const` fix) |
| Dev server (mock source) compiles the design route `/chair/demo-dsai-2027/certificates/design/<id>` | Passed: HTTP 200, no compile error in the log. The unknown id means the studio itself did not render. |
| Browser interaction (drag, resize, rotate, marquee, shortcuts, inline text edit, undo/redo, zoom, layers drag, autosave, upload, print) | **Not tested.** No browser tool was available in this session. |
| v1 design converted by `studioFromDesign` looks identical to the old rendering | **Not tested** (frame offsets were computed by hand). |
| Export / PDF output | **Not tested.** Uses the existing print pipeline. |
| Rulers, guides, grid, print margins (added later): `tsc` and `eslint` | Passed |
| Rulers, guides, grid, margins in the browser (drag a guide from a ruler, snap to guides / grid / margin, remove a guide, units mm/in/px, ruler alignment while scrolling and zooming) | **Not tested** |
| Bulk, signatures, brand kit, versions, PNG/JPG, revoke | **Not implemented** (later slices). |

Next step: open the designer in a real browser on the mock backend and walk the checklist above, then record results here.

## Backend + signature library (added)
| Check | Result |
|---|---|
| Backend `npx tsc --noEmit`, `vitest run` (111 unit tests incl. 4 new for the R2 signer) | Passed |
| R2 request signer against the published AWS Signature V4 example | Passed (matches `f0e8bdb8…bdb41`). **Not tested against a real R2 bucket.** |
| `Backend/test/certificates.e2e-spec.ts` (7 tests, real Postgres via PGlite): chair-only access, validation, issue once with continuing IDs, email queued with verify link, My Certificates, events, public verify (no email leaked), design with issued certificates cannot be deleted, signatures: upload / default switch / refuse SVG and oversize / replace / delete refused while used | Passed |
| Full backend e2e suite after the JSON body limit change (100 kb -> 3 mb) | Passed: 30 files, 275 tests |
| Frontend `tsc` + `eslint` for services/api/certificates, services/api/signatures, Signatures tab, group-aware align/distribute | Passed |
| Frontend against a running backend in a browser (api mode): load, design autosave, send, issue, signature upload and Add to certificate, print with a library signature, verify page | **Not tested** (no browser tool) |

## Supabase mode signature library (added)
| Check | Result |
|---|---|
| Frontend `tsc` + `eslint` (services/supabase/signatures.ts, mode-aware picture URL, signatory sync for the public check page) | Passed |
| Migration `0048_certificate_signatures.sql` run on a real Supabase project; upload, default switch, replace, delete, chair-only RLS, picture shown in the editor and in My Certificates | **Not tested** (the owner has to run the migration; no Supabase project or browser was available here) |

## Real-browser tests (Playwright + Chromium, mock data source, added with the template gallery)
Scripts: `qa/studio-editor-qa.mjs`, `qa/studio-templates-qa.mjs`, `qa/studio-gallery-qa.mjs` (they need a Next dev server on another port, e.g. a copy of `src` served with `NEXT_PUBLIC_DATA_SOURCE=mock`; the developer's own server on 3100 is Supabase mode).

| Check | Result |
|---|---|
| Template gallery: search, style filter, favourites filter, orientation, create | Passed (30 of 30 checks in `studio-editor-qa.mjs` below) |
| All 13 templates x landscape and portrait (3 certificate types) rendered in the designer and inspected by eye | Passed after fixes (QR caption clipped, body line overlapping the signature, portrait text too small and bottom-heavy, left-aligned body indent) |
| Select by click, drag, nudge with arrows (1 px / 10 px with Shift) | Passed |
| Undo / redo (a drag is ONE step), Ctrl+D duplicate, Delete, undo of delete | Passed. **Found and fixed a real bug**: the history hook mutated a ref inside React state updaters, so under React's double invocation one undo did not revert a whole drag. |
| Resize with the east handle, rotation field, undo of both | Passed |
| Inline text editing (double-click, type, click away), undo of typing | Passed |
| Shift-click multi-select, Ctrl+G group, Ctrl+Shift+G ungroup | Passed |
| Layers panel lists elements and shows the group | Passed |
| Rulers (mm), add guides by position, remove all guides, drag a guide out of a ruler, grid, print-safe margin | Passed |
| Switch template from the Design tab, undo it | Passed |
| Autosave status reads "All changes saved"; zoom in; Preview hides the editing aids | Passed |
| No console or page errors during the whole run | Passed |
| Persistence across a reload, Download PDF (print dialog), Send / issue / verify, signature library, api and supabase modes | **Not covered** (the mock source keeps data in memory and has no signature library) |

## Bulk certificates (real browser, mock data source) - `qa/studio-bulk-qa.mjs`, 24 of 24 passed; `qa/studio-editor-qa.mjs` 33 of 33
| Check | Result |
|---|---|
| Semicolon CSV with a BOM, quoted field with a comma and doubled quotes: all six columns matched from the headers | Passed |
| Review step: rows to add, nameless row skipped, repeated person, missing / wrong email flagged | Passed |
| `.xlsx` (shared strings, first sheet): headers matched, people added | Passed |
| A PDF chosen as the "spreadsheet" is refused with a clear message | Passed |
| Warnings on the list (missing field the certificate prints, long name, repeat), "Check N" filter, preview with previous / next (arrow keys) | Passed |
| Issue, then Download all: one multi-page PDF (7 certificates = 7 pages, A4 landscape, JPEG pages, 1.2 MB) | Passed |
| ZIP of separate PDFs named from the pattern; ZIP of PNGs at the chosen size (2000 x 1414) | Passed |
| The exported picture looked at by eye against the on-screen certificate: Cormorant font, QR code, logo, layout identical | Passed |
| Pictures that cannot be loaded: the failed certificates are listed with the reason; "Try those again" redraws only them and the file is complete | Passed (and found a real bug: a failed picture stayed cached as failed, so a retry could never succeed. Fixed.) |
| Studio Download menu: PNG (3000 px), JPG, one-page A4 PDF | Passed |
| Not covered | 500+ certificates (speed and memory), a real Supabase / api backend, Safari and Firefox (the picture is drawn through an SVG foreignObject, tested in Chromium only), opening the PDF in a viewer, text that wraps differently in a print dialog PDF |

## Dynamic fields (real browser, mock data source; backend e2e) - `qa/studio-editor-qa.mjs` 40 of 40, `qa/studio-bulk-qa.mjs` 24 of 24, `Backend/test/certificates.e2e-spec.ts` 7 of 7
| Check | Result |
|---|---|
| Fields tab groups the fields (Recipient, Submission, Conference, Certificate, Signatory), shows the sample value each prints, and lists what is NOT available (presentation date, organizer name, signature fields) | Passed |
| Add a field as new text; it prints its value (Certificate type -> "Certificate of Presentation") | Passed |
| Reconnect a field to another field from the text's properties; remove a field from its text | Passed |
| Verification link prints a real `/verify/<certificate ID>` address; signatory fields read the signature block on the page | Passed |
| Backend email fills `{{certificateType}}`, `{{issueDate}}`, `{{conferenceYear}}` and the real `{{verificationUrl}}` (checked in the sent email text) | Passed |
| A certificate-level gap notice (field with nothing behind it, unknown field) on the recipients page | Implemented; **not covered by a browser test** |
| Email dialog in Supabase mode offers only the original ten fields (the prototype mail server's list) | Implemented by design; **not tested against that server** |

## Picture library: design images moved out of the design into storage
`Backend/test/certificates.e2e-spec.ts` 11 of 11 (4 new), `qa/studio-assets-qa.mjs` 14 of 14, `qa/migrate-images.test.mjs` 5 of 5, `studio-editor-qa.mjs` 40 of 40, `studio-bulk-qa.mjs` 24 of 24.
| Check | Result |
|---|---|
| Backend: upload and list per conference, name from the file name, serve by id without sign-in, chair-only list and changes (403 for others, 401 without sign-in) | Passed |
| Backend: SVG, a non-picture and a picture over 2 MB refused; 200 per conference | Passed |
| Backend: a picture a design uses cannot be deleted (409 names the design); replacing keeps it for every design; deletable once unused | Passed |
| Designer (mock source): upload several at once; an over-2 MB file and a text file are refused with the reason while the good one is added | Passed |
| Designer: click a picture to put it on the page, rename it, "On this page" list | Passed |
| Designer: a picture the design uses cannot be deleted (message names the design); "Replace image" on the page swaps that element's picture and the new one joins the library, and the old one is kept; deletable once unused | Passed (found and fixed: the library list did not refresh after "Replace image") |
| A library picture is drawn in the PNG export (red logo found at the centre pixel of the 3000 px PNG) | Passed |
| Moving old inline (data URL) pictures into the library: stored once per distinct picture, references and addresses untouched, an SVG or a failing upload stays where it was (pure function, no browser) | Passed |
| The same move running inside the designer on a design that really holds a data URL, and the old v1 `logoSrc` being dropped on save | **Not covered by a browser test** (the mock backend cannot create such a design) |
| Supabase: migration `0049_certificate_assets.sql` run on a real project; upload, replace, delete, 200 limit, chair-only RLS, picture shown in My Certificates | **Not tested** (no Supabase project here) |
| Own backend in a real browser (api mode) | **Not tested** (no running backend + sign-in here) |

## Designer polish (real browser, mock source): `qa/studio-signatures-qa.mjs` 18 of 18; editor 40/40, assets 14/14, bulk 25/25, migrate 5/5 after the changes
| Check | Result |
|---|---|
| A signature that still says "Name of signatory" (or has no name) is flagged in the top bar ("Name missing"); clicking it opens that name for typing; typing a name clears it; undo brings it back | Passed (found and fixed: the click used to select the whole signature group, so the name could not be edited directly) |
| The recipients page warns before sending that a signature still says the placeholder | Passed |
| Fields are marked by a small dot; the "field" label and box show only under the pointer or when selected | Passed |
| Signature library (mock): clear empty state, own picture chooser showing file name and size (no browser "No file chosen"), add signatory (default badge, picture shown) | Passed (this tab had never been driven in a browser before; a mock signature library now exists for mock mode) |
| "Add to certificate": the first signatory takes the place of the template's unfilled block (it is removed) at the same spot | Passed (found and fixed: the new block used to land exactly on top of the placeholder) |
| A second signatory: blocks are spread evenly across the free part of the row, on the same line, clear of the QR code and the logo | Passed (found and fixed: it used to land on the QR code; the spacing first mis-measured the free room because a full-width text box counted as a neighbour) |
| Not covered | Three or more signatories (spacing allows overlap when there is no room, by design), portrait pages for the spacing, real Supabase / backend |

## Draw a signature with the mouse (real browser, mock source): `qa/studio-signatures-qa.mjs` 28 of 28; editor 40/40, assets 14/14, bulk 25/25 after the change
| Check | Result |
|---|---|
| "Draw it" opens a big pad with a "Sign here" hint; "Use this signature" is disabled until something is drawn | Passed |
| Mouse strokes draw ink (hint disappears); Undo removes only the last stroke; Clear empties the pad and brings the hint back | Passed |
| Blue and Thick are used (blue pixels found, more ink than before) | Passed |
| "Use this signature" shows the drawing as the chosen picture; Save adds the signatory like an upload | Passed |
| The saved picture is a transparent PNG (corner alpha 0), has ink, and is cropped to the drawing (758 x 158, not the 900 x 300 pad) | Passed |
| "Draw it" on an existing signatory replaces that signatory's picture (same signatory, new picture) | Passed |
| Not covered | A real touch screen or pen (only the mouse was driven; the pad uses pointer events, which cover all three), pen pressure (not used: the line width is constant), Supabase / backend (the drawing is an ordinary PNG through the same upload, so nothing server-side changed) |

## Pictures blocked by `Cross-Origin-Resource-Policy` (found on the owner's own backend setup)
| Check | Result |
|---|---|
| Public picture routes (`/files/public`, signature image, asset image) answer `Cross-Origin-Resource-Policy: cross-origin`; verify and `/me/certificates` keep `same-origin` | Passed (backend e2e, 12 of 12 in `certificates.e2e-spec.ts`, plus `account.e2e-spec.ts`) |
| The fix was not visible in my browser tests | They run the mock source (no backend), so they could never see this. A browser test against a real backend on another port is still **not done**. |

## Print (real browser, mock source): `qa/studio-print-qa.mjs` 13 of 13; bulk 26/26, editor 40/40, signatures 28/28, assets 14/14 after the change
The print dialog cannot be driven headless, so `window.print` is replaced by a counter and the layout is checked as the browser prints it (print media, `page.pdf()`, a print-media screenshot that was also looked at by eye).
| Check | Result |
|---|---|
| Designer "Print" button calls the print dialog once, for landscape and for portrait designs | Passed |
| The printout is ONE A4 sheet (841.9 x 595 pt landscape, 595 x 841.9 portrait), no blank second page | Passed |
| The certificate fills the whole sheet (artwork scaled to A4), everything else on the page is hidden, wording and QR code are there | Passed |
| After printing the page returns to normal (the button works again) | Passed |
| Recipients > preview "Print" prints that person's certificate (name checked in the print layout) | Passed |
| Found and fixed: the old print path used a page size of 1000 x 707 CSS px (not a paper size), so it printed small or with margins; a design without a QR block waited 2 s for one | Fixed |
| The real browser print dialog, a physical printer, other browsers, "Headers and footers" / "Background graphics" settings (the page asks for A4, no margin, exact colours; Safari / Firefox honour that less strictly) | **Not covered** |

## Paper size for printing and PDF (real browser, mock source): `studio-print-qa.mjs` 40 of 40, editor 41/41, bulk 28/28, signatures 28/28, assets 14/14
Papers: A4, A3, A5, Letter, Legal, Tabloid (`paper.ts`). The certificate keeps its A4 proportions and is scaled to fit the sheet whole and centred; on a sheet with other proportions the extra room stays blank. The choice is remembered per person (localStorage).
| Check | Result |
|---|---|
| Print on Letter, A3, A5 and Legal gives ONE sheet of exactly that size (PDF MediaBox 792 x 612, 1191 x 842, 595 x 420, 1008 x 612 pt), no blank second page | Passed |
| The certificate is fitted whole and centred (Letter: 35 px above and below; Legal: 95 px at each side; A3: fills it) | Passed |
| The paper menu shows the chosen size on its button; the choice is remembered the next time a designer opens | Passed |
| Download > PDF in the designer follows the chosen paper (Letter landscape 792 x 612 pt, one page) | Passed |
| Download all > one PDF: a "Paper size of the PDF" choice; Letter gives 792 x 612 pt pages and every certificate | Passed |
| Found and fixed: the page's on-screen drop shadow was also printed (faint grey edge) | Fixed |
| Not covered | Tabloid and the ZIP-of-PDFs on other papers by hand (same code path), the real print dialog and a physical printer, a design whose own page is not A4-shaped (designs are always A4 proportions for now) |

## All paper sizes + custom size (real browser, mock source): `studio-print-qa.mjs` 75 of 75; editor 41/41, bulk 28/28, signatures 28/28, assets 14/14
30 named sizes in four groups (`paper.ts`): ISO A0-A6 and B3-B6; North America Letter, Legal, Junior Legal, Statement, Executive, Government Letter, Tabloid / Ledger, ANSI C, ANSI D, Arch A, Arch B, Super B (A3+); frame and photo 4x6, 5x7, 8x10, 11x14, 12x16 in; Folio, Foolscap. Plus a custom width x height in mm or inches.
| Check | Result |
|---|---|
| All 30 sizes are in the menu, grouped, with a custom-size section | Passed |
| Print on Executive, 8 x 10 in and A2 gives one sheet of exactly that size (756 x 522, 720 x 576, 1684 x 1191 pt) | Passed (earlier: Letter, Legal, A3, A5) |
| Custom size: a too-small one is refused with the limits; "300 x 200" typed wide-first becomes a 200 x 300 sheet (850 x 567 pt landscape); switching to inches converts what is typed; 6 x 9 in prints 648 x 432 pt; the button shows "Custom" | Passed |
| Download all (PDF) offers the same list (grouped) and a custom size | Implemented; the Letter case is tested, the custom case there is **not covered by a browser test** (same code as the print menu) |
| Not covered | The other 20-odd sizes one by one (they share the code of those tested), a real printer or its paper list, very large sheets (A0 / ANSI D) on a real printer |

## Page size = paper (2026-11-24)
Choosing a paper in the designer now changes the certificate page itself (long side 1000 px, short side by the paper's ratio; `doc.paper`, absent = A4). Content is carried over by `rescaleDoc` (undo restores). Print / PDF use the design's own paper; Download all can override it. Gallery has a paper select for new certificates; rulers show mm of the real paper.
Mock-mode browser QA (Playwright): print 87/87, editor 41/41, bulk 28/28, signatures 28/28, assets 14/14, migrate-images all passed; `tsc --noEmit` clean, eslint 0 errors. Templates looked at on 4x6 landscape and 8x10 portrait (no collisions). Supabase / own-backend flows not browser-tested for this change.

### Page size moved into the Design tab (2026-11-24)
The size picker is now the 'Page size' select (with Custom size fields) in the left Design tab; the toolbar keeps a label button that opens that tab. Print 87/87, editor 41/41, bulk 28/28, signatures 28/28, assets 14/14 (mock mode). The old toolbar menu component is still used for Custom size fields only.
