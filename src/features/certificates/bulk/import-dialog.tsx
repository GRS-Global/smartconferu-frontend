"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { AlertTriangle, FileSpreadsheet, Upload } from "lucide-react";
import { CertModal } from "../components";
import { selectClass, selectStyle } from "../form-styles";
import type { ManualPerson } from "../data";
import { MAX_FILE_BYTES, MAX_ROWS, readTableFile, TableFileError, type TableData } from "./table-file";
import { IMPORT_FIELDS, PROBLEM_TEXT, autoMap, buildRows, importable, type ImportFieldKey, type ImportRow } from "./import-map";
import { saveBlob, toCsv } from "./export-files";

/* Add many people from a spreadsheet: choose the file, say which column is which (matched by the headers where it can be), check every row,
   and only then add them. Nothing is saved until "Add". They join the list the chair already has, next to "Add someone". */

type Step = "file" | "map" | "review";
type PersonInput = Omit<ManualPerson, "key">;
const SAMPLE_HEADERS = IMPORT_FIELDS.map((f) => f.label);
const SAMPLE_ROW = ["Dr. Anika Rao", "anika@example.edu", "IIT Bombay", "Presenting author", "SUB-014", "Federated Learning for Edge Diagnostics"];

export function ImportDialog({ existing, usedFields, onClose, onImport }: {
  existing: Array<{ name: string; email: string }>;
  /** The person fields the certificate's text uses (e.g. "paperTitle"), to warn when no column is chosen for one. */
  usedFields: string[];
  onClose: () => void;
  onImport: (people: PersonInput[]) => void;
}) {
  const [step, setStep] = useState<Step>("file");
  const [table, setTable] = useState<TableData | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hasHeader, setHasHeader] = useState(true);
  const [map, setMap] = useState<Record<ImportFieldKey, number> | null>(null);
  const [auto, setAuto] = useState<Record<ImportFieldKey, boolean>>({} as Record<ImportFieldKey, boolean>);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const input = useRef<HTMLInputElement>(null);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const t = await readTableFile(file);
      const m = autoMap(t.headers);
      setTable(t); setFileName(file.name); setMap(m); setHasHeader(true);
      setAuto(Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, m[f.key] >= 0])) as Record<ImportFieldKey, boolean>);
      setStep("map");
    } catch (e) {
      setError(e instanceof TableFileError ? e.message : "That file could not be read.");
    } finally { setBusy(false); }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void load(e.dataTransfer.files[0]); };

  // With "first row is a header" off, that row is data and the columns are called Column 1, 2…
  const effective = useMemo(() => {
    if (!table) return null;
    if (hasHeader) return table;
    return { ...table, headers: table.headers.map((_, i) => `Column ${i + 1}`), rows: [table.headers, ...table.rows] };
  }, [table, hasHeader]);

  const rows: ImportRow[] = useMemo(() => (effective && map ? buildRows(effective.rows, map, existing) : []), [effective, map, existing]);
  const ready = rows.filter((r) => importable(r, skipDuplicates));
  const count = (p: ImportRow["problems"][number]) => rows.filter((r) => r.problems.includes(p)).length;
  const unmappedUsed = useMemo(() => (map ? IMPORT_FIELDS.filter((f) => usedFields.includes(f.key) && f.key !== "name" && map[f.key] < 0) : []), [map, usedFields]);

  const setField = (key: ImportFieldKey, col: number) => { setMap((m) => (m ? { ...m, [key]: col } : m)); setAuto((a) => ({ ...a, [key]: false })); };
  const nameMissing = !map || map.name < 0;

  const footer = (
    <>
      {step !== "file" && <button onClick={() => setStep(step === "review" ? "map" : "file")} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] transition-colors cursor-pointer">Back</button>}
      <div className="flex-1" />
      <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] transition-colors cursor-pointer">Cancel</button>
      {step === "map" && <button onClick={() => setStep("review")} disabled={nameMissing} style={{ background: "var(--primary)" }} className="px-5 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed">Review {rows.length} rows</button>}
      {step === "review" && <button onClick={() => onImport(ready.map((r) => r.person))} disabled={ready.length === 0} style={{ background: "var(--gradient-primary)" }} className="px-5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed">Add {ready.length} {ready.length === 1 ? "person" : "people"}</button>}
    </>
  );

  return (
    <CertModal
      title="Import people from a file"
      subtitle={step === "file" ? "Step 1 of 3 · Choose a spreadsheet" : step === "map" ? "Step 2 of 3 · Say which column is which" : "Step 3 of 3 · Check the rows, then add them"}
      onClose={onClose} maxWidth="max-w-4xl" footer={footer}
    >
      {step === "file" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
            style={{ border: `2px dashed ${dragging ? "var(--primary)" : "var(--border)"}`, background: dragging ? "var(--primary-soft)" : "var(--canvas)" }}
            className="rounded-2xl py-12 px-6 text-center"
          >
            <FileSpreadsheet size={34} style={{ color: "var(--ink-faint)" }} className="mx-auto" />
            <p style={{ color: "var(--navy)" }} className="text-sm font-bold mt-3">{busy ? "Reading the file…" : "Drop a CSV or Excel file here"}</p>
            <p style={{ color: "var(--ink-muted)" }} className="text-xs mt-1">or</p>
            <button onClick={() => input.current?.click()} disabled={busy} style={{ background: "var(--primary)" }} className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 cursor-pointer"><Upload size={14} /> Choose a file</button>
            <input ref={input} type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv" aria-label="Choose a spreadsheet file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void load(f); }} />
          </div>
          {error && <p role="alert" style={{ color: "var(--danger-ink)" }} className="text-sm font-semibold">{error}</p>}
          <ul style={{ color: "var(--ink-muted)" }} className="text-xs leading-relaxed list-disc pl-5 space-y-1">
            <li>CSV (comma, semicolon or tab) or Excel <strong>.xlsx</strong>; the first sheet is read. Up to {MAX_ROWS.toLocaleString()} rows and {MAX_FILE_BYTES / 1024 / 1024} MB.</li>
            <li>The first row should be the column names. They are matched to the fields automatically; you can change any of them in the next step.</li>
            <li>Only a name is required. Without an email address a person can be added but not sent anything.</li>
          </ul>
          <button onClick={() => saveBlob(toCsv(SAMPLE_HEADERS, [SAMPLE_ROW]), "certificate-recipients-sample.csv")} style={{ color: "var(--primary)" }} className="text-xs font-bold hover:underline cursor-pointer">Download a sample file</button>
        </div>
      )}

      {step === "map" && effective && map && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ color: "var(--navy)" }} className="text-sm font-bold">{fileName}</span>
            <span style={{ color: "var(--ink-muted)" }} className="text-xs">{effective.rows.length} rows{effective.sheetName ? ` · sheet “${effective.sheetName}”` : ""}</span>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer ml-auto" style={{ color: "var(--ink-soft)" }}>
              <input type="checkbox" checked={hasHeader} onChange={(e) => { setHasHeader(e.target.checked); setMap(autoMap(e.target.checked ? table!.headers : table!.headers.map((_, i) => `Column ${i + 1}`))); setAuto({} as Record<ImportFieldKey, boolean>); }} style={{ accentColor: "var(--primary)" }} /> First row has the column names
            </label>
          </div>
          {table?.truncated && <p role="status" style={{ color: "var(--warning-ink)" }} className="text-xs font-semibold">Only the first {MAX_ROWS.toLocaleString()} rows are used.</p>}

          <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
            {IMPORT_FIELDS.map((f, i) => (
              <div key={f.key} style={{ borderTop: i ? "1px solid var(--muted)" : "none" }} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:gap-4 items-center px-4 py-3">
                <div>
                  <label htmlFor={`map-${f.key}`} style={{ color: "var(--navy)" }} className="text-sm font-bold">{f.label}{f.required && <span style={{ color: "var(--danger-ink)" }}> *</span>}</label>
                  <div style={{ color: "var(--ink-muted)" }} className="text-[11px]">{f.hint}</div>
                </div>
                <select id={`map-${f.key}`} value={map[f.key]} onChange={(e) => setField(f.key, Number(e.target.value))} style={selectStyle} className={`${selectClass} w-full`}>
                  <option value={-1}>— none —</option>
                  {effective.headers.map((h, ci) => <option key={ci} value={ci}>{h}</option>)}
                </select>
                <span style={{ color: auto[f.key] ? "var(--success-ink)" : "var(--ink-faint)" }} className="text-[11px] font-semibold w-24 sm:text-right">{map[f.key] >= 0 ? (auto[f.key] ? "Matched" : "Chosen") : f.required ? "Required" : "Optional"}</span>
              </div>
            ))}
          </div>

          {unmappedUsed.length > 0 && (
            <p role="status" style={{ color: "var(--warning-ink)" }} className="text-xs font-semibold flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> This certificate prints {unmappedUsed.map((f) => f.label.toLowerCase()).join(" and ")}, but no column is chosen for it, so it will be empty.</p>
          )}

          <div>
            <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">FIRST ROWS OF YOUR FILE</div>
            <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-x-auto">
              <table className="text-xs w-full" style={{ minWidth: 520 }}>
                <thead><tr style={{ background: "var(--canvas)" }}>{effective.headers.map((h, i) => <th key={i} style={{ color: "var(--ink-muted)" }} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{effective.rows.slice(0, 4).map((r, ri) => <tr key={ri} style={{ borderTop: "1px solid var(--muted)" }}>{effective.headers.map((_, ci) => <td key={ci} style={{ color: "var(--ink)" }} className="px-3 py-1.5 whitespace-nowrap max-w-[220px] truncate">{r[ci] ?? ""}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="px-3 py-1.5 rounded-full">{ready.length} will be added</span>
            {count("no-name") > 0 && <span style={{ background: "var(--danger-soft)", color: "var(--danger-ink)" }} className="px-3 py-1.5 rounded-full">{count("no-name")} skipped: no name</span>}
            {(count("duplicate-in-file") + count("duplicate-in-list")) > 0 && <span style={{ background: "var(--warning-soft)", color: "var(--warning-ink)" }} className="px-3 py-1.5 rounded-full">{count("duplicate-in-file") + count("duplicate-in-list")} repeated</span>}
            {count("no-email") > 0 && <span style={{ background: "var(--warning-soft)", color: "var(--warning-ink)" }} className="px-3 py-1.5 rounded-full">{count("no-email")} without an email</span>}
            {count("bad-email") > 0 && <span style={{ background: "var(--warning-soft)", color: "var(--warning-ink)" }} className="px-3 py-1.5 rounded-full">{count("bad-email")} with a wrong-looking email</span>}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} style={{ accentColor: "var(--primary)" }} /> Skip people who are already on this list or appear twice in the file
          </label>
          <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-auto max-h-[46vh]">
            <table className="text-xs w-full" style={{ minWidth: 560 }}>
              <thead className="sticky top-0"><tr style={{ background: "var(--canvas)" }}>{["Row", "Name", "Email", "Role", "Paper"].map((h) => <th key={h} style={{ color: "var(--ink-muted)" }} className="text-left font-semibold px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 200).map((r) => {
                  const skipped = !importable(r, skipDuplicates);
                  return (
                    <tr key={r.line} style={{ borderTop: "1px solid var(--muted)", opacity: skipped ? 0.5 : 1, background: r.problems.some((p) => p !== "no-email") ? "var(--warning-soft)" : undefined }}>
                      <td style={{ color: "var(--ink-faint)" }} className="px-3 py-1.5 align-top">{r.line}</td>
                      <td style={{ color: "var(--ink)" }} className="px-3 py-1.5 font-medium align-top">
                        <span className="block max-w-[260px] break-words">{r.person.name || "—"}</span>
                        <span style={{ color: r.problems.length ? "var(--warning-ink)" : "var(--success-ink)" }} className="block text-[10.5px] font-semibold mt-0.5">{r.problems.length ? r.problems.map((p) => PROBLEM_TEXT[p]).join("; ") : "OK"}</span>
                      </td>
                      <td style={{ color: "var(--ink-muted)" }} className="px-3 py-1.5 align-top whitespace-nowrap">{r.person.email || "—"}</td>
                      <td style={{ color: "var(--ink-muted)" }} className="px-3 py-1.5 align-top whitespace-nowrap">{r.person.roleLabel || "—"}</td>
                      <td style={{ color: "var(--ink-muted)" }} className="px-3 py-1.5 align-top max-w-[200px] truncate">{r.person.paperTitle || r.person.paperId || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <p style={{ color: "var(--ink-muted)" }} className="text-xs">Showing the first 200 of {rows.length} rows; all of them are checked and added.</p>}
        </div>
      )}
    </CertModal>
  );
}
