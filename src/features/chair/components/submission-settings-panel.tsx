"use client";

import { RichTextEditor, hasRichText } from "@/components/ui/rich-text";
import { AlertTriangle, BookOpen, Check, Clock, GripVertical, Layers, Pencil, Plus, Send, Tag, Ticket, Trash2, type LucideIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { setupChanged } from "@/features/tour/use-setup";
import { getChairService } from "@/services/chair";
import { DEFAULT_SUBMISSION_POLICY, type ConferenceSettings, type ConferenceTrack, type SubmissionPolicy } from "@/types/chair";
import { SectionsRail, type RailLink, type RailSection } from "./sections-rail";
import { HelpLabel } from "./setting-label";

/* The prototype's SubmissionSettingsPanel, card for card: the live status strip, Submission Period, Numbering & Limits, Submission
   Guidelines, Tracks and Presentation Types (the last two as S.No. / name tables with their own On switch). Every change is saved at
   once (the policy in `conferences.settings.submissionPolicy`, the tracks in `tracks`, the types in `conference_settings`). It is the
   panel on Submissions › Manage › Submission Settings and in the middle of Conference Settings › Submissions. Not ported: the guidelines
   are plain text here (the prototype edits them in a rich-text editor). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const INPUT = "w-full rounded-xl border-[1.5px] bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-all placeholder:text-slate-400 focus:ring-4";
const inputCls = (bad: boolean) => `${INPUT} ${bad ? "border-danger focus:ring-danger-soft" : "border-line focus:border-primary focus:ring-primary-soft"}`;
const PRIMARY_BTN = "h-10 cursor-pointer rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]";


/* An ordered list of names (Tracks, Presentation Types) as a S.No. / Name table with drag-to-reorder, an edit dialog and a delete confirmation. */
function OrderedNameTable({ items, onChange, noun, placeholder, muted = false }: { items: string[]; onChange: (next: string[]) => void; noun: string; placeholder: string; muted?: boolean }) {
  const [editor, setEditor] = useState<{ index?: number; serial: number | string; name: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const grabRef = useRef(false);
  const lower = noun.toLowerCase();
  const move = (from: number, to: number) => { if (from === to || to < 0 || to >= items.length) return; const next = [...items]; const [it] = next.splice(from, 1); next.splice(to, 0, it); onChange(next); };
  const isEdit = editor !== null && editor.index !== undefined;
  const maxSerial = editor ? (isEdit ? items.length : items.length + 1) : 1;
  const nameTrim = editor?.name.trim() || "";
  const nameError = !editor ? "" : !nameTrim ? `Give this ${lower} a name.` : items.some((t, i) => i !== editor.index && t.toLowerCase() === nameTrim.toLowerCase()) ? `"${nameTrim}" already exists.` : "";
  const clampSerial = (v: number | string) => Math.min(Math.max(Number(v) || maxSerial, 1), maxSerial);
  const save = () => {
    setTouched(true);
    if (nameError || !editor) return;
    const rest = items.filter((_, i) => i !== editor.index);
    const at = clampSerial(editor.serial) - 1;
    onChange([...rest.slice(0, at), nameTrim, ...rest.slice(at)]);
    setEditor(null);
  };
  const COLS = "grid grid-cols-[28px_52px_minmax(0,1fr)_72px] items-center gap-3";
  const openAdd = () => { setEditor({ serial: items.length + 1, name: "" }); setTouched(false); };
  return (
    <div className={muted ? "opacity-60" : ""}>
      {items.length === 0 ? (
        <div style={{ border: "1.5px dashed var(--border)" }} className="rounded-xl py-7 text-center">
          <p className="text-sm font-semibold text-ink-muted">No {lower}s yet</p>
          <button type="button" onClick={openAdd} style={{ border: "1.5px solid var(--primary)" }} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"><Plus size={15} aria-hidden="true" /> Add {lower}</button>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)" }} className="overflow-hidden rounded-xl">
          <div style={{ borderBottom: "1px solid var(--border)" }} className={`${COLS} bg-canvas px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint`}><span /><span>S.No.</span><span>{noun} name</span><span className="pr-1 text-right">Actions</span></div>
          {items.map((t, i) => {
            const dropHere = overIndex === i && dragIndex !== null && dragIndex !== i;
            return (
              <div key={t} draggable
                onDragStart={(e) => { if (!grabRef.current) { e.preventDefault(); return; } setDragIndex(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
                onDragOver={(e) => { if (dragIndex === null) return; e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
                onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); setOverIndex(null); }}
                onDragEnd={() => { grabRef.current = false; setDragIndex(null); setOverIndex(null); }}
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--muted)", boxShadow: dropHere ? `inset 0 ${dragIndex! < i ? "-2px" : "2px"} 0 var(--primary)` : "none", opacity: dragIndex === i ? 0.45 : 1, background: dragIndex === i ? "var(--primary-soft)" : "#FFFFFF" }}
                className={`${COLS} px-3 py-2.5 transition-colors hover:bg-canvas`}>
                <button type="button" onMouseDown={() => { grabRef.current = true; }} onMouseUp={() => { grabRef.current = false; }} onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); move(i, i - 1); } if (e.key === "ArrowDown") { e.preventDefault(); move(i, i + 1); } }} aria-label={`Reorder ${t} — drag, or use arrow keys`} title="Drag to reorder (or focus and use ↑ ↓)" className="flex h-7 w-7 cursor-grab items-center justify-center rounded-lg text-ink-faint outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"><GripVertical size={15} aria-hidden="true" /></button>
                <span className="text-sm font-bold tabular-nums text-ink-muted">{i + 1}</span>
                <span className="truncate text-sm font-semibold text-ink">{t}</span>
                <span className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => { setEditor({ index: i, serial: i + 1, name: t }); setTouched(false); }} aria-label={`Edit ${t}`} title="Edit" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-primary-soft hover:text-primary"><Pencil size={13} aria-hidden="true" /></button>
                  <button type="button" onClick={() => setConfirmDelete(i)} aria-label={`Delete ${t}`} title="Delete" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"><Trash2 size={13} aria-hidden="true" /></button>
                </span>
              </div>
            );
          })}
          <button type="button" onClick={openAdd} style={{ borderTop: "1px solid var(--muted)" }} className="flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary-soft"><Plus size={13} aria-hidden="true" /> Add {lower}</button>
        </div>
      )}

      <Dialog open={editor !== null} onClose={() => setEditor(null)} title={isEdit ? `Edit ${lower}` : `Add ${lower}`} icon={Layers} size="md">
        {editor && (
          <>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">S.No. <span className="text-danger">*</span></span>
                <input type="number" min={1} max={maxSerial} value={editor.serial} onChange={(e) => setEditor({ ...editor, serial: e.target.value })} onBlur={() => setEditor((d) => (d ? { ...d, serial: clampSerial(d.serial) } : d))} aria-label="S.No." className={`${inputCls(false)} tabular-nums`} />
              </div>
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{noun} name <span className="text-danger">*</span></span>
                <input autoFocus value={editor.name} onChange={(e) => { setEditor({ ...editor, name: e.target.value }); setTouched(true); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} placeholder={placeholder} aria-label={`${noun} name`} className={inputCls(touched && Boolean(nameError))} />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">Position 1–{maxSerial}{!isEdit && " · defaults to the end"}. Others shift to make room.</p>
            {touched && nameError && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {nameError}</p>}
            <div className="mt-7 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setEditor(null)} className="h-10 rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
              <button type="button" onClick={save} disabled={Boolean(nameError)} className={`${PRIMARY_BTN} disabled:cursor-not-allowed disabled:opacity-50`}>{isEdit ? "Save changes" : `Add ${lower}`}</button>
            </div>
          </>
        )}
      </Dialog>
      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title={`Delete "${confirmDelete !== null ? items[confirmDelete] ?? "" : ""}"?`} description={`Authors won't be able to pick this ${lower} any more.`} icon={Trash2} size="md">
        <p className="text-sm leading-relaxed text-ink-soft">Submissions that already chose it keep it. The rest are renumbered.</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={() => setConfirmDelete(null)} className="h-10 rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
          <button type="button" onClick={() => { if (confirmDelete !== null) onChange(items.filter((_, i) => i !== confirmDelete)); setConfirmDelete(null); }} className="h-10 rounded-xl bg-danger px-5 text-sm font-semibold text-white hover:brightness-95">Delete</button>
        </div>
      </Dialog>
    </div>
  );
}

const fmt = (v: number) => new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
function windowStatus(p: SubmissionPolicy, now: number, deadlineIso: string) {
  const from = p.opensAt ? new Date(p.opensAt).getTime() : null;
  const to = deadlineIso ? new Date(`${deadlineIso}T23:59:59`).getTime() : null;
  if (!p.accepting) return { label: "Closed", detail: "Closed manually — authors cannot submit", color: "var(--danger)", bg: "var(--danger-soft)" };
  if (from && now < from) return { label: "Scheduled", detail: `Scheduled to open on ${fmt(from)}`, color: "var(--warning)", bg: "var(--warning-soft)" };
  if (to && now > to) return { label: "Closed", detail: `Deadline passed on ${fmt(to)}`, color: "var(--danger)", bg: "var(--danger-soft)" };
  return { label: "Open", detail: to ? `Closes automatically on ${fmt(to)}` : "Open — no deadline configured", color: "var(--success)", bg: "var(--success-soft)" };
}

export function SubmissionSettingsPanel({ slug, acronym, received, lastNumber, settings, deadline, detailsHref, onOpenForm, before, after, below, leadSections = [], extraSections = [], links = [] }: {
  slug: string; acronym: string; received: number; /** The highest paper number so far (0 when there are none). */ lastNumber: number; settings: ConferenceSettings; deadline: string; detailsHref: string;
  onOpenForm?: () => void; /** Content above the panel's cards (Conference Settings adds Paper Screening). */ before?: ReactNode; /** Content under the whole two-column layout, full width (Conference Settings adds the emails). */ below?: ReactNode; /** Content under the cards in the left column. */ after?: ReactNode;
  /** Rail entries before / after the panel's own (Conference Settings adds Paper Screening first and the emails last). */ leadSections?: RailSection[]; extraSections?: RailSection[]; links?: RailLink[];
}) {
  const [policy, setPolicy] = useState<SubmissionPolicy>({ ...DEFAULT_SUBMISSION_POLICY, ...settings.submission });
  const [tracks, setTracks] = useState<ConferenceTrack[]>(settings.tracks);
  const [types, setTypes] = useState<string[]>(settings.presentationTypes);
  const [now] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [guideDraft, setGuideDraft] = useState(settings.submission.guidelines);
  const [guideSaved, setGuideSaved] = useState(false);
  const last = lastNumber;
  const [numDraft, setNumDraft] = useState(() => String(settings.submission.startNumber ?? last + 1));

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "That couldn't be saved.");
  const update = (patch: Partial<SubmissionPolicy>) => {
    const next = { ...policy, ...patch };
    setPolicy(next); setError("");
    void getChairService().then((s) => s.saveSubmissionPolicy(slug, next)).catch(fail);
  };
  const commitTracks = (names: string[]) => {
    const next: ConferenceTrack[] = names.map((name, i) => tracks.find((t) => t.name === name) ?? { id: `new-${Date.now()}-${i}`, name, description: "" });
    const patch: Partial<SubmissionPolicy> = names.length > tracks.length ? { tracksOn: true } : names.length === 0 ? { tracksOn: false } : {};
    setTracks(next); setError("");
    // Having a track is one of the required setup items: tell the "Finish setup" checklist and the locked menu to read it again once it is saved.
    void getChairService().then((s) => s.saveTracks(slug, next)).then(() => setupChanged()).catch(fail);
    if (Object.keys(patch).length) update(patch);
  };
  const commitTypes = (names: string[]) => {
    const patch: Partial<SubmissionPolicy> = names.length > types.length ? { typesOn: true } : names.length === 0 ? { typesOn: false } : {};
    setTypes(names); setError("");
    void getChairService().then((s) => s.savePresentationTypes(slug, names)).catch(fail);
    if (Object.keys(patch).length) update(patch);
  };
  const saveGuidelines = () => { update({ guidelines: guideDraft }); setGuideSaved(true); setTimeout(() => setGuideSaved(false), 2000); };

  const status = windowStatus(policy, now, deadline);
  const numValue = Number(numDraft);
  const numError = !/^\d+$/.test(numDraft.trim()) || numValue < 1 ? "Enter a whole number of 1 or greater." : numValue <= last ? `Must be greater than ${last}, the last assigned submission number.` : "";
  const nextNumber = policy.startNumber ?? last + 1;
  const prefix = (acronym || "SUB").split(/\s+/)[0].toUpperCase();
  const nextLabel = policy.idFormat === "prefixed" ? `${prefix}-${nextNumber}` : `#${nextNumber}`;
  const periodError = policy.opensAt && deadline && `${deadline}T23:59` <= policy.opensAt ? "The submission deadline (set in Conference Details) must be later than the opening date." : "";
  const trackNames = tracks.map((t) => t.name);
  const hasGuidelines = hasRichText(policy.guidelines);

  const card = (id: string, Icon: LucideIcon, title: string, helpKey: string | null, subtitle: string, children: ReactNode, action?: ReactNode) => (
    <section id={`ss-${id}`} data-tour={`ss-${id}`} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon size={16} aria-hidden="true" /></div>
          <div className="min-w-0"><h3 className="text-base font-bold leading-snug text-navy">{helpKey ? <HelpLabel help={helpKey}>{title}</HelpLabel> : title}</h3>{subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}</div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
  const toggleRow = (key: "accepting" | "allowUpdates" | "allowMultiple" | "editAfterAccept", label: string, desc: string) => (
    <div style={{ border: "1px solid var(--border)" }} className="flex items-center justify-between gap-4 rounded-xl px-4 py-3">
      <div className="min-w-0"><div className="text-sm font-semibold text-ink"><HelpLabel help={key}>{label}</HelpLabel></div><div className="mt-0.5 text-xs text-ink-faint">{desc}</div></div>
      <Switch label={label} checked={policy[key]} onChange={(v) => update({ [key]: v })} />
    </div>
  );
  const fieldLabel = (text: string, help: string) => <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help={help}>{text}</HelpLabel></span>;
  const seg = (active: boolean) => ({ background: active ? "var(--navy)" : "#FFFFFF", color: active ? "#FFFFFF" : "var(--ink-muted)", border: "1px solid var(--border)" });
  const onOff = (on: boolean) => ({ label: on ? "On" : "Off", bg: on ? "var(--success-soft)" : "var(--muted)", color: on ? "var(--success)" : "var(--ink-muted)" });
  const enabledSwitch = (key: "tracksOn" | "typesOn", label: string) => (
    <label className="flex shrink-0 cursor-pointer items-center gap-2.5">
      <span style={{ color: policy[key] ? "var(--success)" : "var(--ink-faint)" }} className="text-xs font-bold">{policy[key] ? "On" : "Off"}</span>
      <Switch label={label} checked={policy[key]} onChange={(v) => update({ [key]: v })} />
    </label>
  );

  return (
    <>
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        {error && <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        {before}
        {/* Live status strip — what authors see right now */}
        <div id="ss-status" style={{ background: status.bg, border: `1px solid ${status.color}33` }} className="flex scroll-mt-24 flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
          <span style={{ background: status.color }} className="h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden="true" />
          <span style={{ color: status.color }} className="text-sm font-bold">Submissions {status.label.toLowerCase()}</span>
          <span className="text-xs text-ink-soft">{status.detail}</span>
          <span className="ml-auto text-xs text-ink-muted">{received} received · Next ID: {nextLabel}</span>
        </div>

        {card("window", Send, "Submission Period", null, "Control when authors can submit — manually, or on a schedule.", (
          <div className="space-y-3">
            {toggleRow("accepting", "Accept New Submissions", "Master switch for the submission portal. When off, submissions close immediately, regardless of the schedule below.")}
            <div style={{ border: "1px solid var(--border)", background: policy.accepting ? "var(--canvas)" : "#FFFFFF", opacity: policy.accepting ? 1 : 0.55 }} className="rounded-xl p-4">
              <div className="mb-3 flex items-center gap-2"><Clock size={14} aria-hidden="true" className="text-primary" /><span className="text-sm font-semibold text-ink"><HelpLabel help="schedule">Scheduled Opening</HelpLabel></span><span className="text-xs text-ink-faint">(Optional)</span></div>
              <div className={policy.accepting ? "" : "pointer-events-none"}>
                {fieldLabel("Submission Opens On", "opensAt")}
                <input type="datetime-local" value={policy.opensAt} onChange={(e) => update({ opensAt: e.target.value })} aria-label="Submission opens on" className={inputCls(false)} />
              </div>
              {periodError && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {periodError}</p>}
              <p className="mt-2.5 text-xs text-ink-faint">{policy.accepting ? "Leave blank to open straight away. " : "Enable “Accept New Submissions” to use a schedule. "}Submissions close at the end of the deadline set in <a href={detailsHref} className="font-semibold text-primary hover:underline">Conference Details</a>.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {toggleRow("allowUpdates", "Allow Submission Updates", "Authors may revise their submission until the submission deadline.")}
              {toggleRow("allowMultiple", "Allow Multiple Submissions per Author", "When off, each author may submit only one paper.")}
              {toggleRow("editAfterAccept", "Allow Edits After Acceptance", "Authors may modify accepted submissions, e.g. to correct metadata.")}
            </div>
          </div>
        ))}

        {card("numbering", Tag, "Submission Numbering & Limits", null, "Define how submissions are identified and set capacity limits.", (
          <div className="space-y-4">
            <div style={{ border: "1px solid var(--border)" }} className="flex flex-wrap items-center justify-between gap-4 rounded-xl px-4 py-3">
              <div><div className="text-sm font-semibold text-ink"><HelpLabel help="idFormat">Submission Identifier Format</HelpLabel></div><div className="mt-0.5 text-xs text-ink-faint">How each submission is referenced across chair, reviewer and author views.</div></div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => update({ idFormat: "numeric" })} style={seg(policy.idFormat === "numeric")} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors">Numeric (#{nextNumber})</button>
                <button type="button" onClick={() => update({ idFormat: "prefixed" })} style={seg(policy.idFormat === "prefixed")} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors">Prefixed ID ({prefix}-{nextNumber})</button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                {fieldLabel("Starting Submission Number", "startNumber")}
                <input type="number" min={last + 1} value={numDraft} aria-label="Starting submission number" onChange={(e) => { setNumDraft(e.target.value); const v = e.target.value.trim(); if (/^\d+$/.test(v) && Number(v) > last && Number(v) >= 1) update({ startNumber: Number(v) }); }} className={`${inputCls(Boolean(numError))} tabular-nums`} />
                {numError ? <p className="mt-1.5 text-xs font-medium text-danger">{numError}</p> : <p className="mt-1.5 text-xs text-ink-faint">{last ? `Last assigned: #${last}. ` : "Defaults to 1. "}The next submission will be assigned <b>{nextLabel}</b>.</p>}
              </div>
              <div>
                {fieldLabel("Maximum Number of Submissions", "maxSubmissions")}
                <input type="number" min={1} value={policy.maxSubmissions ?? ""} placeholder="No limit" aria-label="Maximum number of submissions" onChange={(e) => update({ maxSubmissions: e.target.value ? Number(e.target.value) : null })} className={inputCls(false)} />
                <p style={{ color: policy.maxSubmissions && policy.maxSubmissions <= received ? "var(--warning)" : "var(--ink-faint)" }} className="mt-1.5 text-xs">{policy.maxSubmissions && policy.maxSubmissions <= received ? `Limit reached — ${received} submissions already received.` : `${received} received to date. Leave blank for no limit.`}</p>
              </div>
              <div>
                {fieldLabel("Maximum Submissions per Author", "maxPerAuthor")}
                <input type="number" min={1} value={policy.maxPerAuthor ?? ""} placeholder="No limit" aria-label="Maximum submissions per author" onChange={(e) => update({ maxPerAuthor: e.target.value ? Number(e.target.value) : null })} className={inputCls(false)} />
                <p className="mt-1.5 text-xs text-ink-faint">Leave blank for no limit.</p>
              </div>
            </div>
          </div>
        ))}

        {card("guidelines", BookOpen, "Submission Guidelines", "guidelines", "Displayed at the top of the submission form for all authors.", (
          <>
            <RichTextEditor value={settings.submission.guidelines} onChange={setGuideDraft} placeholder="e.g. formatting requirements, page limits, anonymisation policy and templates…" label="Submission guidelines" maxHeight={360} />
            <div className="mt-3 flex items-center justify-end gap-3">
              {guideSaved && <span className="flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} aria-hidden="true" /> Saved</span>}
              <button type="button" onClick={saveGuidelines} className={PRIMARY_BTN}>Save Guidelines</button>
            </div>
          </>
        ))}

        {card("tracks", Layers, "Tracks", "tracks", policy.tracksOn ? "Authors select one track when submitting." : "Disabled — the track field is hidden from the submission form.", (
          <>
            {/* Read by the setup tour (gateOpen): a track other than the default placeholder has been added. */}
            <span hidden data-track-ready={tracks.length > 0 && !(tracks.length === 1 && tracks[0].name === "General Track") ? "1" : "0"} />
            {policy.tracksOn && tracks.length === 0 && <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning"><AlertTriangle size={13} aria-hidden="true" /> Tracks are enabled but none are defined. Add at least one track.</p>}
            <OrderedNameTable items={trackNames} onChange={commitTracks} noun="Track" placeholder="e.g. Business Analytics" muted={!policy.tracksOn} />
          </>
        ), enabledSwitch("tracksOn", "Tracks"))}

        {card("types", Ticket, "Presentation Types", "types", policy.typesOn ? "Authors select a presentation type when submitting." : "Disabled — the presentation type field is hidden from the submission form.", (
          <>
            {policy.typesOn && types.length === 0 && <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning"><AlertTriangle size={13} aria-hidden="true" /> Presentation types are enabled but none are defined. Add at least one type.</p>}
            <OrderedNameTable items={types} onChange={commitTypes} noun="Presentation type" placeholder="e.g. Paper Presentation" muted={!policy.typesOn} />
            {!settings.stored && <p className="mt-3 text-xs font-semibold text-warning">Run migration 0028_conference_settings.sql to save the presentation types.</p>}
          </>
        ), enabledSwitch("typesOn", "Presentation types"))}
        {after}
      </div>

      <SectionsRail
        sections={[
          ...leadSections,
          { id: "ss-status", label: "Submission status", meta: `${policy.maxSubmissions ? `${received} / ${policy.maxSubmissions}` : received} received · next ${nextLabel}`, tone: { label: status.label, bg: status.bg, color: status.color } },
          { id: "ss-window", label: "Submission Period", meta: policy.allowUpdates ? "Updates allowed until the deadline" : "Updates not allowed" },
          { id: "ss-numbering", label: "Numbering & Limits", meta: `${policy.idFormat === "prefixed" ? "Prefixed IDs" : "Numeric IDs"} · ${policy.maxSubmissions ? `max ${policy.maxSubmissions}` : "no limit"}` },
          { id: "ss-guidelines", label: "Submission Guidelines", meta: hasGuidelines ? "Published" : "Not added yet" },
          { id: "ss-tracks", label: "Tracks", meta: policy.tracksOn ? `${tracks.length} track${tracks.length === 1 ? "" : "s"}` : "Hidden from the form", tone: onOff(policy.tracksOn) },
          { id: "ss-types", label: "Presentation Types", meta: policy.typesOn ? `${types.length} type${types.length === 1 ? "" : "s"}` : "Hidden from the form", tone: onOff(policy.typesOn) },
          ...extraSections,
        ]}
        links={onOpenForm ? [{ label: "Submission Form", desc: "Configure the fields authors complete", onClick: onOpenForm }, ...links] : links}
      />
    </div>
    {below && <div className="mt-6">{below}</div>}
    </>
  );
}
