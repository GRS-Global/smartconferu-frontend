"use client";

import { AlertTriangle, Mail, Search, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AddPick } from "../add-reviewers";
import type { AssignCandidate } from "./assign-reviewer-popover";

/* Peer Review › "Add reviewer" on a paper (the prototype's AddReviewersModal): pick one or more people from the conference's reviewer pool
   (search, lightest load first, conflicts marked) or add someone new by name and email — they join the pool and get this paper. The page does the
   assigning (and the invitation / assignment emails). Not ported: the keyword-match badges and sort (the database keeps no reviewer expertise). */


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD = "w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft";

export function AddReviewersModal({ paperLabel, candidates, poolEmails, acronym, maxLoad, deadline, busy, error, onAdd, onClose }: {
  paperLabel: string; candidates: AssignCandidate[]; poolEmails: string[]; acronym: string; maxLoad: number | null; deadline: string; busy: boolean; error: string;
  onAdd: (picks: AddPick[], due: string) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<"pool" | "invite">(candidates.length ? "pool" : "invite");
  const [due, setDue] = useState(deadline);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [invite, setInvite] = useState({ name: "", email: "", touched: false });
  const blocked = (c: AssignCandidate) => Boolean(c.conflict?.startsWith("Author"));
  const q = query.trim().toLowerCase();
  // Authors of this paper sink to the bottom; lightest load first (the candidates arrive in that order).
  const rows = candidates.filter((c) => !q || `${c.rev.name} ${c.rev.email}`.toLowerCase().includes(q)).sort((a, b) => Number(blocked(a)) - Number(blocked(b)));
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const pickedRows = candidates.filter((c) => picked.includes(c.rev.memberId));
  const warnings = [
    pickedRows.some((c) => c.conflict && !blocked(c)) && "Someone you picked is at the same institution as an author.",
    pickedRows.some((c) => c.full) && "Someone you picked is already at the papers-per-reviewer limit.",
    pickedRows.some((c) => c.rev.status === "invited") && "Someone you picked hasn't accepted the committee invitation — their paper waits until they do.",
  ].filter((w): w is string => Boolean(w));
  const inviteError = !invite.name.trim() ? "Enter the reviewer's name." : !EMAIL.test(invite.email.trim()) ? "Enter a valid email address."
    : poolEmails.some((e) => e.toLowerCase() === invite.email.trim().toLowerCase()) ? "This person is already in your reviewer pool — pick them from the list." : "";
  const chosen = tab === "pool" ? pickedRows.length : inviteError ? 0 : 1;
  const fromSearch = () => {
    const t = query.trim();
    const isEmail = EMAIL.test(t);
    setInvite({ name: isEmail ? "" : t, email: isEmail ? t : "", touched: false });
    setTab("invite");
  };
  const submit = () => {
    if (tab === "invite") {
      setInvite((v) => ({ ...v, touched: true }));
      if (inviteError) return;
      onAdd([{ invite: { name: invite.name.trim(), email: invite.email.trim() } }], due);
    } else if (pickedRows.length) onAdd(pickedRows.map((c) => ({ rev: c.rev })), due);
  };

  return (
    <>
      <p className="-mt-1 mb-4 text-xs text-ink-faint">{paperLabel}</p>
      <div role="tablist" className="mb-4 inline-flex items-center gap-1 rounded-xl bg-muted p-1">
        {([{ key: "pool", label: `Reviewer pool (${candidates.length})`, Icon: Users }, { key: "invite", label: "Add new reviewer", Icon: UserPlus }] as const).map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)} style={{ boxShadow: on ? "0 1px 3px rgba(15,23,42,0.10)" : "none" }} className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${on ? "bg-white text-navy" : "bg-transparent text-ink-muted"}`}>
              <t.Icon size={13} aria-hidden="true" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "pool" ? (
        <>
          <div className="relative mb-3">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search the reviewer pool" className={`${FIELD} pl-10`} />
          </div>
          {candidates.length === 0 ? (
            <p className="rounded-xl bg-canvas px-4 py-6 text-center text-xs text-ink-faint">Everyone in your reviewer pool is already on this paper. Add a new reviewer.</p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl bg-canvas px-4 py-6 text-center">
              <p className="text-xs text-ink-faint">No reviewer in the pool matches “{query}”.</p>
              {query.trim() && <button type="button" onClick={fromSearch} className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-primary hover:underline"><UserPlus size={13} aria-hidden="true" /> Add “{query.trim()}” as a new {acronym} reviewer and assign to this paper</button>}
            </div>
          ) : (
            <div className="max-h-[22rem] divide-y divide-muted overflow-y-auto rounded-xl border border-line">
              {rows.map((c) => {
                const on = picked.includes(c.rev.memberId);
                const block = blocked(c);
                return (
                  <label key={c.rev.memberId} title={block ? "Can't review a paper they authored" : undefined} className={`flex items-start gap-3 px-4 py-3 transition-colors ${block ? "cursor-not-allowed bg-canvas opacity-70" : `cursor-pointer hover:bg-canvas ${on ? "bg-primary-soft" : "bg-white"}`}`}>
                    <input type="checkbox" checked={on} disabled={block} onChange={() => toggle(c.rev.memberId)} aria-label={`Select ${c.rev.name}`} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{c.rev.name}</span>
                        {block && <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-ink">Author of this paper — can&apos;t review</span>}
                        {!block && c.conflict && <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-ink">{c.conflict}</span>}
                        {!block && c.rev.status === "invited" && <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-ink">Invite not accepted yet</span>}
                      </span>
                      <span className="block truncate text-xs text-ink-faint">{c.rev.email}</span>
                    </span>
                    <span title={maxLoad ? `Maximum papers per reviewer: ${maxLoad}` : undefined} className={`shrink-0 whitespace-nowrap pt-0.5 text-right text-[11px] font-semibold ${c.full ? "text-warning-ink" : "text-ink-muted"}`}>
                      {c.load}{maxLoad ? ` / ${maxLoad}` : ""} paper{c.load === 1 && !maxLoad ? "" : "s"}
                      {c.full && <span className="block text-[10px]">At limit</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {/* Someone who isn't a reviewer of this conference yet: one step adds them to the pool and to this paper. */}
          <button type="button" onClick={fromSearch} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-left text-xs font-semibold text-ink-muted hover:text-primary">
            <Mail size={13} aria-hidden="true" className="shrink-0" /> Not in the pool yet? <span className="font-bold text-primary hover:underline">Add a new reviewer</span> — they join {acronym}&apos;s reviewers and get this paper.
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-ink-muted">They&apos;re added to {acronym}&apos;s reviewer pool, and this paper is held for them. The invitation email asks them to accept and set up their account; once they have, the paper reaches their dashboard as a request they can accept or decline.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="add-rev-name" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Full name <span className="text-danger-ink">*</span></label>
              <input id="add-rev-name" autoFocus value={invite.name} onChange={(e) => setInvite((v) => ({ ...v, name: e.target.value }))} placeholder="Dr. Anika Rao" className={FIELD} />
            </div>
            <div>
              <label htmlFor="add-rev-email" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Email <span className="text-danger-ink">*</span></label>
              <input id="add-rev-email" type="email" value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="name@university.edu" className={FIELD} />
            </div>
          </div>
          {invite.touched && inviteError && <p className="flex items-center gap-1 text-xs font-medium text-danger-ink"><AlertTriangle size={12} aria-hidden="true" /> {inviteError}</p>}
        </div>
      )}

      {tab === "pool" && warnings.length > 0 && (
        <div className="mt-3 space-y-1 rounded-xl border border-line bg-danger-soft px-3.5 py-2.5">
          {warnings.map((w) => <p key={w} className="flex items-start gap-1.5 text-xs font-medium text-danger-ink"><AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0" /> {w}</p>)}
        </div>
      )}
      {tab === "invite" && <p className="mt-3 text-[11px] text-ink-faint">They must accept the committee invitation and then this paper before reviewing it.</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto flex min-w-0 flex-col gap-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">Review due <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 rounded-lg border-[1.5px] border-line px-2 text-[13px] outline-none focus:border-primary" /></label>
          <span className="text-xs text-ink-faint">{chosen ? `${chosen} selected · each gets an assignment email` : tab === "pool" ? "Select one or more reviewers" : ""}</span>
        </div>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !due || (tab === "pool" && !chosen)}><UserPlus size={15} aria-hidden="true" /> {busy ? "Adding…" : tab === "invite" ? "Add & assign" : `Add ${chosen > 1 ? `${chosen} reviewers` : "reviewer"}`}</Button>
      </div>
    </>
  );
}
