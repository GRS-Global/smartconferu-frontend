"use client";

import { AlertTriangle, Check, Globe2, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { openSetupGuide } from "@/features/tour/conference-tour";
import { getCfpService } from "@/services/cfps";
import { AuthRequiredError } from "@/services/errors";
import { CfpPublicPreview, type CfpPreviewProps } from "./cfp-public-preview";

/* Publish (the prototype's PublishCFPPage): choose the page the CFP lives at, check what is still missing, see what will go live, and publish. In the
   database, publishing opens submissions at once (`publish_cfp`); there is no review step and the submission link is the conference's own
   (/submit/<conference>). The page is chosen once and kept. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const plural = (n: number) => (n === 1 ? "" : "s");
const lower = (label: string) => label.replace(/^(Set the|Choose the|Describe the|Choose|Add) /, "").toLowerCase();

interface Props {
  slug: string;
  acronym: string;
  /** The page chosen earlier ("" until it is chosen). */
  chosen: string;
  /** Required setup that is still open (labels). */
  missing: string[];
  preview: Omit<CfpPreviewProps, "submissionLink" | "heading">;
  onCancel: () => void;
  /** Called once the CFP is published (the manager reloads it). */
  onPublished: () => void;
  onSessionEnded: () => void;
}

export function PublishPanel({ slug, acronym, chosen, missing, preview, onCancel, onPublished, onSessionEnded }: Props) {
  const suggestedBase = acronym.trim().split(/\s+/).filter(Boolean);
  const suggestions = [...new Set([suggestedBase.join(""), suggestedBase.join("").toLowerCase(), suggestedBase.join("-"), suggestedBase.join("-").toLowerCase(), suggestedBase.join("_"), suggestedBase.join("_").toLowerCase()])].filter(Boolean);
  const [page, setPage] = useState(chosen || suggestions[0] || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const locked = Boolean(chosen);
  const canPublish = missing.length === 0;
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/submit/${encodeURIComponent(slug)}`;

  useEffect(() => {
    if (locked) return undefined;
    let cancelled = false;
    getCfpService().then((s) => s.takenPages(slug, suggestions)).then((t) => { if (!cancelled) setTaken(t); }).catch(() => { /* the check at Publish still refuses a taken page */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the suggestions follow the acronym, which does not change on this page
  }, [slug, locked]);

  const validate = (value: string) => {
    if (!value.trim()) return "Choose a page for your CFP.";
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return "Only letters, digits, underscores and hyphens are allowed.";
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return "Must contain at least one letter and one digit.";
    return "";
  };
  const publish = async () => {
    if (!canPublish || busy) return;
    const err = locked ? "" : validate(page);
    if (err) { setError(err); return; }
    setBusy(true); setError("");
    try { await (await getCfpService()).publish(slug, locked ? chosen : page); setDone(true); } catch (e) {
      if (e instanceof AuthRequiredError) onSessionEnded(); else setError(e instanceof Error ? e.message : "Couldn't publish the Call for Papers.");
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="flex items-center justify-center p-8" style={{ minHeight: "60vh" }}>
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft"><Check size={28} strokeWidth={2.5} aria-hidden="true" className="text-success" /></div>
          <h2 className="mb-2 text-lg font-bold text-navy">Call for Papers published</h2>
          <div className="mb-6">
            <p className="mb-3 text-sm text-ink-muted">Submissions are open. Share this link with authors — they sign in (or register) and submit their paper:</p>
            <code className="mb-3 block break-all rounded-lg bg-primary-soft px-3 py-2 text-xs text-primary">{link}</code>
            <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }, () => undefined); }}>{copied ? "Link copied" : "Copy link"}</Button>
          </div>
          <Button variant="outline" onClick={onPublished}>Go to CFP Manager</Button>
        </div>
      </div>
    );
  }

  const notice = (tone: "danger" | "warning", body: ReactNode) => (
    <div role={tone === "danger" ? "alert" : undefined} className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3.5 ${tone === "danger" ? "border-[#FECACA] bg-danger-soft" : "border-warning bg-warning-soft"}`}>{body}</div>
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {!canPublish && notice("danger", (
        <>
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
          <div className="min-w-[16rem] flex-1">
            <p className="text-sm font-bold text-danger">Finish setting up {acronym} before you publish</p>
            <p className="mt-0.5 text-xs text-ink-soft">{missing.length} thing{plural(missing.length)} still missing: {missing.map(lower).join(", ")}.</p>
          </div>
          <button type="button" onClick={() => openSetupGuide()} className="h-9 cursor-pointer rounded-lg bg-danger px-4 text-xs font-bold text-white">Open the setup checklist</button>
        </>
      ))}
      {notice("warning", (
        <>
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-warning"><strong>Warning:</strong> publishing opens submissions straight away: authors can use the submission link as soon as you publish. Please make sure the CFP is ready — check the preview alongside.</p>
        </>
      ))}
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:sticky lg:top-6 lg:col-span-2">
          <div style={CARD} className="rounded-2xl bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-extrabold text-navy"><Globe2 size={16} aria-hidden="true" className="text-primary" /> Choose the CFP web page</h2>
            <p className="-mt-1 mb-4 text-xs text-ink-faint">This is the page authors will visit to view your published CFP — it&apos;ll live at <strong className="text-ink-soft">/cfp/&lt;the part you choose below&gt;</strong>.</p>
            {!locked && suggestions.length > 0 && (
              <div className="mb-4">
                <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Suggested pages</span>
                <div className="grid grid-cols-2 gap-2">
                  {suggestions.map((s) => {
                    const used = taken.includes(s);
                    const on = page === s;
                    return (
                      <button key={s} type="button" disabled={used} onClick={() => { setPage(s); setError(""); }} aria-pressed={on} style={{ border: on ? "1.5px solid var(--primary)" : "1.5px solid var(--border)", background: on ? "var(--primary-soft)" : "#FFFFFF", opacity: used ? 0.5 : 1 }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed">
                        <span style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${on ? "var(--primary)" : "var(--line-strong)"}`, background: on ? "var(--primary)" : "transparent" }} className="flex shrink-0 items-center justify-center">{on && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFFFFF" }} />}</span>
                        <span className={`truncate text-xs font-medium ${used ? "text-ink-faint" : "text-ink"}`}>{s}{used ? " (in use)" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label htmlFor="cfp-page" className="mb-1.5 block text-xs font-semibold text-ink-soft">{locked ? "Your page" : "Or type your own"}</label>
            <div className="mb-2 flex items-center">
              <span style={{ borderRight: "none" }} className="whitespace-nowrap rounded-l-lg border-[1.5px] border-line bg-canvas px-3.5 py-2.5 text-sm font-medium text-ink-muted">/cfp/</span>
              <input id="cfp-page" value={locked ? chosen : page} disabled={locked} onChange={(e) => { setPage(e.target.value); setError(""); }} className="min-w-0 flex-1 rounded-r-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:bg-canvas disabled:text-ink-faint" />
            </div>
            {locked && <p className="text-xs text-ink-faint">You&apos;ve already chosen this page — it can only be set once.</p>}
            {error && <p role="alert" className="text-xs font-semibold text-danger">{error}</p>}
            <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-ink-faint">
              <li>Letters, digits, underscores and hyphens only</li>
              <li>Must include at least one letter and one digit</li>
              <li>Case-sensitive — {suggestions[0]} and {suggestions[1] ?? suggestions[0]} would be different pages</li>
              <li>Unique across Smartconferu — can&apos;t reuse another CFP&apos;s page</li>
              <li>Can only be chosen once, so pick thoughtfully</li>
            </ul>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
            <button type="button" onClick={() => void publish()} disabled={!canPublish || busy} title={canPublish ? undefined : `${missing.length} thing${plural(missing.length)} left to fill in before you can publish`} className="flex cursor-pointer items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><ShieldCheck size={16} aria-hidden="true" /> {busy ? "Publishing…" : "Select Page and Publish"}</button>
          </div>
        </div>
        <div className="lg:col-span-3">
          <CfpPublicPreview {...preview} submissionLink="" heading="Preview — what will go live" />
        </div>
      </div>
    </div>
  );
}
