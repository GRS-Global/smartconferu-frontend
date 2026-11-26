/* eslint-disable @next/next/no-img-element -- images are uploaded data URLs or fixed files */
"use client";

import { useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import QRCodeLib from "qrcode";
import { verifyUrl } from "../data";
import { resolveImageSrc } from "./images";
import { FONTS, fittedSize, resolveText, type Background, type FontKey, type StudioDoc, type StudioElement } from "./model";

/* Draws a studio document at base size (the caller scales it). The same component draws the editor canvas, the gallery thumbnails, the
   recipient's wallet and the print page, so what is edited is what is exported. It draws nothing the editor adds (handles, guides, rulers). */

export const backgroundCss = (b: Background): string => (b.kind === "gradient" ? `linear-gradient(${b.angle}deg, ${b.from}, ${b.to})` : b.color);

export function useQr(serial: string, enabled: boolean): string {
  const [qr, setQr] = useState({ serial: "", dataUrl: "" });
  useEffect(() => {
    if (!enabled || !serial) return undefined;
    let cancelled = false;
    QRCodeLib.toDataURL(verifyUrl(serial), { width: 200, margin: 0, color: { dark: "#0B1020", light: "#FFFFFF" } })
      .then((dataUrl) => { if (!cancelled) setQr({ serial, dataUrl }); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [enabled, serial]);
  return qr.serial === serial ? qr.dataUrl : "";
}

export function elementBoxStyle(el: StudioElement): CSSProperties {
  return { position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, transformOrigin: "center center", opacity: el.opacity, display: el.hidden ? "none" : undefined, boxSizing: "border-box" };
}

export function shownText(el: StudioElement, values: Record<string, string>): string {
  const t = resolveText(el.text ?? "", values);
  return t || (el.text?.trim() === "{{recipientName}}" ? "Recipient name" : "");
}

/** What an export swaps in: the QR as a ready data URL, the fonts' real family names (a `var(--font-…)` means nothing outside the page) and pictures as data URLs. */
export interface ExportOverrides { qrDataUrl?: string; fonts?: Partial<Record<FontKey, string>>; src?: (src: string | undefined) => string | undefined }

function ElementBody({ el, values, qrDataUrl, serial, editing, out }: { el: StudioElement; values: Record<string, string>; qrDataUrl: string; serial: string; editing?: ReactNode; out?: ExportOverrides }) {
  if (el.type === "text") {
    const shown = shownText(el, values);
    const size = fittedSize(el, shown);
    return editing ?? (
      <span style={{
        display: "block", fontFamily: out?.fonts?.[el.font ?? "serif"] ?? FONTS[el.font ?? "serif"].css, fontSize: size, fontWeight: el.weight ?? 400, fontStyle: el.italic ? "italic" : "normal",
        textDecoration: el.underline ? "underline" : "none", color: el.color ?? "#0B1020", textAlign: el.align ?? "center", letterSpacing: el.letterSpacing ?? 0,
        lineHeight: el.lineHeight ?? 1.3, whiteSpace: el.autoFit ? "pre" : "pre-wrap", overflowWrap: "anywhere", textTransform: el.upper ? "uppercase" : "none",
      }}>{shown}</span>
    );
  }
  if (el.type === "shape") {
    const fill = el.fillTo ? `linear-gradient(90deg, ${el.fill}, ${el.fillTo})` : el.fill || "transparent";
    return <div style={{ width: "100%", height: "100%", boxSizing: "border-box", background: fill, border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke || "#000"}` : undefined, borderRadius: el.shape === "ellipse" ? "50%" : el.radius ?? 0 }} />;
  }
  if (el.type === "image") return <img src={out?.src ? out.src(el.src) : resolveImageSrc(el.src)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: el.fit ?? "contain", display: "block", pointerEvents: "none" }} />;
  // QR: the code, and the certificate ID with "Scan to verify" beside it. Only drawn once there is a certificate ID (the sample has one).
  if (!serial) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: el.w + 130 }}>
      <div style={{ width: el.w, height: el.w, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 4, padding: 4, boxSizing: "border-box", flexShrink: 0 }}>
        {qrDataUrl ? <img src={qrDataUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: "#F1F5F9" }} />}
      </div>
      <div style={{ lineHeight: 1.5, whiteSpace: "nowrap" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 0.4 }}>{serial}</div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>Scan to verify</div>
      </div>
    </div>
  );
}

export function StudioPage({ doc, values, serial, w, h, elementProps, editingId, editor, out }: {
  doc: StudioDoc; values: Record<string, string>; serial: string; w: number; h: number;
  /** Editor hook: extra props per element (pointer handlers, data attributes). Absent in every read-only use. */
  elementProps?: (el: StudioElement) => HTMLAttributes<HTMLDivElement>;
  editingId?: string | null; editor?: (el: StudioElement) => ReactNode;
  /** Used only by exports (features/certificates/bulk/render-image.tsx). */
  out?: ExportOverrides;
}) {
  const hasQr = doc.elements.some((e) => e.type === "qr" && !e.hidden);
  const hooked = useQr(serial, hasQr && !out?.qrDataUrl);
  const qrDataUrl = out?.qrDataUrl ?? hooked;
  return (
    <div style={{ position: "relative", width: w, height: h, background: backgroundCss(doc.background), overflow: "hidden" }}>
      {doc.elements.map((el) => (
        <div key={el.id} {...(elementProps?.(el) ?? {})} data-el={el.id} style={{ ...elementBoxStyle(el), ...(elementProps?.(el)?.style ?? {}) }}>
          <ElementBody el={el} values={values} qrDataUrl={qrDataUrl} serial={serial} editing={editingId === el.id ? editor?.(el) : undefined} out={out} />
        </div>
      ))}
    </div>
  );
}
