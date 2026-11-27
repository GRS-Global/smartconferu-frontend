"use client";

import { FileText, Link2, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { ConferenceMonogram } from "@/features/workspace/components/conference-shell";
import { getCfpService } from "@/services/cfps";
import type { PublicCfp } from "@/types/cfp";
import { docOf } from "../content";
import { themeOf } from "../themes";
import { CfpDoc, SUBMISSION_LINK_PENDING } from "./cfp-public-preview";

/* The page authors visit at /cfp/<page> (the prototype's PublishedCFPPage, Home tab): a hero in the theme's colour with the acronym, name, venue and
   deadline, the conference web page and submission link, the CFP's text, and beside it the key dates and the way in to the submission form. The data is
   readable by anyone (Row Level Security lets anyone read a published CFP and an active conference), but the app's sign-in guard (proxy.ts) still sends a
   signed-out visitor to sign in first and back here: opening this path to signed-out visitors is a one-line change there, left to the owner. A closed CFP says so and takes no submissions. The prototype's Registration tab is not here (registration is not ported). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "");

type State = { status: "loading" } | { status: "error"; message: string } | { status: "missing" } | { status: "ready"; cfp: PublicCfp };

function Message({ icon, title, children }: { icon: React.ReactNode; title?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-3 flex justify-center">{icon}</div>
        {title && <h1 className="mb-2 text-lg font-bold text-navy">{title}</h1>}
        <div className="text-sm text-ink-muted">{children}</div>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Go to Home</Link>
      </div>
    </main>
  );
}

export function PublicCfpPage({ page }: { page: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getCfpService().then((s) => s.loadPublic(page)).then((cfp) => { if (!cancelled) setState(cfp ? { status: "ready", cfp } : { status: "missing" }); }, (e: unknown) => { if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." }); });
    return () => { cancelled = true; };
  }, [page]);

  if (state.status === "loading") return <main className="min-h-screen bg-canvas p-8"><div role="status" aria-label="Loading the Call for Papers" className="mx-auto h-64 max-w-5xl animate-pulse rounded-2xl border border-line bg-white" /></main>;
  if (state.status === "error") return <Message icon={<XCircle size={26} aria-hidden="true" className="text-danger-ink" />}>{state.message}</Message>;
  if (state.status === "missing") return <Message icon={<Send size={26} aria-hidden="true" className="text-ink-faint" />}>No published call for papers found at <span className="font-semibold">/cfp/{page || "…"}</span> — it may not be published yet, or the address is wrong.</Message>;

  const { cfp } = state;
  // A closed Call for Papers has no public page: the address no longer opens the CFP or its submission form.
  if (cfp.status === "closed") return <Message icon={<XCircle size={26} aria-hidden="true" className="text-danger-ink" />} title={`${cfp.acronym} has closed its Call for Papers`}>This link no longer takes submissions.</Message>;

  const accent = themeOf(cfp.themeId).accent;
  const html = docOf(cfp.doc, { about: cfp.about, topics: cfp.topics, venue: cfp.venue, city: cfp.city, country: cfp.country, contactEmail: cfp.contactEmail }, cfp.acronym);
  const where = [cfp.venue || cfp.city, cfp.country].filter(Boolean).join(", ");
  const submit = `/submit/${encodeURIComponent(cfp.slug)}`;
  const conferenceDays = cfp.startDate ? `${showDate(cfp.startDate)}${cfp.endDate ? ` – ${showDate(cfp.endDate)}` : ""}` : "";
  const copy = () => { void navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }, () => undefined); };

  return (
    <main className="min-h-screen bg-canvas" style={{ "--cfp-accent": accent } as CSSProperties}>
      <div style={{ background: accent }} className="px-6 pb-8 pt-10">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <ConferenceMonogram acronym={cfp.acronym} size={52} onTint />
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span style={{ background: "rgba(255,255,255,0.16)" }} className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white">Call for Papers</span>
                <span style={{ background: "rgba(255,255,255,0.16)" }} className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white">Published</span>
              </div>
              <h1 className="text-2xl font-bold leading-tight text-white">{cfp.acronym}: {cfp.name}</h1>
              <p style={{ color: "rgba(255,255,255,0.82)" }} className="mt-1.5 text-sm">{where}{cfp.submissionDeadline ? `${where ? " · " : ""}${showDate(cfp.submissionDeadline)}` : ""}</p>
            </div>
          </div>
          <button type="button" onClick={copy} style={{ background: "rgba(255,255,255,0.16)" }} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/25"><Link2 size={13} aria-hidden="true" /> {copied ? "Link copied" : "Share"}</button>
        </div>
      </div>
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-6">
          <span aria-current="page" style={{ color: accent, boxShadow: `inset 0 -2.5px 0 ${accent}` }} className="flex items-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-sm font-semibold"><FileText size={14} aria-hidden="true" /> Home</span>
          <Link href={submit} className="flex items-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-sm font-semibold text-ink-muted transition-colors hover:text-navy"><Send size={14} aria-hidden="true" /> Submission</Link>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div style={CARD} className="min-w-0 rounded-2xl bg-white p-6">
            <div style={{ border: "1px solid var(--border)", borderRadius: "0.7rem" }} className="mb-5 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-36 shrink-0 text-xs font-semibold text-ink-faint">Conference web page</span>
                {cfp.webPage ? <a href={cfp.webPage} target="_blank" rel="noreferrer" style={{ color: accent }} className="truncate text-sm font-medium hover:underline">{cfp.webPage}</a> : <span className="text-sm text-ink-faint">Not set</span>}
              </div>
              <div style={{ borderTop: "1px solid var(--muted)" }} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-36 shrink-0 text-xs font-semibold text-ink-faint">Submission link</span>
                <span style={{ color: accent }} className="truncate text-sm font-medium">{typeof window === "undefined" ? SUBMISSION_LINK_PENDING : `${window.location.origin}${submit}`}</span>
              </div>
            </div>
            <CfpDoc html={html} accent={accent} />
          </div>
          <div className="space-y-4 lg:sticky lg:top-24">
            <div style={CARD} className="rounded-2xl bg-white p-4">
              <div className="mb-2 text-xs font-semibold text-ink-faint">Key dates</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2"><span className="text-ink-faint">Submission deadline</span><span className="text-right font-semibold text-ink">{showDate(cfp.submissionDeadline) || "—"}</span></div>
                {conferenceDays && <div className="flex justify-between gap-2"><span className="text-ink-faint">Conference</span><span className="text-right font-semibold text-ink">{conferenceDays}</span></div>}
              </div>
            </div>
            <Link href={submit} style={{ background: accent }} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"><Send size={14} aria-hidden="true" /> Submission form</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
