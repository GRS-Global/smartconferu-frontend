/* Reads a spreadsheet the chair uploads: CSV / TSV / text (comma, semicolon or tab separated) and Excel .xlsx. Nothing here talks to the server;
   the file is read in the browser and only the people the chair confirms are saved. */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;

export interface TableData { headers: string[]; rows: string[][]; source: "csv" | "xlsx"; sheetName?: string; truncated: boolean }

export class TableFileError extends Error {}

/** RFC 4180-style parsing: quoted fields, doubled quotes, line breaks inside quotes, a BOM, any of ',' ';' '\t' as the separator. */
export function parseDelimited(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter = [",", ";", "\t"].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  // Blank lines (and a trailing one) are not people.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const colIndex = (ref: string): number => {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "A";
  return [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
};

/** The first sheet of an .xlsx (a zip of XML files): shared strings, inline strings and numbers; formulas are read as the value Excel stored. */
export async function parseXlsx(buffer: ArrayBuffer): Promise<{ rows: string[][]; sheetName: string }> {
  const { default: JSZip } = await import("jszip");
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try { zip = await JSZip.loadAsync(buffer); } catch { throw new TableFileError("That does not look like an Excel (.xlsx) file."); }
  const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
  const read = async (path: string) => { const f = zip.file(path); return f ? parse(await f.async("string")) : null; };

  const workbook = await read("xl/workbook.xml");
  const sheet0 = workbook?.getElementsByTagName("sheet")[0];
  const sheetName = sheet0?.getAttribute("name") ?? "Sheet1";
  // The first sheet's file: via its relationship id when there is one, else the conventional name.
  let target = "xl/worksheets/sheet1.xml";
  const rid = sheet0?.getAttribute("r:id") ?? sheet0?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (rid && rels) {
    const rel = [...rels.getElementsByTagName("Relationship")].find((r) => r.getAttribute("Id") === rid);
    const t = rel?.getAttribute("Target");
    if (t) target = t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.?\//, "")}`;
  }
  const sheet = await read(target);
  if (!sheet) throw new TableFileError("That Excel file has no readable sheet.");

  const shared: string[] = [];
  const sst = await read("xl/sharedStrings.xml");
  sst?.querySelectorAll("si").forEach((si) => { shared.push([...si.getElementsByTagName("t")].map((t) => t.textContent ?? "").join("")); });

  const rows: string[][] = [];
  sheet.querySelectorAll("sheetData > row").forEach((r) => {
    const out: string[] = [];
    r.querySelectorAll(":scope > c").forEach((c) => {
      const at = colIndex(c.getAttribute("r") ?? "A1");
      const type = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let value = v;
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = [...c.getElementsByTagName("t")].map((t) => t.textContent ?? "").join("");
      else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
      while (out.length < at) out.push("");
      out[at] = value;
    });
    if (out.some((x) => x.trim() !== "")) rows.push(out);
  });
  return { rows, sheetName };
}

/** Reads a chosen file into headers + rows (the first row is taken as the headers; the mapping step can say otherwise). */
export async function readTableFile(file: File): Promise<TableData> {
  if (file.size === 0) throw new TableFileError("That file is empty.");
  if (file.size > MAX_FILE_BYTES) throw new TableFileError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please use one under ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  const name = file.name.toLowerCase();
  let rows: string[][];
  let source: TableData["source"] = "csv";
  let sheetName: string | undefined;
  if (name.endsWith(".xlsx")) {
    ({ rows, sheetName } = await parseXlsx(await file.arrayBuffer()));
    source = "xlsx";
  } else if (name.endsWith(".xls")) {
    throw new TableFileError("Old Excel files (.xls) can't be read. In Excel use Save As → .xlsx or CSV.");
  } else if (/\.(csv|tsv|txt)$/.test(name) || file.type.startsWith("text/")) {
    rows = parseDelimited(await file.text());
  } else {
    throw new TableFileError("Please choose a CSV, TSV or Excel (.xlsx) file.");
  }
  if (rows.length === 0) throw new TableFileError("That file has no rows.");
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim());
  const [head, ...body] = rows.map(pad);
  const truncated = body.length > MAX_ROWS;
  return { headers: head.map((h, i) => h || `Column ${i + 1}`), rows: body.slice(0, MAX_ROWS), source, sheetName, truncated };
}
