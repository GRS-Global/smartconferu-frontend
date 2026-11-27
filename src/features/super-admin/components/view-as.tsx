"use client";
/* "View as" (the prototype's ViewAsPanel): why you are looking (one-click reasons, still editable),
   then the user app opens in a new tab, read-only, as that person, for 30 minutes. The reason goes
   in the activity log. The API refuses every change made with the view's token. */
import { useState } from "react";
import { ExternalLink, Eye } from "lucide-react";
import { viewAsUser } from "../services";
import { Button, errorText } from "./ui";

const REASONS = ["The user reported a problem — reproducing it.", "Checking what they see before replying to their ticket.", "Confirming a fix they asked about."];

/** Opens the user app's support-view page in a new tab with the read-only token. */
function openSupportView(view: { accessToken: string; expiresAt: string; user: { name: string } }, next: string) {
  const hash = new URLSearchParams({ token: view.accessToken, name: view.user.name, until: view.expiresAt, next });
  window.open(`/support-view#${hash.toString()}`, "_blank", "noopener");
}

export function ViewAsPanel({ who, userId, next, onCancel, onStarted }: { who: string; userId: string; next: string; onCancel: () => void; onStarted: (text: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const view = await viewAsUser(userId, reason.trim());
      openSupportView(view, next);
      onStarted(`Opened read-only as ${view.user.name} for 30 minutes`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-5 rounded-xl p-4 sa-pop" style={{ background: "var(--primary-soft)" }}>
      <label className="block">
        <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Why are you viewing the app as {who}? <span style={{ color: "var(--danger-ink)" }}>*</span>
        </span>
        <textarea rows={2} className="sa-input resize-none !h-auto py-2.5" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={500} placeholder="e.g. ticket #4182 — chair can't see the Notify authors button" />
      </label>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {REASONS.map((t) => (
          <button key={t} type="button" onClick={() => setReason(t)} className="rounded-full px-2.5 py-1 text-[12px] bg-white cursor-pointer" style={{ border: `1px solid ${reason === t ? "var(--primary)" : "var(--border)"}`, color: reason === t ? "var(--primary)" : "var(--text-soft)" }}>
            {t}
          </button>
        ))}
      </div>
      <p className="text-[12px] mt-3 flex items-start gap-1.5" style={{ color: "var(--text-muted)" }}>
        <Eye size={13} className="shrink-0 mt-px" /> Opens the user app in a new tab, <b>read-only</b> — nothing can be saved or sent — for 30 minutes. Recorded in the audit log with this reason.
      </p>
      {error && (
        <p role="alert" className="text-[13px] mt-2" style={{ color: "var(--danger-ink)" }}>
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 mt-3">
        <Button tone="neutral" variant="soft" onClick={onCancel}>
          Cancel
        </Button>
        <Button tone="primary" busy={busy} disabled={reason.trim().length < 3} onClick={() => void start()}>
          <ExternalLink size={15} />
          Open read-only view
        </Button>
      </div>
    </div>
  );
}
