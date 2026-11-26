"use client";

import { RichTextContent, hasRichText } from "@/components/ui/rich-text";
import { BookOpen, Check, ChevronUp, Eye, Pencil, Plus, Sparkles, Trash2, Upload, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { INPUT_CLASS } from "@/components/ui/field";
import { COUNTRIES } from "@/lib/country-codes";
import { cn } from "@/lib/cn";
import { getProfileService } from "@/services/profile";
import type { SubmissionExtra } from "@/types/author-submission";

/* The prototype's Manage › Submission Form (InlineFormEditor in "Author's view"): the form exactly as authors see it (guidelines, paper drop
   zone, Basic Information with the keyword tags and the author cards, Declarations, the chair's extra questions), to try out — nothing is
   saved — with "Edit form" opening the editor. The rail counts the required fields answered and jumps to a section. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const Star = () => <span className="text-danger"> *</span>;
const LABEL = "mb-1.5 block text-sm font-semibold text-ink";
const AUTHOR_INPUT = "rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary";

interface AuthorRow { firstName: string; lastName: string; email: string; affiliation: string; country: string; corresponding: boolean }
const blankAuthor = (corresponding: boolean): AuthorRow => ({ firstName: "", lastName: "", email: "", affiliation: "", country: "", corresponding });
const has = (s: string) => Boolean(s.trim());
const authorComplete = (a: AuthorRow) => has(a.firstName) && has(a.lastName) && has(a.email) && has(a.affiliation) && has(a.country);

export function SubmissionFormPreview({ acronym, guidelines, types, tracks, extras, onEdit }: { acronym: string; guidelines: string; types: string[]; tracks: string[]; extras: SubmissionExtra[]; onEdit: () => void }) {
  const [v, setV] = useState({ title: "", abstract: "", file: false, type: "", track: "", d1: false, d2: false });
  const [authors, setAuthors] = useState<AuthorRow[]>([blankAuthor(true)]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [showGuide, setShowGuide] = useState(() => hasRichText(guidelines));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const reqExtras = extras.filter((x) => x.required);
  const authorsDone = authors.length > 0 && authors.every(authorComplete) && authors.some((a) => a.corresponding);
  const required = [v.file, has(v.title), has(v.abstract), authorsDone, Boolean(v.type), Boolean(v.track), v.d1, v.d2, ...reqExtras.map((x) => Boolean(answers[x.id]?.trim()))];
  const done = required.filter(Boolean).length;
  const all = done === required.length;
  const trackList = tracks.length ? tracks : ["General Track"];
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const touched = v.file || has(v.title) || has(v.abstract) || keywords.length > 0 || authors.some((a) => has(a.firstName) || has(a.email)) || Boolean(v.type) || Boolean(v.track) || v.d1 || v.d2 || Object.keys(answers).length > 0;
  const reset = () => { setV({ title: "", abstract: "", file: false, type: "", track: "", d1: false, d2: false }); setAuthors([blankAuthor(true)]); setKeywords([]); setDraft(""); setAnswers({}); };

  const addKeyword = () => { const t = draft.trim(); if (t && !keywords.includes(t)) setKeywords([...keywords, t]); setDraft(""); };
  const setAuthor = (i: number, patch: Partial<AuthorRow>) => setAuthors((l) => l.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const addMyself = async () => {
    try {
      const p = await (await getProfileService()).load();
      const row: AuthorRow = { firstName: p.firstName || "", lastName: p.lastName || "", email: p.mainEmail || "", affiliation: p.affiliation || "", country: p.country || "", corresponding: !authors.some((a) => a.corresponding && (has(a.firstName) || has(a.email))) };
      const blank = authors.findIndex((a) => !has(a.firstName) && !has(a.lastName) && !has(a.email) && !has(a.affiliation) && !has(a.country));
      setAuthors(blank >= 0 ? authors.map((a, i) => (i === blank ? row : a)) : [...authors, row]);
    } catch { /* no profile to read here (mock mode) */ }
  };

  const choice = (list: string[], key: "type" | "track") => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {list.map((o) => {
        const active = v[key] === o;
        return (
          <button key={o} type="button" aria-pressed={active} onClick={() => setV({ ...v, [key]: active ? "" : o })} style={{ borderColor: active ? "var(--primary)" : "var(--border)", background: active ? "var(--primary-soft)" : "#FFFFFF", color: active ? "var(--primary)" : "var(--ink-soft)" }} className="flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-[13px] font-semibold transition-colors">
            {active && <Check size={14} aria-hidden="true" className="shrink-0" />} {o}
          </button>
        );
      })}
    </div>
  );
  const sections: Array<[string, string]> = [["sfp-basic", "Basic Information"], ...(extras.length ? [["sfp-extra", "Additional questions"] as [string, string]] : []), ["sfp-decl", "Declarations"]];
  const sectionDone: Record<string, boolean> = { "sfp-basic": [has(v.title), has(v.abstract), authorsDone, Boolean(v.type), Boolean(v.track)].every(Boolean), "sfp-extra": reqExtras.every((x) => Boolean(answers[x.id]?.trim())), "sfp-decl": v.d1 && v.d2 };

  return (
    <div className="mx-auto w-full xl:max-w-[66.5rem]">
      <div className="ui-banner ui-banner-lg mb-5 rounded-2xl px-6 py-5">
        <span style={{ background: "#FFFFFF", color: "var(--primary)", border: "1px solid var(--banner-border)" }} className="mb-2 inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[11px] font-bold"><Eye size={11} aria-hidden="true" /> Author&apos;s view</span>
        <h2 className="text-xl font-extrabold leading-snug tracking-tight text-navy">Submit your paper to {acronym}</h2>
        <p className="mt-1.5 text-xs text-ink-soft">This is exactly how authors see the form.</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,48rem)_17rem]">
        <aside className="space-y-3 xl:sticky xl:top-24 xl:order-2" aria-label="Form summary">
          <div style={CARD} className="rounded-2xl bg-white p-3.5">
            <div className="flex items-center gap-2.5 px-1">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Eye size={15} aria-hidden="true" /></span>
              <span className="min-w-0"><span className="block text-sm font-bold text-navy">Author&apos;s view</span><span className="block text-[11px] text-ink-faint">What authors see</span></span>
            </div>
            <div className="mt-3.5 px-1">
              <div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-semibold text-ink-muted">Required answered</span><span style={{ color: all ? "var(--success)" : "var(--navy)" }} className="text-xs font-bold">{done} of {required.length}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div style={{ width: `${required.length ? (done / required.length) * 100 : 100}%`, background: all ? "var(--success)" : "var(--primary)" }} className="h-full rounded-full transition-all duration-300" /></div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">Exactly what authors see. Try filling it in — nothing is saved.</p>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={onEdit} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-white transition-shadow hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]"><Pencil size={13} aria-hidden="true" /> Edit form</button>
                {touched && <button type="button" onClick={reset} title="Clear the answers you typed" className="h-9 rounded-xl border-[1.5px] border-line px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-canvas">Reset</button>}
              </div>
            </div>
          </div>
          <nav style={CARD} className="rounded-2xl bg-white p-3.5" aria-label="Sections">
            <div className="mb-2 flex items-center justify-between px-1.5"><span className="text-[10.5px] font-extrabold uppercase tracking-wider text-ink-faint">Sections</span><span className="text-[11px] text-ink-faint">{required.length + 1} fields · {required.length} required</span></div>
            <div className="space-y-0.5">
              {sections.map(([id, l], i) => (
                <button key={id} type="button" onClick={() => jump(id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-canvas">
                  <span style={sectionDone[id] ? { background: "var(--success)", color: "#FFFFFF" } : { background: "var(--muted)", color: "var(--ink-muted)" }} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">{sectionDone[id] ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : i + 1}</span>
                  <span className="flex-1 truncate text-xs font-semibold text-ink-soft">{l}</span>
                </button>
              ))}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-5 xl:order-1">
          <section style={CARD} className="overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center gap-3 bg-primary-soft/60 px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary"><BookOpen size={15} aria-hidden="true" /></span>
              <div className="flex-1"><div className="text-sm font-bold text-navy">Submission guidelines</div><div className="text-[11px] text-ink-faint">Please read before you submit</div></div>
              <button type="button" onClick={() => setShowGuide(!showGuide)} aria-expanded={showGuide} className="inline-flex items-center gap-1 text-xs font-bold text-primary">{showGuide ? "Hide" : "Show"} <ChevronUp size={13} className={showGuide ? "" : "rotate-180"} aria-hidden="true" /></button>
            </div>
            {showGuide && (hasRichText(guidelines) ? <RichTextContent value={guidelines} className="max-h-[360px] overflow-y-auto px-5 py-4" /> : <div className="px-5 py-4 text-[13px] leading-relaxed"><p className="text-ink-faint">No guidelines written yet — add them under Conference Settings › Submissions.</p></div>)}
          </section>

          <div style={{ background: "var(--gradient-primary)" }} className="rounded-2xl p-[1.5px]">
            <div className="rounded-[0.7rem] bg-white p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Sparkles size={18} aria-hidden="true" /></div>
                <div><h3 className="text-[15px] font-bold text-navy">Auto-fill from your paper</h3><p className="mt-0.5 text-xs text-ink-faint">Upload your paper and we&apos;ll fill in the title, abstract, keywords and authors below for you.</p></div>
              </div>
              <button type="button" onClick={() => setV({ ...v, file: !v.file })} style={{ border: "1.5px dashed var(--border-strong)" }} className="group flex w-full flex-col items-center rounded-2xl bg-canvas px-6 py-12 text-center transition-colors hover:border-primary">
                <span className="mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-full bg-muted text-ink-soft transition-colors group-hover:bg-primary-soft group-hover:text-primary"><Upload size={28} aria-hidden="true" /></span>
                <span className="text-[19px] font-bold text-navy">{v.file ? "Paper attached (preview)" : "Drag & Drop Your Paper Here"}</span>
                <span className="mt-2.5 max-w-sm text-[14px] leading-relaxed text-ink-muted">Drag and drop your paper as a PDF (max 20 MB) here or browse — we&apos;ll fill in the form for you.</span>
                <span className="mt-4 text-[14px] font-semibold text-primary underline underline-offset-2">Browse File</span>
              </button>
            </div>
          </div>

          <section id="sfp-basic" style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
            <h3 className="mb-4 flex items-center gap-2.5 text-sm font-bold text-navy"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[11px] text-white">1</span> Basic Information</h3>
            <div className="space-y-4">
              <div><label htmlFor="sfp-title" className={LABEL}>Title<Star /></label><input id="sfp-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Title" className={INPUT_CLASS} /></div>
              <div><label htmlFor="sfp-abs" className={LABEL}>Abstract<Star /></label><textarea id="sfp-abs" rows={8} value={v.abstract} onChange={(e) => setV({ ...v, abstract: e.target.value })} placeholder="Add abstract…" className={cn(INPUT_CLASS, "min-h-[180px] resize-y leading-relaxed")} /></div>
              <div>
                <label htmlFor="sfp-kw" className={LABEL}>Keywords</label>
                <div className="mb-3 flex items-stretch gap-2">
                  <input id="sfp-kw" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="e.g. Machine Learning — press Enter to add" className="min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft" />
                  <button type="button" onClick={addKeyword} disabled={!draft.trim()} style={{ border: "1.5px solid var(--primary)" }} className="shrink-0 rounded-xl px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">Add</button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((k) => <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft py-1 pl-2.5 pr-1.5 text-xs font-semibold text-primary">{k}<button type="button" onClick={() => setKeywords(keywords.filter((x) => x !== k))} aria-label={`Remove ${k}`} className="transition-opacity hover:opacity-60"><X size={12} aria-hidden="true" /></button></span>)}
                  </div>
                )}
              </div>
              <div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {authors.map((a, i) => (
                    <div key={i} style={{ background: "var(--row-hover)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold text-navy">Author {i + 1}</span>
                        {authors.length > 1 && <button type="button" onClick={() => setAuthors(authors.filter((_, idx) => idx !== i))} className="flex items-center gap-1 text-xs font-medium text-danger hover:underline"><Trash2 size={12} aria-hidden="true" /> Remove</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input value={a.firstName} onChange={(e) => setAuthor(i, { firstName: e.target.value })} placeholder="First name *" aria-label={`Author ${i + 1} first name`} className={AUTHOR_INPUT} />
                        <input value={a.lastName} onChange={(e) => setAuthor(i, { lastName: e.target.value })} placeholder="Last name *" aria-label={`Author ${i + 1} last name`} className={AUTHOR_INPUT} />
                        <input value={a.email} onChange={(e) => setAuthor(i, { email: e.target.value })} placeholder="Email *" aria-label={`Author ${i + 1} email`} className={cn(AUTHOR_INPUT, "col-span-2")} />
                        <input value={a.affiliation} onChange={(e) => setAuthor(i, { affiliation: e.target.value })} placeholder="Affiliation *" aria-label={`Author ${i + 1} affiliation`} className={AUTHOR_INPUT} />
                        <div className="min-w-0">
                          <select value={a.country} onChange={(e) => setAuthor(i, { country: e.target.value })} aria-label={`Author ${i + 1} country`} style={{ color: a.country ? "var(--ink)" : "#94A3B8" }} className={cn(AUTHOR_INPUT, "w-full cursor-pointer")}>
                            <option value="" disabled>Country / region *</option>
                            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={a.corresponding} onChange={(e) => setAuthor(i, { corresponding: e.target.checked })} className="cursor-pointer accent-[var(--primary)]" /><span className="text-xs font-medium text-ink-soft">Corresponding author</span></label>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <button type="button" onClick={() => setAuthors([...authors, blankAuthor(false)])} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Plus size={13} aria-hidden="true" /> Add another author</button>
                  <button type="button" onClick={() => { void addMyself(); }} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><UserPlus size={13} aria-hidden="true" /> Add myself as an author</button>
                </div>
              </div>
              <div><div className={LABEL}>Please choose your submission type<Star /></div>{choice(types, "type")}</div>
              <div><div className={LABEL}>Please choose your track<Star /></div>{choice(trackList, "track")}</div>
            </div>
          </section>

          {extras.length > 0 && (
            <section id="sfp-extra" style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
              <h3 className="mb-4 flex items-center gap-2.5 text-sm font-bold text-navy"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[11px] text-white">2</span> Additional questions</h3>
              <div className="space-y-4">{extras.map((x) => <div key={x.id}><label htmlFor={`sfp-${x.id}`} className={LABEL}>{x.label}{x.required && <Star />}</label><input id={`sfp-${x.id}`} value={answers[x.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [x.id]: e.target.value })} className={INPUT_CLASS} /></div>)}</div>
            </section>
          )}

          <section id="sfp-decl" style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
            <h3 className="mb-4 flex items-center gap-2.5 text-sm font-bold text-navy"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[11px] text-white">{extras.length ? 3 : 2}</span> Declarations</h3>
            <div className="space-y-3">
              {([["d1", "I confirm this submission is original work and has not been previously published or plagiarized."], ["d2", "I agree to the conference's submission terms and conditions."]] as const).map(([k, t]) => (
                <label key={k} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3 text-[13px] font-medium leading-relaxed text-ink-soft"><input type="checkbox" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} className="accent-[var(--primary)]" />{t}<Star /></label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
