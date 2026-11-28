import { getPdfjs } from "@/lib/auto-check";
import { COUNTRY_CODES } from "@/lib/country-codes";
import { inferAuthorCountry } from "@/lib/country-inference";
import { extractPaperFields } from "@/services/paper-ai";

/* Reading a paper's PDF for New Submission's "Auto-fill from your paper" (the prototype's src/shared/paperExtraction.js).
   Two ways, as there:
   - AI ("Smart Fill"): the first pages' text goes to Claude through this app's proxy (`extract-paper`), which tells names from affiliations
     and reads the country, e-mail and corresponding author of each one.
   - Basic guess (rules over the same text, no network): used when the AI is not available, so the form is still filled as far as it can be.
   The person always checks the result: nothing is saved until they press Submit. */

export interface FilledAuthor { name: string; email: string; affiliation: string; department: string; city: string; country: string; corresponding: boolean; countrySource: string }
export interface FilledPaper { title: string; abstract: string; keywords: string[]; authors: FilledAuthor[]; how: "ai" | "basic" }

const WORLD: Array<[string, string]> = Object.entries(COUNTRY_CODES);

/** The first three pages as plain text, a line per row of the page (pdf.js hands back loose fragments). */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await getPdfjs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let full = "";
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let lastY: number | null = null;
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { full += `${line.trim()}\n`; line = ""; }
      line += `${item.str} `;
      lastY = y;
    }
    full += `${line.trim()}\n\n`;
  }
  return full.trim();
}

const AFFILIATION_HINTS = /(university|institute|department|dept\.|college|school|lab(oratory)?|centre|center|ltd\.?|inc\.?|corp\.?|faculty)/i;
interface Raw { name: string; email: string; affiliation: string; department: string; city: string; country: string; corresponding: boolean }

function splitAuthorBlock(block: string): Raw[] {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  // The names are nearly always the first line ("A, B, C"); the rest is affiliation text, a shared guess for everyone found.
  const affiliation = lines.slice(1).join(", ");
  return lines[0].split(/,| and | & /i).map((s) => s.trim()).filter(Boolean)
    .filter((s) => !AFFILIATION_HINTS.test(s) && !/\d/.test(s) && s.split(/\s+/).length <= 4)
    .map((name) => ({ name, email: "", affiliation, department: "", city: "", country: "", corresponding: false })); // a guess never picks the corresponding author
}

/** The basic guess: regular expressions over the paper's first pages. */
export function parsePaperRuleBased(text: string): { title: string; abstract: string; keywords: string[]; authors: Raw[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines.find((l) => l.length > 12 && !/^\d+$/.test(l)) || lines[0] || "";
  const abs = text.match(/abstract[\s:.\-–—]*\n?([\s\S]*?)(?=\n\s*(keywords|index terms|1\.|i\.|introduction)\b)/i);
  const abstract = abs ? abs[1].replace(/\s*\n\s*/g, " ").trim() : "";
  const kw = text.match(/(?:keywords|index terms)[\s:.\-–—]*([^\n]+)/i);
  const keywords = kw ? kw[1].split(/[,;]/).map((k) => k.trim()).filter(Boolean) : [];
  const titleAt = lines.indexOf(title);
  const absAt = lines.findIndex((l) => /^abstract\b/i.test(l));
  const block = titleAt >= 0 && absAt > titleAt ? lines.slice(titleAt + 1, absAt).join("\n") : "";
  // Emails printed above the abstract, in author order.
  const head = absAt > 0 ? lines.slice(0, absAt).join("\n") : text.slice(0, 2500);
  const emails = [...new Set(head.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || [])];
  return { title, abstract, keywords, authors: splitAuthorBlock(block).map((a, i) => ({ ...a, email: emails[i] || "" })) };
}

/** Reads the PDF and returns what could be filled in. Throws only when the PDF itself can't be read. */
export async function fillFromPdf(file: File, onStage?: (stage: "reading" | "ai" | "filling") => void): Promise<FilledPaper> {
  onStage?.("reading");
  const text = await extractPdfText(file);
  if (text.replace(/\s+/g, "").length < 40) throw new Error("No selectable text in that PDF.");
  onStage?.("ai");
  const ai = await extractPaperFields(text);
  const picked = ai ? { ...ai, how: "ai" as const } : { ...parsePaperRuleBased(text), how: "basic" as const };
  onStage?.("filling");
  // Papers often leave the country out: work it out from the institution, city or e-mail.
  const authors = picked.authors.map((a) => { const c = inferAuthorCountry(a, WORLD); return { ...a, country: c.country, countrySource: c.source }; });
  return { title: picked.title, abstract: picked.abstract, keywords: picked.keywords, authors, how: picked.how };
}
