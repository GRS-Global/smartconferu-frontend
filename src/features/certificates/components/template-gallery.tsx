"use client";

import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import type { Conference } from "@/types/conference";
import { CertModal } from "../components";
import { inputStyle, inputClass } from "../form-styles";
import { CERTIFICATE_TYPES, getCertificateType, mergeValues, sampleRecipient, type CertTypeKey, type Orientation } from "../data";
import { pageSize } from "../studio/model";
import { CUSTOM_KEY, PAPER_GROUPS, labelOf, loadPaper, savePaper, specOf, type PaperKey, type PaperSpec } from "../paper";
import { CustomSizeFields } from "../paper-menu";
import { STUDIO_TEMPLATES, TEMPLATE_STYLES, type StudioTemplate, type TemplateStyle } from "../studio/templates";
import { TemplateThumb } from "../studio/template-thumb";
import { loadFavourites, loadRecent, rememberTemplate, toggleFavourite } from "../studio/template-prefs";

/* The template gallery behind "New certificate": what the certificate is for, search, style and page filters, favourites and the templates used
   last. Choosing a template only decides the starting layout; everything on it can be changed in the designer. */

export interface NewCertificateInput { name: string; typeKey: CertTypeKey; templateKey: string; orientation: Orientation; paper: PaperSpec }

type Scope = "all" | "favourites" | "recent";

export function NewCertificateModal({ conference, onClose, onCreate }: { conference: Conference; onClose: () => void; onCreate: (input: NewCertificateInput) => void }) {
  const [typeKey, setTypeKey] = useState<CertTypeKey>(CERTIFICATE_TYPES[0].key);
  const [templateKey, setTemplateKey] = useState(STUDIO_TEMPLATES[0].key);
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [paperKey, setPaperKey] = useState<PaperKey>(loadPaper); // the paper last used; this modal only opens after a click, so it is never rendered on the server
  const [, setCustomTick] = useState(0);
  const paper = specOf(paperKey);
  const [style, setStyle] = useState<TemplateStyle | "All">("All");
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  // Favourites and recents live in this browser. The modal only opens after a click, so it is never rendered on the server.
  const [favourites, setFavourites] = useState<string[]>(loadFavourites);
  const [recent] = useState<string[]>(loadRecent);

  const type = getCertificateType(typeKey);
  const values = useMemo(() => mergeValues(sampleRecipient(conference, typeKey), conference, { typeKey }), [conference, typeKey]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = STUDIO_TEMPLATES.filter((t) => {
      if (style !== "All" && t.style !== style) return false;
      if (scope === "favourites" && !favourites.includes(t.key)) return false;
      if (scope === "recent" && !recent.includes(t.key)) return false;
      return !q || `${t.name} ${t.blurb} ${t.style}`.toLowerCase().includes(q);
    });
    // The ones that suit this certificate type come first.
    return [...list].sort((a, b) => Number(b.bestFor.includes(typeKey)) - Number(a.bestFor.includes(typeKey)));
  }, [query, style, scope, favourites, recent, typeKey]);

  const dims = pageSize(orientation, paper);
  const create = () => {
    rememberTemplate(templateKey);
    onCreate({ name: name.trim() || `${conference?.acronym} — ${type.short}`, typeKey, templateKey, orientation, paper });
  };
  const chip = (active: boolean) => (active
    ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" }
    : { border: "1px solid var(--border)", background: "#FFFFFF", color: "var(--ink-muted)" });

  return (
    <CertModal
      title="New certificate"
      subtitle="Pick what it is for and a starting design. You can change everything afterwards."
      onClose={onClose}
      maxWidth="max-w-6xl"
      footer={
        <>
          <div className="flex-1 min-w-0 max-w-sm">
            <label htmlFor="cert-name" className="sr-only">Name it (only you see this)</label>
            <input id="cert-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${conference?.acronym} — ${type.short}`} style={inputStyle} className={inputClass} />
          </div>
          <div className="flex-1" />
          <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] transition-colors cursor-pointer">Cancel</button>
          <button onClick={create} style={{ background: "var(--gradient-primary)" }} className="px-5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer">
            Create &amp; open the designer
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[190px_1fr] gap-6">
        <div className="space-y-5">
          <div>
            <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">WHAT IS IT FOR?</div>
            <div className="space-y-1.5" role="radiogroup" aria-label="Certificate type">
              {CERTIFICATE_TYPES.map((t) => (
                <button key={t.key} role="radio" aria-checked={t.key === typeKey} onClick={() => setTypeKey(t.key)} style={chip(t.key === typeKey)} className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold transition-colors cursor-pointer">{t.short}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">PAGE</div>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Page orientation">
              {(["landscape", "portrait"] as const).map((o) => (
                <button key={o} role="radio" aria-checked={o === orientation} onClick={() => setOrientation(o)} style={chip(o === orientation)} className="flex-1 py-2 rounded-lg text-xs font-bold capitalize cursor-pointer">{o}</button>
              ))}
            </div>
            <p style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-1.5">{labelOf(paper)}: {orientation === "landscape" ? `${paper.h} × ${paper.w}` : `${paper.w} × ${paper.h}`} mm ({dims.w} × {dims.h} px).</p>
            <label htmlFor="gal-paper" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mt-3 mb-1 block">Paper size</label>
            <select id="gal-paper" value={paperKey} onChange={(e) => { const k = e.target.value; savePaper(k); setPaperKey(k); }} style={inputStyle} className={inputClass}>
              {PAPER_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.papers.map((p) => <option key={p.key} value={p.key}>{p.label} ({p.note})</option>)}</optgroup>)}
              <option value={CUSTOM_KEY}>Custom size…</option>
            </select>
            {paperKey === CUSTOM_KEY && <div className="mt-2"><CustomSizeFields compact onUse={() => setCustomTick((n) => n + 1)} /></div>}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} style={{ color: "var(--ink-faint)" }} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <label htmlFor="tpl-search" className="sr-only">Search templates</label>
              <input id="tpl-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates" style={{ ...inputStyle, paddingLeft: 32 }} className={inputClass} />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by style">
              {(["All", ...TEMPLATE_STYLES] as const).map((s) => (
                <button key={s} aria-pressed={style === s} onClick={() => setStyle(s)} style={chip(style === s)} className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer">{s}</button>
              ))}
            </div>
            <div className="flex gap-1.5 ml-auto" role="group" aria-label="Show">
              {([["all", "All"], ["favourites", "Favourites"], ["recent", "Recently used"]] as const).map(([k, l]) => (
                <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)} style={chip(scope === k)} className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer">{l}</button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p role="status" style={{ color: "var(--ink-muted)" }} className="text-sm py-10 text-center">
              {scope === "favourites" ? "No favourites yet. Tap the star on a template to keep it here." : scope === "recent" ? "Templates you have used will show up here." : "No template matches that search."}
            </p>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${orientation === "landscape" ? 210 : 150}px, 1fr))` }} role="radiogroup" aria-label="Templates">
              {shown.map((t) => (
                <TemplateCard key={t.key} t={t} selected={t.key === templateKey} recommended={t.bestFor.includes(typeKey)} favourite={favourites.includes(t.key)}
                  typeKey={typeKey} orientation={orientation} paper={paper} values={values}
                  onSelect={() => setTemplateKey(t.key)} onCreate={create} onFavourite={() => setFavourites(toggleFavourite(t.key))} />
              ))}
            </div>
          )}
        </div>
      </div>
    </CertModal>
  );
}

function TemplateCard({ t, selected, recommended, favourite, typeKey, orientation, paper, values, onSelect, onCreate, onFavourite }: {
  t: StudioTemplate; selected: boolean; recommended: boolean; favourite: boolean; typeKey: CertTypeKey; orientation: Orientation; paper: PaperSpec; values: Record<string, string>;
  onSelect: () => void; onCreate: () => void; onFavourite: () => void;
}) {
  const width = orientation === "landscape" ? 210 : 140;
  return (
    <div style={{ border: selected ? "2px solid var(--primary)" : "1px solid var(--border)", background: selected ? "var(--primary-soft)" : "#FFFFFF" }} className="rounded-xl overflow-hidden relative">
      <button role="radio" aria-checked={selected} onClick={onSelect} onDoubleClick={onCreate} aria-label={`${t.name}: ${t.blurb}`} className="w-full text-left cursor-pointer">
        <div style={{ background: "#E9EDF3" }} className="p-3 flex justify-center relative">
          {recommended && <span style={{ background: "var(--primary)", color: "#fff" }} className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold shadow-sm">Recommended</span>}<TemplateThumb templateKey={t.key} typeKey={typeKey} orientation={orientation} paper={paper} width={width} values={values} /></div>
        <div className="px-3 py-2.5">
          <div style={{ color: "var(--navy)" }} className="text-[13px] font-bold truncate">{t.name}</div>
          <div style={{ color: "var(--ink-muted)" }} className="text-[11px] mt-0.5 leading-snug">{t.style} · {orientation === "landscape" ? "Landscape" : "Portrait"}</div>
        </div>
      </button>
      <button
        onClick={onFavourite} aria-pressed={favourite} aria-label={favourite ? `Remove ${t.name} from favourites` : `Add ${t.name} to favourites`} title={favourite ? "Remove from favourites" : "Add to favourites"}
        style={{ background: "rgba(255,255,255,0.92)", color: favourite ? "#F59E0B" : "var(--ink-faint)" }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm cursor-pointer"
      >
        <Star size={14} fill={favourite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
