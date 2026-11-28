"use client";

import { AlertTriangle, Bell, Calendar, Check, Clock, Lock, Send, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { getChairService } from "@/services/chair";
import type { LicenseRequest } from "@/types/chair";
import { HelpLabel } from "./setting-label";

/* Conference Details › License expiry (the prototype's LicenseExpiryField): read-only, because Smartconferu sets it, not the chair. A new conference's license runs until one
   month after the conference ends (30 days from creation while it has no end date); only the Super Admin moves it, after a "Request extension" from the chair. One request can be open at a time; the chair can withdraw it. The
   requests are `license_requests` (migration 0035): until it is run, sending says so. */

const TRIAL_DAYS = 30;
const LABEL = "mb-1.5 block text-xs font-semibold text-ink-soft";
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string | null, days: number) => { const b = s ? parse(s) : new Date(); return iso(new Date(b.getFullYear(), b.getMonth(), b.getDate() + days)); };
const addMonths = (s: string, months: number) => { const [y, m, d] = s.split("-").map(Number); const last = new Date(y, m - 1 + months + 1, 0).getDate(); return iso(new Date(y, m - 1 + months, Math.min(d, last))); };
const daysUntil = (s: string) => { const t = new Date(); return Math.round((parse(s).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86400000); };
/** The day a license ends when Smartconferu has set none: one month after the conference ends; with no end date, 30 days from creation (same rule as the backend). */
export const licenseEndOf = (createdAt: string, endDate?: string) => (endDate ? addMonths(endDate, 1) : addDays(createdAt, TRIAL_DAYS));
const show = (s: string) => parse(s).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
const ago = (t: string) => { const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export function LicenseExpiryField({ slug, name, createdAt, endDate, licenseExpiry }: { slug: string; name: string; createdAt: string; endDate?: string; licenseExpiry: string }) {
  const [record, setRecord] = useState<LicenseRequest | null>(null);
  const [draft, setDraft] = useState<{ date: string; reason: string; touched: boolean } | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(() => { void getChairService().then((c) => c.loadLicenseRequest(slug)).then(setRecord).catch(() => undefined); }, [slug]);
  useEffect(() => { reload(); }, [reload]);

  const pending = record?.status === "pending" ? record : null;
  const decided = record && (record.status === "approved" || record.status === "declined") ? record : null;
  // What the Super Admin set wins, then an approved answer, then a month after the conference ends (30 days from creation without an end date).
  const expiry = (decided?.status === "approved" && decided.newExpiry) || licenseExpiry || (endDate || createdAt ? licenseEndOf(createdAt, endDate) : "");
  const days = expiry ? daysUntil(expiry) : null;
  const tone = days === null ? null
    : days < 0 ? { label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, color: "var(--danger-ink)", bg: "var(--danger-soft)" }
      : days <= 30 ? { label: days === 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}`, color: "var(--warning-ink)", bg: "var(--warning-soft)" }
        : { label: `${days} days left`, color: "var(--success-ink)", bg: "var(--success-soft)" };

  // The new date has to be after the current expiry (or after today, if it has already lapsed).
  const today = addDays(null, 0);
  const floor = expiry && expiry > today ? expiry : today;
  const minDate = addDays(floor, 1);
  const dateError = draft && (!draft.date ? "Pick the date you need the license until." : draft.date < minDate ? `Pick a date after ${show(floor)}.` : "");

  const submit = async () => {
    if (!draft) return;
    setDraft({ ...draft, touched: true });
    if (dateError) return;
    setBusy(true); setError("");
    try { await (await getChairService()).requestLicenseExtension(slug, draft.date, draft.reason.trim()); setDraft(null); reload(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't send the request."); } finally { setBusy(false); }
  };
  const withdraw = async () => { setConfirmWithdraw(false); try { await (await getChairService()).withdrawLicenseRequest(slug); } finally { reload(); } };

  return (
    <div>
      <label className={LABEL}><HelpLabel help="licenseExpiry">License expiry</HelpLabel></label>
      {/* Read-only: looks like a field so it lines up with the inputs beside it, but can't be edited. */}
      <div style={{ border: "1px solid var(--border)" }} aria-readonly="true" className="flex min-h-[42px] w-full items-center gap-2 rounded-lg bg-canvas px-3 py-2.5">
        <Lock size={13} aria-hidden="true" className="shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{expiry ? show(expiry) : "Not set"}</span>
        {tone && <span style={{ background: tone.bg, color: tone.color }} className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold">{tone.label}</span>}
      </div>

      {pending ? (
        <div style={{ border: "1px solid var(--border)" }} className="mt-2 rounded-lg bg-warning-soft px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Clock size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-warning-ink" />
            <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft"><span className="font-semibold text-navy">Extension requested to {show(pending.requestedDate)}</span><span className="block text-ink-muted">Waiting for the Super Admin · sent {ago(pending.createdAt)}. You&apos;ll get a notification when it&apos;s decided.</span></div>
          </div>
          <div className="mt-1.5 flex justify-end"><button type="button" onClick={() => setConfirmWithdraw(true)} className="cursor-pointer text-[11px] font-semibold text-ink-muted hover:underline">Withdraw request</button></div>
        </div>
      ) : (
        <>
          {decided && (
            <div style={{ border: "1px solid var(--border)", background: decided.status === "approved" ? "var(--success-soft)" : "var(--danger-soft)" }} className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2.5">
              {decided.status === "approved" ? <Check size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-success-ink" /> : <XCircle size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-danger-ink" />}
              <p className="min-w-0 text-xs leading-relaxed text-ink-soft">
                {decided.status === "approved"
                  ? <><span className="font-semibold text-navy">Extension approved</span> — the license now runs until {show(decided.newExpiry || decided.requestedDate)}.</>
                  : <><span className="font-semibold text-navy">Extension to {show(decided.requestedDate)} declined</span>{decided.decisionReason ? `: “${decided.decisionReason}”` : "."} You can send a new request.</>}
              </p>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs leading-relaxed text-ink-faint">{!licenseExpiry && endDate ? `One month after the conference ends (${show(endDate)}). ` : createdAt && !licenseExpiry ? `${TRIAL_DAYS} days from creation (${show(createdAt)}) — set the conference dates and it moves to one month after the end. ` : "Set by Smartconferu. "}Need more time?</p>
            <button type="button" onClick={() => { setError(""); setDraft({ date: addMonths(floor, 1), reason: "", touched: false }); }} className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline"><Send size={12} aria-hidden="true" /> Request extension</button>
          </div>
        </>
      )}

      <Dialog open={draft !== null} onClose={() => { if (!busy) setDraft(null); }} title="Request a license extension" description={`${name} · the Super Admin reviews and approves it`} icon={Calendar} size="lg">
        {draft && (
          <>
            <div style={{ border: "1px solid var(--border)" }} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
              <span className="text-xs font-semibold text-ink-muted">Current expiry</span>
              <span className="flex items-center gap-2"><span className="text-sm font-bold text-navy">{expiry ? show(expiry) : "Not set"}</span>{tone && <span style={{ background: tone.bg, color: tone.color }} className="rounded-full px-2 py-0.5 text-[10.5px] font-bold">{tone.label}</span>}</span>
            </div>
            <div className="mt-4">
              <label htmlFor="license-ext-date" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Extend until <span className="text-danger-ink">*</span></label>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {[1, 3, 6, 12].map((m) => { const v = addMonths(floor, m); const active = draft.date === v; return <button key={m} type="button" aria-pressed={active} onClick={() => setDraft({ ...draft, date: v })} style={{ border: `1px solid ${active ? "var(--primary)" : "var(--border)"}` }} className={`h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition-colors ${active ? "bg-primary-soft text-primary" : "bg-white text-ink-soft"}`}>+{m === 12 ? "1 year" : `${m} month${m > 1 ? "s" : ""}`}</button>; })}
              </div>
              <input id="license-ext-date" type="date" min={minDate} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={`w-full rounded-xl border-[1.5px] bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-4 ${draft.touched && dateError ? "border-danger focus:ring-danger-soft" : "border-line focus:border-primary focus:ring-primary-soft"}`} />
              {draft.touched && dateError
                ? <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger-ink"><AlertTriangle size={12} aria-hidden="true" /> {dateError}</p>
                : draft.date && expiry && <p className="mt-1.5 text-xs text-ink-faint">{Math.max(0, daysUntil(draft.date) - Math.max(days ?? 0, 0))} more days than today&apos;s license.</p>}
            </div>
            <div className="mt-4">
              <label htmlFor="license-ext-reason" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Reason <span className="font-normal text-ink-faint">(optional)</span></label>
              <textarea id="license-ext-reason" rows={3} maxLength={500} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="e.g. Certificates and the proceedings go out three weeks after the event." className="w-full resize-none rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft" />
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint"><Bell size={12} aria-hidden="true" /> The Super Admin gets an in-app notification.</p>
            {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDraft(null)} disabled={busy} className="h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-canvas">Cancel</button>
              <button type="button" onClick={() => void submit()} disabled={busy} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:shadow-[0_0_24px_rgba(124,58,237,0.35)] disabled:opacity-60"><Send size={14} aria-hidden="true" /> {busy ? "Sending…" : "Send request"}</button>
            </div>
          </>
        )}
      </Dialog>
      {confirmWithdraw && pending && <ConfirmDialog title="Withdraw this request?" message={`The Super Admin will no longer see your request to extend the license to ${show(pending.requestedDate)}.`} confirmLabel="Withdraw" tone="warning" onConfirm={() => void withdraw()} onClose={() => setConfirmWithdraw(false)} />}
    </div>
  );
}
