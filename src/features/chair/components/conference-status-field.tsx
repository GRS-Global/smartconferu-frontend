"use client";

import { Lock, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/ui/field";
import { getChairService } from "@/services/chair";
import type { DeletionRequest } from "@/types/chair";

/* Conference Details › Status (the prototype's status row for a real conference): the status as a pill, and "Archive conference" (new submissions stop right away; papers,
   reviews, decisions and authors stay, and it can be restored). An archived conference can be restored, and its chair can ask the Super Admin to delete it (a reason and
   typing DELETE; the request can be taken back). The database functions are those of migrations 0012 (archive / restore) and 0013 (deletion requests). */

const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const OUTLINE = { border: "1px solid var(--border)" } as const;

export function ConferenceStatusField({ slug, acronym, status, endDate, onChanged }: { slug: string; acronym: string; status: string; endDate: string; onChanged: () => void }) {
  const manually = status === "archived";
  const lapsed = !manually && endDate !== "" && endDate < today();
  const archived = manually || lapsed;
  const [ask, setAsk] = useState<DeletionRequest | null>(null);
  const [archiveAsk, setArchiveAsk] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadAsk = useCallback(() => { if (manually) void getChairService().then((c) => c.loadDeletionRequest(slug)).then(setAsk).catch(() => undefined); }, [slug, manually]);
  useEffect(() => { loadAsk(); }, [loadAsk]);

  const run = async (job: (c: Awaited<ReturnType<typeof getChairService>>) => Promise<void>, done?: () => void) => {
    setBusy(true); setError("");
    try { await job(await getChairService()); done?.(); onChanged(); loadAsk(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {archived
          ? <span style={{ border: "1px solid var(--danger-border, #FECACA)" }} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-danger-ink"><span className="h-1.5 w-1.5 rounded-full bg-danger" /> Archived</span>
          : <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-ink"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Active</span>}
        {manually && <button type="button" onClick={() => void run((c) => c.restoreConference(slug))} disabled={busy} style={{ ...OUTLINE }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:bg-canvas disabled:opacity-60"><RotateCcw size={13} aria-hidden="true" />Restore conference</button>}
        {!manually && <button type="button" onClick={() => { setError(""); setArchiveAsk(true); }} style={{ ...OUTLINE }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-danger-ink transition-colors hover:bg-canvas"><Lock size={13} aria-hidden="true" />Archive conference</button>}
      </div>
      {lapsed && <p className="mt-1.5 text-xs text-ink-faint">Archived because the conference&apos;s end date has passed.</p>}
      {manually && <p className="mt-1.5 text-xs text-ink-faint">New submissions are closed. Restore to open the conference again (the end date must not have passed).</p>}
      {manually && (
        <div className="mt-3 border-t border-muted pt-3">
          {ask?.status === "pending" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning-ink">Deletion requested</span>
              <span className="text-xs text-ink-faint">Waiting for the Super Admin to decide.</span>
              <button type="button" onClick={() => void run((c) => c.cancelDeletion(slug))} disabled={busy} style={OUTLINE} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-canvas disabled:opacity-60">Take back request</button>
            </div>
          ) : (
            <>
              {ask?.status === "rejected" && <p className="mb-2 text-xs text-danger-ink">The Super Admin didn&apos;t approve the deletion{ask.adminNote ? `: ${ask.adminNote}` : "."}</p>}
              <button type="button" onClick={() => { setError(""); setDeleteAsk(true); }} style={OUTLINE} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-danger-ink transition-colors hover:bg-canvas"><Trash2 size={13} aria-hidden="true" />Ask for this conference to be deleted</button>
            </>
          )}
        </div>
      )}
      {error && !archiveAsk && !deleteAsk && <p role="alert" className="mt-2 text-xs font-semibold text-danger-ink">{error}</p>}

      <Dialog open={archiveAsk} onClose={() => { if (!busy) setArchiveAsk(false); }} title="Archive this conference?" description={acronym} icon={Lock} size="md">
        <p className="text-sm leading-relaxed text-ink-muted">New submissions stop right away. Papers, reviews, decisions and authors all stay as they are, and you can restore the conference at any time.</p>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setArchiveAsk(false)} disabled={busy} style={OUTLINE} className="cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-ink-muted">Cancel</button>
          <button type="button" onClick={() => void run((c) => c.archiveConference(slug), () => setArchiveAsk(false))} disabled={busy} className="cursor-pointer rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Archiving…" : "Archive conference"}</button>
        </div>
      </Dialog>

      <Dialog open={deleteAsk} onClose={() => { if (!busy) setDeleteAsk(false); }} title="Ask for this conference to be deleted" description={acronym} icon={Trash2} size="md">
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">Only the Super Admin can delete a conference. They will see your reason and decide. Until then nothing changes, and you can take the request back.</p>
        <label htmlFor="del-reason" className="mb-1.5 block text-xs font-semibold text-ink-soft">Why should it be deleted? *</label>
        <textarea id="del-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: created by mistake, or it was only a test." className={`${INPUT_CLASS} mb-3 resize-y`} />
        <label htmlFor="del-confirm" className="mb-1.5 block text-xs font-semibold text-ink-soft">Type DELETE to confirm deletion *</label>
        <input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" className={INPUT_CLASS} />
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setDeleteAsk(false)} disabled={busy} style={OUTLINE} className="cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-ink-muted">Cancel</button>
          <button type="button" disabled={busy || !reason.trim() || confirm.trim().toUpperCase() !== "DELETE"} onClick={() => void run((c) => c.requestDeletion(slug, reason.trim()), () => { setDeleteAsk(false); setReason(""); setConfirm(""); })} className="cursor-pointer rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Sending…" : "Send request"}</button>
        </div>
      </Dialog>
    </div>
  );
}
