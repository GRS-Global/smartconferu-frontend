"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import type { SubmissionExtra } from "@/types/author-submission";
import { useConferenceSettings } from "../use-conference-settings";
import { SubmissionFormEditor } from "./submission-form-editor";
import { SubmissionFormPreview } from "./submission-form-preview";
import { SubmissionSettingsPanel } from "./submission-settings-panel";

/* Submissions › Manage (the prototype's Form and Settings tabs): Form is the submission form editor (the chair's extra questions);
   Settings gathers where the rest of the submission setup lives — Paper Screening, Tracks and Submission types on Conference Settings ›
   Submissions, the Call for Papers dates on Conference Details. */

export function SubmissionsManagePage({ slug }: { slug: string }) {
  const { state, retry, reload } = useConferenceSettings(slug);
  const [editing, setEditing] = useState(false);
  // Two tabs on one page, as in the prototype; ?tab=settings opens the second.
  const [tab, setTab] = useState<"form" | "settings">(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "settings" ? "settings" : "form"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const gate = workspaceGate(state, retry, { title: "Submissions", loadingLabel: "Loading the submission setup", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the submission setup." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, data, settings, extras, info } = state;
  const e = encodeURIComponent(conference.id);
  const save = async (list: SubmissionExtra[]) => {
    setBusy(true); setError("");
    try { await (await getChairService()).saveSubmissionForm(slug, list); setToast({ title: "Submission form saved", text: list.length ? `${list.length} extra question${list.length === 1 ? "" : "s"} on the form.` : "The form has no extra questions." }); reload(); } catch (err) { setError(err instanceof AuthRequiredError ? "Your session ended — please sign in again." : err instanceof Error ? err.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const lastNumber = Math.max(0, ...data.papers.map((p) => Number(/(\d+)$/.exec(p.id)?.[1] ?? 0)));
  const tabCls = (on: boolean) => `rounded-full border px-4 py-2 text-xs font-bold transition-colors ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink-soft hover:bg-canvas"}`;
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="submissions/manage" screening={data.screening}>
      <PageHeader title="Manage Submissions" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="hd-page p-8">
        <div className="mb-6 flex items-center gap-2" aria-label="Manage Submissions">
          <button type="button" aria-pressed={tab === "form"} onClick={() => setTab("form")} className={tabCls(tab === "form")}>Submission Form</button>
          <button type="button" aria-pressed={tab === "settings"} onClick={() => setTab("settings")} className={tabCls(tab === "settings")}>Submission Settings</button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-ink">{error}</p>}
        {tab === "settings" ? (
          <SubmissionSettingsPanel slug={slug} acronym={conference.acronym} received={data.papers.length} lastNumber={lastNumber} settings={settings} deadline={info?.submissionDeadline ?? ""} detailsHref={`/chair/${e}/settings`} onOpenForm={() => setTab("form")} />
        ) : editing ? (
          <>
            <button type="button" onClick={() => setEditing(false)} className="mb-4 text-xs font-bold text-primary hover:underline">← Back to the author&apos;s view</button>
            <SubmissionFormEditor key={JSON.stringify(extras) + settings.stored} initial={extras} stored={settings.stored} busy={busy} onSave={(l) => void save(l)} />
          </>
        ) : (
          <SubmissionFormPreview acronym={conference.acronym} guidelines={settings.submission.guidelines} types={settings.presentationTypes} tracks={settings.tracks.map((t) => t.name)} extras={extras} onEdit={() => setEditing(true)} />
        )}
      </div>
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
