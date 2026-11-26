"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, RotateCcw } from "lucide-react";
import { CertModal } from "../components";
import { inputClass, inputStyle } from "../form-styles";
import type { CertificateDesign } from "../data";
import { BatchRenderer, DEFAULT_PATTERN, FORMAT_LABELS, PATTERN_TOKENS, QUALITIES, buildFile, fileNameFor, saveBlob, type BuiltFile, type ExportFormat, type ExportItem, type Failure, type Progress, type QualityKey } from "./export-files";
import type { RenderConference } from "./render-image";
import { A4_SPEC, CUSTOM_KEY, PAPER_GROUPS, labelOf, paperOf, type PaperKey } from "../paper";
import { docPaper } from "../studio/model";
import { CustomSizeFields } from "../paper-menu";

/* "Download all": the issued certificates as one PDF or a ZIP. It draws them one at a time with a progress bar, tells which ones failed and why,
   and a retry redraws only those. Nothing leaves the browser: the files are built here. */

const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function DownloadDialog({ cert, conference, items, onClose }: { cert: CertificateDesign; conference: RenderConference & { acronym?: string }; items: ExportItem[]; onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>("pdf-multi");
  const [quality, setQuality] = useState<QualityKey>("standard");
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  // "design": every certificate on the paper it was designed for (the default); otherwise one paper for the whole file
  const [paper, setPaper] = useState<PaperKey | "design">("design");
  const own = cert.design.studio ? docPaper(cert.design.studio) : A4_SPEC;
  const [, setPaperTick] = useState(0); // a changed custom size re-renders the note
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState<Progress>({ done: 0, total: items.length, current: "", failed: 0 });
  const [failures, setFailures] = useState<Failure[]>([]);
  const [built, setBuilt] = useState<BuiltFile | null>(null);
  const [error, setError] = useState("");
  const renderer = useRef<{ r: BatchRenderer; key: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const scale = QUALITIES.find((q) => q.key === quality)!.scale;
  const raster = format === "zip-png" ? "png" : "jpeg";
  const baseName = `${conference.acronym || "certificates"} - ${cert.name}`;
  const names = useMemo(() => { const taken = new Set<string>(); return items.slice(0, 3).map((i) => fileNameFor(pattern, i.recipient, taken)); }, [items, pattern]);
  const running = phase === "running";

  /** Draws what is not drawn yet (all of it, or only the failures on a retry), then builds and saves the file. */
  const start = async () => {
    setError(""); setPhase("running"); setBuilt(null);
    const key = `${scale}:${raster}`;
    if (renderer.current?.key !== key) renderer.current = { r: new BatchRenderer(cert.design, conference, scale, raster), key };
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const failed = await renderer.current.r.run(items, setProgress, ctl.signal);
      setFailures(failed);
      if (ctl.signal.aborted) { setPhase("idle"); return; }
      const file = await buildFile(format, items, renderer.current.r.done, pattern, baseName, ctl.signal, paper === "design" ? undefined : paper);
      setBuilt(file);
      saveBlob(file.blob, file.filename);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while making the file.");
      setPhase("idle");
    }
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const radio = (on: boolean) => (on ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)" } : { border: "1px solid var(--border)", background: "#fff" });

  return (
    <CertModal
      title="Download the certificates"
      subtitle={`${items.length} ${items.length === 1 ? "certificate" : "certificates"} · made in your browser, nothing is uploaded`}
      onClose={() => { abort.current?.abort(); onClose(); }}
      maxWidth="max-w-2xl"
      footer={
        <>
          {running && <button onClick={() => abort.current?.abort()} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white cursor-pointer">Stop</button>}
          <div className="flex-1" />
          <button onClick={() => { abort.current?.abort(); onClose(); }} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] cursor-pointer">{phase === "done" ? "Close" : "Cancel"}</button>
          <button onClick={() => void start()} disabled={running || items.length === 0} style={{ background: "var(--gradient-primary)" }} className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed">
            <Download size={15} /> {running ? "Making the file…" : phase === "done" ? "Make it again" : "Make the file"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset disabled={running} className="space-y-2">
          <legend style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">FORMAT</legend>
          {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
            <label key={f} style={radio(format === f)} className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer">
              <input type="radio" name="fmt" checked={format === f} onChange={() => { setFormat(f); setBuilt(null); }} style={{ accentColor: "var(--primary)" }} className="mt-1" />
              <span><span style={{ color: "var(--navy)" }} className="text-sm font-bold block">{FORMAT_LABELS[f].label}</span><span style={{ color: "var(--ink-muted)" }} className="text-xs">{FORMAT_LABELS[f].note}</span></span>
            </label>
          ))}
        </fieldset>

        <fieldset disabled={running} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <legend style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">QUALITY</legend>
          {QUALITIES.map((q) => (
            <label key={q.key} style={radio(quality === q.key)} className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer">
              <input type="radio" name="quality" checked={quality === q.key} onChange={() => { setQuality(q.key); setBuilt(null); }} style={{ accentColor: "var(--primary)" }} className="mt-1" />
              <span><span style={{ color: "var(--navy)" }} className="text-sm font-bold block">{q.label}</span><span style={{ color: "var(--ink-muted)" }} className="text-xs">{q.note}</span></span>
            </label>
          ))}
        </fieldset>

        {format !== "zip-png" && (
          <div>
            <label htmlFor="dl-paper" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Paper size of the PDF</label>
            <select id="dl-paper" value={paper} disabled={running} onChange={(e) => { setPaper(e.target.value as PaperKey | "design"); setBuilt(null); }} style={inputStyle} className={inputClass}>
              <option value="design">Same as the certificate ({labelOf(own)}, {own.w} × {own.h} mm)</option>
              {PAPER_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.papers.map((p) => <option key={p.key} value={p.key}>{p.label} ({p.note})</option>)}</optgroup>)}
              <option value={CUSTOM_KEY}>Custom size…</option>
            </select>
            {paper === CUSTOM_KEY && <div className="mt-2"><CustomSizeFields compact onUse={() => { setBuilt(null); setPaperTick((n) => n + 1); }} /></div>}
            <p style={{ color: "var(--ink-muted)" }} className="text-[11px] mt-1">{paper === "design" ? "Each certificate fills its own paper exactly." : `Fitted whole and centred on ${paper === CUSTOM_KEY ? `the custom sheet (${paperOf(paper).note})` : paperOf(paper).label}; the extra room stays blank.`}</p>
          </div>
        )}

        {format !== "pdf-multi" && (
          <div>
            <label htmlFor="dl-pattern" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">File names</label>
            <input id="dl-pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} disabled={running} style={inputStyle} className={inputClass} />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {PATTERN_TOKENS.map(([token, label]) => <button key={token} type="button" disabled={running} onClick={() => setPattern((p) => `${p}${p && !p.endsWith(" ") ? " " : ""}${token}`)} style={{ border: "1px solid var(--border)", background: "var(--canvas)", color: "var(--ink-soft)" }} className="px-2.5 py-1 rounded-full text-[11.5px] font-medium cursor-pointer">+ {label}</button>)}
            </div>
            <p style={{ color: "var(--ink-muted)" }} className="text-[11px] mt-2 truncate">e.g. {names.map((n) => `${n}.${format === "zip-png" ? "png" : "pdf"}`).join("  ·  ")}</p>
          </div>
        )}

        {(running || phase === "done") && (
          <div role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span style={{ color: "var(--ink-soft)" }} className="font-semibold truncate pr-3">{running ? `Drawing ${progress.done + 1 > progress.total ? progress.total : progress.done + 1} of ${progress.total}${progress.current ? ` · ${progress.current}` : ""}` : `${built?.count ?? 0} of ${items.length} drawn`}</span>
              <span style={{ color: "var(--ink-muted)" }}>{pct}%</span>
            </div>
            <div style={{ background: "var(--muted)" }} className="h-2.5 rounded-full overflow-hidden"><div style={{ width: `${pct}%`, background: "var(--primary)", transition: "width .2s" }} className="h-full rounded-full" /></div>
          </div>
        )}

        {phase === "done" && built && (
          <p style={{ color: "var(--success)" }} className="text-sm font-semibold flex items-center gap-2"><Check size={16} /> Saved {built.filename} · {built.count} {built.count === 1 ? "certificate" : "certificates"} · {size(built.blob.size)}
            <button onClick={() => saveBlob(built.blob, built.filename)} style={{ color: "var(--primary)" }} className="text-xs font-bold hover:underline cursor-pointer ml-2">Save again</button></p>
        )}
        {error && <p role="alert" style={{ color: "var(--danger)" }} className="text-sm font-semibold">{error}</p>}

        {failures.length > 0 && !running && (
          <div style={{ border: "1px solid var(--warning-border)", background: "var(--warning-soft)" }} className="rounded-xl p-3.5">
            <p style={{ color: "var(--warning)" }} className="text-sm font-bold flex items-center gap-2"><AlertTriangle size={15} /> {failures.length} {failures.length === 1 ? "certificate" : "certificates"} could not be made{phase === "done" ? " and are not in the file" : ""}</p>
            <ul className="mt-2 space-y-1 max-h-32 overflow-auto">
              {failures.map((f) => <li key={f.key} style={{ color: "var(--ink-soft)" }} className="text-xs"><strong>{f.name}</strong> ({f.serial}): {f.reason}</li>)}
            </ul>
            <button onClick={() => void start()} style={{ border: "1px solid var(--warning-border)", color: "var(--warning)" }} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white cursor-pointer"><RotateCcw size={12} /> Try those again</button>
          </div>
        )}
      </div>
    </CertModal>
  );
}
