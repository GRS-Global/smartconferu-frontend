/* eslint-disable @next/next/no-img-element -- the QR code and an uploaded logo are data URLs; the platform mark is a fixed file */
"use client";

import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import QRCodeLib from "qrcode";
import { mergeValues, applyMerge, verifyUrl, BASE_SIZES, defaultElements, type Design, type Layout, type Recipient } from "./data";

import { StudioPage } from "./studio/render";
import { extrasOf } from "./merge-extras";
import { docPage } from "./studio/model";

// Display serif: used ONLY on printed artefacts (certificate artwork), never in app chrome.
const SERIF_FAMILY = "var(--font-cormorant), 'Cormorant Garamond', 'Times New Roman', serif";
// The platform's own mark, shown when the chair has not uploaded a logo.
const LOGO_SRC = "/smartconferu-mark.png";

/* ---------------------------------------------------------------------------
   The certificate itself — one component, used at every size in the module: the
   gallery's thumbnails, the designer's canvas, the recipient preview and the
   recipient's own wallet.

   Every piece is absolutely positioned in a fixed base-pixel space and the whole
   sheet is scaled with a CSS transform, so a 96px thumbnail and a full-size
   preview are provably the same artwork — there is no second, simplified "small"
   version to drift out of sync, and dragging a block moves it everywhere at once.

   With `editable`, blocks can be dragged. Drag deltas are divided by the scale so
   the block tracks the pointer exactly however far the sheet is zoomed out.
   --------------------------------------------------------------------------- */

const SNAP = 9; // px, in base space — how close to centred before it clicks into place

export function CertificateArtwork({
  design, recipient, conference, width = 480,
  editable = false, selectedId = null, onSelect, onMove,
}: {
  design: Design; recipient?: (Partial<Recipient> & { serial?: string }) | null; conference: { name?: string; acronym?: string; startDate?: string; endDate?: string; city?: string; country?: string } | null | undefined; width?: number;
  editable?: boolean; selectedId?: string | null; onSelect?: (id: string) => void; onMove?: (id: string, x: number, y: number) => void;
}) {
  const [qr, setQr] = useState({ serial: "", dataUrl: "" });
  const [guide, setGuide] = useState<"x" | null>(null); // "x" when the dragged block is snapped to centre
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; w: number } | null>(null);
  const serial = recipient?.serial || "";

  useEffect(() => {
    if (!design.showQr || !serial) return undefined;
    let cancelled = false;
    QRCodeLib.toDataURL(verifyUrl(serial), { width: 200, margin: 0, color: { dark: "#0B1020", light: "#FFFFFF" } })
      .then((dataUrl) => { if (!cancelled) setQr({ serial, dataUrl }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [design.showQr, serial]);

  // Stored with the serial it belongs to, so switching preview recipients shows a blank square
  // for one frame rather than the previous person's code.
  const qrDataUrl = qr.serial === serial ? qr.dataUrl : "";

  const orientation = design.orientation === "portrait" ? "portrait" : "landscape";
  const { w, h } = design.studio ? docPage(design.studio) : BASE_SIZES[orientation];
  const scale = width / w;
  const els = design.elements || defaultElements(orientation, design.signatories?.length || 1);
  const values = mergeValues(recipient, conference, extrasOf(design));
  const { ink, accent, paper, rule } = design.palette;

  if (design.studio) {
    return (
      <div style={{ width, height: h * scale, position: "relative", flexShrink: 0 }}>
        <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0, boxShadow: "0 10px 30px rgba(11,16,32,0.14)" }}>
          <StudioPage doc={design.studio} values={values} serial={serial} w={w} h={h} />
        </div>
      </div>
    );
  }

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (!editable) return;
    const el = els[id];
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, w: el.w || 70 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    let nx = d.origX + (e.clientX - d.startX) / scale;
    let ny = d.origY + (e.clientY - d.startY) / scale;

    // Snap to the sheet's vertical centre line — the alignment people actually want, and the one
    // that is hardest to hit by eye.
    const centred = (w - d.w) / 2;
    const snapped = Math.abs(nx - centred) < SNAP;
    if (snapped) nx = centred;
    setGuide(snapped ? "x" : null);

    // Clamp so a block can't be dragged off the sheet and lost.
    nx = Math.max(-d.w * 0.4, Math.min(w - d.w * 0.6, nx));
    ny = Math.max(-20, Math.min(h - 24, ny));
    onMove?.(d.id, Math.round(nx), Math.round(ny));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setGuide(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const block = (id: string, children: ReactNode, extra: React.CSSProperties = {}) => {
    const el = els[id];
    if (!el) return null;
    const selected = editable && selectedId === id;
    return (
      <div
        key={id}
        onPointerDown={(e) => startDrag(e, id)}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: "absolute", left: el.x, top: el.y, width: el.w,
          textAlign: el.align || "center",
          cursor: editable ? "move" : "default",
          touchAction: editable ? "none" : "auto",
          outline: selected ? "2px solid #7C3AED" : editable ? "1px dashed rgba(124, 58, 237,0.35)" : "none",
          outlineOffset: 6,
          borderRadius: 3,
          ...extra,
        }}
      >
        {children}
      </div>
    );
  };

  return (
    <div style={{ width, height: h * scale, position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left",
          position: "absolute", top: 0, left: 0,
          background: paper, boxSizing: "border-box",
          boxShadow: "0 10px 30px rgba(11,16,32,0.14)",
          padding: design.layout === "banner-top" ? 0 : 22,
        }}
      >
        <Frame layout={design.layout} ink={ink} accent={accent} rule={rule}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>

            {block("headline", (
              <span style={{ fontFamily: SERIF_FAMILY, fontSize: els.headline?.size || 64, fontWeight: 700, color: ink, letterSpacing: 7, lineHeight: 1, display: "block" }}>
                {design.headline}
              </span>
            ))}

            {block("typeLine", (
              <span style={{ fontFamily: SERIF_FAMILY, fontStyle: "italic", fontSize: els.typeLine?.size || 26, fontWeight: 600, color: accent, letterSpacing: 3, lineHeight: 1.2, display: "block" }}>
                {design.typeLine}
              </span>
            ))}

            {block("rule", <span style={{ display: "block", width: "100%", height: els.rule?.size || 3, background: accent }} />)}

            {block("leadIn", (
              <span style={{ fontFamily: SERIF_FAMILY, fontSize: els.leadIn?.size || 21, color: "#475569", lineHeight: 1.4, display: "block" }}>
                {applyMerge(design.leadIn, values)}
              </span>
            ))}

            {block("recipientName", (
              <span style={{ fontFamily: SERIF_FAMILY, fontStyle: "italic", fontSize: els.recipientName?.size || 52, fontWeight: 600, color: ink, lineHeight: 1.15, display: "block" }}>
                {values.recipientName || "Recipient name"}
              </span>
            ))}

            {block("bodyLine", (
              <span style={{ fontFamily: SERIF_FAMILY, fontSize: els.bodyLine?.size || 21, color: "#475569", lineHeight: 1.6, display: "block" }}>
                {applyMerge(design.bodyLine, values)}
                {values.conferenceName ? <><br />at {values.conferenceName}{values.conferenceDates ? `, ${values.conferenceDates}` : ""}</> : null}
              </span>
            ))}

            {design.signatories?.slice(0, 3).map((s, i) => block(`sig${i}`, (
              <div>
                <div style={{ fontFamily: SERIF_FAMILY, fontStyle: "italic", fontSize: els[`sig${i}`]?.size || 32, color: ink, lineHeight: 1.1 }}>
                  {(s.name || "").replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/, "") || "Signature"}
                </div>
                <div style={{ width: "100%", height: 1, background: "#CBD5E1", margin: "8px 0 7px" }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>{s.name}</div>
                <div style={{ fontFamily: SERIF_FAMILY, fontStyle: "italic", fontSize: 16, color: "#64748B" }}>{s.title}</div>
              </div>
            )))}
            {design.showQr && serial && block("qr", (
              <div style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                <div style={{ width: 70, height: 70, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 4, padding: 4, boxSizing: "border-box", flexShrink: 0 }}>
                  {qrDataUrl
                    ? <img src={qrDataUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />
                    : <div style={{ width: "100%", height: "100%", background: "#F1F5F9" }} />}
                </div>
                <div style={{ lineHeight: 1.5, whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 0.4 }}>{serial}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>Scan to verify</div>
                </div>
              </div>
            ), { width: (els.qr?.w || 70) + 130 })}

            {design.showLogo && block("logo", (
              <img
                src={design.logoSrc || LOGO_SRC} alt="" draggable={false}
                style={{ width: "100%", maxHeight: 90, objectFit: "contain", objectPosition: "center", display: "block" }}
              />
            ))}

            {guide === "x" && (
              <div style={{ position: "absolute", left: w / 2 - 0.5, top: 0, width: 1, height: "100%", background: "#7C3AED", opacity: 0.7, pointerEvents: "none" }} />
            )}
          </div>
        </Frame>
      </div>
    </div>
  );
}

/* The three border treatments a template can choose. Each fills its parent. */
function Frame({ layout, ink, accent, rule, children }: { layout: Layout; ink: string; accent: string; rule: string; children: ReactNode }) {
  if (layout === "banner-top") {
    return (
      <div style={{ width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 14, background: `linear-gradient(90deg, ${ink} 0%, ${accent} 100%)`, flexShrink: 0 }} />
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
        <div style={{ height: 6, background: rule, flexShrink: 0 }} />
      </div>
    );
  }
  if (layout === "ornate-border") {
    return (
      <div style={{ width: "100%", height: "100%", boxSizing: "border-box", border: `5px solid ${accent}`, padding: 5 }}>
        <div style={{ width: "100%", height: "100%", boxSizing: "border-box", border: `1px solid ${rule}`, outline: `1px solid ${accent}`, outlineOffset: 5 }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", border: `4px solid ${ink}`, padding: 6 }}>
      <div style={{ width: "100%", height: "100%", boxSizing: "border-box", border: `1.5px solid ${rule}` }}>
        {children}
      </div>
    </div>
  );
}

/* A cheap, static stand-in for list rows and template swatches — no QR work and no layout
   maths, just the palette, so a page can show twenty without twenty QR renders. */
export function CertificateSwatch({ design, width = 96, label = "CERTIFICATE" }: { design: { palette: Design["palette"] }; width?: number; label?: string }) {
  const { ink, accent, paper, rule } = design.palette;
  const height = Math.round((width * BASE_SIZES.landscape.h) / BASE_SIZES.landscape.w);
  return (
    <div style={{ width, height, background: paper, boxSizing: "border-box", border: `1px solid ${rule}`, borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: Math.max(2, width * 0.035), overflow: "hidden", flexShrink: 0 }}>
      <span style={{ fontFamily: SERIF_FAMILY, fontSize: Math.max(7, width * 0.105), fontWeight: 700, color: ink, letterSpacing: width * 0.008, lineHeight: 1 }}>{label}</span>
      <span style={{ width: width * 0.42, height: 1.5, background: accent }} />
      <span style={{ width: width * 0.3, height: 1.5, background: rule }} />
    </div>
  );
}
