import type { Design } from "../data";
import { specOf, type PaperKey, type PaperSpec } from "../paper";
import { createRenderSession, renderCertificate, type RenderConference, type RenderRecipient, type Rendered } from "./render-image";

/* Many certificates into files: one multi-page PDF, a ZIP of single-page PDFs, or a ZIP of PNG pictures. Every certificate is drawn by
   render-image.tsx (the same drawing as on screen), one at a time so the page stays usable; one that fails is reported and does not stop
   the others, and only the failed ones are drawn again on a retry. */

export type ExportFormat = "pdf-multi" | "zip-pdf" | "zip-png";
export const FORMAT_LABELS: Record<ExportFormat, { label: string; note: string; ext: string }> = {
  "pdf-multi": { label: "One PDF with every certificate", note: "One file, one certificate per page. Good for printing.", ext: "pdf" },
  "zip-pdf": { label: "ZIP of separate PDFs", note: "One PDF per person, named as you choose.", ext: "zip" },
  "zip-png": { label: "ZIP of PNG pictures", note: "One picture per person, with a transparent-safe white page.", ext: "zip" },
};
export const QUALITIES = [
  { key: "standard", label: "Standard", scale: 2, note: "About 170 dpi on A4. Smaller files, quicker." },
  { key: "print", label: "Print", scale: 3, note: "About 255 dpi on A4. Sharper, bigger files, slower." },
] as const;
export type QualityKey = (typeof QUALITIES)[number]["key"];

export interface ExportItem { key: string; recipient: RenderRecipient }
export interface Failure { key: string; name: string; serial: string; reason: string }
export interface Progress { done: number; total: number; current: string; failed: number }

export const DEFAULT_PATTERN = "{serial} - {recipientName}";
export const PATTERN_TOKENS = [["{recipientName}", "Name"], ["{serial}", "Certificate ID"], ["{paperId}", "Paper ID"], ["{role}", "Role"]] as const;

/** A safe file name (no extension) from a pattern; `taken` keeps names unique within one export. */
export function fileNameFor(pattern: string, r: RenderRecipient, taken: Set<string>): string {
  const values: Record<string, string> = { recipientName: r.name, serial: r.serial, paperId: r.paperId ?? "", role: r.roleLabel ?? "" };
  let name = pattern.replace(/\{\s*(\w+)\s*\}/g, (_m, t: string) => values[t] ?? "");
  name = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 100)
    .trim();
  if (!name) name = r.serial || "certificate";
  let unique = name, n = 2;
  while (taken.has(unique.toLowerCase())) unique = `${name}-${n++}`;
  taken.add(unique.toLowerCase());
  return unique;
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Draws certificates one by one and keeps what was drawn, so a retry only redoes the failures. */
export class BatchRenderer {
  readonly done = new Map<string, Rendered>();
  private session = createRenderSession();
  constructor(private readonly design: Design, private readonly conference: RenderConference, private readonly scale: number, private readonly format: "png" | "jpeg") {}

  async run(items: ExportItem[], onProgress: (p: Progress) => void, signal: AbortSignal): Promise<Failure[]> {
    const failures: Failure[] = [];
    const todo = items.filter((i) => !this.done.has(i.key));
    const already = items.length - todo.length;
    for (let i = 0; i < todo.length; i++) {
      if (signal.aborted) break;
      const item = todo[i];
      onProgress({ done: already + i, total: items.length, current: item.recipient.name, failed: failures.length });
      try {
        this.done.set(item.key, await renderCertificate({ design: this.design, recipient: item.recipient, conference: this.conference }, { scale: this.scale, format: this.format, quality: 0.92 }, this.session));
      } catch (e) {
        failures.push({ key: item.key, name: item.recipient.name, serial: item.recipient.serial, reason: e instanceof Error ? e.message : "The certificate could not be drawn." });
      }
      await tick();
    }
    onProgress({ done: items.length - failures.length, total: items.length, current: "", failed: failures.length });
    return failures;
  }
}

export interface BuiltFile { blob: Blob; filename: string; count: number }

/** The file for the certificates drawn so far, in the order of `items` (those that failed are left out). */
export async function buildFile(format: ExportFormat, items: ExportItem[], rendered: Map<string, Rendered>, pattern: string, baseName: string, signal?: AbortSignal, paper?: PaperKey | PaperSpec): Promise<BuiltFile> {
  const ready = items.filter((i) => rendered.has(i.key));
  if (ready.length === 0) throw new Error("There is nothing to save yet.");
  const { jsPDF } = await import("jspdf");
  const pdfFormat = (r: Rendered) => (r.mime === "image/png" ? "PNG" : "JPEG");
  // The sheet is given in portrait order (short side first); jsPDF turns it for a landscape page. The picture is fitted whole and centred.
  // Each certificate goes on the paper it was designed for, unless a paper was chosen for the file. The sheet is given in portrait order (short side first);
  // jsPDF turns it for a landscape page.
  const sheetFor = (r: Rendered): [number, number] => { const s = paper ? (typeof paper === "string" ? specOf(paper) : paper) : r.paper; return [s.w, s.h]; };
  const addPage = (pdf: InstanceType<typeof jsPDF>, r: Rendered, first: boolean) => {
    const orientation = r.orientation === "portrait" ? "p" : "l";
    if (!first) pdf.addPage(sheetFor(r), orientation);
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const ratio = r.width / r.height;
    let w = pw, h = pw / ratio;
    if (h > ph) { h = ph; w = ph * ratio; }
    pdf.addImage(r.bytes, pdfFormat(r), (pw - w) / 2, (ph - h) / 2, w, h, undefined, "FAST");
  };
  const newPdf = (r: Rendered, title: string) => {
    const pdf = new jsPDF({ orientation: r.orientation === "portrait" ? "p" : "l", unit: "mm", format: sheetFor(r), compress: true });
    pdf.setProperties({ title });
    return pdf;
  };

  if (format === "pdf-multi") {
    const first = rendered.get(ready[0].key)!;
    const pdf = newPdf(first, baseName);
    ready.forEach((item, i) => { addPage(pdf, rendered.get(item.key)!, i === 0); });
    return { blob: pdf.output("blob"), filename: `${sanitizeBase(baseName)}.pdf`, count: ready.length };
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const taken = new Set<string>();
  for (const item of ready) {
    if (signal?.aborted) break;
    const r = rendered.get(item.key)!;
    const name = fileNameFor(pattern, item.recipient, taken);
    if (format === "zip-png") zip.file(`${name}.png`, r.bytes);
    else { const pdf = newPdf(r, name); addPage(pdf, r, true); zip.file(`${name}.pdf`, pdf.output("arraybuffer")); }
    await tick();
  }
  return { blob: await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } }), filename: `${sanitizeBase(baseName)}.zip`, count: ready.length };
}

const sanitizeBase = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "certificates";

/** Hands a file to the browser's download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A CSV a spreadsheet opens correctly (UTF-8 with a BOM, every field quoted). */
export function toCsv(headers: string[], rows: string[][]): Blob {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers, ...rows].map((r) => r.map(cell).join(","));
  return new Blob(["﻿", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}
