import { defaultDesign, defaultElements, getCertificateType, type CertificateType, type CertTypeKey, type Design, type Orientation, type Palette, type Signatory } from "../data";
import { A4_SPEC, type PaperSpec } from "../paper";
import { SIGNATORY_PLACEHOLDER, newId, pageSize, shapeEl, textEl, type FontKey, type StudioDoc, type StudioElement } from "./model";

/* The template gallery's designs. Each is a function that lays the certificate out from the page size and the certificate type, so the same
   template works on a landscape and a portrait page and carries the right wording ("OF PARTICIPATION"…). Every element it makes is an
   ordinary studio element: nothing is locked, and nothing about a template is remembered once it has been applied. */

export type TemplateStyle = "Classic" | "Academic" | "Modern" | "Elegant" | "Bold" | "Soft";
export const TEMPLATE_STYLES: TemplateStyle[] = ["Classic", "Academic", "Modern", "Elegant", "Bold", "Soft"];

export interface StudioTemplate {
  key: string; name: string; blurb: string; style: TemplateStyle;
  /** The certificate types this look suits best (they are listed first and marked "Recommended"). */
  bestFor: CertTypeKey[];
  palette: Palette;
  build(input: BuildInput): StudioDoc;
}
interface BuildInput { orientation: Orientation; type: CertificateType; signatory: Signatory; paper: PaperSpec }

interface C { w: number; h: number; k: number; portrait: boolean; type: CertificateType; sig: Signatory; pal: Palette; paper: PaperSpec }
const ctxOf = (i: BuildInput, pal: Palette): C => {
  const { w, h } = pageSize(i.orientation, i.paper);
  // The layouts were drawn for A4 (1000 x 707): sizes follow the width, and on a landscape page that is shorter than A4 (Legal, Executive…) they shrink with the height too, so nothing collides.
  const k = (w / 1000) * (i.orientation === "landscape" ? Math.min(1, h / 707) : 1);
  return { w, h, k, portrait: i.orientation === "portrait", type: i.type, sig: i.signatory, pal, paper: i.paper };
};
const doc = (c: C, background: StudioDoc["background"], elements: StudioElement[], orientation: Orientation): StudioDoc => ({ version: 2, orientation, background, elements, paper: c.paper });
const solid = (color: string): StudioDoc["background"] => ({ kind: "color", color });

/* ---- shared pieces ---- */
const MUTED = "#475569";
interface Stack { x: number; w: number; align: "left" | "center"; ink: string; accent: string; body?: string; font?: FontKey; nameFont?: FontKey; headWeight?: number; headSpacing?: number; nameItalic?: boolean; nameWeight?: number; typeItalic?: boolean; showRule?: boolean; upperType?: boolean; headSize?: number; nameSize?: number; y?: number[] }

/** The wording of the certificate, top to bottom: headline, type line, rule, lead-in, recipient, body, conference line. */
function stack(c: C, s: Stack): StudioElement[] {
  const { h, portrait } = c;
  const k = portrait ? c.k * 1.15 : c.k; // text scale
  const y = s.y ?? (portrait ? [0.14, 0.24, 0.30, 0.355, 0.41, 0.53] : [0.11, 0.215, 0.285, 0.335, 0.39, 0.505]);
  const f = (v: number) => Math.round(v * h);
  const font = s.font ?? "serif";
  const headSize = Math.round((s.headSize ?? 64) * k * (portrait ? 1.0 : 1));
  const out: StudioElement[] = [
    textEl({ name: "Headline", x: s.x, y: f(y[0]), w: s.w, text: "CERTIFICATE", size: headSize, weight: s.headWeight ?? 700, font, color: s.ink, align: s.align, letterSpacing: s.headSpacing ?? 7 * k, lineHeight: 1, h: Math.round(headSize * 1.1) }),
    textEl({ name: "Type line", x: s.x, y: f(y[1]), w: s.w, text: c.type.line, size: Math.round(26 * k), weight: 600, italic: s.typeItalic ?? true, font, color: s.accent, align: s.align, letterSpacing: 3 * k, lineHeight: 1.2 }),
  ];
  if (s.showRule !== false) out.push(shapeEl({ name: "Divider", x: s.align === "center" ? Math.round(s.x + s.w / 2 - 50 * k) : s.x, y: f(y[2]), w: Math.round(100 * k), h: Math.max(2, Math.round(3 * k)), fill: s.accent }));
  out.push(
    textEl({ name: "Lead-in", x: s.x, y: f(y[3]), w: s.w, text: "This certificate is proudly awarded to", size: Math.round(21 * k), font, color: s.body ?? MUTED, align: s.align, lineHeight: 1.4 }),
    textEl({ name: "Recipient name", x: s.x, y: f(y[4]), w: s.w, text: "{{recipientName}}", size: Math.round((s.nameSize ?? 52) * k), weight: s.nameWeight ?? 600, italic: s.nameItalic ?? true, font: s.nameFont ?? font, color: s.ink, align: s.align, lineHeight: 1.15, autoFit: true, h: Math.round((s.nameSize ?? 52) * k * 1.3) }),
    textEl({ name: "Body line", x: s.align === "center" ? s.x + Math.round(24 * k) : s.x, y: f(y[5]), w: s.align === "center" ? s.w - Math.round(48 * k) : s.w, text: `${c.type.body}\nat {{conferenceName}}, {{conferenceDates}}`, size: Math.round(21 * k), font, color: s.body ?? MUTED, align: s.align, lineHeight: 1.6, h: Math.round(21 * k * 1.6 * 3) }),
  );
  return out;
}

/** A signature block: room above the line for a picture from the library, then the line, the name and the designation, grouped. */
function sigBlock(c: C, x: number, y: number, w: number, ink = "#1E293B", muted = "#64748B", line = "#94A3B8", align: "left" | "center" = "center"): StudioElement[] {
  const g = newId("g");
  const { k } = c;
  const size = Math.round(17 * k);
  return [
    shapeEl({ name: "Signature line", x, y, w, h: 1, fill: line, groupId: g }),
    textEl({ name: "Signatory name", x, y: y + Math.round(8 * k), w, text: c.sig.name || SIGNATORY_PLACEHOLDER, size, weight: 700, font: "sans", color: ink, align, groupId: g, lineHeight: 1.25 }),
    textEl({ name: "Signatory title", x, y: y + Math.round(8 * k) + Math.round(size * 1.4), w, text: c.sig.title || "Conference Chair", size: Math.round(16 * k), italic: true, font: "serif", color: muted, align, groupId: g, lineHeight: 1.25 }),
  ];
}
/** The QR block's real width: the code, a gap and the printed certificate ID. */
const qrSpan = (c: C) => Math.round(64 * c.k) + 12 + 104;
const qr = (c: C, x: number, y: number): StudioElement => ({ id: newId("q"), type: "qr", name: "QR & certificate ID", x, y, w: Math.round(64 * c.k), h: Math.round(64 * c.k), rotation: 0, opacity: 1 });
const logo = (c: C, x: number, y: number, w = 110): StudioElement => ({ id: newId("i"), type: "image", name: "Logo", x, y, w: Math.round(w * c.k), h: Math.round(w * 0.8 * c.k), rotation: 0, opacity: 1, src: "/smartconferu-mark.png", fit: "contain" });
const plate = (name: string, x: number, y: number, w: number, h: number, radius = 8): StudioElement => shapeEl({ name, x, y, w, h, fill: "#FFFFFF", radius });

/** Signature, QR and logo along the bottom of a centred page. */
function footer(c: C, o: { pad: number; sigColor?: string; sigMuted?: string; sigLine?: string; qrPlate?: boolean; logoX?: "right" | "left" }): StudioElement[] {
  const { w, h, k, portrait } = c;
  const sigW = Math.round(220 * k);
  const sigY = h - Math.round((portrait ? 190 : 175) * k) - o.pad / 2;
  const qy = h - o.pad - Math.round(70 * k);
  const out: StudioElement[] = [];
  if (o.qrPlate) out.push(plate("QR plate", o.pad - 8, qy - 8, qrSpan(c) + 16, Math.round(64 * k) + 16, 8));
  out.push(...sigBlock(c, Math.round((w - sigW) / 2), sigY, sigW, o.sigColor, o.sigMuted, o.sigLine), qr(c, o.pad, qy), logo(c, w - o.pad - Math.round(110 * k), h - o.pad - Math.round(95 * k), 110));
  return out;
}

/* ---------------------------------------------------------------- the templates */

const classicNavy: StudioTemplate = {
  key: "classic-navy", name: "Classic Navy", blurb: "A double navy border. Formal and timeless.", style: "Classic", bestFor: ["participation", "presentation"],
  palette: { ink: "#1E1B4B", accent: "#06B6D4", paper: "#FDFDFB", rule: "#C7D2FE" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(64 * k);
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Outer border", x: 22, y: 22, w: w - 44, h: h - 44, stroke: p.ink, strokeWidth: 4 }),
      shapeEl({ name: "Inner border", x: 32, y: 32, w: w - 64, h: h - 64, stroke: p.rule, strokeWidth: 1.5 }),
      ...stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent }),
      ...footer(c, { pad }),
    ], i.orientation);
  },
};

const borderedGold: StudioTemplate = {
  key: "bordered-gold", name: "Bordered Gold", blurb: "A warm gold frame with corner studs.", style: "Classic", bestFor: ["appreciation", "publication"],
  palette: { ink: "#7C2D12", accent: "#B45309", paper: "#FFFBF3", rule: "#FDE68A" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(70 * k), s = 16;
    const corner = (n: string, x: number, y: number) => shapeEl({ name: n, x, y, w: s, h: s, fill: p.accent });
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Outer border", x: 22, y: 22, w: w - 44, h: h - 44, stroke: p.accent, strokeWidth: 5 }),
      shapeEl({ name: "Inner border", x: 40, y: 40, w: w - 80, h: h - 80, stroke: p.rule, strokeWidth: 1.5 }),
      corner("Corner 1", 32, 32), corner("Corner 2", w - 32 - s, 32), corner("Corner 3", 32, h - 32 - s), corner("Corner 4", w - 32 - s, h - 32 - s),
      ...stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent }),
      ...footer(c, { pad: pad - 6 }),
    ], i.orientation);
  },
};

const modernMinimal: StudioTemplate = {
  key: "modern-minimal", name: "Modern Minimal", blurb: "A clean sheet with a gradient band on top.", style: "Modern", bestFor: ["participation", "publication"],
  palette: { ink: "#0B1020", accent: "#4F46E5", paper: "#FFFFFF", rule: "#E2E8F0" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(70 * k);
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Top band", x: 0, y: 0, w, h: 14, fill: p.ink, fillTo: p.accent }),
      shapeEl({ name: "Bottom band", x: 0, y: h - 6, w, h: 6, fill: p.rule }),
      ...stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent, font: "sans", nameFont: "serif", headWeight: 800 }),
      ...footer(c, { pad }),
    ], i.orientation);
  },
};

const quietTeal: StudioTemplate = {
  key: "quiet-teal", name: "Quiet Teal", blurb: "Left-aligned and calm, with a soft circle.", style: "Modern", bestFor: ["appreciation", "participation"],
  palette: { ink: "#134E4A", accent: "#0F766E", paper: "#FFFFFF", rule: "#99F6E4" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(90 * k), cs = Math.round(w * 0.5);
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Soft circle", x: w - Math.round(cs * 0.62), y: -Math.round(cs * 0.42), w: cs, h: cs, shape: "ellipse", fill: p.rule, opacity: 0.55 }),
      shapeEl({ name: "Accent bar", x: Math.round(48 * k), y: Math.round(h * 0.11), w: Math.max(6, Math.round(10 * k)), h: Math.round(h * 0.18), fill: p.accent }),
      ...stack(c, { x: pad, w: w - pad * 2, align: "left", ink: p.ink, accent: p.accent, headSpacing: 2, showRule: false }),
      ...sigBlock(c, pad, h - Math.round(175 * k) - pad / 2, Math.round(220 * k), "#1E293B", "#64748B", p.accent, "left"),
      qr(c, w - pad - Math.round(90 * k) - Math.round(30 * k) - qrSpan(c), h - pad - Math.round(64 * k)),
      logo(c, w - pad - Math.round(90 * k), h - pad - Math.round(72 * k), 90),
    ], i.orientation);
  },
};

const academicCrest: StudioTemplate = {
  key: "academic-crest", name: "Academic Crest", blurb: "A heavy burgundy frame and an ornamental divider.", style: "Academic", bestFor: ["publication", "author"],
  palette: { ink: "#4A0E1B", accent: "#9A6B1F", paper: "#FBF7EE", rule: "#D9C9A3" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(80 * k);
    const mid = Math.round(h * 0.285);
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Frame", x: 18, y: 18, w: w - 36, h: h - 36, stroke: p.ink, strokeWidth: 10 }),
      shapeEl({ name: "Inner frame", x: 40, y: 40, w: w - 80, h: h - 80, stroke: p.accent, strokeWidth: 1.5 }),
      shapeEl({ name: "Ornament line left", x: Math.round(w / 2 - 150 * k), y: mid + 5, w: Math.round(122 * k), h: 1.5, fill: p.accent }),
      shapeEl({ name: "Ornament diamond", x: Math.round(w / 2 - 7 * k), y: mid - 2, w: Math.round(14 * k), h: Math.round(14 * k), rotation: 45, fill: p.accent }),
      shapeEl({ name: "Ornament line right", x: Math.round(w / 2 + 28 * k), y: mid + 5, w: Math.round(122 * k), h: 1.5, fill: p.accent }),
      ...stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent, font: "display", nameFont: "serif", showRule: false, headWeight: 700, headSpacing: 9 * k, headSize: 58 }),
      ...footer(c, { pad: pad - 4, sigLine: p.accent }),
    ], i.orientation);
  },
};

const corporateSidebar: StudioTemplate = {
  key: "corporate-sidebar", name: "Corporate Sidebar", blurb: "A solid side panel with the logo; text reads left to right.", style: "Modern", bestFor: ["participation", "publication"],
  palette: { ink: "#0F2A47", accent: "#2563EB", paper: "#FFFFFF", rule: "#DBEAFE" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k, portrait } = c;
    const bar = Math.round((portrait ? 150 : 210) * k), x = bar + Math.round(56 * k), cw = w - x - Math.round(56 * k);
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Side panel", x: 0, y: 0, w: bar, h, fill: p.ink, fillTo: "#1D4ED8" }),
      plate("Logo plate", Math.round(bar / 2 - 50 * k), Math.round(48 * k), Math.round(100 * k), Math.round(100 * k), 14),
      logo(c, Math.round(bar / 2 - 40 * k), Math.round(58 * k), 80),
      ...stack(c, { x, w: cw, align: "left", ink: p.ink, accent: p.accent, font: "sans", nameFont: "serif", headWeight: 800, headSpacing: 2, headSize: 58, showRule: true }),
      ...sigBlock(c, x, h - Math.round(175 * k) - 30, Math.round(220 * k), "#0F172A", "#64748B", p.accent, "left"),
      qr(c, w - Math.round(56 * k) - qrSpan(c), h - Math.round(56 * k) - Math.round(64 * k)),
    ], i.orientation);
  },
};

const royalNight: StudioTemplate = {
  key: "royal-night", name: "Royal Night", blurb: "Deep indigo with gold lettering. For awards.", style: "Elegant", bestFor: ["appreciation", "author"],
  palette: { ink: "#F8FAFC", accent: "#FBBF24", paper: "#1E1B4B", rule: "#4C1D95" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(80 * k);
    return doc(c, { kind: "gradient", from: "#1E1B4B", to: "#4C1D95", angle: 135 }, [
      shapeEl({ name: "Gold frame", x: 24, y: 24, w: w - 48, h: h - 48, stroke: p.accent, strokeWidth: 3 }),
      shapeEl({ name: "Inner frame", x: 36, y: 36, w: w - 72, h: h - 72, stroke: p.accent, strokeWidth: 1, opacity: 0.6 }),
      ...stack(c, { x: pad, w: w - pad * 2, align: "center", ink: "#F8FAFC", accent: p.accent, body: "#CBD5E1", headWeight: 600, headSpacing: 12 * k, nameItalic: true }).map((e) => (e.name === "Recipient name" ? { ...e, color: "#FDE68A" } : e)),
      ...footer(c, { pad, sigColor: "#F8FAFC", sigMuted: "#CBD5E1", sigLine: p.accent, qrPlate: true }),
    ], i.orientation);
  },
};

const geometricCircles: StudioTemplate = {
  key: "geometric-circles", name: "Geometric Circles", blurb: "Overlapping circles in the corners. Light and modern.", style: "Modern", bestFor: ["participation", "presentation"],
  palette: { ink: "#1F2937", accent: "#7C3AED", paper: "#FFFFFF", rule: "#EDE9FE" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(80 * k), big = Math.round(w * 0.46);
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Circle top left", x: -Math.round(big * 0.38), y: -Math.round(big * 0.38), w: big, h: big, shape: "ellipse", fill: p.accent, opacity: 0.14 }),
      shapeEl({ name: "Circle top left small", x: Math.round(big * 0.38), y: -Math.round(big * 0.12), w: Math.round(big * 0.32), h: Math.round(big * 0.32), shape: "ellipse", fill: "#06B6D4", opacity: 0.16 }),
      shapeEl({ name: "Circle bottom right", x: w - Math.round(big * 0.62), y: h - Math.round(big * 0.62), w: big, h: big, shape: "ellipse", fill: p.ink, opacity: 0.07 }),
      shapeEl({ name: "Circle bottom right small", x: w - Math.round(big * 0.95), y: h - Math.round(big * 0.2), w: Math.round(big * 0.28), h: Math.round(big * 0.28), shape: "ellipse", fill: p.accent, opacity: 0.2 }),
      ...stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent, font: "sans", nameFont: "serif", headWeight: 700, headSpacing: 8 * k, headSize: 58 }),
      ...footer(c, { pad }),
    ], i.orientation);
  },
};

const awardSeal: StudioTemplate = {
  key: "award-seal", name: "Award Seal", blurb: "A ribbon header and a gold seal. Made for best-paper style awards.", style: "Bold", bestFor: ["author", "appreciation"],
  palette: { ink: "#1F2937", accent: "#B7791F", paper: "#FFFDF7", rule: "#F6E7B4" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(70 * k), band = Math.round(h * 0.2), seal = Math.round(112 * k);
    const stackEls = stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent, font: "serif", y: i.orientation === "portrait" ? [0.065, 0.27, 0.335, 0.40, 0.45, 0.57] : [0.05, 0.245, 0.31, 0.345, 0.395, 0.51], headSize: 66, headSpacing: 10 * k, showRule: true })
      .map((e) => (e.name === "Headline" ? { ...e, color: "#FFFFFF", y: Math.round(band / 2 - e.h / 2) } : e));
    const sx = Math.round(w / 2 - seal / 2), sy = h - pad - seal + Math.round(12 * k);
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Ribbon", x: 0, y: 0, w, h: band, fill: p.ink, fillTo: "#374151" }),
      shapeEl({ name: "Ribbon edge", x: 0, y: band, w, h: Math.max(4, Math.round(6 * k)), fill: p.accent }),
      ...stackEls,
      shapeEl({ name: "Seal", x: sx, y: sy, w: seal, h: seal, shape: "ellipse", fill: p.accent, fillTo: "#F6D365" }),
      shapeEl({ name: "Seal ring", x: sx + Math.round(9 * k), y: sy + Math.round(9 * k), w: seal - Math.round(18 * k), h: seal - Math.round(18 * k), shape: "ellipse", stroke: "#FFFBEB", strokeWidth: 2 }),
      textEl({ name: "Seal star", x: sx, y: sy + Math.round(seal * 0.22), w: seal, text: "★", size: Math.round(54 * k), weight: 700, font: "sans", color: "#FFFBEB", align: "center", lineHeight: 1 }),
      ...sigBlock(c, pad + Math.round(10 * k), h - pad - Math.round(60 * k), Math.round(220 * k), "#1E293B", "#64748B", "#94A3B8"),
      qr(c, w - pad - qrSpan(c), h - pad - Math.round(64 * k)),
    ], i.orientation);
  },
};

const softPastel: StudioTemplate = {
  key: "soft-pastel", name: "Soft Pastel", blurb: "A white card on a pastel gradient, with a label pill.", style: "Soft", bestFor: ["participation", "appreciation"],
  palette: { ink: "#3B2A5E", accent: "#7C3AED", paper: "#FFFFFF", rule: "#E9D5FF" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const m = Math.round(38 * k), pad = Math.round(90 * k);
    const els = stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent, font: "serif", showRule: false, headSpacing: 8 * k, headWeight: 600 });
    const typeLine = els.find((e) => e.name === "Type line")!;
    return doc(c, { kind: "gradient", from: "#FCE7F3", to: "#E0E7FF", angle: 135 }, [
      shapeEl({ name: "Card", x: m, y: m, w: w - m * 2, h: h - m * 2, fill: "#FFFFFF", radius: Math.round(30 * k) }),
      shapeEl({ name: "Label pill", x: Math.round(w / 2 - 190 * k), y: typeLine.y - Math.round(8 * k), w: Math.round(380 * k), h: Math.round(44 * k), fill: p.rule, radius: 40 }),
      ...els,
      ...footer(c, { pad: pad - 14 * k }),
    ], i.orientation);
  },
};

const boldEditorial: StudioTemplate = {
  key: "bold-editorial", name: "Bold Editorial", blurb: "Huge left-aligned type and a heavy accent bar.", style: "Bold", bestFor: ["presentation", "author"],
  palette: { ink: "#111827", accent: "#F59E0B", paper: "#FFFFFF", rule: "#FEF3C7" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k, portrait } = c;
    const pad = Math.round(96 * k);
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Accent bar", x: Math.round(48 * k), y: Math.round(h * 0.09), w: Math.max(10, Math.round(22 * k)), h: Math.round(h * (portrait ? 0.16 : 0.22)), fill: p.accent }),
      shapeEl({ name: "Footer bar", x: 0, y: h - Math.round(16 * k), w, h: Math.round(16 * k), fill: p.ink }),
      ...stack(c, { x: pad, w: w - pad * 1.5, align: "left", ink: p.ink, accent: "#B45309", font: "sans", nameFont: "sans", nameItalic: false, nameWeight: 800, nameSize: 50, headWeight: 900, headSize: 80, headSpacing: -1, typeItalic: false, showRule: false, body: "#374151", y: portrait ? [0.1, 0.215, 0.3, 0.34, 0.39, 0.52] : [0.085, 0.235, 0.3, 0.33, 0.385, 0.5] }),
      ...sigBlock(c, pad, h - Math.round(185 * k) - 30, Math.round(230 * k), "#111827", "#6B7280", p.ink, "left"),
      qr(c, w - Math.round(60 * k) - qrSpan(c), h - Math.round(60 * k) - Math.round(64 * k) - 20),
    ], i.orientation);
  },
};

const elegantLine: StudioTemplate = {
  key: "elegant-line", name: "Elegant Line", blurb: "Fine gold rules and a lot of white space.", style: "Elegant", bestFor: ["appreciation", "presentation"],
  palette: { ink: "#2B2B2B", accent: "#A8842C", paper: "#FFFDF8", rule: "#E7D9B0" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, h, k } = c;
    const pad = Math.round(90 * k), m = Math.round(44 * k);
    const rule = (n: string, y: number, th: number) => shapeEl({ name: n, x: m, y, w: w - m * 2, h: th, fill: p.accent });
    return doc(c, solid(p.paper), [
      rule("Top rule", m, 3), rule("Top rule thin", m + 9, 1), rule("Bottom rule thin", h - m - 10, 1), rule("Bottom rule", h - m - 3, 3),
      ...stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent, font: "serif", headWeight: 300, headSize: 62, headSpacing: 16 * k, showRule: false, nameWeight: 500 }).map((e) => (e.name === "Recipient name" ? { ...e, color: p.accent } : e)),
      ...footer(c, { pad: pad - 12 * k, sigLine: p.accent }),
    ], i.orientation);
  },
};

const conferenceBanner: StudioTemplate = {
  key: "conference-banner", name: "Conference Banner", blurb: "The conference name in a banner across the top.", style: "Academic", bestFor: ["presentation", "publication"],
  palette: { ink: "#1E3A5F", accent: "#C2410C", paper: "#FFFFFF", rule: "#FED7AA" },
  build(i) {
    const p = this.palette, c = ctxOf(i, p), { w, k, portrait } = c;
    const pad = Math.round(70 * k), band = Math.round((portrait ? 150 : 128) * k);
    const base = stack(c, { x: pad, w: w - pad * 2, align: "center", ink: p.ink, accent: p.accent, font: "serif", y: portrait ? [0.2, 0.29, 0.345, 0.40, 0.45, 0.57] : [0.2, 0.30, 0.36, 0.395, 0.44, 0.535], headSize: 58, headSpacing: 8 * k });
    return doc(c, solid(p.paper), [
      shapeEl({ name: "Banner", x: 0, y: 0, w, h: band, fill: p.ink, fillTo: "#2F5D8C" }),
      shapeEl({ name: "Banner accent", x: 0, y: band, w, h: Math.max(5, Math.round(8 * k)), fill: p.accent }),
      textEl({ name: "Conference name", x: pad, y: Math.round(band / 2 - 26 * k), w: w - pad * 2, text: "{{conferenceName}}", size: Math.round(30 * k), weight: 700, font: "sans", color: "#FFFFFF", align: "center", lineHeight: 1.2, autoFit: true, h: Math.round(44 * k) }),
      ...base.map((e) => (e.name === "Body line" ? { ...e, text: `${c.type.body}\n{{conferenceDates}}` } : e)),
      ...footer(c, { pad }),
    ], i.orientation);
  },
};

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  classicNavy, modernMinimal, academicCrest, royalNight, awardSeal, elegantLine, softPastel, geometricCircles,
  corporateSidebar, boldEditorial, borderedGold, quietTeal, conferenceBanner,
];
export const getStudioTemplate = (key: string | undefined): StudioTemplate | undefined => STUDIO_TEMPLATES.find((t) => t.key === key);

/** The template's document for a certificate type and page orientation. */
export function buildTemplateDoc(templateKey: string, typeKey: CertTypeKey, orientation: Orientation, signatory: Signatory = { name: "", title: "Conference Chair" }, paper: PaperSpec = A4_SPEC): StudioDoc {
  const t = getStudioTemplate(templateKey) ?? STUDIO_TEMPLATES[0];
  return t.build({ orientation, type: getCertificateType(typeKey), signatory, paper });
}

/** A complete new design from a template: the v1 fields that other screens still read, plus the studio document. */
export function designFromTemplate(templateKey: string, typeKey: CertTypeKey, orientation: Orientation, signatory: Signatory = { name: "", title: "Conference Chair" }, paper: PaperSpec = A4_SPEC): Design {
  const t = getStudioTemplate(templateKey) ?? STUDIO_TEMPLATES[0];
  const base = defaultDesign(typeKey, "classic-navy", signatory);
  return { ...base, templateKey: t.key, palette: { ...t.palette }, orientation, elements: defaultElements(orientation, 1), studio: buildTemplateDoc(t.key, typeKey, orientation, signatory, paper) };
}
