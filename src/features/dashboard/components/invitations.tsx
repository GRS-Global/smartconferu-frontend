"use client";

import { Check, ChevronRight, Clock, Eye, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import type { ReviewInvitation } from "@/types/conference";

/* Dashboard › review invitations. Accept asks for the guidelines to be confirmed and then adds the
   Reviewer role; Decline asks for a reason. The top of the dashboard only ever gets one line
   (InvitationStrip); the full list — pending plus answered history — lives in the History tab and
   above the conference table (PendingInvitations). */

export const INVITE_DECLINE_REASONS = ["Not available in that period", "Outside my expertise", "Too many commitments", "Other"];
const INVITE_URGENT_DAYS = 3;
const INVITE_PREVIEW_COUNT = 3;

const inviteDetails = (inv: ReviewInvitation) =>
  [inv.invitedBy, inv.invitedAt && `invited ${inv.invitedAt}`, inv.maxPapers && `up to ${inv.maxPapers} papers`].filter(Boolean).join(" · ");

// Whole days from today to an invitation's reply-by date; null if it has none.
function daysLeft(inv: ReviewInvitation): number | null {
  if (!inv.respondBy) return null;
  const [y, m, d] = inv.respondBy.split("-").map(Number);
  const t = new Date();
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86400000);
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/* ---------- state: answering an invitation ---------- */

interface Toast { title: string; text: string; conferenceId?: string }

export interface InvitationController {
  pending: ReviewInvitation[];
  history: ReviewInvitation[];
  openAccept: (inv: ReviewInvitation) => void;
  openDecline: (inv: ReviewInvitation) => void;
  ui: ReactNode;
}

export function useInvitations({ invitations, respond, onAnswered, onOpenWorkspace }: {
  invitations: ReviewInvitation[];
  respond: (id: string, accept: boolean, reason?: string) => Promise<void>;
  /** Reload the dashboard so the new Reviewer role / conference shows. */
  onAnswered: () => void;
  onOpenWorkspace: (conferenceId: string) => void;
}): InvitationController {
  const [flow, setFlow] = useState<{ inv: ReviewInvitation; mode: "accept" | "decline" } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const pending = invitations.filter((i) => i.status === "pending");
  const history = invitations.filter((i) => i.status !== "pending");

  const accept = async (inv: ReviewInvitation) => {
    await respond(inv.id, true);
    setFlow(null);
    onAnswered();
    setToast({ title: `You're on the ${inv.acronym} review committee`, text: "Papers will appear in your review queue once the chair assigns them.", conferenceId: inv.conferenceId });
  };
  const decline = async (inv: ReviewInvitation, reason: string) => {
    await respond(inv.id, false, reason);
    setFlow(null);
    onAnswered();
    setToast({ title: "Invitation declined", text: "Thanks for letting the chair know. You'll find it under History." });
  };

  const ui = (
    <>
      <AcceptDialog invitation={flow?.mode === "accept" ? flow.inv : null} onClose={() => setFlow(null)} onConfirm={accept} />
      <DeclineDialog invitation={flow?.mode === "decline" ? flow.inv : null} onClose={() => setFlow(null)} onConfirm={decline} />
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[60] flex w-[22rem] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-2xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-ink"><Check size={18} strokeWidth={2.5} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-navy">{toast.title}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{toast.text}</p>
            {toast.conferenceId && (
              <button type="button" onClick={() => onOpenWorkspace(toast.conferenceId as string)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                Open reviewer workspace <ChevronRight size={12} aria-hidden="true" />
              </button>
            )}
          </div>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-canvas"><X size={14} aria-hidden="true" /></button>
        </div>
      )}
    </>
  );
  return { pending, history, openAccept: (inv) => setFlow({ inv, mode: "accept" }), openDecline: (inv) => setFlow({ inv, mode: "decline" }), ui };
}

/* ---------- dialogs ---------- */

function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); } finally { setBusy(false); }
  };
  return { busy, error, run, reset: () => setError("") };
}

function AcceptDialog({ invitation, onClose, onConfirm }: { invitation: ReviewInvitation | null; onClose: () => void; onConfirm: (inv: ReviewInvitation) => Promise<void> }) {
  const [ack, setAck] = useState(false);
  const { busy, error, run } = useBusy();
  return (
    <Dialog open={invitation !== null} onClose={() => { setAck(false); onClose(); }} size="md" title={`Join the ${invitation?.acronym ?? ""} review committee`} description="Confirm the guidelines to accept this invitation.">
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3 text-[13px] text-ink-soft">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
        <span>I will review papers honestly and on time, keep them confidential, and declare any conflict of interest to the chair.</span>
      </label>
      {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-danger-ink">{error}</p>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => { setAck(false); onClose(); }}>Cancel</Button>
        <Button disabled={!ack || busy} onClick={() => invitation && run(async () => { await onConfirm(invitation); setAck(false); })}>
          <Check size={15} aria-hidden="true" /> {busy ? "Joining…" : "Join committee"}
        </Button>
      </div>
    </Dialog>
  );
}

function DeclineDialog({ invitation, onClose, onConfirm }: { invitation: ReviewInvitation | null; onClose: () => void; onConfirm: (inv: ReviewInvitation, reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(INVITE_DECLINE_REASONS[0]);
  const [note, setNote] = useState("");
  const { busy, error, run } = useBusy();
  const close = () => { setNote(""); onClose(); };
  return (
    <Dialog open={invitation !== null} onClose={close} size="md" title="Decline invitation" description={invitation ? `Let the ${invitation.acronym} chair know why.` : undefined}>
      <label className="mb-1 block text-xs font-bold text-ink-soft" htmlFor="decline-reason">Reason</label>
      <select id="decline-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
        {INVITE_DECLINE_REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <label className="mb-1 block text-xs font-bold text-ink-soft" htmlFor="decline-note">Note (optional)</label>
      <textarea id="decline-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-primary" />
      {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-danger-ink">{error}</p>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={close}>Cancel</Button>
        <Button disabled={busy} onClick={() => invitation && run(async () => { await onConfirm(invitation, [reason, note.trim()].filter(Boolean).join(" — ")); setNote(""); })}>
          {busy ? "Declining…" : "Decline invitation"}
        </Button>
      </div>
    </Dialog>
  );
}

/* ---------- views ---------- */

/** Top of the dashboard: always one line, however many invitations wait. */
export function InvitationStrip({ pending, onAccept, onDecline, onReview }: { pending: ReviewInvitation[]; onAccept: (i: ReviewInvitation) => void; onDecline: (i: ReviewInvitation) => void; onReview: () => void }) {
  if (!pending.length) return null;
  const single = pending.length === 1 ? pending[0] : null;
  const names = pending.map((i) => i.acronym);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary-soft-border bg-primary-soft px-5 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary"><Eye size={17} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        {single ? (
          <>
            <div className="text-sm font-bold text-navy">You&apos;re invited to review for {single.acronym}</div>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{inviteDetails(single)}{single.respondBy ? ` · reply by ${fmtDate(single.respondBy)}` : ""}</p>
          </>
        ) : (
          <>
            <div className="text-sm font-bold text-navy">{pending.length} review invitations waiting for your reply</div>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{names.slice(0, 2).join(", ")}{names.length > 2 ? ` and ${names.length - 2} more` : ""}</p>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {single ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => onDecline(single)} className="hover:bg-white">Decline</Button>
            <Button size="sm" onClick={() => onAccept(single)}><Check size={13} aria-hidden="true" /> Accept invitation</Button>
          </>
        ) : (
          <Button size="sm" onClick={onReview}>Review invitations <ChevronRight size={13} aria-hidden="true" /></Button>
        )}
      </div>
    </div>
  );
}

/** Above the conference table (All / As a Reviewer): pending invitations, soonest reply-by first. */
export function PendingInvitations({ pending, onAccept, onDecline, onOpenWorkspace }: { pending: ReviewInvitation[]; onAccept: (i: ReviewInvitation) => void; onDecline: (i: ReviewInvitation) => void; onOpenWorkspace: (conferenceId: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  if (!pending.length) return null;
  const sorted = [...pending].sort((a, b) => (daysLeft(a) ?? Infinity) - (daysLeft(b) ?? Infinity));
  const shown = showAll ? sorted : sorted.slice(0, INVITE_PREVIEW_COUNT);
  const hidden = sorted.length - shown.length;
  return (
    <section id="dashboard-pending-invitations" aria-labelledby="pending-inv-title" style={{ scrollMarginTop: 80 }} className="space-y-2.5">
      <h2 id="pending-inv-title" className="inline-flex items-center gap-2 text-[13.5px] font-extrabold text-navy">
        Pending invitations
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-extrabold text-white">{pending.length}</span>
      </h2>
      <InvitationList view="pending" list={shown} onAccept={onAccept} onDecline={onDecline} onOpenWorkspace={onOpenWorkspace} />
      {(hidden > 0 || (showAll && sorted.length > INVITE_PREVIEW_COUNT)) && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          {showAll ? "Show fewer" : `Show all (${sorted.length})`} <ChevronRight size={12} aria-hidden="true" className={showAll ? "-rotate-90" : "rotate-90"} />
        </button>
      )}
    </section>
  );
}

/** One card of invitation rows: "pending" rows get Decline / Accept and the reply-by date; "history"
 *  rows show how and when they were answered. */
export function InvitationList({ view, list, onAccept, onDecline, onOpenWorkspace }: { view: "pending" | "history"; list: ReviewInvitation[]; onAccept: (i: ReviewInvitation) => void; onDecline: (i: ReviewInvitation) => void; onOpenWorkspace: (conferenceId: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      {list.length === 0 && (
        <div className="py-14 text-center">
          <Eye size={28} className="mx-auto mb-3 text-line-strong" aria-hidden="true" />
          <p className="mb-1 text-sm font-semibold text-navy">{view === "pending" ? "You're all caught up." : "No answered invitations yet."}</p>
          <p className="text-sm text-ink-faint">{view === "pending" ? "New review invitations from chairs will appear here." : "Invitations you accept or decline are kept here."}</p>
        </div>
      )}
      {list.map((inv, i) => {
        const accepted = inv.status === "accepted";
        const left = view === "pending" ? daysLeft(inv) : null;
        const urgent = left !== null && left <= INVITE_URGENT_DAYS;
        const urgentLabel = !urgent ? "" : left < 0 ? "Reply overdue" : left === 0 ? "Due today" : left === 1 ? "Due tomorrow" : `Due in ${left} days`;
        return (
          <div key={inv.id} className={cn("flex flex-wrap items-center gap-4 px-5 py-4", i > 0 && "border-t border-muted")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{inv.acronym}</span>
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success-ink">Reviewer</span>
                {inv.conferenceName && <span className="truncate text-sm font-medium text-ink">{inv.conferenceName}</span>}
                {urgent && <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger-ink"><Clock size={11} strokeWidth={2.6} aria-hidden="true" /> {urgentLabel}</span>}
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                {inviteDetails(inv)}{view === "pending" && inv.respondBy ? <> · <span className="font-semibold text-[#B45309]">reply by {fmtDate(inv.respondBy)}</span></> : ""}
              </p>
              {view === "history" && (
                <p className={cn("mt-1 inline-flex flex-wrap items-center gap-1.5 text-xs", accepted ? "text-success-ink" : "text-ink-soft")}>
                  {accepted ? <Check size={12} strokeWidth={2.6} aria-hidden="true" /> : <X size={12} strokeWidth={2.6} aria-hidden="true" />}
                  <span className="font-semibold">{accepted ? "Accepted" : "Declined"} {inv.respondedAt}</span>
                  {!accepted && inv.declineReason && <span className="text-ink-muted">· “{inv.declineReason}”</span>}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {view === "pending" ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => onDecline(inv)} className="font-semibold text-ink-muted">Decline</Button>
                  <Button size="sm" onClick={() => onAccept(inv)}><Check size={13} aria-hidden="true" /> Accept</Button>
                </>
              ) : accepted ? (
                <Button variant="ghost" size="sm" onClick={() => onOpenWorkspace(inv.conferenceId)} className="text-primary hover:bg-primary-soft">Open workspace <ChevronRight size={13} aria-hidden="true" /></Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
