# Certificate functionality gap report

Status values: Full / Partial / Broken / Missing. Priority follows the brief (P0 core editor, P1 advanced design, P2 automation, P3 later).

| Feature | Existing Status | Current Problem | Required Improvement | Priority |
|---|---|---|---|---|
| Interactive canvas | Partial | Fixed 11 blocks, move only | Free-form element model, add/delete any element | P0 |
| Resize / rotate | Missing | Only numeric width/size inputs | Selection handles, rotation | P0 |
| Multi-select, copy/paste, duplicate, delete | Missing | None | Selection set + clipboard | P0 |
| Undo / redo | Missing | Every drag writes straight to state | History stack with coalescing | P0 |
| Keyboard shortcuts | Missing | None | Shortcut layer that ignores text inputs | P0 |
| Layers / group / lock / hide / z-order | Missing | None | Layers panel, group model | P0 |
| Zoom / fit / scroll | Missing | Fixed 660/440 px width | Zoom state, fit-to-screen | P0 |
| Text styling (font, weight, colour, spacing...) | Missing | One serif, colour from palette | Per-element text props, font list | P0 |
| Shapes, lines, borders | Missing | 3 hard-coded frames | Shape elements | P0 |
| Image upload as asset | Partial | Logo as base64 inside design JSON, 700 KB | Upload to storage, reference by URL | P0 |
| Signature library | Missing | Typed name in italic font fakes a signature | Upload, metadata, default, reuse; needs table + storage | P0 |
| Signature on canvas / multiple | Partial | Up to 3 text blocks, no images | Image + name + title group | P0 |
| Save / load | Full | Works; one JSON blob | Keep; add schema version for new element model | P0 |
| Autosave status / offline recovery | Partial | No "saving/saved" indicator, no recovery | Status + local draft | P0 |
| PDF export, correct size | Partial | `window.print()` only, one at a time, depends on browser dialog | Real PDF (needs library or print pipeline decision) | P0 |
| Template gallery | Partial | 4 templates, no search/filter/favourite/recents | 12+ designed templates, filters | P1 |
| Template save / duplicate / institution-level | Partial | Designs are per conference; no sharing across conferences | Needs scope column (migration) | P1 |
| Rulers, guides, grid, margins | Missing | Centre-line snap only | Rulers, guides, safe area | P1 |
| Smart alignment, align/distribute | Missing | None | Edge/centre snapping, align toolbar | P1 |
| Dynamic fields | Partial | 10 tokens, 2 target blocks, no overflow handling | Any text element, field chips, auto-fit, missing-data check | P1 |
| Brand kit | Missing | None | Colours/fonts/logos per institution; needs table | P1 |
| Version history | Missing | None | Revisions table (migration), restore | P1 |
| PNG / JPG export | Missing | None | Canvas rasterisation | P1 |
| Backgrounds (gradient, pattern, image) | Missing | Paper colour only | Background panel | P1 |
| Bulk create (CSV/XLSX, mapping, preview) | Partial | Audience engine is good; CSV import button is dead; no mapping step; no overflow/duplicate checks | Mapping + preview + validation | P2 |
| Multi-page PDF / ZIP | Missing | "Download all PDFs" is dead | Needs PDF + zip libs | P2 |
| Issue / download | Partial | Link-only email, per-recipient print | Keep issuing; add PDF attach later | P2 |
| Revoke / reissue / status | Missing | Status is sent/bounced only | Needs status column + RPC + verify page change | P2 |
| QR verification | Full | Works (signed-out RPC) | Show revoked state once revoke exists | P2 |
| Private-signature protection | n/a | No signatures stored | Private bucket + signed URLs once library exists | P0 |
| PDF import | Missing | pdfjs-dist is installed | Flattened-background import (honest, not editable) | P3 |
| Collaboration / sharing / comments | Missing | Chairs only via RLS | Out of scope unless needed | P3 |
| Accessibility | Partial | Form controls labelled; canvas not keyboard operable | Arrow-key nudge, focus order, labels | P1 |
| Backend (NestJS) connection | Missing | No certificate module | Separate decision (see plan) | P2 |
