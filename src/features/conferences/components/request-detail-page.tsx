"use client";

import { Building2, Info, Layers, MailOpen, PlusCircle, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { AuthRequiredError } from "@/services/errors";
import { getConferenceRequestService } from "@/services/conference-requests";
import type { ConferenceRequest } from "@/types/conference-request";

/* One conference request (the prototype's ConferenceRequestDetailPage): its status and what it means, the information that was sent, and the
   correspondence with Smartconferu. What the database has is shown for real — the request itself, when it was sent, and the Super Admin's note when
   the request was declined. "Cancel This Request" and "Send Message" are the prototype's design only: neither can be done yet (a request has no cancelled
   state and there is no place to keep messages), so each says so and changes nothing. The rows the prototype keeps for a request but this app does not
   ask for (estimated submissions, organizer, contact phone, role, other information) are not listed. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const STATUS = {
  pending: { label: "Pending Review", color: "var(--warning)", bg: "var(--warning-soft)" },
  rejected: { label: "Rejected", color: "var(--danger)", bg: "var(--danger-soft)" },
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
  const [message, setMessage] = useState("");
  const [messageNote, setMessageNote] = useState("");
  const [showAll, setShowAll] = useState(false);

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
  const cfg = STATUS[r.status];
  const fields = [
    { label: "Type", value: TYPE_LABEL[r.type] ?? r.type },
    { label: "Web page", value: r.webPage },
    { label: "Location", value: [r.venue, r.city, r.country].filter(Boolean).join(", ") },
    { label: "Conference dates", value: r.startDate || r.endDate ? `${r.startDate ? showDate(r.startDate) : "?"} – ${r.endDate ? showDate(r.endDate) : "?"}` : "" },
    { label: "Research area", value: [...new Set([r.primaryArea, r.secondaryArea].filter(Boolean))].join(", ") },
    { label: "Contact email", value: r.contactEmail },
  ].filter((f) => f.value);
  // The correspondence this app has: the email that confirmed the request (sent when it was submitted) and, for a declined one, the note from the Super Admin.
  const history: Array<{ type: "message"; from: string; to: string; at: string; text: string }> = [
    { type: "message", from: "Smartconferu", to: "You", at: r.submittedAt, text: `We received your installation request for ${r.acronym} (${r.title}). As soon as possible, our team will check it and either grant it or contact you if we need more information.

Thank you for using Smartconferu.` },
    ...(r.status === "rejected" && r.decidedNote ? [{ type: "message" as const, from: "Smartconferu", to: "You", at: "", text: r.decidedNote }] : []),
  ];

  return (
    <>
      <PageHeader title={title} breadcrumbs={crumbs} />
      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          {showCancel && (
            <div style={{ border: "1.5px solid var(--danger-border-soft, #FECACA)" }} className="mb-6 rounded-xl bg-danger-soft p-6">
              <CardHeader icon={XCircle} title={`Cancel Request for ${r.acronym}`} />
              <p className="mb-4 text-sm leading-relaxed text-ink-soft">Note that you should <strong>not</strong> cancel this request if you only want to modify some data in it — send us a message in the correspondence thread instead and we&apos;ll update it for you.</p>
              <label htmlFor="rq-cancel" className="mb-1 block text-xs font-semibold text-ink-soft">Explanation (optional)</label>
              <p className="mb-2 text-xs text-ink-faint">Not mandatory, but it helps us understand why the request was cancelled.</p>
              <textarea id="rq-cancel" value={explanation} onChange={(e) => { setExplanation(e.target.value); setCancelNote(""); }} rows={3} placeholder="Why are you cancelling this request?" className="mb-3 w-full resize-none rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary" />
              {cancelNote && <p role="status" className="mb-3 text-xs font-semibold text-ink-muted">{cancelNote}</p>}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setCancelNote("Cancelling a request isn't switched on yet — your request is unchanged.")} className="cursor-pointer rounded-lg bg-danger px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">Cancel Request</button>
                <button type="button" onClick={() => { setShowCancel(false); setExplanation(""); setCancelNote(""); }} className="cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-white">Keep Request</button>
              </div>
            </div>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-3">
            {/* The status, the key details and the actions — sticky so they stay in view beside a thread that can grow longer. */}
            <div className="space-y-6 lg:sticky lg:top-6">
              <span style={{ background: cfg.bg, color: cfg.color }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"><span style={{ background: cfg.color }} className="h-1.5 w-1.5 rounded-full" />{cfg.label}</span>

              <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="flex items-start gap-2.5 rounded-xl px-4 py-3">
                <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-[#1E4E8C]">
                  {r.status === "rejected" ? "This request wasn't approved — see the message from Smartconferu. You can send a new request any time." : "We're reviewing this request — no action needed right now. We'll email you if we need anything else, or once it's approved."}
                </p>
              </div>

              <div style={CARD} className="rounded-2xl bg-white p-5">
                <CardHeader icon={Building2} title="Conference Information" />
                <p className="-mt-3 mb-3 text-xs text-ink-faint">Submitted {showDate(r.submittedAt)}</p>
                <div className="space-y-3 text-sm">
                  <div><div className="mb-0.5 text-xs font-semibold text-ink-faint">Acronym</div><div className="font-medium text-ink">{r.acronym}</div></div>
                  <div><div className="mb-0.5 text-xs font-semibold text-ink-faint">Title</div><div className="font-medium text-ink">{r.title}</div></div>
                  {showAll && fields.map((f) => <div key={f.label}><div className="mb-0.5 text-xs font-semibold text-ink-faint">{f.label}</div><div className="break-words font-medium text-ink">{f.value}</div></div>)}
                </div>
                <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 w-full cursor-pointer border-t border-muted pt-3 text-left text-xs font-semibold text-primary hover:underline">{showAll ? "Show less" : "Show full details"}</button>
              </div>

              <div style={CARD} className="rounded-2xl bg-white p-1.5">
                <Link href="/my-requests" className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[var(--row-hover,#F1EEFB)]"><Layers size={14} aria-hidden="true" /> My Requests</Link>
                <Link href="/create-conference" className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[var(--row-hover,#F1EEFB)]"><PlusCircle size={14} aria-hidden="true" /> Make New Request</Link>
                {!showCancel && (
                  <>
                    <div className="my-1.5 border-t border-muted" />
                    <button type="button" onClick={() => setShowCancel(true)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"><XCircle size={14} aria-hidden="true" /> Cancel This Request</button>
                  </>
                )}
              </div>
            </div>

            {/* The correspondence — wider, and starts at the top of the page. */}
            <div className="lg:col-span-2">
              <div style={CARD} className="rounded-2xl bg-white p-6">
                <CardHeader icon={MailOpen} title="Correspondence" />
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <div key={i} style={{ border: "1px solid var(--border)" }} className="rounded-xl bg-success-soft p-4">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-bold text-navy">{h.from} → {h.to}</span>{h.at && <span className="text-[11px] text-ink-faint">{showDate(h.at)}</span>}</div>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{h.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-line pt-5">
                  <label htmlFor="rq-message" className="mb-1 block text-xs font-semibold text-ink-soft">Add a message</label>
                  <p className="mb-2 text-xs text-ink-faint">Ask a question or add information for Smartconferu — it&apos;s saved to this correspondence log.</p>
                  <textarea id="rq-message" value={message} onChange={(e) => { setMessage(e.target.value); setMessageNote(""); }} rows={3} placeholder="Type your message..." className="mb-2.5 w-full resize-none rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary" />
                  {messageNote && <p role="status" className="mb-2.5 text-xs font-semibold text-ink-muted">{messageNote}</p>}
                  <button type="button" onClick={() => setMessageNote("Messages to Smartconferu aren't switched on yet — nothing was sent.")} disabled={!message.trim()} className="cursor-pointer rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40">Send Message</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
