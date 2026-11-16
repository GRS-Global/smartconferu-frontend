"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/* The Dashboard's "Next: …" card (the prototype's ConferenceSetupCard): the conference's life in four stages, the current one's tasks with a
   button each (the first one still to do is the primary "Do this"), the later stages folded under "Later", and the conference profile's
   completeness ring. What is done is read from what is saved. The guided tour (welcome, checklist, spotlight, menu lock) lives in features/tour. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;

export interface SetupTask { label: string; desc: string; done: boolean; href?: string; copy?: string; cta?: string }
export interface SetupStage { key: string; name: string; tasks: SetupTask[]; /** What the card says under the title when the stage is current. */ sub: string }

export function SetupGuide({ stages, profilePct, profileHref }: { stages: SetupStage[]; profilePct: number; profileHref: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const doneOf = (s: SetupStage) => s.tasks.filter((t) => t.done).length;
  const stageDone = (s: SetupStage) => doneOf(s) === s.tasks.length;
  const currentIndex = stages.findIndex((s) => !stageDone(s));
  if (currentIndex < 0) return null;
  const current = stages[currentIndex];
  const later = stages.filter((_, i) => i > currentIndex);
  const total = stages.reduce((a, s) => a + s.tasks.length, 0);
  const done = stages.reduce((a, s) => a + doneOf(s), 0);
  const firstTodo = current.tasks.findIndex((t) => !t.done);
  const copy = async (t: SetupTask) => { try { await navigator.clipboard.writeText(t.copy ?? ""); setCopied(t.label); setTimeout(() => setCopied((c) => (c === t.label ? null : c)), 2500); } catch { /* clipboard blocked: the link is shown on the button's title */ } };
  const R = 16; const C = 2 * Math.PI * R;
  return (
    <section aria-label="Set up your conference" style={CARD} className="rounded-2xl bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><h2 className="text-xl font-extrabold tracking-tight text-navy">Next: {current.name}</h2><p className="text-[13px] text-ink-faint">{doneOf(current)} of {current.tasks.length} done · {current.sub}</p></div>
        <Link href={profileHref} className="flex items-center gap-3 rounded-2xl border border-[var(--primary-soft-border)] bg-primary-soft px-4 py-2.5 transition-colors hover:bg-white">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r={R} fill="none" stroke="#fff" strokeWidth="4" /><circle cx="20" cy="20" r={R} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(profilePct / 100) * C} ${C}`} transform="rotate(-90 20 20)" /><text x="20" y="23.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--navy)">{profilePct}%</text></svg>
          <span><span className="block text-[13px] font-bold text-navy">Conference profile</span><span className="block text-xs font-semibold text-primary">{profilePct >= 100 ? "Complete" : "Complete it →"}</span></span>
        </Link>
      </div>
      <div className="mb-4 mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div style={{ width: `${(done / total) * 100}%` }} className="h-full rounded-full bg-primary" /></div>
      <ol className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Stages">
        {stages.map((s, i) => {
          const isDone = stageDone(s); const isCur = i === currentIndex;
          return (
            <li key={s.key} aria-current={isCur ? "step" : undefined} className={`rounded-xl border px-3.5 py-2.5 ${isDone ? "border-[#BBF7D0] bg-success-soft" : isCur ? "border-primary bg-white shadow-[0_0_0_3px_var(--primary-soft)]" : "border-line bg-white"}`}>
              <div className={`flex items-center gap-1 text-xs font-bold ${isDone ? "text-success" : isCur ? "text-primary" : "text-ink-muted"}`}>{isDone && <Check size={12} strokeWidth={3} aria-hidden="true" />}{i + 1} · {s.name}</div>
              <div className="text-[11.5px] text-ink-faint">{isDone ? "Done" : isCur ? `${doneOf(s)}/${s.tasks.length} done` : "Later"}</div>
            </li>
          );
        })}
      </ol>
      <ul className="divide-y divide-muted border-t border-muted">
        {current.tasks.map((t, i) => (
          <li key={t.label} className="flex items-center gap-3.5 py-3.5">
            <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${t.done ? "bg-success text-white" : "border-2 border-line-strong"}`}>{t.done && <Check size={14} strokeWidth={3} />}</span>
            <div className="min-w-0 flex-1"><div className={`text-[14.5px] font-bold ${t.done ? "text-ink-faint line-through" : "text-navy"}`}>{t.label}</div><div className="text-[12.5px] text-ink-faint">{t.desc}</div></div>
            {t.copy !== undefined ? (
              <button type="button" onClick={() => void copy(t)} title={t.copy} className={`h-9 shrink-0 rounded-xl px-4 text-[13px] font-bold ${t.done ? "border border-line bg-white text-navy hover:bg-canvas" : "bg-primary text-white"}`}>{copied === t.label ? "Copied" : t.done ? "Copy again" : "Copy link"}</button>
            ) : t.href ? (
              <Link href={t.href} className={`inline-flex h-9 shrink-0 items-center rounded-xl px-4 text-[13px] font-bold ${!t.done && i === firstTodo ? "bg-primary text-white hover:bg-primary-hover" : "border border-line bg-white text-navy hover:bg-canvas"}`}>{t.done ? "Open" : i === firstTodo ? "Do this" : (t.cta ?? "Open")}</Link>
            ) : null}
          </li>
        ))}
      </ul>
      {later.length > 0 && <details className="mt-3 border-t border-dashed border-line pt-3"><summary className="cursor-pointer text-[13px] font-bold text-navy">Later · {later.map((s) => s.name).join(", ")}, Profile</summary><ul className="mt-3 space-y-2">{later.map((s) => <li key={s.key} className="text-[13px] text-ink-soft"><b className="text-navy">{s.name}</b> — {s.tasks.map((t) => t.label).join("; ")}</li>)}</ul></details>}
    </section>
  );
}
