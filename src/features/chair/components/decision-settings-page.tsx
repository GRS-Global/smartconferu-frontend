"use client";

import { AlertTriangle, Check, GripVertical, Pencil, Pipette, Plus, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Modal } from "@/components/ui/modal";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import type { DecisionType, Outcome } from "@/types/chair";
import { useChairConference } from "../use-chair-conference";
import { DECISION_EMAILS, EmailsPanel } from "./policy-cards";
import { SectionsRail } from "./sections-rail";
import { HelpLabel } from "./setting-label";

/* Conference Settings › Decision (the prototype's ConfSettingsDecisionPage): the outcomes a chair can give a paper — a name, a colour, a
   description and the order they are offered in (the Decision menu on Peer Review and the paper page). Each one has an outcome that
   decides how it counts and which email goes out; a new one takes it from its name, as the prototype does. The list is written back
   as a whole (`decision_types`). Not ported: the “Author sees” wording (the table has no column for it, so authors see the standard
   wording for each outcome), drag to reorder (the arrows do it), the decision emails panel (it comes with Email Templates). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const HEX = /^#[0-9A-Fa-f]{6}$/;
// The prototype's quick picks (its list names #7C3AED twice).
const PRESETS = ["#16A34A", "#0D9488", "#2563EB", "#7C3AED", "#7C3AED", "#DB2777", "#DC2626", "#EA580C", "#F59E0B", "#64748B"];
const FIELD = (bad = false) => `w-full rounded-xl border-[1.5px] bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-4 ${bad ? "border-danger focus:ring-danger-soft" : "border-line focus:border-primary focus:ring-primary-soft"}`;
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const eyedropper = typeof window !== "undefined" && "EyeDropper" in window ? () => new (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper() : null;
const OUTCOMES: Array<{ key: Outcome; label: string }> = [
  { key: "upload_pending", label: "Paper upload pending" }, { key: "no_decision", label: "No decision" }, { key: "plagiarism_clear", label: "Plagiarism cleared" },
  { key: "accept", label: "Accepted" }, { key: "registered", label: "Registered" }, { key: "revise", label: "Revision requested" }, { key: "waitlist", label: "Waitlisted" }, { key: "reject", label: "Rejected" },
];
const STANDARD: Array<Omit<DecisionType, "id">> = [
  { label: "Paper Upload Pending", color: "#64748B", outcome: "upload_pending", description: "Details saved but the full paper isn't uploaded yet." },
  { label: "No Decision", color: "#94A3B8", outcome: "no_decision", description: "Paper uploaded (or resubmitted), nothing decided yet." },
  { label: "Plagiarism clear", color: "#0EA5E9", outcome: "plagiarism_clear", description: "Similarity check passed — reviewers can now be assigned." },
  { label: "Revision", color: "#F59E0B", outcome: "revise", description: "Changes needed — after the plagiarism check or after review." },
  { label: "Waitlist", color: "#8B5CF6", outcome: "waitlist", description: "Acceptable but no slot now — the author hears by the final decision date." },
  { label: "Accept", color: "#16A34A", outcome: "accept", description: "Accepted (oral / poster); registration pending." },
  { label: "Registered", color: "#0D9488", outcome: "registered", description: "Accepted paper's registration payment confirmed — set by Finance or the Chair." },
  { label: "Reject", color: "#DC2626", outcome: "reject", description: "Not accepted, always with a reason." },
];
/** The outcome for a new decision, read from its name ("Accept as Poster" → accept, "Minor Revision" → revise); anything else counts as accepted. */
function outcomeFromLabel(label: string): Outcome {
  const l = label.toLowerCase();
  if (/reject|declin|not accept/.test(l)) return "reject";
  if (/upload/.test(l)) return "upload_pending";
  if (/no decision|undecided|pending decision/.test(l)) return "no_decision";
  if (/plagiar|similarity/.test(l)) return "plagiarism_clear";
  if (/revis|resubmi|shepherd|condition/.test(l)) return "revise";
  if (/wait|hold|reserve/.test(l)) return "waitlist";
  if (/registered|paid/.test(l)) return "registered";
  return "accept";
}
/** What the author is told for each outcome (the standard wording; the database keeps no per-conference wording). */
const STAGES = ["upload_pending", "no_decision", "plagiarism_clear"];
const AUTHOR_SEES: Record<string, string> = { upload_pending: "Paper Upload Pending", no_decision: "Under Review", plagiarism_clear: "Under Review", revise: "Revision Required", waitlist: "Waitlisted", accept: "Accepted – Registration Pending", registered: "Registered", reject: "Not Accepted" };
const pill = (color: string) => ({ color, background: `${color}1A`, border: `1px solid ${color}33` });
const COLS = "grid grid-cols-[28px_44px_128px_minmax(120px,180px)_minmax(120px,180px)_minmax(0,1fr)_72px] items-center gap-3";

interface Draft { id?: string; serial: number; label: string; color: string; hex: string; outcome: Outcome | ""; description: string; authorLabel: string }

export function DecisionSettingsPage({ slug }: { slug: string }) {
  const { state, retry, reload } = useChairConference(slug);
  const [editor, setEditor] = useState<Draft | null>(null);
  const [touched, setTouched] = useState(false);
  const [del, setDel] = useState<DecisionType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const grab = useRef(false);
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const gate = workspaceGate(state, retry, { title: "Decision", loadingLabel: "Loading the decision types", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the decision types." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, data } = state;
  const types = data.decisionTypes;

  const commit = async (next: DecisionType[], done: FlowToastData) => {
    setBusy(true); setError("");
    try { await (await getChairService()).saveDecisionTypes(slug, next); setToast(done); reload(); return true; } catch (e) {
      setError(e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally { setBusy(false); }
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= types.length) return;
    const next = [...types]; const [item] = next.splice(from, 1); next.splice(to, 0, item);
    void commit(next, { title: "Order saved", text: "The decisions are offered in this order." });
  };
  const openAdd = () => {
    const used = new Set(types.map((t) => t.color.toUpperCase()));
    const color = PRESETS.find((c) => !used.has(c)) ?? PRESETS[0];
    setEditor({ serial: types.length + 1, label: "", color, hex: color, outcome: "", description: "", authorLabel: "" }); setTouched(false); setError("");
  };
  const openEdit = (t: DecisionType, i: number) => { setEditor({ id: t.id, serial: i + 1, label: t.label, color: t.color, hex: t.color, outcome: t.outcome, description: t.description, authorLabel: t.authorLabel ?? "" }); setTouched(false); setError(""); };
  const maxSerial = editor ? (editor.id ? types.length : types.length + 1) : 1;
  const labelTrim = editor?.label.trim() ?? "";
  const errs = editor ? {
    label: !labelTrim ? "Give this decision a name." : types.some((t) => t.id !== editor.id && t.label.toLowerCase() === labelTrim.toLowerCase()) ? `"${labelTrim}" already exists.` : "",
    hex: HEX.test(editor.hex) ? "" : "Use a 6-digit hex code, e.g. #16A34A.",
  } : { label: "", hex: "" };
  const save = async () => {
    setTouched(true);
    if (!editor || errs.label || errs.hex) return;
    const outcome = editor.outcome || outcomeFromLabel(labelTrim);
    const item: DecisionType = { id: editor.id ?? `new-${Date.now()}`, label: labelTrim, color: editor.color.toUpperCase(), outcome, description: editor.description.trim(), authorLabel: editor.authorLabel.trim() || (editor.id ? "" : labelTrim) };
    const rest = types.filter((t) => t.id !== editor.id);
    const at = Math.min(Math.max(Number(editor.serial) || maxSerial, 1), maxSerial) - 1;
    if (await commit([...rest.slice(0, at), item, ...rest.slice(at)], { title: editor.id ? "Decision updated" : "Decision added", text: `${labelTrim} is offered in the Decision menu.` })) setEditor(null);
  };
  const remove = async () => {
    if (!del) return;
    if (await commit(types.filter((t) => t.id !== del.id), { title: "Decision deleted", text: `${del.label} is no longer offered.` })) setDel(null);
  };
  const addStandard = () => void commit(STANDARD.map((t, i) => ({ ...t, id: `new-${i}` })), { title: "Standard decisions added", text: "The agreed list is now in the Decision menu." });
  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors disabled:opacity-30";

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="settings/decision" screening={data.screening}>
      <PageHeader title="Decision" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: "Conference Settings" }, { label: "Decision", strong: true }]} />
      <div className="hd-page p-8">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
        <section id="dc-types" data-tour="dc-types" style={CARD} className="min-w-0 scroll-mt-24 rounded-2xl bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Check size={15} aria-hidden="true" /></span><h3 className="text-sm font-bold text-navy"><HelpLabel help="decisionTypes">Decision types</HelpLabel></h3></div>
            <Button size="sm" data-tour="dc-add" className="!px-4 !text-sm !font-semibold" onClick={openAdd} disabled={busy}><Plus size={15} aria-hidden="true" /> Add decision</Button>
          </div>
          <p className="-mt-1 mb-4 text-xs text-ink-faint">The options a chair can choose from when recording a decision on a submission. Drag <GripVertical size={11} aria-hidden="true" className="-mt-0.5 inline" /> to reorder — S.No. sets the order they&apos;re offered in.</p>
          {error && !editor && !del && <p role="alert" className="mb-3 text-sm font-semibold text-danger">{error}</p>}
          {types.length === 0 ? (
            <div className="rounded-xl border-[1.5px] border-dashed border-line py-10 text-center">
              <p className="text-sm font-semibold text-ink-muted">No decision types yet</p>
              <p className="mb-4 mt-1 text-xs text-ink-faint">Add at least one so chairs can record decisions.</p>
              <div className="flex justify-center gap-2"><Button variant="outline" size="sm" onClick={openAdd}><Plus size={15} aria-hidden="true" /> Add decision</Button><Button size="sm" onClick={addStandard} disabled={busy}>Add the standard decisions</Button></div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <div className="min-w-[820px]">
                <div className={`${COLS} border-b border-line bg-canvas px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint`}><span /><span>S.No.</span><span>Color code</span><span>Chair decision</span><span>Author sees</span><span>Description</span><span className="pr-1 text-right">Actions</span></div>
                {types.map((t, i) => (
                  <div key={t.id} draggable onDragStart={(ev) => { if (!grab.current) { ev.preventDefault(); return; } setDragIndex(i); ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", String(i)); }} onDragOver={(ev) => { if (dragIndex === null) return; ev.preventDefault(); if (overIndex !== i) setOverIndex(i); }} onDrop={(ev) => { ev.preventDefault(); if (dragIndex !== null && dragIndex !== i) move(dragIndex, i); setDragIndex(null); setOverIndex(null); }} onDragEnd={() => { grab.current = false; setDragIndex(null); setOverIndex(null); }} style={{ borderTop: i === 0 ? "none" : "1px solid var(--muted)", boxShadow: overIndex === i && dragIndex !== null && dragIndex !== i ? `inset 0 ${dragIndex < i ? "-2px" : "2px"} 0 var(--primary)` : "none", opacity: dragIndex === i ? 0.45 : 1, background: dragIndex === i ? "var(--primary-soft)" : "#FFFFFF" }} className={`${COLS} group px-3 py-3 transition-colors hover:bg-canvas`}>
                    <button type="button" disabled={busy} onMouseDown={() => { grab.current = true; }} onMouseUp={() => { grab.current = false; }} onKeyDown={(ev) => { if (ev.key === "ArrowUp") { ev.preventDefault(); move(i, i - 1); } if (ev.key === "ArrowDown") { ev.preventDefault(); move(i, i + 1); } }} aria-label={`Reorder ${t.label} — drag, or use arrow keys`} title="Drag to reorder (or focus and use ↑ ↓)" className="flex h-7 w-7 cursor-grab items-center justify-center rounded-lg text-ink-faint outline-none hover:bg-white hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing disabled:opacity-30"><GripVertical size={15} aria-hidden="true" /></button>
                    <span className="text-sm font-bold tabular-nums text-ink-muted">{i + 1}</span>
                    <span className="flex min-w-0 items-center gap-2"><span style={{ background: t.color, boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.12)" }} className="h-5 w-5 shrink-0 rounded-md" aria-hidden="true" /><code className="text-xs text-ink-soft [font-family:inherit]">{t.color.toUpperCase()}</code></span>
                    <span className="min-w-0"><span style={pill(t.color)} className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"><span style={{ background: t.color }} className="h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" /><span className="truncate">{t.label}</span></span><span className="mt-1 block pl-1 text-[10px] font-semibold text-ink-faint">→ {OUTCOMES.find((o) => o.key === t.outcome)?.label ?? "No outcome set"}</span></span>
                    <span className="min-w-0 text-[12.5px] font-bold leading-snug text-navy" title={STAGES.includes(t.outcome) ? "Stage — the author never sees the chair's name for it" : "Exactly what the author sees on their paper"}>{t.authorLabel?.trim() || AUTHOR_SEES[t.outcome] || t.label}</span>
                    <span className={`line-clamp-2 text-xs leading-relaxed ${t.description ? "text-ink-soft" : "text-line-strong"}`} title={t.description || undefined}>{t.description || "No description"}</span>
                    <span className="flex items-center justify-end gap-1"><button type="button" onClick={() => openEdit(t, i)} aria-label={`Edit ${t.label}`} title="Edit" className={`${iconBtn} cursor-pointer hover:bg-primary-soft hover:text-primary`}><Pencil size={13} aria-hidden="true" /></button><button type="button" onClick={() => { setError(""); setDel(t); }} aria-label={`Delete ${t.label}`} title="Delete" className={`${iconBtn} cursor-pointer hover:bg-danger-soft hover:text-danger`}><Trash2 size={13} aria-hidden="true" /></button></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        <EmailsPanel id="dc-emails" title="Decision emails" desc="Sent when you record a decision on a paper. Authors and co-authors get the decision; each reviewer gets the final result." items={DECISION_EMAILS} href={`/chair/${encodeURIComponent(conference.id)}/settings/email-templates`} slug={slug} conferenceName={conference.name} acronym={conference.acronym} backLabel="Decision settings" backHref={`/chair/${encodeURIComponent(conference.id)}/settings/decision`} />
        </div>
        <SectionsRail sections={[{ id: "dc-types", label: "Decision types", meta: types.length ? <span className="mt-1 flex flex-wrap gap-1">{types.map((t) => <span key={t.id} style={pill(t.color)} className="rounded-full px-1.5 py-px text-[10px] font-bold">{t.label}</span>)}</span> : "None yet" }, { id: "dc-emails", label: "Decision emails", meta: `${DECISION_EMAILS.length} automatic emails`, children: DECISION_EMAILS.flatMap((x) => (x.key ? [{ id: `dc-emails-${x.key}`, label: x.name }] : [])) }]} links={[{ label: "Submissions", desc: "Where chairs record a decision on each paper", href: `/chair/${encodeURIComponent(conference.id)}` }, { label: "Peer Review", desc: "Reviews feed into each submission’s decision", href: `/chair/${encodeURIComponent(conference.id)}/peer-review` }]} />
        </div>
      </div>

      {editor && (
        <Modal title={editor.id ? "Edit decision" : "Add decision"} subtitle="Chairs pick from these when recording a decision on a submission." icon={Check} onClose={() => { if (!busy) setEditor(null); }} maxWidth="max-w-xl" roomy
          actions={<>
            <button type="button" onClick={() => setEditor(null)} disabled={busy} className="h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
            <button type="button" onClick={() => void save()} disabled={busy || Boolean(errs.label || errs.hex)} className="h-10 cursor-pointer rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : editor.id ? "Save changes" : "Add decision"}</button>
          </>}>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
            <div><label htmlFor="dc-serial" className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help="decisionSerial">S.No.</HelpLabel> <span className="text-danger">*</span></label><input id="dc-serial" type="number" min={1} max={maxSerial} value={editor.serial} onChange={(e) => setEditor({ ...editor, serial: e.target.value === "" ? 0 : Number(e.target.value) })} onBlur={() => setEditor({ ...editor, serial: Math.min(Math.max(Number(editor.serial) || maxSerial, 1), maxSerial) })} className={`${FIELD()} tabular-nums`} /></div>
            <div><label htmlFor="dc-label" className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help="decisionLabel">Decision</HelpLabel> <span className="text-danger">*</span></label><input id="dc-label" autoFocus maxLength={80} value={editor.label} onChange={(e) => { setEditor({ ...editor, label: e.target.value }); setTouched(true); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }} placeholder="e.g. Accept with Shepherding" aria-invalid={touched && Boolean(errs.label)} className={FIELD(touched && Boolean(errs.label))} /></div>
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">Position 1–{maxSerial}{!editor.id && " · defaults to the end"}. Other decisions shift to make room.</p>
          {touched && errs.label && <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {errs.label}</p>}
          <div className="mt-5">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><label htmlFor="dc-author">Author sees</label></span>
            <input id="dc-author" maxLength={120} value={editor.authorLabel} onChange={(e) => setEditor({ ...editor, authorLabel: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }} placeholder={editor.id ? AUTHOR_SEES[editor.outcome as string] ?? "" : labelTrim || "Same as the decision name"} className={FIELD()} />
            <p className="mt-1.5 text-xs text-ink-faint">The exact status text the author sees on their paper. Leave blank to use {editor.id ? "the standard wording" : "the decision name"}.</p>
          </div>
          <div className="mt-5"><label htmlFor="dc-desc" className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help="decisionDescription">Description</HelpLabel></label><textarea id="dc-desc" rows={3} maxLength={1000} value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} placeholder="What this decision means for the author — e.g. what they need to do next." className={`${FIELD()} resize-none`} /></div>
          <div className="mt-5">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help="decisionColor">Color code</HelpLabel> <span className="text-danger">*</span></span>
            <div className="rounded-2xl border border-line bg-canvas p-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_148px]">
                <ColorPicker value={editor.color} onChange={(c) => setEditor({ ...editor, color: c, hex: c })} />
                <div className="flex flex-col gap-2.5">
                  <div style={{ background: editor.color, boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.12)" }} className="h-14 rounded-xl" aria-hidden="true" />
                  <div>
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Hex code</span>
                    <input value={editor.hex} maxLength={7} spellCheck={false} placeholder="#16A34A" aria-label="Hex color code" onChange={(e) => { let v = e.target.value.trim().toUpperCase(); if (v && !v.startsWith("#")) v = `#${v}`; setEditor({ ...editor, hex: v, color: HEX.test(v) ? v : editor.color }); }} className={`${FIELD(Boolean(errs.hex) && editor.hex.length >= 7)} font-mono uppercase`} />
                  </div>
                  {eyedropper && <button type="button" onClick={() => { void eyedropper().open().then((r) => setEditor({ ...editor, color: r.sRGBHex.toUpperCase(), hex: r.sRGBHex.toUpperCase() })).catch(() => undefined); }} style={{ border: "1.5px solid var(--border)" }} className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"><Pipette size={13} aria-hidden="true" /> Pick from screen</button>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Quick picks</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESETS.map((c, i) => { const active = editor.color.toUpperCase() === c; return (
                    <button key={`${c}-${i}`} type="button" onClick={() => setEditor({ ...editor, color: c, hex: c })} aria-label={`Use ${c}`} aria-pressed={active} title={c} style={{ background: c, boxShadow: active ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${c}` : "inset 0 0 0 1px rgba(15,23,42,0.12)" }} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110">{active && <Check size={12} strokeWidth={3} color="#FFFFFF" aria-hidden="true" />}</button>
                  ); })}
                </div>
              </div>
            </div>
            {errs.hex && editor.hex.length >= 7 && <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {errs.hex}</p>}
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Preview</span>
            <span className="text-sm font-bold tabular-nums text-ink-muted">{Math.min(Math.max(Number(editor.serial) || maxSerial, 1), maxSerial)}</span>
            <span style={pill(editor.color)} className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"><span style={{ background: editor.color }} className="h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" /><span className="truncate">{labelTrim || "Decision name"}</span></span>
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
        </Modal>
      )}
      {del && (
        <Modal title={`Delete "${del.label}"?`} subtitle="Chairs won't be able to pick this decision any more." icon={Trash2} onClose={() => { if (!busy) setDel(null); }} maxWidth="max-w-md"
          actions={<>
            <button type="button" onClick={() => setDel(null)} disabled={busy} className="h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
            <button type="button" onClick={() => void remove()} disabled={busy} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-danger px-5 text-sm font-semibold text-white disabled:opacity-60"><Trash2 size={14} aria-hidden="true" /> {busy ? "Deleting…" : "Delete"}</button>
          </>}>
          <p className="text-sm leading-relaxed text-ink-soft">Decisions already recorded with it stay on their submissions. The remaining decisions are renumbered.</p>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
        </Modal>
      )}
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
