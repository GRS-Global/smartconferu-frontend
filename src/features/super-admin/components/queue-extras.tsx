"use client";
/* The working state shared by every approval queue (the prototype's QueuePage drawer):
   "Assign to me" / "You're reviewing this · Release" / "<X> is reviewing this · Take over", the
   item's messages to the person who asked, and internal notes only admins see. */
import { useCallback, useEffect, useState } from "react";
import { StickyNote, UserCheck } from "lucide-react";
import { useAdmin } from "../session";
import { addQueueNote, claimQueueItem, loadQueueState, releaseQueueItem, type AdminNote, type QueueState } from "../services";
import type { QueueKey } from "../pending";
import { Avatar, Badge, Button, errorText, fmtDate, Section } from "./ui";

const timeOf = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

/** "Assign to me" / "reviewing this" and the internal notes are hidden for now (not needed yet). Set to true to bring them back: nothing else changes. */
const SHOW_CLAIMS_AND_NOTES = false;

/** A queue's claims and notes, reloadable; `null` until loaded. */
export function useQueueState(queue: QueueKey) {
  const [state, setState] = useState<QueueState | null>(null);
  const reload = useCallback(() => {
    loadQueueState(queue)
      .then(setState)
      .catch(() => undefined);
  }, [queue]);
  useEffect(() => {
    reload();
  }, [reload]);
  const claimOf = (itemId: string) => state?.claims.find((c) => c.itemId === itemId) ?? null;
  const notesOf = (itemId: string) => state?.notes.filter((n) => n.itemId === itemId) ?? [];
  return { state, reload, claimOf, notesOf };
}

/** In the table's Waiting cell: who is on it, and whether it has notes. */
export function ClaimMarks({ claim, notes }: { claim: { admin: { name: string } } | null; notes: number }) {
  const { name } = useAdmin();
  if (!SHOW_CLAIMS_AND_NOTES) return null;
  return (
    <>
      {claim && (
        <span title={`${claim.admin.name === name ? "You are" : `${claim.admin.name} is`} reviewing this`} className="rounded-full ring-2 ring-white">
          <Avatar name={claim.admin.name} size={24} />
        </span>
      )}
      {notes > 0 && (
        <span title={`${notes} internal note${notes > 1 ? "s" : ""}`} style={{ color: "var(--text-faint)" }}>
          <StickyNote size={14} />
        </span>
      )}
    </>
  );
}

/** The drawer's top line for a waiting item: since when, and who is on it. */
export function ClaimBar({ queue, itemId, since, waiting, claim: claimed, onChanged }: { queue: QueueKey; itemId: string; since: string; waiting: React.ReactNode; claim: { admin: { id: string; name: string }; claimedAt: string } | null; onChanged: () => void }) {
  const { me } = useAdmin();
  const claim = SHOW_CLAIMS_AND_NOTES ? claimed : null;
  const [error, setError] = useState<string | null>(null);
  const run = (work: Promise<unknown>) =>
    work.then(onChanged).catch((e: unknown) => setError(errorText(e)));
  const mine = claim?.admin.id === me.id;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5 text-[13px]" style={{ color: "var(--text-muted)" }}>
        <span className="inline-flex items-center gap-2">
          Submitted {fmtDate(since)} · waiting {waiting}
        </span>
        {SHOW_CLAIMS_AND_NOTES && !claim && (
          <button onClick={() => run(claimQueueItem(queue, itemId))} className="inline-flex items-center gap-1.5 font-semibold cursor-pointer" style={{ color: "var(--primary)" }}>
            <UserCheck size={15} />
            Assign to me
          </button>
        )}
        {mine && (
          <span className="inline-flex items-center gap-2">
            <Badge tone="primary">
              <UserCheck size={12} />
              You&apos;re reviewing this
            </Badge>
            <button onClick={() => run(releaseQueueItem(queue, itemId))} className="font-semibold cursor-pointer" style={{ color: "var(--text-muted)" }}>
              Release
            </button>
          </span>
        )}
      </div>
      {claim && !mine && (
        <div className="flex items-start gap-3 rounded-xl p-3.5 mb-5 text-[13px]" style={{ background: "var(--warning-soft)" }}>
          <Avatar name={claim.admin.name} size={28} />
          <div className="flex-1">
            <p style={{ color: "var(--text)" }}>
              <b>{claim.admin.name}</b> is reviewing this since {timeOf(claim.claimedAt)} {fmtDate(claim.claimedAt)}.
            </p>
            <p style={{ color: "var(--text-soft)" }}>Check their notes below before deciding, or take it over.</p>
          </div>
          <button onClick={() => run(claimQueueItem(queue, itemId))} className="font-semibold shrink-0 cursor-pointer" style={{ color: "var(--primary)" }}>
            Take over
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] -mt-3 mb-4" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </>
  );
}

/** Messages sent to the person who asked ("Ask for info"), as the item's thread. */
export function MessageThread({ notes }: { notes: AdminNote[] }) {
  const messages = notes.filter((n) => n.kind === "message");
  return (
    <Section title="Messages">
      {messages.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          No messages yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-2.5">
              <Avatar name={m.author?.name ?? "Admin"} size={28} />
              <div className="flex-1 rounded-xl px-3 py-2 text-[13px]" style={{ background: "var(--primary-soft)" }}>
                <p className="text-[11.5px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                  <b style={{ color: "var(--text)" }}>{m.author?.name ?? "Admin"}</b> · {fmtDate(m.createdAt)} {timeOf(m.createdAt)}
                </p>
                <p style={{ color: "var(--text)" }}>{m.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Internal notes: only admins see these. */
export function InternalNotes(props: { queue: QueueKey; itemId: string; notes: AdminNote[]; onChanged: () => void }) {
  return SHOW_CLAIMS_AND_NOTES ? <InternalNotesBox {...props} /> : null;
}

function InternalNotesBox({ queue, itemId, notes, onChanged }: { queue: QueueKey; itemId: string; notes: AdminNote[]; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const own = notes.filter((n) => n.kind === "note");
  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      await addQueueNote(queue, itemId, t);
      setText("");
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-2 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
      <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
        <StickyNote size={13} /> Internal notes <span className="normal-case font-medium tracking-normal">· only admins see these</span>
      </h4>
      {own.map((n) => (
        <div key={n.id} className="flex gap-2.5 mb-3">
          <Avatar name={n.author?.name ?? "Admin"} size={28} />
          <div className="flex-1 rounded-xl px-3 py-2 text-[13px]" style={{ background: "var(--warning-soft)" }}>
            <p className="text-[11.5px] mb-0.5" style={{ color: "var(--text-muted)" }}>
              <b style={{ color: "var(--text)" }}>{n.author?.name ?? "Admin"}</b> · {fmtDate(n.createdAt)} {timeOf(n.createdAt)}
            </p>
            <p style={{ color: "var(--text)" }}>{n.text}</p>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <input className="sa-input" placeholder="Add a note for other admins" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} aria-label="Add a note for other admins" />
        <Button tone="primary" variant="soft" busy={busy} disabled={!text.trim()} onClick={() => void add()}>
          Add
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] mt-2" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </section>
  );
}
