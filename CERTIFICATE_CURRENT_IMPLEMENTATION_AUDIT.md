# Certificate module: current implementation audit

Audited 2026-11-24 by reading the code (no runtime testing yet). Scope: `frontend/src/features/certificates/*`, `services/certificates.ts`, `services/supabase/certificates.ts`, `mocks/certificates.ts`, `app/verify/[serial]`, and the Backend.

## 1. Where it lives
| Area | Files |
|---|---|
| Routes | `app/(authed)/(app)/chair/[slug]/certificates/{page, design/[cert], distribute, distribute/[dist]}`, `my-certificates`, `author/.../certificates`, `reviewer/.../certificates`, public `app/verify/[serial]` |
| Rules / types | `features/certificates/data.ts` (types, 5 certificate types, 4 templates, audience engine, merge fields, serial generator) |
| Artwork | `certificate-artwork.tsx`: ONE component for thumbnails, designer canvas, preview, wallet. Absolute-positioned blocks in a fixed 1000x707 (or 707x1000) space, scaled by CSS transform |
| Designer | `components/designer-body.tsx` (369 lines): left form rail + canvas + numeric position panel |
| Gallery | `components/design-body.tsx` |
| Sends / recipients | `distribute-body.tsx`, `recipients-body.tsx` |
| Recipient side | `my-certificates-*.tsx`, `verify-page.tsx` |
| Export | `print-certificate.tsx`: off-screen artwork + `window.print()` ("Save as PDF") |
| State | `use-certificates.ts`: optimistic local state, per-key debounced save (700 ms) |
| Service seam | `services/certificates.ts` interface, `supabase/` and `mocks/` implementations. **No `services/api/certificates.ts`** |

## 2. Data model (Supabase, migration 0046 / 0047)
Tables `certificate_designs(id, conference_id, name, type_key, design jsonb)`, `certificate_distributions`, `issued_certificates`; RPCs `issue_certificates`, `verify_certificate` (public), `my_certificates`, `record_certificate_event`. RLS: conference chairs only. **The migration SQL files are not in this repository** (no `supabase/` folder); per PORT-PLAN they were written and run by the owner elsewhere. Schema above is inferred from the service code. The whole design is one JSON blob (`Design`), so editor-state changes need no new column.

## 3. Backend (NestJS)
`Backend/src` has **no certificate code at all** (GAP-REPORT: "certificates, no backend"). In `api` data source mode the certificate screens still use Supabase.

## 4. What the designer actually is
- Fixed element set: headline, typeLine, rule, leadIn, recipientName, bodyLine, qr, logo, sig0-2. Each has x, y, w, size, align. Nothing can be added or deleted.
- Dragging: pointer events, clamp, snap to vertical centre only. No resize, rotate, multi-select, undo/redo, layers, zoom, rulers, copy/paste, keyboard shortcuts.
- Styling: 4 templates (3 border layouts), 4 palettes, one serif font. No per-element font/colour/weight.
- Signatures: typed name rendered in italic serif as a fake "signature". **No signature image upload, no library.**
- Logo: data URL stored inside the design JSON, 700 KB cap (violates "no large binaries in DB rows").
- Merge fields: `{{recipientName}}` style, 10 fields, insertable only into leadIn/bodyLine. Unresolved tokens print as empty.
- Orientation: switching resets positions.
- Autosave: debounced, no status UI beyond an error banner, no version history, no offline recovery.

## 5. Issuing, export, verification
- Audience rule engine (accepted authors, presenting authors, reviewers who finished) is solid and uses real data. Registered attendees, committee, published papers list nobody (no tables).
- Issue: RPC gives serials like `ISBM26-PRS-000`, sends link-only email (no PDF).
- Export: browser print dialog, one certificate at a time. No PNG/JPG, no multi-page PDF, no ZIP. "Download all PDFs", "Export CSV" and "Import CSV" buttons **do nothing** (inherited from prototype).
- Verification: public `/verify/<serial>` + QR in artwork. Revocation/reissue: **not implemented** (status is only `sent|bounced`).

## 6. Dependencies present
`qrcode`, `pdfjs-dist`, `recharts`, `lucide-react`, React 19, Next 16. **Not installed:** konva, fabric, jspdf, pdf-lib, jszip, xlsx, papaparse, html-to-image.

## 7. Constraints from project rules
- `frontend/CLAUDE.md`: no new dependency without approval; no schema/RLS/migration changes except new migration *files* the owner agreed to; parity with the prototype is the design rule, and "if the prototype has no equivalent, stop and ask".
- Root `CLAUDE.md`: no commits, don't read `.env*`, one feature at a time.
