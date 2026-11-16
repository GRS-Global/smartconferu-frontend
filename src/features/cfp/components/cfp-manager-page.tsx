"use client";

import { ChevronRight, Clock, Eye, FileText, FileUp, Lock, Send, Settings, ShieldCheck, Sparkles, User, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useConferenceInfo } from "@/features/chair/use-conference-info";
import { useConferenceSetup } from "@/features/tour/use-setup";
import { HeroChip, PageHero } from "@/features/workspace/components/hero";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { daysToISO } from "@/features/author/format";
import { getCfpService } from "@/services/cfps";
import { AuthRequiredError } from "@/services/errors";
import type { CfpDetail } from "@/types/cfp";
import { docOf } from "../content";
import { themeOf } from "../themes";
import { CfpNavBar, type CfpEditItem, type CfpNavItem } from "./cfp-nav-bar";
import { CfpDoc, CfpPublicPreview, SUBMISSION_LINK_PENDING } from "./cfp-public-preview";
import { ContentPanel } from "./content-panel";
import { BrandingTab } from "@/features/chair/components/branding-tab";
import { DetailsPanel } from "./details-panel";
import { AddManagerPanel, ManagersPanel } from "./managers-panel";
import { PublishPanel } from "./publish-panel";
import { ThemePanel } from "./theme-panel";

/* The CFP manager (the prototype's CFPManagerPage and CFPDraftViewPage, which are the same page in two states): the conference's Call for Papers —
   its status, where it can be reached, its text, the number of papers and its managers — with a bar of actions: Publish (while it is a draft),
   Managers, View, and Edit ▾ (content, details, theme, logo, Close this CFP). Publish, View, the overview, Edit content, Edit details, Change theme, Change logo (the one Conference Settings › Conference Details keeps) and
   Managers are here. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const STATUS = {
  draft: { label: "Unpublished draft", color: "var(--ink-muted)", bg: "var(--muted)" },
  published: { label: "Published", color: "var(--primary)", bg: "var(--primary-soft)" },
  closed: { label: "Closed", color: "var(--danger)", bg: "var(--danger-soft)" },
} as const;
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "");
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** "Submissions close Jan 10, 2027 · 64 days left" (the prototype's SubmissionDeadlineBadge). */
function DeadlineChip({ iso }: { iso: string }) {
  if (!iso) return null;
  const days = daysToISO(iso);
  if (days === null) return null;
  const tone = days < 0 ? { bg: "var(--danger-soft)", color: "var(--danger)" } : days === 0 ? { bg: "var(--danger-soft)", color: "var(--danger)" } : days <= 14 ? { bg: "var(--warning-soft)", color: "var(--warning)" } : { bg: "var(--primary-soft)", color: "var(--primary)" };
  const text = days < 0 ? "Submission deadline has passed" : days === 0 ? "Submissions close today" : `Submissions close ${showDate(iso)} · ${days} day${days === 1 ? "" : "s"} left`;
  return <span style={{ background: tone.bg, color: tone.color }} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"><Clock size={11} aria-hidden="true" /> {text}</span>;
}

type Tab = "overview" | "preview" | "publish" | "content" | "details" | "theme" | "logo" | "managers" | "add-manager";

export function CfpManagerPage({ slug }: { slug: string }) {
  const { state, retry, reload: reloadInfo } = useConferenceInfo(slug);
  const setup = useConferenceSetup(slug, true);
  const [cfp, setCfp] = useState<CfpDetail | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  // The new-CFP wizard sends the chair here to finish the text (?tab=content).
  const asked = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(asked === "content" || asked === "managers" ? asked : "overview");
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    getCfpService().then((s) => s.load(slug)).then((d) => { if (!cancelled) { setCfp(d); setLoadError(""); } }).catch((e: unknown) => {
      if (cancelled) return;
      if (e instanceof AuthRequiredError) retry(); else { setCfp(null); setLoadError(e instanceof Error ? e.message : "Couldn't load this Call for Papers."); }
    });
    return () => { cancelled = true; };
  }, [slug, tick, retry]);

  const gate = workspaceGate(state, retry, { title: "CFP Manager", loadingLabel: "Loading the Call for Papers", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load this Call for Papers." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, screening, info } = state;
  const e = encodeURIComponent(slug);
  const shell = (body: React.ReactNode, title = `${conference.acronym} CFP Manager`, crumb = "CFP Manager") => (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="cfp" screening={screening}>
      <PageHeader title={title} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: crumb }]} />
      <div className="p-4 sm:p-8">{body}</div>
    </ConferenceShell>
  );
  if (cfp === undefined) return shell(<div role="status" aria-label="Loading the Call for Papers" className="h-48 animate-pulse rounded-2xl border border-line bg-white" />);
  if (cfp === null) return shell(<div role="alert" className="flex items-center gap-3 rounded-2xl border border-danger bg-danger-soft p-5 text-sm font-semibold text-danger"><span className="flex-1">{loadError || "We couldn't find this Call for Papers."}</span><button type="button" onClick={reload} className="cursor-pointer rounded-lg border border-danger px-3 py-1.5 text-xs font-bold">Try again</button></div>);

  const draft = cfp.status === "draft";
  const closed = cfp.status === "closed";
  const st = STATUS[cfp.status];
  const theme = themeOf(cfp.themeId);
  const html = docOf(cfp.doc, info, conference.acronym);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/submit/${e}`;
  const submissionLink = cfp.status === "published" ? link : "";
  const where = [info.venue || [info.city, info.state].filter(Boolean).join(", "), info.country].filter(Boolean).join(" · ");
  const missing = setup.ready ? setup.tasks.filter((t) => !t.done).map((t) => t.label) : [];
  const lockedWhy = "This CFP is closed and can't be updated";

  const close = async () => {
    setBusy(true); setError("");
    try {
      const svc = await getCfpService();
      if (draft) await svc.discardDraft(slug); else await svc.close(slug);
      setClosing(false); setTab("overview"); reload();
    } catch (err) { if (err instanceof AuthRequiredError) retry(); else setError(err instanceof Error ? err.message : "Something went wrong."); } finally { setBusy(false); }
  };

  const editItems: CfpEditItem[] = [
    { label: "Edit content", icon: FileText, onClick: () => setTab("content"), active: tab === "content", disabled: closed, disabledReason: lockedWhy },
    { label: "Edit details", icon: Settings, onClick: () => setTab("details"), active: tab === "details", disabled: closed, disabledReason: lockedWhy },
    { label: "Change theme", icon: Sparkles, onClick: () => setTab("theme"), active: tab === "theme", disabled: closed, disabledReason: lockedWhy },
    { label: "Change logo", icon: FileUp, onClick: () => setTab("logo"), active: tab === "logo", disabled: closed, disabledReason: lockedWhy },
    ...(closed ? [] : [{ label: "Close this CFP", icon: XCircle, onClick: () => { setError(""); setClosing(true); }, divider: true, danger: true }]),
  ];
  const navItems: CfpNavItem[] = [
    ...(draft ? [{ label: "Publish", icon: ShieldCheck, onClick: () => setTab("publish"), active: tab === "publish", accent: true }] : []),
    { label: "Managers", icon: User, onClick: () => setTab("managers"), active: tab === "managers" || tab === "add-manager" },
    { label: "View", icon: Eye, onClick: () => setTab("preview"), active: tab === "preview" },
  ];
  const preview = { acronym: conference.acronym, name: conference.name, venue: info.venue, country: info.country, deadline: showDate(info.submissionDeadline), webPage: info.webPage, html, accent: theme.accent };

  const row = (label: string, value: React.ReactNode, first = false) => (
    <div style={first ? undefined : { borderTop: "1px solid var(--muted)" }} className="flex items-center gap-3 px-5 py-3.5"><span className="w-40 shrink-0 text-xs font-semibold text-ink-faint">{label}</span>{value}</div>
  );
  const overview = (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
          {row("Conference web page", info.webPage ? <a href={info.webPage} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-primary hover:underline">{info.webPage}</a> : <span className="text-sm text-ink-faint">Not set</span>, true)}
          {draft && row("Submission link", <span className="text-sm italic text-ink-faint">{SUBMISSION_LINK_PENDING}</span>)}
          {cfp.status === "published" && row("Submission link", <a href={link} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-primary hover:underline">{link}</a>)}
          {row("Venue", <span className="text-sm text-ink">{where || "Not set"}</span>)}
          {draft ? row("Contact", info.contactEmail ? <a href={`mailto:${info.contactEmail}`} className="truncate text-sm font-medium text-primary hover:underline">{info.contactEmail}</a> : <span className="text-sm text-ink-faint">Not set</span>) : row("Submission deadline", <span className="text-sm font-medium text-ink">{showDate(info.submissionDeadline) || "Not set"}</span>)}
        </div>
        <div style={CARD} className="rounded-2xl bg-white p-6">
          <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><FileText size={16} aria-hidden="true" className="text-primary" /> CFP Content</h2>
          <CfpDoc html={html} accent="var(--navy)" />
        </div>
      </div>
      <div className="space-y-6">
        {draft && (
          <div style={{ border: "1.5px dashed var(--warning-border)" }} className="rounded-xl bg-warning-soft p-5">
            <div className="mb-2 text-xs font-semibold text-warning">Draft status</div>
            <p className="text-xs leading-relaxed text-warning">This CFP hasn&apos;t been published yet. Finish the remaining sections and publish it from the CFP Manager to start accepting submissions.</p>
          </div>
        )}
        <div style={CARD} className="rounded-2xl bg-white p-5">
          <div className="mb-3 text-xs font-semibold text-ink-faint">Submissions</div>
          <div className="text-2xl font-bold text-navy"><AnimatedNumber value={cfp.submissions} /></div>
          <p className="mt-1 text-xs text-ink-faint">received so far</p>
        </div>
        <div style={CARD} className="rounded-2xl bg-white p-5">
          <div className="mb-3 text-xs font-semibold text-ink-faint">Managers</div>
          {cfp.managers.length > 0 ? (
            <div className="space-y-2">
              {cfp.managers.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{initials(m.name)}</span>
                  <span className="text-sm font-medium text-ink">{m.name}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-ink-faint">No co-managers added yet — add some from Managers.</p>}
        </div>
        <Link href="/cfp" className="flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-line px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft">{draft ? "Back to My CFPs" : "View All My CFPs"} <ChevronRight size={14} aria-hidden="true" /></Link>
      </div>
    </div>
  );

  const body = (
    <>
      <PageHero
        tile={<Send size={34} aria-hidden="true" />} title={`${conference.acronym} CFP`}
        badge={<span style={{ color: st.color, background: st.bg }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"><span style={{ background: st.color }} className="h-1.5 w-1.5 shrink-0 rounded-full" />{st.label}</span>}
        subtitle={conference.name}
        chips={draft ? <HeroChip icon={Lock}>Not yet published — visible only to CFP managers</HeroChip> : <DeadlineChip iso={info.submissionDeadline} />}
      />
      <div className="mt-5" />
      <CfpNavBar navItems={navItems} editMenuItems={editItems} editMenuActive={tab === "content" || tab === "details" || tab === "theme" || tab === "logo"} />
      {tab === "publish" && draft && (
        setup.ready
          ? <PublishPanel slug={slug} acronym={conference.acronym} chosen={cfp.publicSlug} missing={missing} preview={preview} onCancel={() => setTab("overview")} onPublished={() => { setTab("overview"); reload(); setup.reload(); }} onSessionEnded={retry} />
          : <div role="status" aria-label="Checking what is still missing" className="h-48 animate-pulse rounded-2xl border border-line bg-white" />
      )}
      {tab === "content" && !closed && <ContentPanel slug={slug} acronym={conference.acronym} initialHtml={html} preview={{ ...preview, submissionLink }} onDone={() => setTab("overview")} onSaved={reload} onSessionEnded={retry} />}
      {tab === "details" && !closed && <DetailsPanel slug={slug} info={info} submissionLink={submissionLink} onDone={() => setTab("overview")} onSaved={() => { reloadInfo(); setup.reload(); }} onSessionEnded={retry} />}
      {tab === "managers" && <ManagersPanel key={cfp.managers.map((m) => m.id).join()} slug={slug} acronym={conference.acronym} managers={cfp.managers} onAdd={() => setTab("add-manager")} onDone={() => setTab("overview")} onChanged={reload} onSessionEnded={retry} />}
      {tab === "add-manager" && <AddManagerPanel slug={slug} acronym={conference.acronym} confName={conference.name} managers={cfp.managers} onDone={() => setTab("managers")} onAdded={reload} onSessionEnded={retry} />}
      {tab === "logo" && !closed && (
        <div className="space-y-4">
          <BrandingTab slug={slug} acronym={conference.acronym} name={conference.name} logoUrl={info.logoUrl} onSaved={() => reloadInfo()} />
          <Button variant="outline" onClick={() => setTab("overview")}>Back to Overview</Button>
        </div>
      )}
      {tab === "theme" && !closed && <ThemePanel slug={slug} acronym={conference.acronym} currentId={cfp.themeId} preview={{ ...preview, html, submissionLink }} onDone={() => setTab("overview")} onSaved={reload} onSessionEnded={retry} />}
      {tab === "preview" && (
        <div className="mx-auto max-w-3xl space-y-5">
          <CfpPublicPreview {...preview} submissionLink={submissionLink} heading="How authors will see this CFP" />
          <button type="button" onClick={() => setTab("overview")} className="cursor-pointer rounded-lg border-[1.5px] border-line px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft">Back to Overview</button>
        </div>
      )}
      {(tab === "overview" || (tab === "publish" && !draft) || ((tab === "content" || tab === "details" || tab === "theme" || tab === "logo") && closed)) && overview}
      <Dialog open={closing} onClose={() => { if (!busy) setClosing(false); }} title="Close this CFP?" size="md">
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">
          {draft
            ? `${conference.acronym} hasn't been published yet, so closing it discards this draft entirely — its text and theme are cleared and ${conference.acronym} goes back to an empty draft. This can't be undone.`
            : `Closing ${conference.acronym} stops it from accepting further updates or submissions. You'll still be able to view it, but Edit Content, Edit Details, Change Theme and Change Logo will be locked. This can't be undone from here.`}
        </p>
        {error && <p role="alert" className="mb-3 text-sm font-semibold text-danger">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => setClosing(false)} disabled={busy}>Cancel</Button>
          <button type="button" onClick={() => void close()} disabled={busy} className="cursor-pointer rounded-lg bg-danger px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Closing…" : "Close This CFP"}</button>
        </div>
      </Dialog>
    </>
  );
  return shell(body, draft ? `${conference.acronym} — CFP Manager (Draft Version)` : `${conference.acronym} CFP Manager`);
}
