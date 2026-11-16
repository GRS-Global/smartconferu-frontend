import { DATA_SOURCE } from "@/lib/config";
import { screenPaperDigest } from "@/services/paper-ai";
import type { AutoCheck } from "@/types/chair";

/* The automatic initial check of an uploaded PDF (the prototype's src/chair-plagiarism/autoCheck.js, Option C). It runs on the real file
   the moment it is picked:

   1. Rules, in the browser (pdf.js, no server, a second or two): page count, whether the text is selectable, whether it is English (share of
      common English words and of non-Latin letters), and the column layout (where body lines start and how wide they are: two clusters of
      half-width lines, at the left edge and in the middle, are a double column; lines spanning the page are a single column).
   2. An AI review only when the rules are not sure (column or language): a compact digest, never the file, goes to `screen-paper`
      (through app/api/ai/[name]), which also notes parts that are missing (abstract, keywords …).

   The result is advisory: it is saved with the file (`submission_files.auto_check`, read by the chair's Initial Check, which shows it tagged "Auto"),
   and the chair confirms or changes it. It never blocks a submission: a failed step is reported inside the result. */

const SAMPLE_PAGES = 8;
const TEXT_SAMPLE = 9000;
const GUTTER = 0.02; // a gap wider than 2% of the page width starts a new line: real gutters are about 18pt
const STOPWORDS = new Set("the of and to in a is for that with on as are by this be we from an at which or it can our these their was were has have not been also using based used".split(" "));
/** In a double-blind conference the PDF carries no author names or affiliations, so their absence is not a problem. */
const BLIND_OK = new Set(["author_names", "affiliations"]);
const TIMEOUT_MS = 30_000;

type PdfJs = typeof import("pdfjs-dist");
let pdfjsReady: Promise<PdfJs> | null = null;
export function getPdfjs(): Promise<PdfJs> {
  pdfjsReady ??= import("pdfjs-dist").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return lib;
  });
  return pdfjsReady;
}

interface TextItem { str: string; transform: number[]; width: number }
interface Line { start: number; width: number; chars: number; text: string }

/** Lines of text: items on (about) the same baseline, split wherever a wide horizontal gap separates them (in a double-column paper the left
 *  and right columns share baselines, and the gutter between them keeps them two lines instead of one full-width one). */
function linesOf(items: TextItem[], pageWidth: number): Line[] {
  const rows = new Map<number, Array<{ x: number; w: number; str: string }>>();
  for (const it of items) {
    const str = it.str || "";
    if (!str.trim()) continue;
    const y = Math.round(it.transform[5] / 2.5);
    const list = rows.get(y) ?? [];
    list.push({ x: it.transform[4], w: it.width || 0, str });
    rows.set(y, list);
  }
  const segs: Array<{ minX: number; maxX: number; chars: number; text: string }> = [];
  rows.forEach((list) => {
    list.sort((a, b) => a.x - b.x);
    let seg: (typeof segs)[number] | null = null;
    for (const it of list) {
      if (seg && it.x - seg.maxX > GUTTER * pageWidth) { segs.push(seg); seg = null; }
      if (!seg) seg = { minX: it.x, maxX: it.x + it.w, chars: 0, text: "" };
      seg.maxX = Math.max(seg.maxX, it.x + it.w);
      seg.chars += it.str.trim().length;
      seg.text += `${it.str} `;
    }
    if (seg) segs.push(seg);
  });
  return segs.map((r) => ({ start: r.minX / pageWidth, width: (r.maxX - r.minX) / pageWidth, chars: r.chars, text: r.text.trim() }));
}

interface Rules {
  unsupported?: false;
  pages: number; editable: boolean; english: boolean | null; column: "single" | "double" | null;
  confidence: { column: string; english: string };
  digest: { pages: number; layout: string; text: string };
}

/** Reads the PDF and applies the rules. A Word file cannot be read in the browser: it comes back unsupported. */
async function analyzePdf(file: File): Promise<Rules | { unsupported: true; reason: string }> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return { unsupported: true, reason: "Only PDF files can be checked automatically." };
  const lib = await getPdfjs();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = pdf.numPages;
  const sampled = Math.min(pages, SAMPLE_PAGES);
  let text = "";
  let totalChars = 0;
  let textPages = 0;
  const digest: string[] = [];
  const body = { lines: 0, middle: 0, narrow: 0, wide: 0 };

  for (let p = 1; p <= sampled; p += 1) {
    const page = await pdf.getPage(p);
    const { width } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const lines = linesOf(content.items.filter((i): i is typeof i & TextItem => "str" in i) as unknown as TextItem[], width);
    const chars = lines.reduce((n, l) => n + l.chars, 0);
    totalChars += chars;
    if (chars > 150) textPages += 1;
    if (text.length < TEXT_SAMPLE) text += `${lines.map((l) => l.text).join("\n")}\n\n`;

    // Body text only: real sentences, skipping the title page when there is more than one page.
    const bodyLines = lines.filter((l) => l.chars >= 25);
    const left = bodyLines.filter((l) => l.start < 0.3).length;
    const middle = bodyLines.filter((l) => l.start >= 0.42 && l.start <= 0.62).length;
    const narrow = bodyLines.filter((l) => l.width < 0.5).length;
    const wide = bodyLines.filter((l) => l.width > 0.62).length;
    digest.push(`p${p}: ${bodyLines.length} text lines · start left ${left} / middle ${middle} / other ${bodyLines.length - left - middle} · narrow(<50% width) ${narrow} · wide(>62%) ${wide}`);
    if (p > 1 || pages === 1) { body.lines += bodyLines.length; body.middle += middle; body.narrow += narrow; body.wide += wide; }
  }

  // Editable: most sampled pages carry real text.
  const editable = totalChars > 400 && textPages / sampled >= 0.5;

  // English: common English words, and few non-Latin letters.
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  const nonLatin = letters.length ? (letters.match(/[^a-z]/gi) ?? []).length / letters.length : 0;
  const stopShare = words.length ? words.filter((w) => STOPWORDS.has(w)).length / words.length : 0;
  const english = editable ? nonLatin < 0.3 && stopShare > 0.08 : null;
  const englishConfidence = !editable ? "low" : stopShare > 0.14 || stopShare < 0.03 ? "high" : "low";

  // Column layout from the body pages.
  let column: "single" | "double" | null = null;
  let columnConfidence = "low";
  if (editable && body.lines >= 10) {
    const middleShare = body.middle / body.lines;
    const narrowShare = body.narrow / body.lines;
    const wideShare = body.wide / body.lines;
    column = middleShare >= 0.2 && narrowShare >= 0.5 ? "double" : "single";
    columnConfidence = (column === "double" && middleShare > 0.3 && narrowShare > 0.7) || (column === "single" && wideShare > 0.6 && middleShare < 0.06) ? "high" : "low";
  }
  return { pages, editable, english, column, confidence: { column: columnConfidence, english: englishConfidence }, digest: { pages, layout: digest.join("\n"), text: text.slice(0, TEXT_SAMPLE) } };
}

/** The full check: the rules, then the AI review when a rule is unsure. Never throws: a failed step is in the result, and the chair checks that value by hand. */
async function runAutoCheck(file: File): Promise<AutoCheck> {
  const startedAt = Date.now();
  let rules: Awaited<ReturnType<typeof analyzePdf>>;
  try {
    rules = await analyzePdf(file);
  } catch (err) {
    return { status: "failed", error: `The PDF couldn't be read (${err instanceof Error ? err.message : "unknown error"}).`, at: new Date().toISOString() };
  }
  if ("unsupported" in rules && rules.unsupported) return { status: "failed", error: rules.reason, at: new Date().toISOString() };
  const r = rules as Rules;
  const result: AutoCheck = {
    status: "done", pages: r.pages, editable: r.editable, english: r.english ?? undefined, column: r.column ?? undefined,
    confidence: { ...r.confidence }, source: { column: "rules", english: "rules" }, missing: [], at: new Date().toISOString(),
  };
  if (r.editable && (r.confidence.column === "low" || r.confidence.english === "low")) {
    try {
      const ai = await screenPaperDigest({ ...r.digest, rules: { column: r.column, columnConfidence: r.confidence.column } });
      if (r.confidence.column === "low") { result.column = ai.column; result.confidence = { ...result.confidence, column: ai.columnConfidence }; result.source = { ...result.source, column: "ai" }; }
      if (r.confidence.english === "low") { result.english = ai.english; result.confidence = { ...result.confidence, english: "high" }; result.source = { ...result.source, english: "ai" }; }
      result.missing = ai.missing;
      result.aiNote = ai.summary;
    } catch (err) {
      // Keep the rules' best guess; the chair sees it marked low-confidence.
      result.aiError = err instanceof Error ? err.message : "The AI review failed.";
    }
  }
  result.ms = Date.now() - startedAt;
  return result;
}

/** Reviews are double-blind here, so a missing author name or affiliation is expected, not a problem. */
const forDoubleBlind = (auto: AutoCheck): AutoCheck => (auto.missing?.length ? { ...auto, missing: auto.missing.filter((k) => !BLIND_OK.has(k)) } : auto);

// One check per picked file, started right away so it is usually done by the time the person presses Submit.
const started = new WeakMap<File, Promise<AutoCheck>>();

/** Starts the check of a picked file (real accounts only; in mock mode nothing runs). Safe to call again for the same file. */
export function startAutoCheck(file: File): void {
  if (DATA_SOURCE === "mock" || started.has(file)) return;
  started.set(file, runAutoCheck(file).catch((e: unknown) => ({ status: "failed" as const, error: e instanceof Error ? e.message : "The automatic check failed." })));
}

/** The result for a file: what is running (or has finished) for it, waiting at most 30 seconds; null in mock mode. Never throws. */
export async function autoCheckOf(file: File): Promise<AutoCheck | null> {
  if (DATA_SOURCE === "mock") return null;
  startAutoCheck(file);
  const pending = started.get(file);
  if (!pending) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<AutoCheck>((resolve) => { timer = setTimeout(() => resolve({ status: "failed", error: "The automatic check took too long" }), TIMEOUT_MS); });
  try { return forDoubleBlind(await Promise.race([pending, slow])); } finally { if (timer) clearTimeout(timer); }
}
