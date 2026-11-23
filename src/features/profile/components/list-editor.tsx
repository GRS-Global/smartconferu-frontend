"use client";

import { useMasterDataVersion } from "@/lib/master-data";
import { Award, Briefcase, ChevronDown, ChevronUp, Clock, GraduationCap, GripVertical, Lock, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Field, INPUT_CLASS } from "@/components/ui/field";
import { SOCIETIES } from "@/lib/societies";
import type { TimelineEntry } from "@/types/profile";
import {
  blankEntry, entryError, findListName, MEMBERSHIP_GRADES, membershipEntryError, newEntryId, PROFILE_OTHER, similarSocieties, type EntryDraft,
} from "../entries";
import { formatEntryPeriod, MEMBERSHIP_OTHER, membershipPending, membershipSociety, withEntryDates } from "../showcase/helpers";
import { OrgMonogram, PENDING_AMBER } from "../showcase/parts";
import { useSectionSave } from "../use-section-save";
import { FieldError, ListMatch, MonthYearPicker, OtherBox, PendingNote } from "./editor-parts";
import type { EditorProps } from "./editor-types";
import { SectionCard } from "./section-card";

export type ListKind = "experience" | "education" | "membership";

interface Copy { icon: LucideIcon; title: string; sub: string; add: string; empty: string; org: string; titleLabel: string; titlePh: string; current: string; saved: string; society?: boolean }
const COPY: Record<ListKind, Copy> = {
  experience: { icon: Briefcase, title: "Experience", sub: "Roles you have held — use ↑ ↓ to set the order.", add: "Add experience", empty: "No experience added yet.", org: "Organization", titleLabel: "Position", titlePh: "e.g. Research Assistant", current: "I currently work here", saved: "Experience updated" },
  education: { icon: GraduationCap, title: "Education", sub: "Degrees and qualifications — use ↑ ↓ to set the order.", add: "Add education", empty: "No education added yet.", org: "Institution", titleLabel: "Degree", titlePh: "e.g. Ph.D. in Computer Science", current: "I'm currently studying here", saved: "Education updated" },
  membership: { icon: Award, title: "Professional memberships", sub: "Societies and professional bodies — use ↑ ↓ to set the order.", add: "Add membership", empty: "No memberships added yet.", org: "Society / organization", titleLabel: "Membership grade", titlePh: "e.g. Senior Member, Fellow", current: "Membership is active", saved: "Memberships updated", society: true },
};
export const LIST_TITLES: Record<ListKind, string> = { experience: "Edit experience", education: "Edit education", membership: "Edit memberships" };

type Entry = EntryDraft & Partial<Pick<TimelineEntry, "memberNumber" | "memberUrl" | "societyUrl" | "gradeOther" | "gradeRejectReason">>;

/** Membership grade: the list + "Other" (used straight away, marked pending). */
function GradeFields({ entry, onChange, idPrefix, part }: { entry: Entry; onChange: (e: Entry) => void; idPrefix: string; part: "select" | "other" }) {
  const listed = findListName(MEMBERSHIP_GRADES, entry.title);
  const other = Boolean(entry.gradeOther) || (Boolean(entry.title) && !listed);
  const picked = other ? PROFILE_OTHER : listed || "";
  const pick = (v: string) => onChange(v === PROFILE_OTHER
    ? { ...entry, gradeOther: true, gradePending: true, title: listed ? "" : entry.title, gradeRejectReason: undefined }
    : { ...entry, title: v, gradeOther: false, gradePending: false, gradeRejectReason: undefined });
  if (part === "select") {
    return (
      <Field label="Membership grade" htmlFor={`${idPrefix}-title`}>
        <select id={`${idPrefix}-title`} value={picked} onChange={(e) => pick(e.target.value)} className={INPUT_CLASS}>
          <option value="">Select a grade</option>
          {MEMBERSHIP_GRADES.map((n) => <option key={n} value={n}>{n}</option>)}
          <option value={PROFILE_OTHER}>Other — not in the list</option>
        </select>
        {entry.gradeRejectReason && !other && <span className="mt-1 block text-xs text-danger">Your grade wasn&apos;t accepted: {entry.gradeRejectReason} Pick one from the list.</span>}
      </Field>
    );
  }
  if (!other) return null;
  const match = entry.title && findListName(MEMBERSHIP_GRADES, entry.title);
  return (
    <div className="sm:col-span-2">
      <OtherBox>
        <Field label="Grade name" htmlFor={`${idPrefix}-grade-other`}>
          <input id={`${idPrefix}-grade-other`} value={entry.title} placeholder="e.g. Chartered Member" onChange={(e) => onChange({ ...entry, title: e.target.value, gradePending: true })} className={INPUT_CLASS} />
        </Field>
        {match && <ListMatch match={match} onUse={() => pick(match)} />}
        <PendingNote>Our team checks new grades and adds them to the list for everyone. Until then it shows as “Pending review” to you.</PendingNote>
      </OtherBox>
    </div>
  );
}

function SocietyFields({ entry, onChange, idPrefix }: { entry: Entry; onChange: (e: Entry) => void; idPrefix: string }) {
  useMasterDataVersion(); // render again when the Super Admin's lists arrive from the backend
  const society = membershipSociety({ societyId: entry.societyId ?? "", org: entry.org });
  const picked = entry.societyId === MEMBERSHIP_OTHER ? MEMBERSHIP_OTHER : society ? society.id : "";
  const pick = (id: string) => {
    if (id === MEMBERSHIP_OTHER) onChange({ ...entry, societyId: MEMBERSHIP_OTHER, org: society ? "" : entry.org, verification: "pending" });
    else {
      const s = SOCIETIES.find((x) => x.id === id);
      onChange({ ...entry, societyId: id, org: s ? s.name : "", societyUrl: "", verification: "" });
    }
  };
  const similar = similarSocieties(entry.org);
  return (
    <>
      <Field className="sm:col-span-2" label="Membership name" htmlFor={`${idPrefix}-society`}>
        <select id={`${idPrefix}-society`} value={picked} onChange={(e) => pick(e.target.value)} className={INPUT_CLASS}>
          <option value="">Select a society</option>
          {SOCIETIES.map((s) => <option key={s.id} value={s.id}>{s.name === s.acronym ? s.name : `${s.name} (${s.acronym})`}</option>)}
          <option value={MEMBERSHIP_OTHER}>Other — not in the list</option>
        </select>
      </Field>
      {picked === MEMBERSHIP_OTHER && (
        <div className="sm:col-span-2">
          <OtherBox>
            <Field label="Society name" htmlFor={`${idPrefix}-org`}><input id={`${idPrefix}-org`} value={entry.org} placeholder="e.g. International Association of Engineers" onChange={(e) => onChange({ ...entry, org: e.target.value })} className={INPUT_CLASS} /></Field>
            {similar.length > 0 && (
              <div className="rounded-lg border border-primary-soft-border bg-primary-soft px-3 py-2.5">
                <div className="text-[13px] font-semibold text-navy">Already in our list — use it instead?</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {similar.map((s) => (
                    <button key={s.id} type="button" onClick={() => pick(s.id)} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-white pl-1 pr-2.5 text-[13px] font-semibold text-navy hover:border-primary">
                      <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-bold">{s.acronym}</span>{s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label="Society website" htmlFor={`${idPrefix}-society-url`}><input id={`${idPrefix}-society-url`} inputMode="url" value={entry.societyUrl ?? ""} placeholder="https://" onChange={(e) => onChange({ ...entry, societyUrl: e.target.value })} className={INPUT_CLASS} /></Field>
            <PendingNote>Our team verifies new societies and adds their official acronym and logo. Until then it shows as “Pending review” to you.</PendingNote>
          </OtherBox>
        </div>
      )}
      <GradeFields entry={entry} onChange={onChange} idPrefix={idPrefix} part="select" />
      <Field label="Membership number" htmlFor={`${idPrefix}-number`} hint={<span className="inline-flex items-center gap-1"><Lock size={11} aria-hidden="true" /> Private — only you and our team</span>}>
        <input id={`${idPrefix}-number`} value={entry.memberNumber ?? ""} placeholder="e.g. 94512873" onChange={(e) => onChange({ ...entry, memberNumber: e.target.value })} className={INPUT_CLASS} />
      </Field>
      <GradeFields entry={entry} onChange={onChange} idPrefix={idPrefix} part="other" />
      <Field className="sm:col-span-2" label="Membership URL" htmlFor={`${idPrefix}-url`}>
        <input id={`${idPrefix}-url`} inputMode="url" value={entry.memberUrl ?? ""} placeholder="Link to your member profile or certificate (optional)" onChange={(e) => onChange({ ...entry, memberUrl: e.target.value })} className={INPUT_CLASS} />
      </Field>
    </>
  );
}

function EntryFields({ copy, entry, onChange, error, idPrefix }: { copy: Copy; entry: Entry; onChange: (e: Entry) => void; error: string; idPrefix: string }) {
  return (
    <>
      {copy.society ? <SocietyFields entry={entry} onChange={onChange} idPrefix={idPrefix} /> : (
        <>
          <Field className="sm:col-span-2" label={copy.titleLabel} htmlFor={`${idPrefix}-title`}><input id={`${idPrefix}-title`} value={entry.title} placeholder={copy.titlePh} onChange={(e) => onChange({ ...entry, title: e.target.value })} className={INPUT_CLASS} /></Field>
          <Field className="sm:col-span-2" label={copy.org} htmlFor={`${idPrefix}-org`}><input id={`${idPrefix}-org`} value={entry.org} onChange={(e) => onChange({ ...entry, org: e.target.value })} className={INPUT_CLASS} /></Field>
        </>
      )}
      <MonthYearPicker label="From" month={entry.startMonth} year={entry.startYear} onMonth={(v) => onChange({ ...entry, startMonth: v })} onYear={(v) => onChange({ ...entry, startYear: v })} />
      <MonthYearPicker label="To" month={entry.endMonth} year={entry.endYear} onMonth={(v) => onChange({ ...entry, endMonth: v })} onYear={(v) => onChange({ ...entry, endYear: v })} disabled={entry.current} />
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink sm:col-span-2">
        <input type="checkbox" checked={Boolean(entry.current)} onChange={() => onChange({ ...entry, current: !entry.current, endMonth: "", endYear: "" })} className="m-0 h-4 w-4 accent-[var(--primary)]" />
        {copy.current}
      </label>
      {error && <div className="sm:col-span-2"><FieldError text={error} /></div>}
    </>
  );
}

const Grid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">{children}</div>;

/** Experience / Education / Memberships — one editor per list: rows (edit, ↑ ↓, delete) plus an "Add" form. The list keeps exactly this order on the profile. */
export function ListEditor({ kind, profile, save, onDone, onCancel, startSociety, focusAdd }: EditorProps & { kind: ListKind; startSociety?: string | null; focusAdd?: boolean }) {
  const copy = COPY[kind];
  const timeline = profile.timeline.map(withEntryDates);
  const [list, setList] = useState<(TimelineEntry & Entry)[]>(() => timeline.filter((x) => x.type === kind));
  const [editId, setEditId] = useState<string | null>(null);
  const preset = startSociety ? SOCIETIES.find((x) => x.id === startSociety) : null;
  const presetEntry: Entry | null = preset ? { ...blankEntry(), societyId: preset.id, org: preset.name } : null;
  const [newEntry, setNewEntry] = useState<Entry>(() => presetEntry ?? blankEntry());
  const [newError, setNewError] = useState("");
  const state = useSectionSave();
  const addForm = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = addForm.current;
    if ((!startSociety && !focusAdd) || !box) return undefined;
    // The dialog moves focus to itself when it opens (after this effect runs), so wait for that before taking it.
    const t = setTimeout(() => {
      box.scrollIntoView({ block: "center" });
      [...box.querySelectorAll<HTMLElement & { value?: string }>("input:not([type=checkbox]),select,textarea")].find((el) => !el.value)?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [startSociety, focusAdd]);

  const validate = (x: Entry) => (copy.society ? membershipEntryError({ ...x, societyId: x.societyId ?? "" }) : entryError(x));
  const editing = list.find((x) => x.id === editId);
  const editError = editing ? validate(editing) : "";
  const move = (from: number, to: number) => setList((l) => {
    if (to < 0 || to >= l.length || from === to) return l;
    const next = [...l];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    return next;
  });
  const built = (): TimelineEntry & Entry => {
    const trimmed: Partial<Entry> = { title: newEntry.title.trim(), org: newEntry.org.trim() };
    if (copy.society) (["memberNumber", "memberUrl", "societyUrl"] as const).forEach((k) => { if (newEntry[k]) trimmed[k] = String(newEntry[k]).trim(); });
    return { period: "", societyId: "", verification: "", gradePending: false, ...newEntry, ...trimmed, type: kind, id: newEntryId() } as TimelineEntry & Entry;
  };
  const addEntry = () => {
    const err = validate(newEntry);
    if (err) { setNewError(err); return; }
    setList((l) => [built(), ...l]);
    setNewEntry(blankEntry());
    setNewError("");
  };
  const FORM_FIELDS = ["title", "org", "societyId", "societyUrl", "memberNumber", "memberUrl", "startMonth", "startYear", "endMonth", "endYear"] as const;
  const differsFrom = (base: Entry) => FORM_FIELDS.some((k) => String(newEntry[k] ?? "").trim() !== String(base[k] ?? "").trim());
  const formStarted = differsFrom(blankEntry()) && (!presetEntry || differsFrom(presetEntry));

  const submit = async () => {
    if (editError) return;
    // Save also takes what's in the form (people fill it in and press Save): a complete entry is included; an incomplete one keeps the dialog open.
    let items = list;
    if (formStarted) {
      const err = validate(newEntry);
      if (err) { setNewError(err); addForm.current?.scrollIntoView({ block: "center" }); return; }
      items = [built(), ...list];
    }
    const others = timeline.filter((x) => x.type !== kind);
    const saved = copy.society ? items.map((x) => {
      const listed = x.gradeOther && findListName(MEMBERSHIP_GRADES, x.title);
      return listed ? { ...x, title: listed, gradeOther: false, gradePending: false } : x;
    }) : items;
    const wasPending = new Set(timeline.filter((x) => x.type === kind && membershipPending(x)).map((x) => x.id));
    const sentForReview = Boolean(copy.society) && saved.some((x) => membershipPending(x) && !wasPending.has(x.id));
    const gradesBefore = new Set(timeline.filter((x) => x.type === kind && x.gradePending).map((x) => x.id));
    const gradeForReview = Boolean(copy.society) && saved.some((x) => x.gradePending && !gradesBefore.has(x.id));
    const message = sentForReview && gradeForReview ? "Saved — new society and grade sent for review" : sentForReview ? "Saved — new society sent for review" : gradeForReview ? "Saved — new grade sent for review" : copy.saved;
    if (await state.run(() => save({ timeline: [...others, ...saved.map((x) => ({ ...x, period: formatEntryPeriod(x) }))] }))) onDone(message);
  };

  const rowBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors enabled:hover:bg-primary-soft enabled:hover:text-primary disabled:cursor-not-allowed disabled:text-line-strong";
  return (
    <SectionCard inDialog id={`list-${kind}`} title={copy.title} description={copy.sub} save={state} canSave={!editError} onSave={() => void submit()} onCancel={onCancel}>
      <div>
        {list.length === 0 && <p className="mb-1.5 mt-1 text-sm text-ink-muted">{copy.empty}</p>}
        {list.map((e, i) => {
          const isEditing = e.id === editId;
          const society = copy.society ? membershipSociety({ societyId: e.societyId, org: e.org }) : null;
          return (
            <div key={e.id} className={`my-1.5 flex gap-2.5 rounded-xl border py-2.5 pl-2 pr-2 transition-colors hover:border-primary-soft-border ${isEditing ? "items-start border-primary-soft-border bg-[#F5F7FF]" : "items-center border-line bg-white"}`}>
              <span aria-hidden="true" className="flex h-9 w-6 shrink-0 items-center justify-center text-ink-muted"><GripVertical size={16} /></span>
              <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-ink-soft ${isEditing ? "mt-2" : ""}`}>{i + 1}</span>
              {isEditing ? (
                <div className="min-w-0 flex-1 pb-1.5 pr-1 pt-1">
                  <Grid>
                    <EntryFields copy={copy} entry={e} onChange={(next) => setList((l) => l.map((x) => (x.id === e.id ? { ...x, ...next } as TimelineEntry & Entry : x)))} error={editError} idPrefix={`row-${e.id}`} />
                    <div className="flex justify-end sm:col-span-2">
                      <button type="button" onClick={() => { if (!editError) setEditId(null); }} disabled={Boolean(editError)} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-ink-muted">Done</button>
                    </div>
                  </Grid>
                </div>
              ) : (
                <>
                  {copy.society && <OrgMonogram org={e.org} acronym={society?.acronym} logo={society?.logo} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-navy">{e.title}</div>
                    <div className="mt-0.5 truncate text-[13px] text-ink-muted">{[society?.name || e.org, e.memberNumber && `No. ${e.memberNumber}`, formatEntryPeriod(e)].filter(Boolean).join(" · ")}</div>
                    {copy.society && membershipPending(e) && <div style={{ color: PENDING_AMBER }} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold"><Clock size={12} strokeWidth={2.2} aria-hidden="true" /> Pending review</div>}
                    {copy.society && e.verification === "rejected" && <div className="mt-0.5 text-xs font-semibold text-danger">Not accepted{e.verificationReason ? `: ${e.verificationReason}` : ""}</div>}
                  </div>
                  <div role="group" aria-label={`Edit or reorder ${e.title}`} className="flex shrink-0 gap-0.5">
                    <button type="button" onClick={() => setEditId(e.id)} disabled={editId !== null} aria-label={`Edit ${e.title}`} title="Edit" className={rowBtn}><Pencil size={14} aria-hidden="true" /></button>
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${e.title} up`} title="Move up" className={rowBtn}><ChevronUp size={16} aria-hidden="true" /></button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`Move ${e.title} down`} title="Move down" className={rowBtn}><ChevronDown size={16} aria-hidden="true" /></button>
                  </div>
                  <button type="button" onClick={() => setList((l) => l.filter((x) => x.id !== e.id))} aria-label={`Remove ${e.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={16} aria-hidden="true" /></button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div ref={addForm} data-add-form="" className={`mt-4 rounded-xl border bg-canvas p-5 ${startSociety ? "border-primary-soft-border" : "border-line"}`}>
        <div className="text-sm font-bold text-navy">{copy.add}</div>
        <div className="mt-3.5"><Grid><EntryFields copy={copy} entry={newEntry} onChange={(next) => { setNewEntry(next); setNewError(""); }} error={newError} idPrefix="new-entry" /></Grid></div>
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={addEntry} className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-line-strong bg-white px-3.5 text-sm font-semibold text-ink hover:bg-canvas"><Plus size={14} aria-hidden="true" /> Add to list</button>
          {formStarted && !newError && <span data-form-pending="" className="text-xs text-ink-muted">Not in the list yet — it&apos;s added when you click Add to list or Save.</span>}
        </div>
      </div>
    </SectionCard>
  );
}
