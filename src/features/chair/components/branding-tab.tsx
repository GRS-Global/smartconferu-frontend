"use client";

import { AlertTriangle, Camera, Check, Download, Eye, FileCheck, FileText, FileUp, Layers, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { getChairService } from "@/services/chair";
import { ConferenceMonogram } from "@/features/workspace/components/conference-shell";
import { STICKY_SIDE_LG } from "@/components/layout/sticky-side";

/* Conference Details › Branding (the prototype's Change Logo, embedded): the conference logo, shown beside its name on the Call for Papers, the submission pages and
   the emails. Drag a file onto the box or browse; nothing is saved until "Save logo" (Discard goes back to the saved one, Remove takes it off). The logo is stored in the
   public storage folder of the conference (`conferences.logo_path`); until there is one the monogram is used. The previews show where it will appear. */

// What the server takes for a logo (PNG, JPEG, WebP); a GIF or SVG would be refused only after the upload.
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;
const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
// A checkerboard, so the edges of a transparent PNG / SVG are visible.
const CHECKER = { backgroundColor: "#FFFFFF", backgroundImage: "linear-gradient(45deg, #F1F5F9 25%, transparent 25%), linear-gradient(-45deg, #F1F5F9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #F1F5F9 75%), linear-gradient(-45deg, transparent 75%, #F1F5F9 75%)", backgroundSize: "16px 16px", backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0" } as const;
const size = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

interface Pending { url: string; name: string; size: number | null; file: File | null }

export function BrandingTab({ slug, acronym, name, logoUrl, onSaved, locked }: { slug: string; acronym: string; name: string; logoUrl: string; onSaved: (url: string) => void; /** Why the logo can't be changed right now (it is then shown read-only). */ locked?: string }) {
  const [saved, setSaved] = useState(logoUrl);
  const [pending, setPending] = useState<Pending | null>(logoUrl ? { url: logoUrl, name: "Current logo", size: null, file: null } : null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const handle = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { setError("Please choose a JPEG, PNG or WebP image."); return; }
    if (file.size > MAX_BYTES) { setError("That image is too large — please choose one under 2MB."); return; }
    setError(""); setDone(false);
    const reader = new FileReader();
    reader.onload = () => setPending({ url: String(reader.result), name: file.name, size: file.size, file });
    reader.readAsDataURL(file);
  };
  const dirty = (pending?.url ?? "") !== saved;
  const save = async () => {
    setBusy(true); setError("");
    try {
      const url = await (await getChairService()).saveLogo(slug, pending?.file ?? null);
      // Saving what is already shown (no new file, nothing removed) never reaches here: the button is off.
      setSaved(url); setPending(url ? { url, name: pending?.name ?? "Current logo", size: pending?.size ?? null, file: null } : null); onSaved(url); setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the logo."); } finally { setBusy(false); }
  };
  const discard = () => { setPending(saved ? { url: saved, name: "Current logo", size: null, file: null } : null); setError(""); setDone(false); };
  const open = () => input.current?.click();
  // The logo tile of the previews: the upload, or the monogram until there is one.
  // eslint-disable-next-line @next/next/no-img-element
  const mark = (px: number, onTint = false) => pending ? <div style={{ width: px, height: px, border: "1px solid var(--border)" }} className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1"><img src={pending.url} alt="" className="max-h-full max-w-full object-contain" /></div> : <ConferenceMonogram acronym={acronym} size={px} onTint={onTint} />;

  return (
    <div className="grid max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
        <div className="p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Camera size={16} aria-hidden="true" /></div>
            <div className="min-w-0"><h3 className="text-base font-bold leading-snug text-navy">Conference logo</h3><p className="mt-0.5 text-xs text-ink-faint">Shown beside {acronym}&apos;s name on the CFP, submission pages and emails.</p></div>
          </div>
          <input ref={input} disabled={Boolean(locked)} type="file" accept={ACCEPT.join(",")} className="hidden" aria-label="Choose a logo" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="grid items-stretch gap-5 sm:grid-cols-[168px_minmax(0,1fr)]">
            <div style={{ ...CHECKER, border: "1px solid var(--border)" }} className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl p-4">
              {pending
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={pending.url} alt={`${acronym} logo`} className="max-h-full max-w-full object-contain" />
                : <div className="text-center"><ConferenceMonogram acronym={acronym} size={64} /><div className="mt-2 text-[11px] font-semibold text-ink-faint">No logo yet</div></div>}
            </div>
            <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files?.[0]); }} onClick={open} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
              style={{ border: `2px dashed ${dragOver ? "var(--primary)" : error ? "var(--danger)" : "var(--border-strong)"}`, background: dragOver ? "var(--primary-soft)" : "var(--canvas)" }} className="flex cursor-pointer flex-col items-center justify-center rounded-2xl p-6 text-center outline-none transition-colors hover:border-primary focus-visible:ring-4 focus-visible:ring-primary-soft">
              <div style={{ boxShadow: "var(--shadow-card)" }} className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white"><FileUp size={20} aria-hidden="true" className="text-primary" /></div>
              <p className="text-sm font-semibold text-ink">{dragOver ? "Drop to upload" : pending ? "Drop a new image to replace" : "Drag & drop your logo here"}</p>
              <p className="mt-1 text-xs text-ink-faint">or <span className="font-semibold text-primary">browse files</span></p>
            </div>
          </div>
          {error && <p role="alert" className="mt-3 flex items-center gap-1 text-xs font-semibold text-danger-ink"><AlertTriangle size={12} aria-hidden="true" /> {error}</p>}
          {pending && (
            <div style={{ border: "1px solid var(--border)" }} className="mt-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
              <FileText size={15} aria-hidden="true" className="shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink">{pending.name}</div><div className="text-xs text-ink-faint">{pending.size != null ? size(pending.size) : "Saved logo"}</div></div>
              <button type="button" disabled={Boolean(locked)} onClick={open} style={{ border: "1.5px solid var(--border)" }} className="h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary">Replace</button>
              <button type="button" disabled={Boolean(locked)} onClick={() => setPending(null)} className="h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold text-danger-ink transition-colors hover:bg-danger-soft">Remove</button>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {([[FileCheck, "JPEG, PNG or WebP"], [Download, "Up to 2 MB"], [Layers, "Square, 256 × 256 px or larger"], [Sparkles, "Transparent background looks best"]] as const).map(([Icon, text]) => (
              <span key={text} style={{ border: "1px solid var(--border)" }} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink-muted"><Icon size={11} aria-hidden="true" /> {text}</span>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--border)" }} className="flex flex-wrap items-center gap-3 bg-canvas px-6 py-4">
          {done ? <span className="flex items-center gap-1.5 text-xs font-semibold text-success-ink"><Check size={14} aria-hidden="true" /> Logo saved — it&apos;s live on your CFP.</span>
            : dirty ? <span className="flex items-center gap-1.5 text-xs font-semibold text-warning-ink"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved changes</span>
              : <span className="text-xs text-ink-faint">{saved ? "Your saved logo is shown." : "No logo saved yet — the monogram is used."}</span>}
          <span className="flex-1" />
          <button type="button" onClick={discard} disabled={!dirty || busy} className="h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">Discard</button>
          <button type="button" onClick={() => void save()} disabled={!dirty || busy || Boolean(locked)} style={{ background: dirty ? "var(--primary)" : "var(--border-strong)" }} className="h-10 cursor-pointer rounded-xl px-5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed">{busy ? "Saving…" : pending || !saved ? "Save logo" : "Remove logo"}</button>
        </div>
      </div>

      <aside className={`space-y-3 ${STICKY_SIDE_LG}`}>
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint"><Eye size={12} aria-hidden="true" /> Where your logo appears</div>
        <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
          <div style={{ borderBottom: "1px solid var(--muted)" }} className="px-4 py-2 text-[11px] font-semibold text-ink-faint">Call for Papers page</div>
          <div className="p-4"><div className="ui-banner flex items-center gap-3 rounded-xl p-4">{mark(48, true)}<div className="min-w-0"><div className="truncate text-sm font-extrabold tracking-tight text-navy">{acronym}</div><div className="truncate text-[11px] text-ink-soft">{name}</div></div></div></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div style={CARD} className="overflow-hidden rounded-2xl bg-white"><div style={{ borderBottom: "1px solid var(--muted)" }} className="px-3 py-2 text-[11px] font-semibold text-ink-faint">Sidebar</div><div className="p-3"><div className="flex items-center gap-2 rounded-lg bg-primary-soft px-2.5 py-2">{mark(24)}<span className="truncate text-xs font-bold text-navy">{acronym}</span></div></div></div>
          <div style={CARD} className="overflow-hidden rounded-2xl bg-white"><div style={{ borderBottom: "1px solid var(--muted)" }} className="px-3 py-2 text-[11px] font-semibold text-ink-faint">Email header</div><div className="flex flex-col items-center gap-1.5 p-3">{mark(32)}<span className="max-w-full truncate text-[10px] font-semibold text-ink-muted">{acronym} Secretariat</span></div></div>
        </div>
        {!pending && <p className="px-1 text-[11px] leading-relaxed text-ink-faint">Until you add a logo, the {acronym} monogram is used everywhere.</p>}
      </aside>
    </div>
  );
}
