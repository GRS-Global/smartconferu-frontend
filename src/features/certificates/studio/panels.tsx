/* eslint-disable @next/next/no-img-element -- uploaded data URLs */
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Type, Shapes, Upload, PenLine, Star, Pencil, PenTool, X, PaintBucket, Braces, Layers, Eye, EyeOff, Lock, Unlock, Copy, Trash2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, ArrowUpToLine, ArrowDownToLine,
  ArrowUp, ArrowDown, Group, Ungroup, Square, Circle, Minus, Frame, Image as ImageIcon, ChevronRight, ChevronDown, LayoutTemplate, AlertTriangle, type LucideIcon,
} from "lucide-react";
import type { SignatureRecord, SignatureService } from "@/services/signatures";
import { checkAssetFile, type AssetRecord, type AssetService } from "@/services/assets";
import { MERGE_FIELDS, UNAVAILABLE_FIELDS, type CertTypeKey, type Orientation } from "../data";
import { STUDIO_TEMPLATES } from "./templates";
import { CUSTOM_KEY, PAPER_GROUPS, labelOf, savePaper, specOf, type PaperKey } from "../paper";
import { CustomSizeFields } from "../paper-menu";
import { TemplateThumb } from "./template-thumb";
import { inputClass, inputStyle, selectClass, selectStyle } from "../form-styles";
import { assetImageUrl, designWithoutReference, isInUseError, resolveImageSrc, signatureImageUrl } from "./images";
import { SignaturePadDialog } from "./signature-pad";
import {
  FONTS, PRESETS, docPaper, rescaleDoc, newShape, newText, tokensIn, type AlignKind, type FontKey, type StudioDoc, type StudioElement, type ZMove,
} from "./model";

export interface StudioCtx {
  doc: StudioDoc; page: { w: number; h: number }; margin: number; sel: Set<string>; selEls: StudioElement[]; values: Record<string, string>;
  select(ids: string[], additive?: boolean): void;
  commit(fn: (d: StudioDoc) => StudioDoc, key?: string): void;
  patch(ids: Iterable<string>, p: Partial<StudioElement>, key?: string): void;
  add(el: StudioElement): void;
  duplicate(): void; remove(): void; group(): void; ungroup(): void;
  align(k: AlignKind): void; distribute(axis: "h" | "v"): void; order(m: ZMove): void;
  upload(file: File, replaceId?: string): Promise<string>;
  restart(opts: { templateKey?: string; orientation?: Orientation }): void;
  typeKey: CertTypeKey;
  templateKey: string;
  startEdit(id: string): void;
  /** The conference signature library; null where it does not exist (the in-memory mock). */
  library: { service: SignatureService; conferenceId: string } | null;
  /** The conference's picture library (logos, backgrounds, graphics). */
  assets: { service: AssetService; conferenceId: string } | null;
  /** Puts a picture on the page at its natural size (`src` is `asset:<id>` or an address). */
  addPicture(src: string, name: string): Promise<void>;
  /** Puts a library signatory on the certificate (in the place waiting for one, else the next free slot). */
  addSignature(sig: { id: string; name: string; designation: string; institution: string }): void;
  /** Changes when a picture is added to the library from outside the Uploads tab (its list then reloads). */
  assetsVersion: number;
  conferenceLogoUrl?: string;
  addMany(els: StudioElement[]): void;
}

const label = "text-[11px] font-semibold block mb-1";
const sectionTitle = "text-[10.5px] font-bold tracking-wider mb-2";

function IconBtn({ icon: Icon, title, onClick, active, disabled, danger }: { icon: LucideIcon; title: string; onClick: () => void; active?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title} aria-pressed={active}
      style={{ border: "1px solid var(--border)", color: danger ? "var(--danger)" : active ? "var(--primary)" : "var(--ink-soft)", background: active ? "var(--primary-soft)" : "#fff" }}
      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 disabled:opacity-35 hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] cursor-pointer disabled:cursor-default"
    >
      <Icon size={15} />
    </button>
  );
}
export { IconBtn };

function Num({ id, text, value, onChange, min, max, step = 1, suffix }: { id: string; text: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div>
      <label htmlFor={id} style={{ color: "var(--ink-soft)" }} className={label}>{text}{suffix ? ` (${suffix})` : ""}</label>
      <input id={id} type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(min !== undefined && n < min ? min : max !== undefined && n > max ? max : n); }} style={inputStyle} className={inputClass} />
    </div>
  );
}
function Color({ id, text, value, onChange }: { id: string; text: string; value: string; onChange: (c: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <div>
      <label htmlFor={id} style={{ color: "var(--ink-soft)" }} className={label}>{text}</label>
      <input id={id} type="color" value={hex} onChange={(e) => onChange(e.target.value)} style={{ border: "1.5px solid var(--border)" }} className="w-full h-9 rounded-lg p-1 bg-white cursor-pointer" />
    </div>
  );
}

/** Deletes a library picture / signature. When a certificate still shows it, says where and offers to take it off first (the open design too). */
async function deleteFromLibrary(ctx: StudioCtx, kind: "signature" | "picture", ref: string, remove: (opts?: { removeFromDesigns?: boolean }) => Promise<void>) {
  try { await remove(); return true; } catch (e) {
    if (!isInUseError(e)) throw e;
    const where = e.message.replace(" Remove it from there first.", "");
    if (!window.confirm(`${where}.

Take it off ${kind === "signature" ? "its signature block" : "the picture"} on those certificates and delete it from the library? (In the open certificate you can undo this with Ctrl+Z.)`)) return false;
    ctx.commit((d) => designWithoutReference({ studio: d }, ref, kind === "signature").studio, "drop-library-item");
    await remove({ removeFromDesigns: true });
    return true;
  }
}

/* ================= left sidebar ================= */
export type Tab = "design" | "signatures" | "text" | "elements" | "uploads" | "background" | "fields" | "layers";
export const TABS: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: "design", label: "Design", icon: LayoutTemplate }, { key: "signatures", label: "Signatures", icon: PenLine }, { key: "text", label: "Text", icon: Type }, { key: "elements", label: "Elements", icon: Shapes },
  { key: "uploads", label: "Uploads", icon: Upload }, { key: "background", label: "Background", icon: PaintBucket }, { key: "fields", label: "Fields", icon: Braces }, { key: "layers", label: "Layers", icon: Layers },
];

export function LeftPanel({ tab, ctx }: { tab: Tab; ctx: StudioCtx }) {
  return (
    <div className="p-3.5 space-y-5 overflow-y-auto h-full">
      {tab === "design" && <DesignTab ctx={ctx} />}
      {tab === "signatures" && <SignaturesTab ctx={ctx} />}
      {tab === "text" && <TextTab ctx={ctx} />}
      {tab === "elements" && <ElementsTab ctx={ctx} />}
      {tab === "uploads" && <UploadsTab ctx={ctx} />}
      {tab === "background" && <BackgroundTab ctx={ctx} />}
      {tab === "fields" && <FieldsTab ctx={ctx} />}
      {tab === "layers" && <LayersTab ctx={ctx} />}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 style={{ color: "var(--ink-faint)" }} className={sectionTitle}>{title}</h2><div className="space-y-2">{children}</div></section>;
}

function DesignTab({ ctx }: { ctx: StudioCtx }) {
  const ask = (what: string, run: () => void) => { if (window.confirm(`${what} This replaces everything on the page with that starting layout (you can undo it with Ctrl+Z).`)) run(); };
  const o = ctx.doc.orientation;
  const paper = docPaper(ctx.doc);
  const [customOpen, setCustomOpen] = useState(false);
  const apply = (key: PaperKey) => {
    savePaper(key);
    ctx.commit((d) => { const next = specOf(key); const cur = docPaper(d); return next.key === cur.key && next.w === cur.w && next.h === cur.h ? d : rescaleDoc(d, next); });
  };
  const showCustom = customOpen || paper.key === CUSTOM_KEY;
  return (
    <>
      <Panel title="PAGE">
        <div className="flex gap-1.5">
          {(["landscape", "portrait"] as const).map((x) => (
            <button key={x} type="button" aria-pressed={o === x} onClick={() => x !== o && ask(`Switch to ${x}?`, () => ctx.restart({ orientation: x }))}
              style={o === x ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" } : { border: "1px solid var(--border)", color: "var(--ink-muted)" }}
              className="flex-1 py-2 rounded-lg text-xs font-bold capitalize cursor-pointer">{x}</button>
          ))}
        </div>
        <div>
          <label htmlFor="page-size" style={{ color: "var(--ink-soft)" }} className={label}>Page size</label>
          <select id="page-size" value={showCustom ? CUSTOM_KEY : paper.key} onChange={(e) => { const k = e.target.value; if (k === CUSTOM_KEY) setCustomOpen(true); else { setCustomOpen(false); apply(k); } }} style={{ ...selectStyle, width: "100%", maxWidth: "100%" }} className={selectClass}>
            {PAPER_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.papers.map((p) => <option key={p.key} value={p.key}>{p.label} ({p.note})</option>)}</optgroup>)}
            <option value={CUSTOM_KEY}>Custom size…</option>
          </select>
        </div>
        {showCustom && <CustomSizeFields compact onUse={() => apply(CUSTOM_KEY)} />}
        <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">Now: {labelOf(paper)}, {o === "landscape" ? `${paper.h} × ${paper.w}` : `${paper.w} × ${paper.h}`} mm. What is on the page is moved to fit the new size; Ctrl+Z brings the old one back. Print and PDF use this paper.</p>
      </Panel>
      <Panel title="TEMPLATES">
        <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">Starting again from a template replaces what is on the page.</p>
        <div className="grid grid-cols-2 gap-2">
          {STUDIO_TEMPLATES.map((t) => (
            <button key={t.key} type="button" aria-pressed={ctx.templateKey === t.key} title={t.blurb}
              onClick={() => ctx.templateKey !== t.key && ask(`Use “${t.name}”?`, () => ctx.restart({ templateKey: t.key }))}
              style={{ border: ctx.templateKey === t.key ? "2px solid var(--primary)" : "1px solid var(--border)", background: "#fff" }} className="rounded-lg p-1.5 text-left cursor-pointer">
              <div className="flex justify-center" style={{ background: "var(--canvas)", padding: 4, borderRadius: 4 }}><TemplateThumb templateKey={t.key} typeKey={ctx.typeKey} orientation={o} paper={ctx.doc.paper} width={o === "landscape" ? 92 : 62} values={ctx.values} /></div>
              <div style={{ color: ctx.templateKey === t.key ? "var(--primary)" : "var(--ink-muted)" }} className="text-[10.5px] font-bold px-0.5 pt-1 truncate">{t.name}</div>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}

function TextTab({ ctx }: { ctx: StudioCtx }) {
  return (
    <Panel title="ADD TEXT">
      {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((k) => (
        <button key={k} type="button" onClick={() => ctx.add(newText(ctx.page, k))} style={{ border: "1px solid var(--border)", color: "var(--ink)", fontFamily: FONTS[PRESETS[k].font].css, fontSize: Math.min(26, PRESETS[k].size * 0.55), fontWeight: PRESETS[k].weight, fontStyle: "italic" in PRESETS[k] ? "italic" : "normal" }} className="w-full text-left px-3 py-2.5 rounded-lg hover:border-[var(--primary)] cursor-pointer">
          {PRESETS[k].name}
        </button>
      ))}
      <button type="button" onClick={() => ctx.add(newText(ctx.page, "custom"))} style={{ border: "1px dashed var(--border)", color: "var(--ink-soft)" }} className="w-full px-3 py-2 rounded-lg text-xs font-bold hover:border-[var(--primary)] cursor-pointer">+ Add a text box</button>
      <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">Double-click text on the page to type directly.</p>
    </Panel>
  );
}

function ElementsTab({ ctx }: { ctx: StudioCtx }) {
  const colour = ctx.doc.elements.find((e) => e.name === "Headline")?.color ?? "#1E1B4B";
  const items: Array<{ k: "rect" | "ellipse" | "line" | "frame"; label: string; icon: LucideIcon }> = [
    { k: "rect", label: "Rectangle", icon: Square }, { k: "ellipse", label: "Circle", icon: Circle }, { k: "line", label: "Line", icon: Minus }, { k: "frame", label: "Border", icon: Frame },
  ];
  return (
    <Panel title="SHAPES, LINES & BORDERS">
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ k, label: l, icon: Icon }) => (
          <button key={k} type="button" onClick={() => ctx.add(newShape(ctx.page, k, colour))} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="py-3 rounded-lg text-xs font-bold flex flex-col items-center gap-1.5 hover:border-[var(--primary)] cursor-pointer">
            <Icon size={20} /> {l}
          </button>
        ))}
      </div>
      <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">Change colours, thickness and corners in the panel on the right.</p>
    </Panel>
  );
}

/** A cache-busting suffix for http pictures (a replaced picture keeps its address); object URLs in mock mode must stay as they are. */
const bust = (url: string, v: string | number) => (url.startsWith("http") ? `${url}?v=${v}` : url);

function UploadsTab({ ctx }: { ctx: StudioCtx }) {
  const lib = ctx.assets;
  const service = lib?.service, conferenceId = lib?.conferenceId;
  const [list, setList] = useState<AssetRecord[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!service || !conferenceId) return undefined;
    let cancelled = false;
    service.list(conferenceId)
      .then((l) => { if (!cancelled) setList(l); })
      .catch((e: unknown) => { if (!cancelled) setProblems([e instanceof Error ? e.message : "The pictures could not be loaded."]); });
    return () => { cancelled = true; };
  }, [service, conferenceId, ctx.assetsVersion]);

  const images = ctx.doc.elements.filter((e) => e.type === "image");
  if (!lib) return <p style={{ color: "var(--ink-soft)" }} className="text-xs leading-relaxed">The picture library is not ready yet.</p>;

  const run = async (job: () => Promise<void>) => { setBusy(true); try { await job(); } finally { setBusy(false); setProgress(""); } };
  const uploadMany = (files: File[]) => void run(async () => {
    const errs: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
      const bad = checkAssetFile(f);
      if (bad) { errs.push(bad); continue; }
      try { const made = await lib.service.create(lib.conferenceId, { file: f }); setList((l) => [...(l ?? []), made]); }
      catch (e) { errs.push(`“${f.name}”: ${e instanceof Error ? e.message : "could not be uploaded."}`); }
    }
    setProblems(errs);
  });
  const q = query.trim().toLowerCase();
  const shown = (list ?? []).filter((a) => !q || a.name.toLowerCase().includes(q));
  const fail = (e: unknown) => setProblems([e instanceof Error ? e.message : "Something went wrong."]);

  return (
    <>
      <Panel title="PICTURE LIBRARY">
        <button type="button" disabled={busy} onClick={() => pick.current?.click()} style={{ border: "1.5px dashed var(--border)", color: "var(--ink-soft)" }} className="w-full py-4 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 hover:border-[var(--primary)] disabled:opacity-60 cursor-pointer">
          <Upload size={18} /> {busy ? "Uploading…" : "Upload logos, backgrounds or graphics"}
        </button>
        <input ref={pick} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Upload pictures"
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) uploadMany(fs); }} />
        <input ref={replaceRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Replace the picture"
          onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            const id = replaceId;
            if (!f || !id) return;
            const bad = checkAssetFile(f);
            if (bad) { setProblems([bad]); return; }
            void run(async () => { try { const r = await lib.service.replaceImage(id, f); setList((l) => (l ?? []).map((x) => (x.id === id ? r : x))); setVersion((v) => v + 1); setProblems([]); } catch (err) { fail(err); } });
          }} />
        {progress && <p role="status" style={{ color: "var(--ink-muted)" }} className="text-[11px]">{progress}</p>}
        {problems.length > 0 && <ul role="alert" style={{ color: "var(--danger)" }} className="text-[11px] font-semibold space-y-1">{problems.map((m) => <li key={m}>{m}</li>)}</ul>}
        <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">PNG (transparent works), JPG or WebP, up to 2 MB each; up to 200 per conference. They are kept in storage, not inside the certificate. SVG is not accepted.</p>
        {ctx.conferenceLogoUrl && (
          <button type="button" onClick={() => void ctx.addPicture(ctx.conferenceLogoUrl!, "Conference logo")} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="w-full py-2 rounded-lg text-xs font-bold hover:border-[var(--primary)] cursor-pointer">Use the conference logo</button>
        )}
      </Panel>

      <Panel title={`YOUR PICTURES${list ? ` (${list.length})` : ""}`}>
        {(list?.length ?? 0) > 6 && (
          <div>
            <label htmlFor="asset-search" className="sr-only">Search pictures</label>
            <input id="asset-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pictures" style={inputStyle} className={inputClass} />
          </div>
        )}
        {list === null && problems.length === 0 && <p style={{ color: "var(--ink-faint)" }} className="text-xs">Loading…</p>}
        {list?.length === 0 && <p style={{ color: "var(--ink-faint)" }} className="text-xs">No pictures yet. Upload your logo to use it on every certificate.</p>}
        {list && list.length > 0 && shown.length === 0 && <p style={{ color: "var(--ink-faint)" }} className="text-xs">No picture matches that.</p>}
        <div className="grid grid-cols-2 gap-2">
          {shown.map((a) => {
            const used = images.some((e) => e.src === `asset:${a.id}`);
            return (
              <div key={a.id} style={{ border: used ? "1.5px solid var(--primary)" : "1px solid var(--border)" }} className="rounded-xl overflow-hidden bg-white">
                <button type="button" onClick={() => void ctx.addPicture(`asset:${a.id}`, a.name)} aria-label={`Add ${a.name} to the page`} title="Add to the page" style={{ background: "repeating-conic-gradient(#EEF1F6 0% 25%, #FFFFFF 0% 50%) 50% / 12px 12px" }} className="w-full h-20 flex items-center justify-center cursor-pointer">
                  <img src={bust(assetImageUrl(a.id), `${version}-${a.sizeBytes}`)} alt="" className="max-w-full max-h-full object-contain" />
                </button>
                <div className="p-1.5">
                  {renaming === a.id ? (
                    <input autoFocus defaultValue={a.name} aria-label="Picture name" maxLength={120} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
                      onBlur={(e) => { const name = e.target.value.trim(); setRenaming(null); if (name && name !== a.name) void run(async () => { try { const r = await lib.service.rename(a.id, name); setList((l) => (l ?? []).map((x) => (x.id === a.id ? r : x))); } catch (err) { fail(err); } }); }}
                      style={inputStyle} className="w-full px-1.5 py-0.5 rounded text-[11px]" />
                  ) : (
                    <div onDoubleClick={() => setRenaming(a.id)} title="Double-click to rename" style={{ color: "var(--ink-soft)" }} className="text-[11px] font-semibold truncate">{a.name}</div>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <IconBtn icon={Pencil} title="Rename" disabled={busy} onClick={() => setRenaming(a.id)} />
                    <IconBtn icon={ImageIcon} title="Replace the picture (every certificate that uses it changes)" disabled={busy} onClick={() => { setReplaceId(a.id); replaceRef.current?.click(); }} />
                    <IconBtn icon={Trash2} title="Delete from the library" danger disabled={busy} onClick={() => { if (window.confirm(`Delete “${a.name}” from the library?`)) void run(async () => { try { if (await deleteFromLibrary(ctx, "picture", `asset:${a.id}`, (o) => lib.service.remove(a.id, o))) { setList((l) => (l ?? []).filter((x) => x.id !== a.id)); setProblems([]); } } catch (err) { fail(err); } }); }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="ON THIS PAGE">
        {images.length === 0 && <p style={{ color: "var(--ink-faint)" }} className="text-xs">No pictures on the page.</p>}
        {images.map((im) => (
          <button key={im.id} type="button" onClick={() => ctx.select([im.id])} style={{ border: ctx.sel.has(im.id) ? "1.5px solid var(--primary)" : "1px solid var(--border)" }} className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left cursor-pointer">
            <span style={{ background: "var(--canvas)" }} className="w-12 h-9 rounded flex items-center justify-center overflow-hidden shrink-0"><img src={resolveImageSrc(im.src)} alt="" className="max-w-full max-h-full object-contain" /></span>
            <span style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold truncate">{im.name}</span>
          </button>
        ))}
      </Panel>
    </>
  );
}

const SOLIDS = ["#FFFFFF", "#FDFDFB", "#FFFBF3", "#F8FAFC", "#EEF2FF", "#ECFDF5", "#FEF3C7", "#1E1B4B", "#0B1020"];
const GRADIENTS: Array<[string, string]> = [["#FFFFFF", "#E0E7FF"], ["#FFFBF3", "#FDE68A"], ["#FFFFFF", "#CCFBF1"], ["#1E1B4B", "#4F46E5"], ["#0B1020", "#475569"], ["#FDF2F8", "#E0E7FF"]];
function BackgroundTab({ ctx }: { ctx: StudioCtx }) {
  const bg = ctx.doc.background;
  const set = (background: StudioDoc["background"]) => ctx.commit((d) => ({ ...d, background }), "bg");
  return (
    <>
      <Panel title="SOLID COLOUR">
        <div className="flex flex-wrap gap-1.5">
          {SOLIDS.map((c) => <button key={c} type="button" aria-label={`Background ${c}`} onClick={() => set({ kind: "color", color: c })} style={{ background: c, border: bg.kind === "color" && bg.color.toLowerCase() === c.toLowerCase() ? "2px solid var(--primary)" : "1px solid var(--border)" }} className="w-8 h-8 rounded-md cursor-pointer" />)}
        </div>
        <Color id="bg-color" text="Custom colour" value={bg.kind === "color" ? bg.color : bg.from} onChange={(c) => set({ kind: "color", color: c })} />
      </Panel>
      <Panel title="GRADIENT">
        <div className="flex flex-wrap gap-1.5">
          {GRADIENTS.map(([a, b]) => <button key={a + b} type="button" aria-label={`Gradient ${a} to ${b}`} onClick={() => set({ kind: "gradient", from: a, to: b, angle: bg.kind === "gradient" ? bg.angle : 135 })} style={{ background: `linear-gradient(135deg, ${a}, ${b})`, border: "1px solid var(--border)" }} className="w-8 h-8 rounded-md cursor-pointer" />)}
        </div>
        {bg.kind === "gradient" && (
          <div className="grid grid-cols-3 gap-2">
            <Color id="bg-from" text="From" value={bg.from} onChange={(c) => set({ ...bg, from: c })} />
            <Color id="bg-to" text="To" value={bg.to} onChange={(c) => set({ ...bg, to: c })} />
            <Num id="bg-angle" text="Angle" value={bg.angle} min={0} max={360} onChange={(n) => set({ ...bg, angle: n })} />
          </div>
        )}
      </Panel>
      <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">For a picture background, upload an image and stretch it over the page, then send it to the back in Layers.</p>
    </>
  );
}

function FieldsTab({ ctx }: { ctx: StudioCtx }) {
  const target = ctx.selEls.length === 1 && ctx.selEls[0].type === "text" ? ctx.selEls[0] : null;
  const insert = (token: string) => {
    if (target) ctx.patch([target.id], { text: `${target.text ?? ""}${target.text ? " " : ""}{{${token}}}` });
    else ctx.add(newText(ctx.page, "custom", `{{${token}}}`));
  };
  return (
    <>
      <p style={{ color: "var(--ink-soft)" }} className="text-xs leading-relaxed">{target ? <>Click a field to add it to <b>{target.name}</b>.</> : "Click a field to add it as new text. Select a text box first to add it there instead."} Each one fills in per person; the page shows sample data.</p>
      {MERGE_FIELDS.map((g) => (
        <Panel key={g.group} title={g.group.toUpperCase()}>
          <div className="space-y-1.5">
            {g.fields.map((f) => {
              const sample = ctx.values[f.token] ?? "";
              return (
                <button key={f.token} type="button" onClick={() => insert(f.token)} title={`Add {{${f.token}}}`} style={{ border: "1px solid #DDD6FE", background: "#FAF8FF" }} className="w-full text-left px-3 py-2 rounded-lg hover:border-[#7C3AED] cursor-pointer">
                  <span className="flex items-center justify-between gap-2">
                    <span style={{ color: "#5B21B6" }} className="text-[12px] font-bold">{f.label}</span>
                    <span style={{ color: "var(--ink-faint)" }} className="text-[10px] font-mono truncate">{"{{"}{f.token}{"}}"}</span>
                  </span>
                  <span style={{ color: sample ? "var(--ink-muted)" : "var(--warning)" }} className="block text-[11px] mt-0.5 truncate italic">{sample || "Nothing to print yet for this conference"}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      ))}
      <Panel title="NOT AVAILABLE YET">
        <ul style={{ color: "var(--ink-muted)" }} className="text-[11px] leading-relaxed space-y-1.5">
          {UNAVAILABLE_FIELDS.map((u) => <li key={u.label}><b style={{ color: "var(--ink-soft)" }}>{u.label}</b>: {u.why}.</li>)}
        </ul>
      </Panel>
    </>
  );
}

/** The fields a text uses: see what each one prints, point it at another field (reconnect) or take it out. */
function TokenList({ el, ctx }: { el: StudioElement; ctx: StudioCtx }) {
  const tokens = [...new Set(tokensIn(el.text ?? ""))];
  if (tokens.length === 0) return null;
  const all = MERGE_FIELDS.flatMap((g) => g.fields);
  const known = new Set(all.map((f) => f.token));
  const swap = (from: string, to: string) => ctx.patch([el.id], { text: (el.text ?? "").replace(new RegExp(`\\{\\{\\s*${from}\\s*\\}\\}`, "g"), to ? `{{${to}}}` : "").replace(/ {2,}/g, " ").replace(/^ +| +$/gm, "") }, `tok:${from}`);
  return (
    <div className="mt-3">
      <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-1.5">FIELDS IN THIS TEXT</div>
      <div className="space-y-1.5">
        {tokens.map((t) => (
          <div key={t} style={{ border: "1px solid #DDD6FE", background: "#FAF8FF" }} className="rounded-lg p-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor={`tok-${t}`} className="sr-only">Field {t}: use another field instead</label>
              <select id={`tok-${t}`} value={t} onChange={(e) => swap(t, e.target.value)} style={selectStyle} className={`${selectClass} flex-1 min-w-0 text-xs`}>
                {!known.has(t) && <option value={t}>Unknown: {t}</option>}
                {all.map((f) => <option key={f.token} value={f.token}>{f.label}</option>)}
              </select>
              <button type="button" onClick={() => swap(t, "")} title={`Remove {{${t}}} from this text`} aria-label={`Remove the field ${t}`} style={{ border: "1px solid var(--border)", color: "var(--danger)", background: "#fff" }} className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 cursor-pointer"><X size={14} /></button>
            </div>
            <div style={{ color: !known.has(t) ? "var(--danger)" : ctx.values[t] ? "var(--ink-muted)" : "var(--warning)" }} className="text-[11px] mt-1 truncate italic">
              {!known.has(t) ? "This field does not exist, so it prints nothing. Pick one above." : ctx.values[t] ? `Prints: ${ctx.values[t]}` : "Nothing to print for this conference yet"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- layers ---- */
const TYPE_ICON: Record<StudioElement["type"], LucideIcon> = { text: Type, shape: Square, image: ImageIcon, qr: Braces };
function LayersTab({ ctx }: { ctx: StudioCtx }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const top = [...ctx.doc.elements].reverse();
  const rows: Array<{ el?: StudioElement; group?: string; members?: StudioElement[] }> = [];
  const seen = new Set<string>();
  top.forEach((el) => {
    if (!el.groupId) { rows.push({ el }); return; }
    if (seen.has(el.groupId)) return;
    seen.add(el.groupId);
    const members = top.filter((m) => m.groupId === el.groupId);
    rows.push({ group: el.groupId, members });
  });
  const move = (fromId: string, toId: string) => ctx.commit((d) => {
    const from = d.elements.find((e) => e.id === fromId), to = d.elements.findIndex((e) => e.id === toId);
    if (!from || to < 0 || fromId === toId) return d;
    const list = d.elements.filter((e) => e.id !== fromId);
    const at = list.findIndex((e) => e.id === toId);
    list.splice(at, 0, from);
    return { ...d, elements: list };
  });
  const row = (el: StudioElement, indent: boolean) => {
    const Icon = TYPE_ICON[el.type];
    const on = ctx.sel.has(el.id);
    return (
      <div key={el.id} draggable onDragStart={() => setDragId(el.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) move(dragId, el.id); setDragId(null); }}
        onClick={(e) => ctx.select([el.id], e.shiftKey)}
        style={{ border: on ? "1.5px solid var(--primary)" : "1px solid var(--border)", background: on ? "var(--primary-soft)" : "#fff", marginLeft: indent ? 16 : 0, opacity: el.hidden ? 0.5 : 1 }}
        className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg cursor-pointer">
        <Icon size={13} style={{ color: "var(--ink-muted)" }} className="shrink-0" />
        {renaming === el.id ? (
          <input autoFocus defaultValue={el.name} aria-label="Layer name" onBlur={(e) => { ctx.patch([el.id], { name: e.target.value.trim() || el.name }); setRenaming(null); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }} style={inputStyle} className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-xs" />
        ) : (
          <span onDoubleClick={() => setRenaming(el.id)} title="Double-click to rename" style={{ color: "var(--ink-soft)" }} className="flex-1 min-w-0 truncate text-xs font-semibold">{el.name}</span>
        )}
        <button type="button" aria-label={el.hidden ? "Show layer" : "Hide layer"} onClick={(e) => { e.stopPropagation(); ctx.patch([el.id], { hidden: !el.hidden }); }} className="p-1 cursor-pointer" style={{ color: "var(--ink-muted)" }}>{el.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
        <button type="button" aria-label={el.locked ? "Unlock layer" : "Lock layer"} onClick={(e) => { e.stopPropagation(); ctx.patch([el.id], { locked: !el.locked }); }} className="p-1 cursor-pointer" style={{ color: el.locked ? "var(--primary)" : "var(--ink-muted)" }}>{el.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
      </div>
    );
  };
  return (
    <>
      <p style={{ color: "var(--ink-faint)" }} className="text-[11px]">Top of the list is the front. Drag to reorder, double-click to rename, shift-click to select several.</p>
      <div className="space-y-1">
        {rows.length === 0 && <p style={{ color: "var(--ink-faint)" }} className="text-xs">Nothing on the page yet.</p>}
        {rows.map((r) => r.el ? row(r.el, false) : (
          <div key={r.group} className="space-y-1">
            <button type="button" onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(r.group!)) n.delete(r.group!); else n.add(r.group!); return n; })} aria-expanded={!collapsed.has(r.group!)}
              style={{ border: "1px solid var(--border)", color: "var(--ink-soft)", background: "var(--canvas)" }} className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer">
              {collapsed.has(r.group!) ? <ChevronRight size={13} /> : <ChevronDown size={13} />} <Group size={13} /> Group ({r.members!.length})
            </button>
            {!collapsed.has(r.group!) && r.members!.map((m) => row(m, true))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ================= properties (right) ================= */
export function Properties({ ctx }: { ctx: StudioCtx }) {
  const els = ctx.selEls;
  if (els.length === 0) {
    return <div className="p-4"><p style={{ color: "var(--ink-soft)" }} className="text-sm font-semibold">Nothing selected</p><p style={{ color: "var(--ink-faint)" }} className="text-xs mt-1 leading-relaxed">Click something on the page, or add text, shapes and images from the left. Shift-click or drag a box around several to select them together.</p></div>;
  }
  const one = els.length === 1 ? els[0] : null;
  const ids = els.map((e) => e.id);
  const groupIds = new Set(els.map((e) => e.groupId).filter(Boolean));
  const locked = els.every((e) => e.locked);
  // Text, images and QR codes should stay inside the print-safe area; frames and backgrounds are meant to reach the edge.
  const unsafe = els.filter((e) => e.type !== "shape" && !e.hidden).some((e) => e.x < ctx.margin || e.y < ctx.margin || e.x + e.w > ctx.page.w - ctx.margin || e.y + e.h > ctx.page.h - ctx.margin);
  return (
    <div className="p-3.5 space-y-5 overflow-y-auto h-full">
      <div>
        <div style={{ color: "var(--ink)" }} className="text-sm font-bold truncate">{one ? one.name : `${els.length} elements`}</div>
        <div style={{ color: "var(--ink-faint)" }} className="text-[11px] capitalize">{one ? one.type : "multiple selection"}{groupIds.size ? " · grouped" : ""}</div>
        {unsafe && <p role="status" style={{ color: "#B45309" }} className="text-[11px] mt-1.5 flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> Reaches past the print-safe margin; a printer may trim it.</p>}
      </div>

      <div>
        <h2 style={{ color: "var(--ink-faint)" }} className={sectionTitle}>ARRANGE</h2>
        <div className="flex flex-wrap gap-1">
          <IconBtn icon={AlignStartVertical} title="Align left" onClick={() => ctx.align("left")} />
          <IconBtn icon={AlignCenterVertical} title="Align centre" onClick={() => ctx.align("center")} />
          <IconBtn icon={AlignEndVertical} title="Align right" onClick={() => ctx.align("right")} />
          <IconBtn icon={AlignStartHorizontal} title="Align top" onClick={() => ctx.align("top")} />
          <IconBtn icon={AlignCenterHorizontal} title="Align middle" onClick={() => ctx.align("middle")} />
          <IconBtn icon={AlignEndHorizontal} title="Align bottom" onClick={() => ctx.align("bottom")} />
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <IconBtn icon={ArrowUpToLine} title="Bring to front" onClick={() => ctx.order("front")} />
          <IconBtn icon={ArrowUp} title="Bring forward" onClick={() => ctx.order("forward")} />
          <IconBtn icon={ArrowDown} title="Send backward" onClick={() => ctx.order("backward")} />
          <IconBtn icon={ArrowDownToLine} title="Send to back" onClick={() => ctx.order("back")} />
          <IconBtn icon={Group} title="Group (Ctrl+G)" onClick={ctx.group} disabled={els.length < 2} />
          <IconBtn icon={Ungroup} title="Ungroup (Ctrl+Shift+G)" onClick={ctx.ungroup} disabled={groupIds.size === 0} />
        </div>
        {new Set(els.map((e) => e.groupId ?? e.id)).size >= 3 && (
          <div className="flex gap-1.5 mt-1.5">
            <button type="button" onClick={() => ctx.distribute("h")} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="flex-1 py-1.5 rounded-md text-[11px] font-bold cursor-pointer">Space evenly →</button>
            <button type="button" onClick={() => ctx.distribute("v")} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="flex-1 py-1.5 rounded-md text-[11px] font-bold cursor-pointer">Space evenly ↓</button>
          </div>
        )}
        <div className="flex gap-1 mt-1.5">
          <IconBtn icon={Copy} title="Duplicate (Ctrl+D)" onClick={ctx.duplicate} />
          <IconBtn icon={locked ? Unlock : Lock} title={locked ? "Unlock" : "Lock"} active={locked} onClick={() => ctx.patch(ids, { locked: !locked })} />
          <IconBtn icon={EyeOff} title="Hide (show again in Layers)" onClick={() => ctx.patch(ids, { hidden: true })} />
          <IconBtn icon={Trash2} title="Delete (Del)" danger onClick={ctx.remove} />
        </div>
      </div>

      {one && (
        <div>
          <h2 style={{ color: "var(--ink-faint)" }} className={sectionTitle}>POSITION & SIZE</h2>
          <div className="grid grid-cols-2 gap-2">
            <Num id="p-x" text="X" value={one.x} onChange={(n) => ctx.patch([one.id], { x: n }, "x")} />
            <Num id="p-y" text="Y" value={one.y} onChange={(n) => ctx.patch([one.id], { y: n }, "y")} />
            <Num id="p-w" text="Width" value={one.w} min={4} onChange={(n) => ctx.patch([one.id], { w: n }, "w")} />
            <Num id="p-h" text="Height" value={one.h} min={1} onChange={(n) => ctx.patch([one.id], { h: n }, "h")} />
            <Num id="p-r" text="Rotation" suffix="°" value={one.rotation} min={-360} max={360} onChange={(n) => ctx.patch([one.id], { rotation: n }, "r")} />
            <Num id="p-o" text="Opacity" suffix="%" value={one.opacity * 100} min={0} max={100} onChange={(n) => ctx.patch([one.id], { opacity: n / 100 }, "o")} />
          </div>
        </div>
      )}
      {!one && (
        <div>
          <Num id="p-o-multi" text="Opacity" suffix="%" value={els[0].opacity * 100} min={0} max={100} onChange={(n) => ctx.patch(ids, { opacity: n / 100 }, "o")} />
        </div>
      )}

      {one?.type === "text" && <TextProps el={one} ctx={ctx} />}
      {one?.type === "shape" && <ShapeProps el={one} ctx={ctx} />}
      {one?.type === "image" && <ImageProps el={one} ctx={ctx} />}
    </div>
  );
}

function TextProps({ el, ctx }: { el: StudioElement; ctx: StudioCtx }) {
  const p = (x: Partial<StudioElement>, key?: string) => ctx.patch([el.id], x, key);
  const tokens = tokensIn(el.text ?? "");
  const known = new Set(MERGE_FIELDS.flatMap((g) => g.fields.map((f) => f.token)));
  const unknown = tokens.filter((t) => !known.has(t));
  const empty = tokens.filter((t) => known.has(t) && !ctx.values[t]);
  return (
    <>
      <div>
        <h2 style={{ color: "var(--ink-faint)" }} className={sectionTitle}>TEXT</h2>
        <label htmlFor="t-text" className={label} style={{ color: "var(--ink-soft)" }}>Content</label>
        <textarea id="t-text" rows={3} value={el.text ?? ""} onChange={(e) => p({ text: e.target.value }, "text")} style={inputStyle} className={`${inputClass} resize-y`} />
        {(unknown.length > 0 || empty.length > 0) && (
          <p role="status" style={{ color: "var(--warning, #B45309)" }} className="text-[11px] mt-1.5 flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {unknown.length > 0 && <span>Unknown field{unknown.length > 1 ? "s" : ""}: {unknown.map((t) => `{{${t}}}`).join(", ")} will print empty. </span>}
            {empty.length > 0 && <span>No sample value for {empty.join(", ")}.</span>}
          </p>
        )}
        <TokenList el={el} ctx={ctx} />
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="col-span-2">
            <label htmlFor="t-font" className={label} style={{ color: "var(--ink-soft)" }}>Font</label>
            <select id="t-font" value={el.font ?? "serif"} onChange={(e) => p({ font: e.target.value as FontKey })} style={selectStyle} className={`${selectClass} w-full`}>
              {(Object.keys(FONTS) as FontKey[]).map((k) => <option key={k} value={k}>{FONTS[k].label}</option>)}
            </select>
          </div>
          <Num id="t-size" text="Size" value={el.size ?? 21} min={6} max={300} onChange={(n) => p({ size: n }, "size")} />
          <div>
            <label htmlFor="t-weight" className={label} style={{ color: "var(--ink-soft)" }}>Weight</label>
            <select id="t-weight" value={el.weight ?? 400} onChange={(e) => p({ weight: Number(e.target.value) })} style={selectStyle} className={`${selectClass} w-full`}>
              {[300, 400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-1 mt-2.5">
          <IconBtn icon={Bold} title="Bold" active={(el.weight ?? 400) >= 700} onClick={() => p({ weight: (el.weight ?? 400) >= 700 ? 400 : 700 })} />
          <IconBtn icon={Italic} title="Italic" active={!!el.italic} onClick={() => p({ italic: !el.italic })} />
          <IconBtn icon={Underline} title="Underline" active={!!el.underline} onClick={() => p({ underline: !el.underline })} />
          <span className="w-2" />
          <IconBtn icon={AlignLeft} title="Align text left" active={el.align === "left"} onClick={() => p({ align: "left" })} />
          <IconBtn icon={AlignCenter} title="Centre text" active={(el.align ?? "center") === "center"} onClick={() => p({ align: "center" })} />
          <IconBtn icon={AlignRight} title="Align text right" active={el.align === "right"} onClick={() => p({ align: "right" })} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <Color id="t-color" text="Colour" value={el.color ?? "#0B1020"} onChange={(c) => p({ color: c }, "color")} />
          <Num id="t-ls" text="Letter spacing" value={el.letterSpacing ?? 0} step={0.5} min={-5} max={60} onChange={(n) => p({ letterSpacing: n }, "ls")} />
          <Num id="t-lh" text="Line height" value={el.lineHeight ?? 1.3} step={0.1} min={0.6} max={3} onChange={(n) => p({ lineHeight: n }, "lh")} />
        </div>
        <label className="flex items-center gap-2 mt-2.5 cursor-pointer"><input type="checkbox" checked={!!el.autoFit} onChange={(e) => p({ autoFit: e.target.checked })} style={{ accentColor: "var(--primary)" }} /><span style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">Shrink to fit one line (long names)</span></label>
        <label className="flex items-center gap-2 mt-1.5 cursor-pointer"><input type="checkbox" checked={!!el.upper} onChange={(e) => p({ upper: e.target.checked })} style={{ accentColor: "var(--primary)" }} /><span style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">Capital letters</span></label>
      </div>
    </>
  );
}

function ShapeProps({ el, ctx }: { el: StudioElement; ctx: StudioCtx }) {
  const p = (x: Partial<StudioElement>, key?: string) => ctx.patch([el.id], x, key);
  const filled = !!el.fill && el.fill !== "transparent";
  return (
    <div>
      <h2 style={{ color: "var(--ink-faint)" }} className={sectionTitle}>SHAPE</h2>
      <label className="flex items-center gap-2 mb-2 cursor-pointer"><input type="checkbox" checked={filled} onChange={(e) => p({ fill: e.target.checked ? "#C7D2FE" : "transparent", fillTo: undefined })} style={{ accentColor: "var(--primary)" }} /><span style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">Fill</span></label>
      <div className="grid grid-cols-2 gap-2">
        {filled && <Color id="s-fill" text="Fill colour" value={el.fill ?? "#000000"} onChange={(c) => p({ fill: c }, "fill")} />}
        {filled && (el.fillTo
          ? <Color id="s-fill2" text="Gradient end" value={el.fillTo} onChange={(c) => p({ fillTo: c }, "fill2")} />
          : <div className="flex items-end"><button type="button" onClick={() => p({ fillTo: el.fill })} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="w-full h-9 rounded-lg text-[11px] font-bold cursor-pointer">Add gradient</button></div>)}
        <Color id="s-stroke" text="Border colour" value={el.stroke ?? "#000000"} onChange={(c) => p({ stroke: c, strokeWidth: el.strokeWidth || 2 }, "stroke")} />
        <Num id="s-sw" text="Border width" value={el.strokeWidth ?? 0} min={0} max={60} step={0.5} onChange={(n) => p({ strokeWidth: n }, "sw")} />
        {el.shape !== "ellipse" && <Num id="s-rad" text="Corner radius" value={el.radius ?? 0} min={0} max={400} onChange={(n) => p({ radius: n }, "rad")} />}
      </div>
    </div>
  );
}

function ImageProps({ el, ctx }: { el: StudioElement; ctx: StudioCtx }) {
  const ref = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState("");
  return (
    <div>
      <h2 style={{ color: "var(--ink-faint)" }} className={sectionTitle}>IMAGE</h2>
      <div className="flex gap-2">
        <button type="button" onClick={() => ref.current?.click()} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer">Replace image</button>
        <select aria-label="Image fit" value={el.fit ?? "contain"} onChange={(e) => ctx.patch([el.id], { fit: e.target.value as "contain" | "cover" })} style={selectStyle} className={selectClass}>
          <option value="contain">Fit inside</option><option value="cover">Fill (crops)</option>
        </select>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" aria-label="Replace image" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setProblem(await ctx.upload(f, el.id)); }} />
      {problem && <p role="alert" style={{ color: "var(--danger)" }} className="text-[11px] font-semibold mt-1.5">{problem}</p>}
      <p style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-1.5">Drag a corner to resize (the proportions stay locked; hold Alt to stretch).</p>
    </div>
  );
}

/* ================= signature library (own backend only) ================= */
const MAX_SIGNATURE_BYTES = 1024 * 1024;
function checkSignatureFile(f: File): string {
  if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return "Please choose a PNG (transparent works best), JPG or WebP image.";
  if (f.size > MAX_SIGNATURE_BYTES) return `That image is ${Math.round(f.size / 1024)} KB: please use one under 1 MB.`;
  return "";
}

interface SigForm { id: string | null; name: string; designation: string; institution: string; file: File | null; drawn?: boolean }

function SignaturesTab({ ctx }: { ctx: StudioCtx }) {
  const lib = ctx.library;
  const [list, setList] = useState<SignatureRecord[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<SigForm | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  // the chosen picture's preview (an object URL that is released when it changes)
  const chosenFile = form?.file ?? null;
  const preview = useMemo(() => (chosenFile ? URL.createObjectURL(chosenFile) : ""), [chosenFile]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const replaceRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const service = lib?.service;
  const conferenceId = lib?.conferenceId;

  useEffect(() => {
    if (!service || !conferenceId) return undefined;
    let cancelled = false;
    service.list(conferenceId)
      .then((l) => { if (!cancelled) setList(l); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "The signatures could not be loaded."); });
    return () => { cancelled = true; };
  }, [service, conferenceId]);

  if (!lib) return <p style={{ color: "var(--ink-soft)" }} className="text-xs leading-relaxed">The signature library is not available in this mode.</p>;

  const run = async (job: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await job(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const merge = (r: SignatureRecord) => setList((l) => (l ?? []).map((x) => (x.id === r.id ? r : r.isDefault && x.isDefault ? { ...x, isDefault: false } : x)));

  const save = () => { if (form) void run(async () => {
    if (!form.name.trim()) throw new Error("Please enter the signatory's name.");
    if (form.id === null) {
      if (!form.file) throw new Error("Draw the signature or upload a picture of it.");
      const problem = checkSignatureFile(form.file);
      if (problem) throw new Error(problem);
      const made = await lib.service.create(lib.conferenceId, { file: form.file, name: form.name.trim(), designation: form.designation.trim(), institution: form.institution.trim() });
      setList((l) => [...(l ?? []), made]);
    } else {
      merge(await lib.service.update(form.id, { name: form.name.trim(), designation: form.designation.trim(), institution: form.institution.trim() }));
      if (form.file) {
        const problem = checkSignatureFile(form.file);
        if (problem) throw new Error(problem);
        merge(await lib.service.replaceImage(form.id, form.file));
        setVersion((v) => v + 1);
      }
    }
    setForm(null);
  }); };

  return (
    <>
      <p style={{ color: "var(--ink-soft)" }} className="text-xs leading-relaxed">Add a signatory, then put them on the certificate as a block you can drag. Only this conference&apos;s chairs see this library.</p>
      {error && <p role="alert" style={{ color: "var(--danger)" }} className="text-[11.5px] font-semibold leading-snug">{error}</p>}

      {form ? (
        <div style={{ border: "1px solid var(--border)", background: "var(--canvas)" }} className="rounded-xl p-3 space-y-2">
          <div style={{ color: "var(--ink)" }} className="text-xs font-bold">{form.id === null ? "New signature" : "Edit signatory"}</div>
          <div>
            <span className={label} style={{ color: "var(--ink-soft)" }}>{form.id === null ? "Signature picture" : "New picture (leave empty to keep the current one)"}</span>
            <input ref={fileRef} id="sig-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Signature image file" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; if (!f) return; setForm({ ...form, file: f, drawn: false }); setError(checkSignatureFile(f)); }} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDrawOpen(true)} style={{ border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" }} className="py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"><PenTool size={14} /> Draw it</button>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ border: "1.5px dashed var(--border)", background: "#fff", color: "var(--ink-soft)" }} className="py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:border-[var(--primary)] cursor-pointer"><Upload size={14} /> Upload a picture</button>
            </div>
            {form.file && (
              <div style={{ border: "1px solid var(--border)", background: "#fff" }} className="mt-2 rounded-lg p-2 flex items-center gap-2.5">
                <span style={{ background: "repeating-conic-gradient(#EEF1F6 0% 25%, #FFFFFF 0% 50%) 50% / 10px 10px" }} className="w-16 h-10 rounded flex items-center justify-center overflow-hidden shrink-0">
                  <img src={preview} alt="The chosen signature" className="max-w-full max-h-full object-contain" />
                </span>
                <span style={{ color: "var(--ink-soft)" }} className="text-[11px] font-semibold min-w-0 truncate">{form.drawn ? "Drawn signature" : form.file.name} · {Math.max(1, Math.round(form.file.size / 1024))} KB</span>
              </div>
            )}
            <p style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-1">Draw with a mouse, finger or pen, or upload a PNG (transparent works best), JPG or WebP, up to 1 MB.</p>
          </div>
          <div><label htmlFor="sig-name" className={label} style={{ color: "var(--ink-soft)" }}>Name</label><input id="sig-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} className={inputClass} placeholder="Dr. Jane Smith" maxLength={200} /></div>
          <div><label htmlFor="sig-des" className={label} style={{ color: "var(--ink-soft)" }}>Designation</label><input id="sig-des" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} style={inputStyle} className={inputClass} placeholder="Conference Chair" maxLength={200} /></div>
          <div><label htmlFor="sig-inst" className={label} style={{ color: "var(--ink-soft)" }}>Institution</label><input id="sig-inst" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} style={inputStyle} className={inputClass} placeholder="Example University" maxLength={300} /></div>
          <div className="flex gap-2 pt-1">
            <button type="button" disabled={busy} onClick={save} style={{ background: "var(--gradient-primary)" }} className="flex-1 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-50 cursor-pointer">{busy ? "Saving…" : "Save"}</button>
            <button type="button" disabled={busy} onClick={() => { setForm(null); setError(""); }} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="px-3 py-2 rounded-lg text-xs font-bold cursor-pointer">Cancel</button>
          </div>
        </div>
      ) : list?.length === 0 ? (
        <div style={{ border: "1px solid var(--border)", background: "var(--canvas)" }} className="rounded-xl px-4 py-6 text-center">
          <PenLine size={26} style={{ color: "var(--ink-faint)" }} className="mx-auto" />
          <p style={{ color: "var(--navy)" }} className="text-[13px] font-bold mt-2">No signatures yet</p>
          <p style={{ color: "var(--ink-muted)" }} className="text-[11.5px] mt-1 leading-relaxed">Add the chair&apos;s, the director&apos;s or anyone who signs your certificates.</p>
          <button type="button" onClick={() => { setForm({ id: null, name: "", designation: "", institution: "", file: null }); setError(""); }} style={{ background: "var(--primary)" }} className="mt-3 px-4 py-2 rounded-lg text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer">+ Add a signature</button>
        </div>
      ) : (
        <button type="button" onClick={() => { setForm({ id: null, name: "", designation: "", institution: "", file: null }); setError(""); }} style={{ border: "1.5px dashed var(--border)", color: "var(--ink-soft)" }} className="w-full py-3 rounded-xl text-xs font-bold hover:border-[var(--primary)] cursor-pointer">+ Add a signature</button>
      )}

      {drawOpen && form && <SignaturePadDialog onClose={() => setDrawOpen(false)} onUse={(file) => { setForm({ ...form, file, drawn: true }); setError(checkSignatureFile(file)); setDrawOpen(false); }} />}

      <input ref={replaceRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Replace the signature picture"
        onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          const id = replaceId;
          if (!f || !id) return;
          const problem = checkSignatureFile(f);
          if (problem) { setError(problem); return; }
          void run(async () => { merge(await lib.service.replaceImage(id, f)); setVersion((v) => v + 1); });
        }} />

      <div className="space-y-2">
        {list === null && !error && <p style={{ color: "var(--ink-faint)" }} className="text-xs">Loading…</p>}
        {list?.map((s) => (
          <div key={s.id} style={{ border: "1px solid var(--border)" }} className="rounded-xl p-2.5 space-y-2">
            <div className="flex items-center gap-2.5">
              <span style={{ background: "#fff", border: "1px solid var(--border)" }} className="w-16 h-11 rounded flex items-center justify-center overflow-hidden shrink-0">
                <img src={bust(signatureImageUrl(s.id), `${version}-${s.sizeBytes}`)} alt={`Signature of ${s.name}`} className="max-w-full max-h-full object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <div style={{ color: "var(--ink)" }} className="text-xs font-bold truncate">{s.name}{s.isDefault && <span style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold align-middle">Default</span>}</div>
                <div style={{ color: "var(--ink-muted)" }} className="text-[11px] truncate">{[s.designation, s.institution].filter(Boolean).join(" · ") || "No designation"}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={busy} onClick={() => ctx.addSignature(s)} style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="px-2.5 py-1.5 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-50">Add to certificate</button>
              <IconBtn icon={Pencil} title="Edit name, designation, institution" disabled={busy} onClick={() => { setForm({ id: s.id, name: s.name, designation: s.designation, institution: s.institution, file: null }); setError(""); }} />
              <IconBtn icon={ImageIcon} title="Replace the picture" disabled={busy} onClick={() => { setReplaceId(s.id); replaceRef.current?.click(); }} />
              <IconBtn icon={Star} title={s.isDefault ? "This is the default signature" : "Make this the default signature"} active={s.isDefault} disabled={busy || s.isDefault} onClick={() => void run(async () => { merge(await lib.service.update(s.id, { isDefault: true })); })} />
              <IconBtn icon={Trash2} title="Delete from the library" danger disabled={busy} onClick={() => { if (window.confirm(`Delete the signature of ${s.name} from the library?`)) void run(async () => { if (await deleteFromLibrary(ctx, "signature", `sig:${s.id}`, (o) => lib.service.remove(s.id, o))) setList((l) => (l ?? []).filter((x) => x.id !== s.id)); }); }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
