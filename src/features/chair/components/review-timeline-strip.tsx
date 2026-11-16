"use client";

import { AlertTriangle, Bell, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { getChairService } from "@/services/chair";
import type { ReviewTimeline } from "@/types/chair";
import { plusDaysISO } from "../assign-rules";

/* Peer Review › the "Review timeline" strip (the prototype's ReviewTimelineStrip + ReviewTimelineEditor): what reviewers get and when they are
   reminded, with an Edit that opens the editor in place. Like the prototype there is no Save button — a change is saved once every field is valid
   (here after a short pause, since it is a database write) and "Done" closes the editor. Reminders go out from the daily job; the reviewing period
   (From / To) is not edited here, it stays on Conference Settings › Review. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
type Draft = { reviewDays: string; reminder1Days: string; reminder2Days: string; reminder1Enabled: boolean; reminder2Enabled: boolean };

export function reviewTimelineProblems(d: Draft): Partial<Record<"reviewDays" | "reminder1Days" | "reminder2Days", string>> {
  const days = Number(d.reviewDays); const r1 = Number(d.reminder1Days); const r2 = Number(d.reminder2Days);
  const out: Partial<Record<"reviewDays" | "reminder1Days" | "reminder2Days", string>> = {};
  if (!Number.isInteger(days) || days < 1 || days > 90) out.reviewDays = "Enter 1 to 90 days.";
  const okDays = !out.reviewDays;
  if (d.reminder1Enabled && (d.reminder1Days.trim() === "" || !Number.isInteger(r1) || r1 < 1 || (okDays && r1 >= days))) out.reminder1Days = okDays ? `Use 1 to ${days - 1} days before the deadline.` : "Enter the number of days.";
  if (d.reminder2Enabled && (d.reminder2Days.trim() === "" || !Number.isInteger(r2) || r2 < 0 || (okDays && r2 >= days))) out.reminder2Days = "Use 0 (the last day) or a few days before.";
  if (d.reminder1Enabled && d.reminder2Enabled && !out.reminder1Days && !out.reminder2Days && r1 <= r2) out.reminder1Days = "Reminder 1 has to come earlier than reminder 2.";
  return out;
}
const reminderWhen = (n: number) => (n === 0 ? "on the last day" : `${n} day${n === 1 ? "" : "s"} before`);
const dayLabel = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

function Chip({ icon: Icon, text, off = false }: { icon: typeof Clock; text: string; off?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${off ? "bg-muted text-ink-muted" : "bg-primary-soft text-primary-hover"}`}><Icon size={13} aria-hidden="true" /> {text}</span>;
}

export function ReviewTimelineEditor({ timeline, emailsHref, onSave }: { timeline: ReviewTimeline; emailsHref: string; onSave: (patch: Partial<ReviewTimeline>) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>({ reviewDays: String(timeline.reviewDays), reminder1Days: String(timeline.reminder1Days), reminder2Days: String(timeline.reminder2Days), reminder1Enabled: timeline.reminder1Enabled, reminder2Enabled: timeline.reminder2Enabled });
  const [saving, setSaving] = useState<"" | "saving" | "saved" | "failed">("");
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const problems = reviewTimelineProblems(draft);
  useEffect(() => () => { if (wait.current) clearTimeout(wait.current); }, []);
  const set = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (wait.current) clearTimeout(wait.current);
    if (Object.keys(reviewTimelineProblems(next)).length) { setSaving(""); return; }
    setSaving("saving");
    wait.current = setTimeout(() => {
      onSave({ reviewDays: Number(next.reviewDays), reminder1Days: next.reminder1Enabled ? Number(next.reminder1Days) : timeline.reminder1Days, reminder2Days: next.reminder2Enabled ? Number(next.reminder2Days) : timeline.reminder2Days, reminder1Enabled: next.reminder1Enabled, reminder2Enabled: next.reminder2Enabled })
        .then(() => setSaving("saved"), () => setSaving("failed"));
    }, 600);
  };
  const end = timeline.closesAt ? timeline.closesAt.slice(0, 10) : "";
  const example = (() => { const iso = plusDaysISO(Number(draft.reviewDays) || 0); return end && iso > end ? end : iso; })();
  const box = (key: keyof Draft, label: string, min: number, max: number) => (
    <input type="number" min={min} max={max} value={String(draft[key])} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} aria-label={label} aria-invalid={Boolean(problems[key as keyof typeof problems])} style={{ border: `1.5px solid ${problems[key as keyof typeof problems] ? "var(--danger)" : "var(--border)"}` }} className="w-20 rounded-lg px-3 py-2 text-right text-sm tabular-nums text-ink outline-none" />
  );
  const err = (m?: string) => m && <p role="alert" className="flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {m}</p>;
  const card = (children: React.ReactNode) => <div className="space-y-2.5 rounded-xl border border-line p-4">{children}</div>;
  const emailLink = <Link href={emailsHref} className="font-semibold text-primary hover:underline">Edit this email</Link>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {card(<>
          <div className="text-sm font-bold text-navy">Review duration</div>
          <div className="flex items-center gap-2">{box("reviewDays", "Days a reviewer has", 1, 90)}<span className="text-sm text-ink-soft">days</span></div>
          {err(problems.reviewDays)}
          <p className="text-xs leading-relaxed text-ink-faint">Counted from the day a paper is given to a reviewer (never past the end of the review period). A paper given today would be due <b className="text-ink-soft">{dayLabel(example)}</b>.</p>
        </>)}
        {card(<>
          <div className="flex items-center justify-between gap-3"><div className="text-sm font-bold text-navy">Reminder 1</div><Switch label="Reminder 1" checked={draft.reminder1Enabled} onChange={(v) => set({ reminder1Enabled: v })} /></div>
          <div className={`flex items-center gap-2 ${draft.reminder1Enabled ? "" : "opacity-50"}`}>{box("reminder1Days", "Days before the deadline for reminder 1", 1, 89)}<span className="text-sm text-ink-soft">days before the deadline</span></div>
          {draft.reminder1Enabled && err(problems.reminder1Days)}
          <p className="text-xs leading-relaxed text-ink-faint">“{Number(draft.reminder1Days) === 1 ? "1 day" : `${draft.reminder1Days || "N"} days`} left to review” — how much time is left and the papers still waiting. {emailLink}</p>
        </>)}
        {card(<>
          <div className="flex items-center justify-between gap-3"><div className="text-sm font-bold text-navy">Reminder 2</div><Switch label="Reminder 2" checked={draft.reminder2Enabled} onChange={(v) => set({ reminder2Enabled: v })} /></div>
          <div className={`flex items-center gap-2 ${draft.reminder2Enabled ? "" : "opacity-50"}`}>{box("reminder2Days", "Days before the deadline for reminder 2", 0, 89)}<span className="text-sm text-ink-soft">days before · 0 = last day</span></div>
          {draft.reminder2Enabled && err(problems.reminder2Days)}
          <p className="text-xs leading-relaxed text-ink-faint">“Last day to review” — today is the deadline and these papers are still waiting. {emailLink}</p>
        </>)}
      </div>
      <p className="text-xs text-ink-faint">Reminders go by email and to the reviewer&apos;s bell, only to reviewers who haven&apos;t submitted yet. They are sent once a day in the morning, by the conference&apos;s calendar day.
        {saving === "saving" && <span className="ml-2 font-semibold text-ink-muted">Saving…</span>}
        {saving === "saved" && <span className="ml-2 font-semibold text-success">Saved</span>}
        {saving === "failed" && <span role="alert" className="ml-2 font-semibold text-danger">Couldn&apos;t save — try again.</span>}
      </p>
    </div>
  );
}

export function ReviewTimelineStrip({ slug, timeline: saved, onSaved }: { slug: string; timeline: ReviewTimeline; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  // What the chips show: the newest saved values, straight away (the page itself reloads when the editor is closed).
  const [fresh, setFresh] = useState<ReviewTimeline | null>(null);
  const timeline = fresh ?? saved;
  const save = async (patch: Partial<ReviewTimeline>) => { const t = { ...(fresh ?? saved), ...patch }; await (await getChairService()).saveReviewTimeline(slug, t); setFresh(t); };
  return (
    <section aria-label="Review timeline" style={CARD} className="rounded-2xl bg-white px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="mr-1 text-sm font-bold text-navy">Review timeline</h2>
        <Chip icon={Clock} text={`Reviewers get ${timeline.reviewDays} days`} />
        <Chip icon={Bell} text={timeline.reminder1Enabled ? `Reminder 1: ${reminderWhen(timeline.reminder1Days)}` : "Reminder 1 off"} off={!timeline.reminder1Enabled} />
        <Chip icon={Bell} text={timeline.reminder2Enabled ? `Reminder 2: ${reminderWhen(timeline.reminder2Days)}` : "Reminder 2 off"} off={!timeline.reminder2Enabled} />
        <span className="flex-1" />
        <button type="button" onClick={() => { if (open) onSaved(); setOpen((o) => !o); }} aria-expanded={open} className="h-8 cursor-pointer rounded-lg border border-line bg-white px-3.5 text-xs font-bold text-navy hover:border-primary hover:text-primary">{open ? "Done" : "Edit"}</button>
      </div>
      {open && <div className="mt-3.5"><ReviewTimelineEditor timeline={saved} emailsHref={`/chair/${encodeURIComponent(slug)}/settings/email-templates`} onSave={save} /></div>}
    </section>
  );
}
