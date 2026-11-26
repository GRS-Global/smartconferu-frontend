# Certificate editor architecture (proposed)

## Decision: no canvas library; extend the existing DOM/SVG renderer
Options weighed: Fabric.js, Konva/react-konva, SVG, existing DOM renderer.

| | Pros | Cons |
|---|---|---|
| Fabric / Konva | Built-in transforms, hit-testing | New dependency (needs approval); canvas text is rasterised, so PDF output drifts from preview; fonts load differently; designs would need a second renderer for thumbnails and the recipient wallet |
| **Existing DOM renderer, extended** | Zero dependencies; one renderer already used by gallery, preview, wallet and print; text stays real text (crisp print, correct fonts); preview == export by construction | We write selection/resize/rotate/snap ourselves (~1500 lines) |

Recommendation: extend `CertificateArtwork` into a generic element renderer. The editor overlay (handles, guides, rulers) is a separate layer that is never part of the exported tree, which satisfies "guides invisible in export".

## Document model (stored in `certificate_designs.design` jsonb, versioned)
```
Design v2 {
  version: 2, page: { orientation, w, h, unit, background: {kind: color|gradient|image|pattern, ...} },
  elements: Element[],            // z-order = array order
  guides: { x: number[], y: number[] }, grid, margins,
  // legacy v1 fields kept readable; migrate on load (pure function)
}
Element = { id, type: text|image|shape|line|qr|group, name, x, y, w, h, rotation, opacity, locked, hidden,
            props by type; text may contain {{tokens}}; image refers to asset by storage path }
```
v1 designs (fixed blocks) are converted on load by `migrateDesign(v1) -> v2` so existing certificates keep rendering identically. No DB column change.

## Modules (`features/certificates/studio/`)
- `model/` pure: element types, `migrateDesign`, geometry, snapping, align/distribute, group ops, token resolution + auto-fit.
- `state/` reducer + history (undo/redo with coalesced drags, 100 steps), selection, clipboard, zoom.
- `canvas/` renderer (shared with gallery/print), `SelectionOverlay` (handles, rotation), `Guides`, `Rulers`.
- `panels/` left sidebar tabs, contextual properties, layers.
- `persist/` autosave (debounced, status machine saving/saved/offline), local draft recovery in localStorage, revisions.
- `export/` print pipeline (same renderer, `@page` size from model), PNG via SVG foreignObject/canvas only if feasible without a dependency.

## Persistence and storage
- Design JSON autosaves through the existing `CertificateService.saveDesign` (no contract change).
- Images and signatures must not be base64 in JSON. Needs a storage path: Supabase Storage bucket (private for signatures, signed URLs) or backend `POST /files`. Requires a decision and, for Supabase, a migration file.
- New tables (migration files only, owner runs them): `certificate_signatures`, `certificate_assets`, `certificate_revisions`, `brand_kits`; a `status`/`revoked_at` on `issued_certificates` and a verify-RPC change.

## Export honesty
- Browser print gives a real vector PDF from live text, but one document per dialog and no programmatic multi-page/ZIP. True bulk PDF/ZIP/PNG needs a library (jspdf or pdf-lib + jszip) or a backend render service. Not chosen yet.
