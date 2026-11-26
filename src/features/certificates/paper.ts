/* Paper sizes. A design's PAGE has the proportions of its paper (A4 by default; Letter, B3, 8 x 10 in, a custom size…) and prints and saves as a PDF on that
   paper exactly. The page is always 1000 base pixels along its long side (so an A4 page is 1000 x 707 as it has always been) and the other side follows the
   paper. A paper is stored in the design as a PaperSpec (key and size) so a design never depends on what this browser remembers. Printing or saving a PDF on a
   DIFFERENT paper fits the certificate whole and centred (nothing is cut off; the extra room stays blank). The last paper chosen is a per-person setting kept
   in this browser, used as the starting paper of a new certificate. */

export type PaperKey = string;
export interface Paper { key: PaperKey; label: string; note: string; /** Portrait size in millimetres (short side first). */ w: number; h: number }
export interface PaperGroup { label: string; papers: Paper[] }

const IN = 25.4;
const inch = (key: string, label: string, wIn: number, hIn: number): Paper => ({ key, label, note: `${wIn} × ${hIn} in`, w: Math.round(wIn * IN * 10) / 10, h: Math.round(hIn * IN * 10) / 10 });
const mm = (key: string, label: string, w: number, h: number): Paper => ({ key, label, note: `${w} × ${h} mm`, w, h });

export const PAPER_GROUPS: PaperGroup[] = [
  { label: "International (ISO)", papers: [
    mm("a0", "A0", 841, 1189), mm("a1", "A1", 594, 841), mm("a2", "A2", 420, 594), mm("a3", "A3", 297, 420), mm("a4", "A4", 210, 297),
    mm("a5", "A5", 148, 210), mm("a6", "A6", 105, 148), mm("b3", "B3", 353, 500), mm("b4", "B4", 250, 353), mm("b5", "B5", 176, 250), mm("b6", "B6", 125, 176),
  ] },
  { label: "North America (US / Canada)", papers: [
    inch("letter", "Letter", 8.5, 11), inch("legal", "Legal", 8.5, 14), inch("juniorlegal", "Junior Legal", 5, 8), inch("statement", "Statement", 5.5, 8.5),
    { key: "executive", label: "Executive", note: "7.25 × 10.5 in", w: 184.2, h: 266.7 }, inch("govletter", "Government Letter", 8, 10.5),
    inch("tabloid", "Tabloid / Ledger", 11, 17), inch("ansic", "ANSI C", 17, 22), inch("ansid", "ANSI D", 22, 34),
    inch("archa", "Arch A", 9, 12), inch("archb", "Arch B", 12, 18), inch("superb", "Super B (A3+)", 13, 19),
  ] },
  { label: "Frame and photo sizes", papers: [
    inch("p4x6", "4 × 6 in", 4, 6), inch("p5x7", "5 × 7 in", 5, 7), inch("p8x10", "8 × 10 in", 8, 10), inch("p11x14", "11 × 14 in", 11, 14), inch("p12x16", "12 × 16 in", 12, 16),
  ] },
  { label: "Other", papers: [mm("folio", "Folio", 210, 330), inch("foolscap", "Foolscap", 8, 13)] },
];
export const PAPERS: Paper[] = PAPER_GROUPS.flatMap((g) => g.papers);
export const DEFAULT_PAPER: PaperKey = "a4";

/** A sheet as stored in a design: its key (for the menu) and its portrait size in millimetres, short side first. */
export interface PaperSpec { key: PaperKey; w: number; h: number }
export const A4_SPEC: PaperSpec = { key: "a4", w: 210, h: 297 };
export const CUSTOM_KEY: PaperKey = "custom";

/** Smallest and largest sheet a custom size may be (millimetres): a business card up to a large banner. */
export const MIN_MM = 50, MAX_MM = 1500;

const CUSTOM_STORE = "certstudio:paper-custom";
export interface CustomSize { w: number; h: number }
export function loadCustom(): CustomSize {
  try {
    const v = JSON.parse(window.localStorage.getItem(CUSTOM_STORE) ?? "null") as Partial<CustomSize> | null;
    if (v && Number.isFinite(v.w) && Number.isFinite(v.h)) return { w: Number(v.w), h: Number(v.h) };
  } catch { /* none saved */ }
  return { w: 210, h: 297 };
}
export function saveCustom(size: CustomSize) {
  try { window.localStorage.setItem(CUSTOM_STORE, JSON.stringify(size)); } catch { /* a per-person convenience only */ }
}

/** A custom size typed in millimetres or inches, in either order, as a sheet (short side first); or the sentence that says what is wrong. */
export function parseCustom(a: string, b: string, unit: "mm" | "in"): { size: CustomSize } | { error: string } {
  const f = unit === "in" ? IN : 1;
  const x = Number(a.replace(",", ".")) * f, y = Number(b.replace(",", ".")) * f;
  if (!a.trim() || !b.trim() || !Number.isFinite(x) || !Number.isFinite(y)) return { error: "Enter both sizes as numbers." };
  const short = Math.min(x, y), long = Math.max(x, y);
  if (short < MIN_MM || long > MAX_MM) return { error: `A sheet must be between ${MIN_MM} mm (about 2 in) and ${MAX_MM / 10} cm (about ${Math.round(MAX_MM / IN)} in) on each side.` };
  return { size: { w: Math.round(short * 10) / 10, h: Math.round(long * 10) / 10 } };
}

export function paperOf(key: string | undefined): Paper {
  if (key === CUSTOM_KEY) { const c = loadCustom(); return { key: CUSTOM_KEY, label: "Custom", note: `${c.w} × ${c.h} mm`, w: c.w, h: c.h }; }
  return PAPERS.find((p) => p.key === key) ?? PAPERS.find((p) => p.key === DEFAULT_PAPER)!;
}

export const specOf = (key: string | undefined): PaperSpec => { const p = paperOf(key); return { key: p.key, w: p.w, h: p.h }; };
export const labelOf = (spec: PaperSpec): string => (spec.key === CUSTOM_KEY ? `Custom ${spec.w} × ${spec.h} mm` : paperOf(spec.key).label);

/** The page of a design on this paper, in base pixels: 1000 along the long side. */
export function pagePx(spec: PaperSpec, orientation: "landscape" | "portrait"): { w: number; h: number } {
  const short = Math.round((1000 * spec.w) / spec.h);
  return orientation === "landscape" ? { w: 1000, h: short } : { w: short, h: 1000 };
}
/** Millimetres per base pixel on this paper (the ruler uses it). */
export const mmPerPx = (spec: PaperSpec): number => spec.h / 1000;

/** CSS pixels per millimetre. */
export const MM = 96 / 25.4;

/** The sheet in millimetres for a design's orientation. */
export function sheetOf(paper: PaperKey | PaperSpec, orientation: "landscape" | "portrait"): { w: number; h: number } {
  const p = typeof paper === "string" ? paperOf(paper) : paper;
  return orientation === "landscape" ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/** Scale and offset (CSS px) that put an `artW` x `artH` page whole and centred on a sheet of `sheetWmm` x `sheetHmm`. */
export function fitOnSheet(artW: number, artH: number, sheetWmm: number, sheetHmm: number): { scale: number; ox: number; oy: number } {
  const pw = sheetWmm * MM, ph = sheetHmm * MM;
  const scale = Math.min(pw / artW, ph / artH);
  return { scale, ox: (pw - artW * scale) / 2, oy: (ph - artH * scale) / 2 };
}

const KEY = "certstudio:paper";
export function loadPaper(): PaperKey {
  try { const k = window.localStorage.getItem(KEY) ?? undefined; return k === CUSTOM_KEY ? CUSTOM_KEY : paperOf(k).key; } catch { return DEFAULT_PAPER; }
}
export function savePaper(key: PaperKey) {
  try { window.localStorage.setItem(KEY, key); } catch { /* a per-person convenience only */ }
}
