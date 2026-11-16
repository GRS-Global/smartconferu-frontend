/* eslint-disable @next/next/no-img-element -- the background, the presenter's photo and the QR code are data URLs or the presenter's own pictures */
"use client";

import { Calendar, MapPin } from "lucide-react";
import { templateOf, headlineFor, flyerMetrics, type FlyerDesign, type FlyerFormat } from "./data";

export interface FlyerData {
  acronym: string; conferenceName: string; authorName: string; initials: string; affiliation: string; photoUrl: string | null;
  paperTitle: string; slotText: string; roomText: string; url: string; hashtag: string;
}

/* Live, on-screen speaker flyer. Laid out on a 1080-wide grid and scaled by `width`, so the
   preview, the chair's designer and the PNG export (renderFlyerPng) all share one set of
   proportions. `data` fields left as "[…]" render as highlighted placeholders for the chair's view. */

const isPlaceholder = (v: unknown) => typeof v === "string" && v.startsWith("[");

export function FlyerArtwork({ design, data, format, width, qrDataUrl }: { design: FlyerDesign; data: FlyerData; format: FlyerFormat; width: number; qrDataUrl: string | null }) {
  const t = templateOf(design);
  const k = width / 1080;
  const height = Math.round(width * (format.h / format.w));
  const m = flyerMetrics(format);
  const px = (n: number) => Math.round(n * k * 10) / 10;
  const ph = (v: unknown) => (isPlaceholder(v) ? { background: "rgba(34,211,238,0.22)", borderRadius: px(8), padding: `0 ${px(8)}px` } : null);

  return (
    <div
      style={{ width, height, background: t.bg, color: t.ink, padding: px(m.pad), gap: px(m.sectionGap), borderRadius: px(28), boxShadow: "0 24px 60px rgba(11,16,32,0.28)" }}
      className="relative overflow-hidden flex flex-col shrink-0 box-border"
      aria-label={`Speaker flyer for ${data.authorName}`}
    >
      {design.bgImage && <img src={design.bgImage} alt="" style={{ opacity: 0.35 }} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}
      <div style={{ top: px(-210), right: px(-210), width: px(500), height: px(500), border: `${px(96)}px solid ${t.ring}` }} className="absolute rounded-full" />
      <div style={{ top: px(-140), right: px(-140), width: px(320), height: px(320), border: `${px(4)}px solid ${design.accent}` }} className="absolute rounded-full" />
      <div style={{ width: px(14), background: design.accent }} className="absolute left-0 top-0 bottom-0" />

      <div className="relative">
        <div style={{ fontSize: px(m.acronym) }} className="font-extrabold leading-tight">{data.acronym}</div>
        <div style={{ fontSize: px(m.confName), color: t.tint }} className="font-semibold leading-snug">{data.conferenceName}</div>
      </div>

      <div className="relative flex flex-col" style={{ gap: px(16) }}>
        <span style={{ fontSize: px(m.badge - 2), background: design.accent, color: "#0B1020", padding: `${px((m.badgeH - m.badge) / 2)}px ${px(20)}px`, borderRadius: px(12), letterSpacing: "0.14em" }} className="self-start font-extrabold">{design.badge}</span>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: px(m.headSize), lineHeight: m.headLine / m.headSize, letterSpacing: "-0.02em" }} className="font-extrabold">
          {headlineFor(design, data.acronym)}
        </div>
      </div>

      <div className="relative flex items-center" style={{ gap: px(28) }}>
        {design.fields.photo && (
          <div style={{ width: px(m.photo), height: px(m.photo), border: `${px(m.photoBorder)}px solid ${design.accent}`, background: "#4C1D95", fontSize: px(m.initials) }} className="rounded-full overflow-hidden flex items-center justify-center font-extrabold text-white shrink-0">
            {data.photoUrl ? <img src={data.photoUrl} alt="" className="w-full h-full object-cover" /> : isPlaceholder(data.authorName) ? <span style={{ fontSize: px(22) }} className="text-center leading-tight">Author<br />photo</span> : data.initials}
          </div>
        )}
        <div className="min-w-0">
          <div style={{ fontSize: px(m.name), ...ph(data.authorName) }} className="font-extrabold leading-tight inline-block">{data.authorName}</div>
          {design.fields.affiliation && data.affiliation && <div style={{ fontSize: px(m.aff), color: t.soft, marginTop: px(6) }} className="leading-snug">{data.affiliation}</div>}
        </div>
      </div>

      {design.fields.paper && (
        <div style={{ background: t.panel, border: `${px(2)}px solid ${t.panelBorder}`, borderRadius: px(22), padding: `${px(22)}px ${px(28)}px` }} className="relative">
          <div style={{ fontSize: px(m.paperLabel), color: t.tint, letterSpacing: "0.1em" }} className="font-extrabold">PAPER</div>
          <div style={{ fontSize: px(m.paper), lineHeight: `${px(m.paperLine)}px`, marginTop: px(6), display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: m.paperLines, overflow: "hidden" }} className="font-bold">{data.paperTitle}</div>
        </div>
      )}

      {(design.fields.slot || design.fields.room) && (
        <div className="relative flex flex-wrap" style={{ gap: px(16) }}>
          {design.fields.slot && data.slotText && (
            <span style={{ background: t.pillBg, color: t.pillInk, fontSize: px(m.pill), height: px(m.pillH), padding: `0 ${px(24)}px`, gap: px(10) }} className="inline-flex items-center rounded-full font-bold">
              <Calendar size={px(m.pill)} /> {data.slotText}
            </span>
          )}
          {design.fields.room && data.roomText && (
            <span style={{ background: t.pillBg, color: t.pillInk, fontSize: px(m.pill), height: px(m.pillH), padding: `0 ${px(24)}px`, gap: px(10) }} className="inline-flex items-center rounded-full font-bold">
              <MapPin size={px(m.pill)} /> {data.roomText}
            </span>
          )}
        </div>
      )}

      <div className="relative mt-auto flex items-end justify-between" style={{ gap: px(24) }}>
        <div className="min-w-0 flex flex-col" style={{ gap: px(6) }}>
          {design.fields.qr && <div style={{ fontSize: px(28) }} className="font-extrabold">Scan to read my paper</div>}
          <div style={{ fontSize: px(24), color: t.soft }} className="truncate">{data.url.replace(/^https?:\/\//, "")}</div>
          <div style={{ fontSize: px(24), color: design.accent }} className="font-bold">{data.hashtag}</div>
        </div>
        {design.fields.qr && (
          <div style={{ padding: px(16), borderRadius: px(20) }} className="bg-white shrink-0 leading-none">
            {qrDataUrl ? <img src={qrDataUrl} alt={`QR code linking to ${data.url}`} style={{ width: px(m.qr), height: px(m.qr) }} /> : <div style={{ width: px(m.qr), height: px(m.qr) }} />}
          </div>
        )}
      </div>
    </div>
  );
}
