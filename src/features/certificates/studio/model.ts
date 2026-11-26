import { defaultElements, type Design, type Orientation } from "../data";
import { A4_SPEC, mmPerPx, pagePx, type PaperSpec } from "../paper";

/* The Certificate Studio's document: a flat, ordered list of elements (list order = stacking order, last is on top) on a page of the same
   fixed base size the rest of the module already uses (1000x707 / 707x1000). It is stored inside the existing `Design` JSON as `design.studio`,
   so no table or service contract changes. A design without `studio` is a v1 design and is converted by `studioFromDesign` the first time the
   studio opens it; every other screen keeps drawing it through CertificateArtwork, which renders `studio` when present. */

export type ElementType = "text" | "shape" | "image" | "qr";
export type ShapeKind = "rect" | "ellipse";

export interface StudioElement {
  id: string; type: ElementType; name: string;
  x: number; y: number; w: number; h: number; rotation: number; opacity: number;
  locked?: boolean; hidden?: boolean; groupId?: string;
  // text
  text?: string; font?: FontKey; size?: number; weight?: number; italic?: boolean; underline?: boolean; color?: string;
  align?: "left" | "center" | "right"; letterSpacing?: number; lineHeight?: number; autoFit?: boolean; upper?: boolean;
  // shape
  shape?: ShapeKind; fill?: string; fillTo?: string; stroke?: string; strokeWidth?: number; radius?: number;
  // image
  src?: string; fit?: "contain" | "cover";
}

export type Background = { kind: "color"; color: string } | { kind: "gradient"; from: string; to: string; angle: number };
/** Custom guides (page px) and the print-safe margin are part of the document so they survive a reload and can be undone. They are never drawn in exports. */
export interface StudioDoc { version: 2; orientation: Orientation; background: Background; elements: StudioElement[]; guides?: { x: number[]; y: number[] }; margin?: number; /** The paper the page is made for (absent = A4). */ paper?: PaperSpec }

/* The page's long side is 1000 base px, so one px is (the paper's long side in mm) / 1000: 0.297 mm on A4. */
export type Unit = "px" | "mm" | "in";
export const docPaper = (d: Pick<StudioDoc, "paper">): PaperSpec => d.paper ?? A4_SPEC;
/** How many of a unit one base pixel is, on this document's paper. */
export const unitPerPx = (d: Pick<StudioDoc, "paper">, unit: Unit): number => (unit === "px" ? 1 : unit === "mm" ? mmPerPx(docPaper(d)) : mmPerPx(docPaper(d)) / 25.4);
/** The print-safe margin: what the person set, else about 10 mm on this paper. */
export const marginOf = (d: StudioDoc) => d.margin ?? Math.round(10 / mmPerPx(docPaper(d)));
export const formatUnit = (px: number, unit: Unit, perPx: number) => (unit === "px" ? String(Math.round(px)) : (px * perPx).toFixed(unit === "mm" ? 1 : 2));

export type FontKey = "serif" | "sans" | "mono" | "display";
export const FONTS: Record<FontKey, { label: string; css: string }> = {
  serif: { label: "Cormorant Garamond", css: "var(--font-cormorant), 'Cormorant Garamond', 'Times New Roman', serif" },
  display: { label: "Georgia", css: "Georgia, 'Times New Roman', serif" },
  sans: { label: "Sans serif", css: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" },
  mono: { label: "Monospace", css: "ui-monospace, Menlo, Consolas, monospace" },
};

let counter = 0;
/** What the templates print for a signatory until the chair fills it in. */
export const SIGNATORY_PLACEHOLDER = "Name of signatory";
/** True when a signature block's name is empty or still the placeholder: such a certificate must not go out. */
export const isPlaceholderName = (text: string | undefined): boolean => { const t = (text ?? "").trim().toLowerCase(); return t === "" || t === SIGNATORY_PLACEHOLDER.toLowerCase(); };

export const newId = (prefix = "el") => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const pageSize = (o: Orientation, paper: PaperSpec = A4_SPEC) => pagePx(paper, o === "portrait" ? "portrait" : "landscape");
/** The page of a document, in base pixels. */
export const docPage = (d: Pick<StudioDoc, "orientation" | "paper">) => pageSize(d.orientation, d.paper);

/**
 * The same document on another paper. The page changes proportions, so what is on it is carried over rather than rebuilt: frames and lines stretch with the
 * page, text boxes follow the new width, pictures and QR codes keep their size, and everything keeps its place relative to the page. A group (a signature
 * block) moves as one piece so its parts stay together. Guides move with the page and the margin keeps its width in millimetres.
 */
export function rescaleDoc(d: StudioDoc, next: PaperSpec): StudioDoc {
  const from = docPage(d), to = pageSize(d.orientation, next);
  const sx = to.w / from.w, sy = to.h / from.h;
  const groupShift = new Map<string, { dx: number; dy: number }>();
  for (const g of new Set(d.elements.map((e) => e.groupId).filter(Boolean) as string[])) {
    const b = boundsOf(d.elements.filter((e) => e.groupId === g));
    groupShift.set(g, { dx: Math.round((b.x + b.w / 2) * sx - (b.x + b.w / 2)), dy: Math.round((b.y + b.h / 2) * sy - (b.y + b.h / 2)) });
  }
  const elements = d.elements.map((e) => {
    const gs = e.groupId ? groupShift.get(e.groupId) : undefined;
    if (gs) return { ...e, x: e.x + gs.dx, y: e.y + gs.dy };
    const cx = (e.x + e.w / 2) * sx, cy = (e.y + e.h / 2) * sy;
    if (e.type === "shape") { // thin lines and borders keep their thickness along the thin side
      const w = e.w <= 8 ? e.w : e.w * sx, h = e.h <= 8 ? e.h : e.h * sy;
      return { ...e, x: Math.round(e.x * sx + (e.w <= 8 ? (e.w * sx - e.w) / 2 : 0)), y: Math.round(e.y * sy + (e.h <= 8 ? (e.h * sy - e.h) / 2 : 0)), w: Math.round(w), h: Math.round(h) };
    }
    if (e.type === "text") return { ...e, x: Math.round(e.x * sx), w: Math.round(e.w * sx), y: Math.round(cy - e.h / 2) };
    return { ...e, x: Math.round(cx - e.w / 2), y: Math.round(cy - e.h / 2) }; // pictures and QR codes keep their size
  });
  const mmRatio = mmPerPx(docPaper(d)) / mmPerPx(next);
  return {
    ...d, paper: next, elements,
    ...(d.guides ? { guides: { x: d.guides.x.map((g) => Math.round(g * sx)), y: d.guides.y.map((g) => Math.round(g * sy)) } } : {}),
    ...(d.margin !== undefined ? { margin: Math.round(d.margin * mmRatio) } : {}),
  };
}
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/* ---------------- v1 -> studio ---------------- */
const SERIF_INK_SOFT = "#475569";
export function textEl(p: Partial<StudioElement> & Pick<StudioElement, "name" | "x" | "y" | "w" | "text">): StudioElement {
  const size = p.size ?? 21;
  return { id: newId("t"), type: "text", rotation: 0, opacity: 1, font: "serif", size, weight: 400, color: "#0B1020", align: "center", lineHeight: 1.3, h: Math.round(size * 1.35), ...p };
}
export const shapeEl = (p: Partial<StudioElement> & Pick<StudioElement, "name" | "x" | "y" | "w" | "h">): StudioElement => ({ id: newId("s"), type: "shape", rotation: 0, opacity: 1, shape: "rect", fill: "transparent", strokeWidth: 0, ...p });

export function studioFromDesign(design: Design): StudioDoc {
  const o: Orientation = design.orientation === "portrait" ? "portrait" : "landscape";
  const { w, h } = pageSize(o);
  const { ink, accent, paper, rule } = design.palette;
  const els = design.elements && Object.keys(design.elements).length ? design.elements : defaultElements(o, design.signatories?.length || 1);
  const out: StudioElement[] = [];

  // Frames (the three template borders) become ordinary shapes the person can edit or delete.
  if (design.layout === "banner-top") {
    out.push(shapeEl({ name: "Top band", x: 0, y: 0, w, h: 14, fill: ink, fillTo: accent, locked: false }));
    out.push(shapeEl({ name: "Bottom band", x: 0, y: h - 6, w, h: 6, fill: rule }));
  } else if (design.layout === "ornate-border") {
    out.push(shapeEl({ name: "Outer border", x: 22, y: 22, w: w - 44, h: h - 44, stroke: accent, strokeWidth: 5 }));
    out.push(shapeEl({ name: "Inner border", x: 38, y: 38, w: w - 76, h: h - 76, stroke: rule, strokeWidth: 1 }));
  } else {
    out.push(shapeEl({ name: "Outer border", x: 22, y: 22, w: w - 44, h: h - 44, stroke: ink, strokeWidth: 4 }));
    out.push(shapeEl({ name: "Inner border", x: 32, y: 32, w: w - 64, h: h - 64, stroke: rule, strokeWidth: 1.5 }));
  }
  // The v1 blocks sat inside the frame's padding; shift by the same offset so nothing moves on screen.
  const dx = design.layout === "banner-top" ? 0 : design.layout === "ornate-border" ? 33 : 33.5;
  const dy = design.layout === "banner-top" ? 14 : dx;
  const P = (id: string) => els[id];
  const at = (id: string) => ({ x: Math.round(P(id).x + dx), y: Math.round(P(id).y + dy), w: P(id).w });

  if (P("headline")) out.push(textEl({ name: "Headline", ...at("headline"), text: design.headline, size: P("headline").size ?? 64, weight: 700, color: ink, letterSpacing: 7, lineHeight: 1 }));
  if (P("typeLine")) out.push(textEl({ name: "Type line", ...at("typeLine"), text: design.typeLine, size: P("typeLine").size ?? 26, weight: 600, italic: true, color: accent, letterSpacing: 3, lineHeight: 1.2 }));
  if (P("rule")) out.push(shapeEl({ name: "Divider", ...at("rule"), h: P("rule").size ?? 3, fill: accent }));
  if (P("leadIn")) out.push(textEl({ name: "Lead-in", ...at("leadIn"), text: design.leadIn, size: P("leadIn").size ?? 21, color: SERIF_INK_SOFT, lineHeight: 1.4 }));
  if (P("recipientName")) out.push(textEl({ name: "Recipient name", ...at("recipientName"), text: "{{recipientName}}", size: P("recipientName").size ?? 52, weight: 600, italic: true, color: ink, lineHeight: 1.15, autoFit: true }));
  if (P("bodyLine")) {
    const b = at("bodyLine");
    const size = P("bodyLine").size ?? 21;
    out.push(textEl({ name: "Body line", ...b, text: `${design.bodyLine}\nat {{conferenceName}}, {{conferenceDates}}`, size, color: SERIF_INK_SOFT, lineHeight: 1.6, h: Math.round(size * 1.6 * 3) }));
  }
  design.signatories?.slice(0, 3).forEach((s, i) => {
    const b = P(`sig${i}`);
    if (!b) return;
    const g = newId("g");
    const x = Math.round(b.x + dx), y = Math.round(b.y + dy);
    const size = b.size ?? 32;
    const first = (s.name || "").replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/, "") || "Signature";
    out.push(textEl({ name: `Signature ${i + 1}`, x, y, w: b.w, text: first, size, italic: true, color: ink, lineHeight: 1.1, groupId: g }));
    out.push(shapeEl({ name: "Signature line", x, y: y + size * 1.1 + 8, w: b.w, h: 1, fill: "#CBD5E1", groupId: g }));
    out.push(textEl({ name: "Signatory name", x, y: Math.round(y + size * 1.1 + 16), w: b.w, text: s.name, size: 16, weight: 700, font: "sans", color: "#1E293B", groupId: g }));
    out.push(textEl({ name: "Signatory title", x, y: Math.round(y + size * 1.1 + 38), w: b.w, text: s.title, size: 16, italic: true, color: "#64748B", groupId: g }));
  });
  if (design.showQr && P("qr")) out.push({ id: newId("q"), type: "qr", name: "QR & certificate ID", ...at("qr"), h: P("qr").w, rotation: 0, opacity: 1 });
  if (design.showLogo && P("logo")) out.push({ id: newId("i"), type: "image", name: "Logo", ...at("logo"), h: Math.round(P("logo").w * 0.8), rotation: 0, opacity: 1, src: design.logoSrc || "/smartconferu-mark.png", fit: "contain" });
  return { version: 2, orientation: o, background: { kind: "color", color: paper }, elements: out };
}

/* ---------------- tokens and text ---------------- */
/** Fill {{tokens}}, then tidy what a missing value leaves behind ("at , " -> nothing) so no braces or stray commas are printed. */
export function resolveText(text: string, values: Record<string, string>): string {
  const filled = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, t: string) => values[t] ?? "");
  return filled.split("\n").map((l) => l.replace(/[,\s]+$/, "").replace(/^at$/, "")).join("\n").replace(/\n+$/, "");
}
export const tokensIn = (text: string): string[] => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);

/** Font size that keeps the longest line inside the box. An estimate (average glyph ~0.5em), identical in the editor, previews and print, so it never differs between them. */
export function fittedSize(el: StudioElement, shown: string): number {
  const size = el.size ?? 21;
  if (!el.autoFit) return size;
  const longest = Math.max(1, ...shown.split("\n").map((l) => l.length));
  const spacing = (el.letterSpacing ?? 0) * longest;
  const needed = longest * size * (el.italic ? 0.46 : 0.5) + spacing;
  return needed > el.w ? Math.max(10, Math.floor(size * (el.w / needed))) : size;
}
export const overflows = (el: StudioElement, shown: string): boolean => !!el.autoFit && fittedSize(el, shown) <= 10 && shown.length * 5 > el.w;

/* ---------------- geometry ---------------- */
export interface Box { x: number; y: number; w: number; h: number }
export const boundsOf = (els: StudioElement[]): Box => {
  if (!els.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x1 = Math.min(...els.map((e) => e.x)), y1 = Math.min(...els.map((e) => e.y));
  const x2 = Math.max(...els.map((e) => e.x + e.w)), y2 = Math.max(...els.map((e) => e.y + e.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};

export interface Guide { axis: "x" | "y"; pos: number }
/** Snap a moving box to the page edges / centre and to the other elements' edges / centres. Returns the correction and the guide lines to draw. */
export function snapBox(box: Box, others: Box[], page: { w: number; h: number }, threshold: number, extra: { x: number[]; y: number[] } = { x: [], y: [] }): { dx: number; dy: number; guides: Guide[] } {
  const xs = [0, page.w / 2, page.w, ...extra.x, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
  const ys = [0, page.h / 2, page.h, ...extra.y, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
  const pick = (mine: number[], targets: number[]) => {
    let best: { d: number; at: number } | null = null;
    for (const m of mine) for (const t of targets) { const d = t - m; if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t }; }
    return best;
  };
  const sx = pick([box.x, box.x + box.w / 2, box.x + box.w], xs);
  const sy = pick([box.y, box.y + box.h / 2, box.y + box.h], ys);
  const guides: Guide[] = [];
  if (sx) guides.push({ axis: "x", pos: sx.at });
  if (sy) guides.push({ axis: "y", pos: sy.at });
  return { dx: sx?.d ?? 0, dy: sy?.d ?? 0, guides };
}

export type AlignKind = "left" | "center" | "right" | "top" | "middle" | "bottom";

/* Align and distribute treat a group (a signature block, say) as ONE unit, so its parts keep their layout. */
interface Block { key: string; members: StudioElement[]; box: Box }
function blocksOf(all: StudioElement[], ids: Set<string>): Block[] {
  const map = new Map<string, StudioElement[]>();
  all.filter((e) => ids.has(e.id)).forEach((e) => { const k = e.groupId ?? e.id; map.set(k, [...(map.get(k) ?? []), e]); });
  return [...map.entries()].map(([key, members]) => ({ key, members, box: boundsOf(members) }));
}
function shift(all: StudioElement[], moves: Map<string, { dx: number; dy: number }>): StudioElement[] {
  return all.map((e) => { const m = moves.get(e.groupId ?? e.id); return m && !e.locked ? { ...e, x: Math.round(e.x + m.dx), y: Math.round(e.y + m.dy) } : e; });
}

/** Align the given elements to their common bounds (or to the page when only one unit is chosen). */
export function alignElements(all: StudioElement[], ids: Set<string>, kind: AlignKind, page: { w: number; h: number }): StudioElement[] {
  const units = blocksOf(all, ids);
  if (!units.length) return all;
  const b = units.length === 1 ? { x: 0, y: 0, w: page.w, h: page.h } : boundsOf(units.flatMap((u) => u.members));
  const moves = new Map<string, { dx: number; dy: number }>();
  units.forEach(({ key, box }) => {
    switch (kind) {
      case "left": moves.set(key, { dx: b.x - box.x, dy: 0 }); break;
      case "center": moves.set(key, { dx: b.x + (b.w - box.w) / 2 - box.x, dy: 0 }); break;
      case "right": moves.set(key, { dx: b.x + b.w - box.w - box.x, dy: 0 }); break;
      case "top": moves.set(key, { dx: 0, dy: b.y - box.y }); break;
      case "middle": moves.set(key, { dx: 0, dy: b.y + (b.h - box.h) / 2 - box.y }); break;
      default: moves.set(key, { dx: 0, dy: b.y + b.h - box.h - box.y });
    }
  });
  return shift(all, moves);
}
/** Even gaps between three or more units (a group counts once). */
export function distributeElements(all: StudioElement[], ids: Set<string>, axis: "h" | "v"): StudioElement[] {
  const units = blocksOf(all, ids).sort((a, b) => (axis === "h" ? a.box.x - b.box.x : a.box.y - b.box.y));
  if (units.length < 3) return all;
  const size = (u: Block) => (axis === "h" ? u.box.w : u.box.h);
  const start = (u: Block) => (axis === "h" ? u.box.x : u.box.y);
  const first = units[0], last = units[units.length - 1];
  const span = start(last) + size(last) - start(first);
  const gap = (span - units.reduce((s, u) => s + size(u), 0)) / (units.length - 1);
  let cursor = start(first);
  const moves = new Map<string, { dx: number; dy: number }>();
  units.forEach((u) => {
    const d = cursor - start(u);
    moves.set(u.key, axis === "h" ? { dx: d, dy: 0 } : { dx: 0, dy: d });
    cursor += size(u) + gap;
  });
  return shift(all, moves);
}

export type ZMove = "forward" | "backward" | "front" | "back";
export function reorder(all: StudioElement[], ids: Set<string>, move: ZMove): StudioElement[] {
  const picked = all.filter((e) => ids.has(e.id));
  const rest = all.filter((e) => !ids.has(e.id));
  if (move === "front") return [...rest, ...picked];
  if (move === "back") return [...picked, ...rest];
  const out = [...all];
  if (move === "forward") { for (let i = out.length - 2; i >= 0; i--) if (ids.has(out[i].id) && !ids.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]]; }
  else { for (let i = 1; i < out.length; i++) if (ids.has(out[i].id) && !ids.has(out[i - 1].id)) [out[i], out[i - 1]] = [out[i - 1], out[i]]; }
  return out;
}

/** Selecting any member of a group selects the whole group. */
export function expandSelection(all: StudioElement[], ids: Iterable<string>): Set<string> {
  const base = new Set(ids);
  const groups = new Set(all.filter((e) => base.has(e.id) && e.groupId).map((e) => e.groupId));
  return new Set(all.filter((e) => base.has(e.id) || (e.groupId && groups.has(e.groupId))).map((e) => e.id));
}

/* ---------------- new elements ---------------- */
export const PRESETS = {
  heading: { name: "Heading", text: "Add a heading", size: 56, weight: 700, font: "serif" as FontKey },
  subheading: { name: "Subheading", text: "Add a subheading", size: 30, weight: 600, font: "serif" as FontKey },
  body: { name: "Body text", text: "Add a little bit of body text", size: 20, weight: 400, font: "serif" as FontKey },
  script: { name: "Script line", text: "Your text here", size: 44, weight: 600, italic: true, font: "serif" as FontKey },
  label: { name: "Label", text: "LABEL", size: 14, weight: 700, font: "sans" as FontKey, letterSpacing: 3 },
};
export function newText(page: { w: number; h: number }, preset: keyof typeof PRESETS | "custom", text?: string): StudioElement {
  const p = preset === "custom" ? { ...PRESETS.body, name: "Text" } : PRESETS[preset];
  const w = Math.min(560, page.w - 120);
  return textEl({ ...p, x: Math.round((page.w - w) / 2), y: Math.round(page.h / 2 - 20), w, text: text ?? p.text, color: "#0B1020" });
}
export const newShape = (page: { w: number; h: number }, kind: "rect" | "ellipse" | "line" | "frame", color: string): StudioElement => {
  const cx = (w: number) => Math.round((page.w - w) / 2), cy = (h: number) => Math.round((page.h - h) / 2);
  if (kind === "line") return shapeEl({ name: "Line", x: cx(300), y: cy(3), w: 300, h: 3, fill: color });
  if (kind === "ellipse") return shapeEl({ name: "Circle", x: cx(160), y: cy(160), w: 160, h: 160, shape: "ellipse", fill: color });
  if (kind === "frame") return shapeEl({ name: "Border", x: 40, y: 40, w: page.w - 80, h: page.h - 80, stroke: color, strokeWidth: 3 });
  return shapeEl({ name: "Rectangle", x: cx(220), y: cy(140), w: 220, h: 140, fill: color });
};
export const newImage = (page: { w: number; h: number }, src: string, name: string, natural: { w: number; h: number }): StudioElement => {
  const scale = Math.min(1, 320 / natural.w, 240 / natural.h);
  const w = Math.max(20, Math.round(natural.w * scale)), h = Math.max(20, Math.round(natural.h * scale));
  return { id: newId("i"), type: "image", name, x: Math.round((page.w - w) / 2), y: Math.round((page.h - h) / 2), w, h, rotation: 0, opacity: 1, src, fit: "contain" };
};

/** A signatory from the library placed on the page as one group: the picture, a signing line, the name, the designation and the institution.
 *  `index` is how many signature blocks are already on the page, so each new one lands in a free slot (middle, left, right). */
export function newSignatureBlock(page: { w: number; h: number }, sig: { id: string; name: string; designation: string; institution: string }, index: number, at?: { cx?: number; y?: number }): StudioElement[] {
  const w = 220;
  const centers = [0.5, 0.25, 0.75, 0.5];
  const cx = at?.cx ?? Math.round(page.w * centers[index % centers.length]);
  const x = cx - w / 2;
  const y = at?.y ?? page.h - 230;
  const g = newId("g");
  const common = { rotation: 0, opacity: 1, groupId: g };
  const out: StudioElement[] = [
    { id: newId("i"), type: "image", name: "Signature image", x, y, w, h: 70, src: `sig:${sig.id}`, fit: "contain", ...common },
    shapeEl({ name: "Signature line", x, y: y + 76, w, h: 1, fill: "#94A3B8", groupId: g }),
    textEl({ name: "Signatory name", x, y: y + 84, w, text: sig.name, size: 17, weight: 700, font: "sans", color: "#1E293B", lineHeight: 1.25, groupId: g }),
    textEl({ name: "Signatory title", x, y: y + 108, w, text: sig.designation, size: 16, italic: true, color: "#64748B", lineHeight: 1.25, groupId: g }),
  ];
  if (sig.institution) out.push(textEl({ name: "Signatory institution", x, y: y + 130, w, text: sig.institution, size: 14, color: "#64748B", lineHeight: 1.25, groupId: g }));
  return out;
}

/** The signatories printed on the page (name + designation of each signature block, left to right), for the places that still read the v1 `signatories` field (the public check page). */
export function signatoriesOf(doc: StudioDoc): Array<{ name: string; title: string }> {
  const names = doc.elements.filter((e) => e.type === "text" && e.name === "Signatory name" && !e.hidden && (e.text ?? "").trim());
  return names
    .sort((a, b) => a.x - b.x)
    .slice(0, 3)
    .map((n) => ({ name: (n.text ?? "").trim(), title: (doc.elements.find((e) => e.name === "Signatory title" && e.groupId && e.groupId === n.groupId)?.text ?? "").trim() }));
}

/** The width an element really takes on the page (the QR block is the code plus its printed ID). */
const reach = (e: StudioElement) => (e.type === "qr" ? e.w + 130 : e.w);

/**
 * Two or more signature blocks share the bottom row: spread them evenly across the part of the row that the QR code, the logo and other things
 * leave free, so they never sit on top of each other or of those. With room for fewer than two it still spreads them as far as it can.
 */
export function spaceSignatureBlocks(all: StudioElement[], page: { w: number; h: number }): StudioElement[] {
  const groups = [...new Set(all.filter((e) => e.name === "Signature image" && e.groupId && !e.hidden).map((e) => e.groupId!))];
  if (groups.length < 2) return all;
  const blocks = groups.map((g) => { const members = all.filter((e) => e.groupId === g); return { g, box: boundsOf(members) }; });
  // The row is the part from each block's signing line down (the picture above it may reach into the text above); a full-width text line is not a neighbour.
  const lineTops = groups.map((g) => all.find((e) => e.groupId === g && e.name === "Signature line")?.y ?? blocks.find((b) => b.g === g)!.box.y);
  const top = Math.min(...lineTops) - 8, bottom = Math.max(...blocks.map((b) => b.box.y + b.box.h));
  const others = all.filter((e) => e.type !== "shape" && !e.hidden && !(e.groupId && groups.includes(e.groupId)) && e.w < page.w * 0.6 && e.y < bottom && e.y + e.h > top);
  const mid = page.w / 2;
  const left = Math.max(32, ...others.filter((e) => e.x + e.w / 2 < mid).map((e) => e.x + reach(e) + 16));
  const right = Math.min(page.w - 32, ...others.filter((e) => e.x + e.w / 2 >= mid).map((e) => e.x - 16));
  const span = Math.max(right - left, 240);
  const ordered = [...blocks].sort((a, b) => a.box.x - b.box.x);
  const shift = new Map<string, number>();
  ordered.forEach((b, i) => { const cx = left + ((i + 0.5) * span) / ordered.length; shift.set(b.g, Math.round(cx - (b.box.x + b.box.w / 2))); });
  return all.map((e) => { const dx = e.groupId ? shift.get(e.groupId) : undefined; return dx ? { ...e, x: e.x + dx } : e; });
}
