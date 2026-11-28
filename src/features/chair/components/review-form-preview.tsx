"use client";

import { RichTextContent } from "@/components/ui/rich-text";
import type { InstructionsPdf } from "@/types/chair";
import { Check, ChevronDown, ChevronRight, ChevronUp, Download, Eye, FileText, KeyRound, Pencil, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ReviewField, ReviewSection } from "@/features/reviewer/form-schema";

/* The prototype's Peer Review › Manage › Form: the review form exactly as reviewers see it (instructions, sections, ratings), to try out —
   nothing is saved — with "Edit form" opening Review settings. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const CONFIDENTIAL = ["f-score", "f-to-chair"];
export const STANDARD = [
  "Thank you for reviewing for this conference. Your careful, constructive review helps authors improve their work and helps the programme committee make fair decisions.",
  "**Before you start**\n- **Conflicts of interest:** if you have co-authored with, work at the same institution as, or have a close personal relationship with any author, stop and inform the chair — do not review the paper.\n- **Confidentiality:** treat the paper and your review as confidential. Do not share, cite or upload the paper to any external tool or service.\n- **Anonymity:** reviews are double-blind. Do not try to identify the authors, and do not reveal your identity in your comments.",
  "**Writing your review**\n- Start with a short summary (2–3 sentences) of the paper's main contribution.\n- Assess originality, technical soundness, clarity of presentation and relevance to the conference.\n- Be specific: refer to sections, figures or tables, and explain how the paper could be improved.\n- Keep comments to authors professional and respectful. Concerns meant only for the chair go in the **confidential** field.",
  "**Scoring guide (1–5)**\n- **5 — Excellent:** an outstanding contribution; accept as is.\n- **4 — Good:** a solid paper with minor issues.\n- **3 — Fair:** some merit, but needs significant revision.\n- **2 — Weak:** major flaws in method or presentation.\n- **1 — Poor:** out of scope, or fundamentally flawed.",
  "**Deadline**\n- Submit your review before the review deadline. If you cannot complete it in time, tell the chair as early as possible so the paper can be reassigned.",
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const boldHtml = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
/** The standard instructions as HTML (what the editor starts with, and what reviewers read until the chair writes their own). */
export function standardInstructionsHtml(): string {
  return STANDARD.map((block) => {
    const lines = block.split("\n");
    const head = lines.filter((l) => !l.startsWith("- ")); const bullets = lines.filter((l) => l.startsWith("- "));
    return (head.length ? `<p>${boldHtml(head.join(" "))}</p>` : "") + (bullets.length ? `<ul>${bullets.map((b) => `<li>${boldHtml(b.slice(2))}</li>`).join("")}</ul>` : "");
  }).join("");
}

/** The instructions card as the reviewer sees it (also shown under the instructions editor as "How reviewers see it"). */
export function InstructionsPreview({ text, pdf = null, mode = "html", defaultOpen = true, className = "" }: { text: string; pdf?: InstructionsPdf | null; mode?: "html" | "pdf"; defaultOpen?: boolean; className?: string }) {
  const [show, setShow] = useState(defaultOpen);
  return (
    <section style={{ border: "1px solid var(--primary-soft-border)", boxShadow: "var(--shadow-card)" }} className={`overflow-hidden rounded-2xl bg-white ${className}`}>
      <button type="button" onClick={() => setShow(!show)} aria-expanded={show} className="flex w-full cursor-pointer items-center gap-3 bg-primary-soft px-5 py-3.5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary"><FileText size={15} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-navy">Reviewer instructions</span><span className="block text-xs text-ink-muted">Please read before you start your review</span></span>
        <span className="shrink-0 text-xs font-semibold text-primary">{show ? "Hide" : "Show"}</span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-ink-muted transition-transform ${show ? "rotate-180" : ""}`} />
      </button>
      {show && <div className="space-y-3 px-5 py-4">{mode === "pdf" ? (pdf ? <InstructionsPdfRow pdf={pdf} /> : <p className="text-sm text-ink-faint">No PDF attached yet.</p>) : <div className="max-h-[360px] overflow-y-auto"><RichTextContent value={text.trim() ? text : standardInstructionsHtml()} /></div>}</div>}
    </section>
  );
}

/** The attached PDF of the instructions: a file row with Download (the prototype's). */
export function InstructionsPdfRow({ pdf }: { pdf: InstructionsPdf }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-[10px] font-extrabold text-[#B91C1C]">PDF</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{pdf.name}</span><span className="block text-xs text-ink-faint">Attached document</span></span>
      <a href={pdf.url} target="_blank" rel="noopener noreferrer" download={pdf.name} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-canvas"><Download size={13} aria-hidden="true" /> Download</a>
    </div>
  );
}

/** The prototype's StarRating: five stars that fill in halves (the left half of a star is n − 0.5, the right half n), a hover preview, the value as "3.5 / 5" and Clear. */
export function StarRating({ value = 0, onChange, size = 22, max = 5, disabled = false, label }: { value?: number; onChange?: (v: number) => void; size?: number; max?: number; disabled?: boolean; label?: string }) {
  const [hover, setHover] = useState(0);
  const readOnly = !onChange || disabled;
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" role={readOnly ? "group" : "radiogroup"} aria-label={label}>
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: max }, (_, k) => k + 1).map((n) => {
          const fill = shown >= n ? 100 : shown >= n - 0.5 ? 50 : 0;
          return (
            <span key={n} className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
              <Star size={size} strokeWidth={1.75} style={{ color: "var(--border-strong)" }} className="absolute inset-0" aria-hidden="true" />
              {fill > 0 && <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}><Star size={size} strokeWidth={1.75} fill="var(--warning)" style={{ color: "var(--warning-ink)" }} aria-hidden="true" /></span>}
              {!readOnly && (
                <>
                  <button type="button" role="radio" aria-checked={value === n - 0.5} aria-label={`${n - 0.5} out of ${max}`} onClick={() => onChange(n - 0.5)} onMouseEnter={() => setHover(n - 0.5)} className="absolute left-0 top-0 h-full w-1/2 cursor-pointer" />
                  <button type="button" role="radio" aria-checked={value === n} aria-label={`${n} out of ${max}`} onClick={() => onChange(n)} onMouseEnter={() => setHover(n)} className="absolute right-0 top-0 h-full w-1/2 cursor-pointer" />
                </>
              )}
            </span>
          );
        })}
      </div>
      <span className="ml-1.5 text-xs text-ink-faint">{value ? `${value} / ${max}` : `/ ${max}`}</span>
      {!readOnly && value > 0 && <button type="button" onClick={() => onChange(0)} className="ml-1 cursor-pointer text-[11px] font-semibold text-ink-faint hover:underline">Clear</button>}
    </div>
  );
}

/** The review form's body (the prototype's ReviewFormBody): numbered section cards, long answers, the grouped ratings table (half stars), choice buttons and
 *  "Confidential" badges, in the order the form lists them. Shared by the reviewer's review page, the chair's "Add your review" and the form preview. */
export function ReviewFormBody({ form, hiddenFields = [], values, onChange, disabled = false, onPolish }: { form: ReviewSection[]; hiddenFields?: string[]; values: Record<string, string | number | boolean | string[] | null | undefined>; onChange: (id: string, v: string | number) => void; disabled?: boolean; onPolish?: () => void }) {
  const badge = (f: ReviewField) => CONFIDENTIAL.includes(f.id) && <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold text-ink-muted"><KeyRound size={9} aria-hidden="true" /> Confidential</span>;
  const num = (f: ReviewField) => Number(values[f.id] ?? 0) || 0;
  return (
    <>
      {form.map((s, si) => {
        const list = s.fields.filter((f) => !hiddenFields.includes(f.id));
        if (!list.length) return null;
        // Consecutive rating fields share one table; everything else stands alone, in the form's own order.
        const blocks: ({ kind: "scores"; fields: ReviewField[] } | { kind: "field"; field: ReviewField })[] = [];
        list.forEach((f) => {
          const last = blocks[blocks.length - 1];
          if (f.type === "score" && last?.kind === "scores") last.fields.push(f);
          else if (f.type === "score") blocks.push({ kind: "scores", fields: [f] });
          else blocks.push({ kind: "field", field: f });
        });
        return (
          <section key={s.id} id={`rfp-${s.id}`} style={CARD} className="scroll-mt-8 rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><div aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{si + 1}</div><h3 className="text-sm font-bold text-navy">{s.name}</h3></div>
            </div>
            <div className="space-y-5">
              {blocks.map((b, bi) => {
                if (b.kind === "scores") {
                  return (
                    <div key={`sg-${bi}`} className="overflow-hidden rounded-xl border border-line">
                      <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-2">
                        <span className="text-xs font-semibold text-ink-muted">Ratings · out of {b.fields[0].max ?? 5}</span>
                        <div className="hidden items-center gap-2 text-ink-faint sm:flex"><span className="text-xs font-semibold">Poor</span><span aria-hidden="true" className="h-px w-14 bg-line-strong" /><span className="text-xs font-semibold">Excellent</span></div>
                      </div>
                      {b.fields.map((f, i) => (
                        <div key={f.id} className={cn("flex flex-wrap items-center justify-between gap-4 px-4 py-3.5", i > 0 && "border-t border-muted")}>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink"><span>{f.label}{f.required && <span className="text-danger-ink"> *</span>}</span>{badge(f)}</div>
                            {f.description && <p className="mt-0.5 text-[11px] text-ink-faint">{f.description}</p>}
                          </div>
                          <StarRating value={num(f)} max={f.max ?? 5} label={f.label} disabled={disabled} onChange={(v) => onChange(f.id, v)} />
                        </div>
                      ))}
                    </div>
                  );
                }
                const f = b.field;
                const text = String(values[f.id] ?? "");
                return (
                  <div key={f.id}>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor={f.type === "long_text" ? `rfp-${f.id}` : undefined} className="flex items-center gap-2 text-sm font-semibold text-ink"><span>{f.label}{f.required && <span className="text-danger-ink"> *</span>}</span>{badge(f)}</label>
                      {onPolish && f.id === "f-summary" && <button type="button" onClick={onPolish} disabled={disabled || !text.trim()} title={text.trim() ? "Improve the wording, clarity and tone of your review — you approve the result before it replaces your text" : "Write your review first, then polish it with Smart Assist"} className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-[var(--primary-soft-border)] bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={12} aria-hidden="true" /> Polish with Smart Assist</button>}
                    </div>
                    {f.description && <p className="mb-2 text-[11px] text-ink-faint">{f.description}</p>}
                    {f.type === "long_text" && <textarea id={`rfp-${f.id}`} disabled={disabled} rows={8} value={text} onChange={(e) => onChange(f.id, e.target.value)} placeholder={`Write your ${f.label.toLowerCase()}…`} className="min-h-[180px] w-full resize-y rounded-lg border-[1.5px] border-line bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-slate-400 focus:border-primary" />}
                    {f.type === "single_choice" && (
                      <div role="group" aria-label={f.label} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {(f.options ?? []).map((o) => {
                          const on = values[f.id] === o;
                          return <button key={o} type="button" disabled={disabled} aria-pressed={on} onClick={() => onChange(f.id, on ? "" : o)} className={cn("flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-[13px] font-semibold transition-colors", on ? "border-primary bg-primary-soft text-primary" : "border-line bg-white text-ink-soft")}>{on && <Check size={14} aria-hidden="true" className="shrink-0" />} {o}</button>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}


/** The review form as reviewers see it, to try out (nothing is saved): the instructions, numbered sections, ratings and choices. */
export function ReviewFormPreview({ acronym, instructions, form, hiddenFields, editHref, onEdit, tryHref, tryLabel }: { acronym: string; instructions: string; form: ReviewSection[]; hiddenFields: string[]; editHref?: string; onEdit?: () => void; tryHref?: string; tryLabel?: string }) {
  const [a, setA] = useState<Record<string, string | number>>({});
  const [show, setShow] = useState(true);
  const fields = form.flatMap((s) => s.fields).filter((f) => !hiddenFields.includes(f.id));
  const req = fields.filter((f) => f.required);
  const done = req.filter((f) => a[f.id] !== undefined && String(a[f.id]).trim() !== "").length;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="mx-auto max-w-[1064px]">
      <div style={CARD} className="ui-accent-card mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EEF2FF] via-[#F1ECFF] to-[#E6F6FB] px-6 py-5">
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-soft-border)] bg-white/70 px-2.5 py-1 text-[11px] font-bold text-primary"><Eye size={11} aria-hidden="true" /> Reviewer&apos;s view</span>
        <h2 className="text-xl font-extrabold tracking-tight text-navy">Review a {acronym} paper</h2>
        <p className="mt-1 text-xs text-ink-muted">This is exactly how reviewers see the form.</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,48rem)_17rem]">
        <div className="min-w-0 space-y-5">
          <section style={CARD} className="overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center gap-3 bg-primary-soft/60 px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary"><FileText size={15} aria-hidden="true" /></span>
              <div className="flex-1"><div className="text-sm font-bold text-navy">Reviewer instructions</div><div className="text-[11px] text-ink-faint">Please read before you start your review</div></div>
              <button type="button" onClick={() => setShow(!show)} aria-expanded={show} className="inline-flex items-center gap-1 text-xs font-bold text-primary">{show ? "Hide" : "Show"} <ChevronUp size={13} className={show ? "" : "rotate-180"} aria-hidden="true" /></button>
            </div>
            {show && <div className="space-y-3 px-5 py-4"><div className="max-h-[360px] overflow-y-auto"><RichTextContent value={instructions.trim() ? instructions : standardInstructionsHtml()} /></div></div>}
          </section>
          <ReviewFormBody form={form} hiddenFields={hiddenFields} values={a} onChange={(id, v) => setA((x) => ({ ...x, [id]: v }))} />
        </div>
        <aside className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pb-1" aria-label="Form summary">
          <div style={CARD} className="rounded-2xl bg-white px-[18px] py-5">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><Eye size={15} aria-hidden="true" /></span><div><div className="text-sm font-bold text-navy">Reviewer&apos;s view</div><div className="text-[11px] text-ink-faint">What reviewers see</div></div></div>
            <div className="mt-4 flex items-center justify-between text-xs"><span className="text-ink-muted">Required answered</span><b className="text-navy">{done} of {req.length}</b></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div style={{ width: `${req.length ? (done / req.length) * 100 : 0}%` }} className="h-full rounded-full bg-primary transition-all" /></div>
            <p className="mb-4 mt-3 text-[11px] text-ink-faint">Exactly what reviewers see. Try filling it in — nothing is saved.</p>
            {onEdit ? <button type="button" onClick={onEdit} className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</button> : <Link href={editHref ?? "#"} className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</Link>}
          </div>
          <nav style={CARD} className="rounded-2xl bg-white p-5" aria-label="Sections">
            <div className="mb-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-ink-faint"><span>Sections</span><span className="normal-case tracking-normal">{fields.length} fields · {req.length} required</span></div>
            <ul className="space-y-1">{form.map((s, i) => <li key={s.id}><button type="button" onClick={() => jump(`rfp-${s.id}`)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-xs font-semibold text-ink hover:bg-canvas"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-ink-muted">{i + 1}</span>{s.name}</button></li>)}</ul>
          </nav>
          {tryHref && (
            <div style={CARD} className="rounded-2xl bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-navy"><FileText size={13} className="text-primary" aria-hidden="true" /> Try it on a real paper</div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">Opens the full review page for {tryLabel}, with the paper header and details.</p>
              <Link href={tryHref} className="mt-3 flex h-9 w-full items-center justify-center rounded-lg border border-line text-xs font-bold text-navy gap-1 hover:bg-canvas">Open review page <ChevronRight size={13} aria-hidden="true" /></Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
