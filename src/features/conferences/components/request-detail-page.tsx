"use client";

import { ArrowLeft, Ban, Building2, Calendar, Check, Clock, Info, LifeBuoy, Mail, MapPin, TriangleAlert, X, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingOverlay } from "@/components/ui/load-more";
import { openPrototypePage } from "@/lib/navigation";
import { roleLanding } from "@/features/workspace/menus";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { AuthRequiredError } from "@/services/errors";
import { getConferenceRequestService } from "@/services/conference-requests";
import type { ConferenceRequest } from "@/types/conference-request";

/* One conference request (the prototype's ConferenceRequestDetailPage): its status and what it means, the information that was sent, and the
   correspondence with Smartconferu. What the database has is shown for real — the request itself, when it was sent, and the Super Admin's note when
   the request was declined. "Cancel This Request" works with the own backend and the mock (POST /conferences/:id/cancel-request; the request leaves the list); the prototype's "Add a message" box is hidden until messages are built (phase 2); meanwhile the card shows a progress strip and the messages we sent. The rows the prototype keeps for a request but this app does not
   ask for (estimated submissions, organizer, contact phone, role, other information) are not listed. */

/** Where people write to about a request (the address the platform's emails already name, lib/email-frame.ts). */
const SUPPORT_EMAIL = "support@smartconferu.com";
const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const STATUS = {
  pending: { label: "Pending Review", color: "var(--warning)", bg: "var(--warning-soft)" },
  approved: { label: "Approved", color: "var(--success)", bg: "var(--success-soft)" },
  rejected: { label: "Rejected", color: "var(--danger)", bg: "var(--danger-soft)" },
  cancelled: { label: "Cancelled", color: "var(--ink-muted)", bg: "var(--muted)" },
} as const;
const TYPE_LABEL: Record<string, string> = { conference: "Conference", book: "Book", journal_special: "Journal Special Issue", journal: "Journal", other: "Other" };
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

function CardHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return <div className="mb-4 flex items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={15} aria-hidden="true" /></div><h3 className="text-sm font-bold text-navy">{title}</h3></div>;
}

type State = { status: "loading" } | { status: "auth" } | { status: "error"; message: string } | { status: "ready"; request: ConferenceRequest | null };

export function RequestDetailPage({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [showCancel, setShowCancel] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    getConferenceRequestService().then((s) => s.list()).then(
      (rows) => { if (alive) setState({ status: "ready", request: rows.find((r) => r.id === id) ?? null }); },
      (e) => { if (alive) setState(e instanceof AuthRequiredError ? { status: "auth" } : { status: "error", message: e instanceof Error ? e.message : "Something went wrong." }); },
    );
    return () => { alive = false; };
  }, [id]);

  const crumbs = [{ label: "My Requests", href: "/my-requests" }, { label: state.status === "ready" && state.request ? state.request.acronym : "Request" }];
  const title = state.status === "ready" && state.request ? `Conference Request — ${state.request.acronym}` : "Conference Request";
  if (state.status === "auth") return <><PageHeader title={title} breadcrumbs={crumbs} /><SessionEnded /></>;
  if (state.status === "loading") return <><PageHeader title={title} breadcrumbs={crumbs} /><div role="status" aria-label="Loading the request" className="p-4 sm:p-8"><div className="h-64 animate-pulse rounded-2xl border border-line bg-white" /></div></>;
  if (state.status === "error") return <><PageHeader title={title} breadcrumbs={crumbs} /><div role="alert" className="m-8 flex items-center gap-3 rounded-2xl border border-danger bg-danger-soft p-5 text-sm font-semibold text-danger"><TriangleAlert size={18} aria-hidden="true" /> {state.message}</div></>;
  if (!state.request) {
    return (
      <>
        <PageHeader title={title} breadcrumbs={crumbs} />
        <div className="p-4 sm:p-8"><div className="rounded-2xl border border-line bg-white"><EmptyState icon={TriangleAlert} title="We couldn't find that request." description="It doesn't exist, or it was approved and is now under My Conferences." action={<Link href="/my-requests"><Button size="sm">My Requests</Button></Link>} /></div></div>
      </>
    );
  }

  const r = state.request;
  const cancelRequest = async (requestId: string) => {
    const service = await getConferenceRequestService();
    if (!service.cancel) { setCancelNote("Cancelling a request isn't available in this mode — your request is unchanged."); return; }
    setCancelling(true); setCancelNote("");
    try {
      await service.cancel(requestId, explanation);
      router.push("/my-requests");
    } catch (e) {
      setCancelNote(e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong.");
      setCancelling(false);
    }
  };
  const cfg = STATUS[r.status];
  const reference = r.id.slice(0, 8).toUpperCase();
  const when = r.startDate || r.endDate ? `${r.startDate ? showDate(r.startDate) : "?"} – ${r.endDate ? showDate(r.endDate) : "?"}` : "";
  const place = [r.venue, r.city, r.country].filter(Boolean).join(", ");
  const fields = [
    { label: "Type", value: TYPE_LABEL[r.type] ?? r.type },
    { label: "Web page", value: r.webPage },
    { label: "Location", value: [r.venue, r.city, r.country].filter(Boolean).join(", ") },
    { label: "Conference dates", value: r.startDate || r.endDate ? `${r.startDate ? showDate(r.startDate) : "?"} – ${r.endDate ? showDate(r.endDate) : "?"}` : "" },
    { label: "Research area", value: [...new Set([r.primaryArea, r.secondaryArea].filter(Boolean))].join(", ") },
    { label: "Contact email", value: r.contactEmail },
  ].filter((f) => f.value);
  const details = [{ label: "Acronym", value: r.acronym }, { label: "Title", value: r.title }, ...fields].filter((d) => d.value);
  const steps: Array<{ label: string; note: string; Icon: LucideIcon; color: string; bg: string }> = [
    { label: "Request sent", note: showDate(r.submittedAt), Icon: Check, color: "var(--success)", bg: "var(--success-soft)" },
    r.status === "cancelled"
      ? { label: "Review stopped", note: "You cancelled it", Icon: Ban, color: "var(--ink-muted)", bg: "var(--muted)" }
      : r.status === "pending"
        ? { label: "In review", note: "Our team is checking it", Icon: Clock, color: "var(--warning)", bg: "var(--warning-soft)" }
        : { label: "Reviewed", note: "Checked by our team", Icon: Check, color: "var(--success)", bg: "var(--success-soft)" },
    r.status === "approved" ? { label: "Approved", note: "The conference is live", Icon: Check, color: "var(--success)", bg: "var(--success-soft)" }
      : r.status === "rejected" ? { label: "Not approved", note: "See the message below", Icon: X, color: "var(--danger)", bg: "var(--danger-soft)" }
      : r.status === "cancelled" ? { label: "Cancelled", note: "No decision needed", Icon: Ban, color: "var(--ink-muted)", bg: "var(--muted)" }
      : { label: "Decision", note: "We'll email you", Icon: Clock, color: "var(--ink-faint)", bg: "var(--muted)" },
  ];

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Conference request ${r.acronym}`)}&body=${encodeURIComponent(`Hello Smartconferu team,\n\nAbout my conference request ${r.acronym} (reference ${reference}):\n\n`)}`;
  const openConference = () => { const { href, external } = roleLanding(r.slug, "chair"); if (external) openPrototypePage(href); else router.push(href); };
  const next: Record<ConferenceRequest["status"], string> = {
    pending: "Our team will check your request and either approve it or contact you if we need more information. You don't need to do anything right now. We'll email you, and this page will show the new status.",
    approved: "Your request was approved and the conference is now live. Open it to finish its profile and publish your Call for Papers.",
    rejected: "This request wasn't approved. You can send a new request any time, or write to us if you'd like to talk it through.",
    cancelled: "You cancelled this request, so nothing more will happen. You can send a new request any time.",
  };

  return (
    <>
      <PageHeader title={title} breadcrumbs={crumbs} />
      <LoadingOverlay open={cancelling} label="Cancelling your request…" hint="Please don't close or refresh the page." />
      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          {/* The request at a glance: what it is, where it stands, and what can be done with it. */}
          <section style={CARD} className="mb-6 overflow-hidden rounded-2xl bg-white">
            <div style={{ background: cfg.color }} className="h-1.5" aria-hidden="true" />
            <div className="flex flex-wrap items-start justify-between gap-5 p-6">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2.5">
                  <span style={{ background: cfg.bg, color: cfg.color }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"><span style={{ background: cfg.color }} className="h-1.5 w-1.5 rounded-full" />{cfg.label}</span>
                  <span className="text-xs text-ink-faint">Submitted {showDate(r.submittedAt)} · Ref. {reference}</span>
                </div>
                <h2 className="text-xl font-extrabold leading-tight text-navy sm:text-2xl">{r.title || r.acronym}</h2>
                <p className="mt-1 text-sm font-semibold text-primary">{r.acronym}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-muted">
                  {when && <span className="inline-flex items-center gap-1.5"><Calendar size={14} aria-hidden="true" /> {when}</span>}
                  {place && <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" /> {place}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link href="/my-requests" style={{ border: "1px solid var(--border)" }} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-canvas"><ArrowLeft size={14} aria-hidden="true" /> My Requests</Link>
                {r.status === "approved" && <button type="button" onClick={openConference} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover">Open the conference</button>}
                {r.status === "pending" && !showCancel && <button type="button" onClick={() => setShowCancel(true)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"><XCircle size={14} aria-hidden="true" /> Cancel this request</button>}
              </div>
            </div>
          </section>

          {showCancel && (
            <div style={{ border: "1.5px solid var(--danger-border-soft, #FECACA)" }} className="mb-6 rounded-xl bg-danger-soft p-6">
              <CardHeader icon={XCircle} title={`Cancel the request for ${r.acronym}?`} />
              <p className="mb-4 text-sm leading-relaxed text-ink-soft">Note that you should <strong>not</strong> cancel this request if you only want to change some details in it. <a href={mailto} className="font-semibold text-primary hover:underline">Write to us</a> instead and we&apos;ll update it for you.</p>
              <label htmlFor="rq-cancel" className="mb-1 block text-xs font-semibold text-ink-soft">Reason for cancelling (optional)</label>
              <p className="mb-2 text-xs text-ink-faint">You can leave this empty. It only helps us understand why you cancelled.</p>
              <textarea id="rq-cancel" value={explanation} onChange={(e) => { setExplanation(e.target.value); setCancelNote(""); }} rows={3} placeholder="Why are you cancelling this request?" className="mb-3 w-full resize-none rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary" />
              {cancelNote && <p role="status" className="mb-3 text-xs font-semibold text-ink-muted">{cancelNote}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void cancelRequest(r.id)} disabled={cancelling} className="cursor-pointer rounded-lg bg-danger px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">Yes, cancel this request</button>
                <button type="button" onClick={() => { setShowCancel(false); setExplanation(""); setCancelNote(""); }} className="cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-white">No, keep my request</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div style={CARD} className="rounded-2xl bg-white p-6">
                <CardHeader icon={Clock} title="Where your request is" />
                <ol aria-label="Request progress" className="grid gap-3 sm:grid-cols-3">
                  {steps.map((st, i) => (
                    <li key={st.label} style={{ border: "1px solid var(--border)" }} className="flex items-start gap-3 rounded-xl bg-white p-3.5">
                      <span style={{ background: st.bg, color: st.color }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"><st.Icon size={15} aria-hidden="true" /></span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Step {i + 1}</span>
                        <span className="block text-sm font-bold text-navy">{st.label}</span>
                        <span className="block text-xs text-ink-muted">{st.note}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="mt-5 flex items-start gap-2.5 rounded-xl px-4 py-3.5">
                  <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-[#1E4E8C]">{next[r.status]}</p>
                </div>
                {r.status === "cancelled" && (
                  <div style={{ border: "1px solid var(--border)" }} className="mt-4 rounded-xl bg-canvas px-4 py-3.5">
                    <div className="mb-1 text-xs font-bold text-ink-muted">Your reason for cancelling</div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{r.decidedNote || "No reason was given."}</p>
                  </div>
                )}
                {r.status === "rejected" && r.decidedNote && (
                  <div style={{ border: "1px solid var(--border)" }} className="mt-4 rounded-xl bg-danger-soft px-4 py-3.5">
                    <div className="mb-1 text-xs font-bold text-danger">Message from Smartconferu</div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{r.decidedNote}</p>
                  </div>
                )}
              </div>

              <div style={CARD} className="rounded-2xl bg-white p-6">
                <CardHeader icon={LifeBuoy} title="Need to talk to us?" />
                <p className="mb-4 text-sm leading-relaxed text-ink-soft">Want to change something in this request, or have a question about it? Write to our team. Mention <strong>{r.acronym}</strong> and the reference <strong>{reference}</strong> so we can find it quickly.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <a href={mailto} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"><Mail size={15} aria-hidden="true" /> Email {SUPPORT_EMAIL}</a>
                  <span className="text-xs text-ink-faint">We reply by email.</span>
                </div>
              </div>
            </div>

            <div style={CARD} className="rounded-2xl bg-white p-6 lg:sticky lg:top-6">
              <CardHeader icon={Building2} title="Conference information" />
              <dl className="space-y-3.5 text-sm">
                {details.map((d) => <div key={d.label}><dt className="mb-0.5 text-xs font-semibold text-ink-faint">{d.label}</dt><dd className="break-words font-medium text-ink">{d.value}</dd></div>)}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
