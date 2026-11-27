"use client";

import { Check, ChevronLeft, FileCheck, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { isFieldAnswered } from "@/features/reviewer/form-schema";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import type { ChairReviewer } from "@/types/chair";
import type { ReviewValues } from "@/types/reviewer";
import { setPendingToast } from "../pending-toast";
import { AbstractCard, PaperHeader, age } from "./review-paper-parts";
import { PaperSplit } from "./paper-split";
import { EnhanceReviewDialog } from "./enhance-review-dialog";
import { ReviewFormBody } from "./review-form-preview";
import { useChairPaper } from "../use-chair-paper";
import { chairPaperHref } from "@/lib/routes";
import { useCanonicalPath } from "@/lib/use-canonical-path";

/* The chair's own review of a paper, on a page of its own (the prototype's ChairAddReviewPage, /submissions/:id/chair/review/add): the paper's header and
   abstract, a note that the review counts like any reviewer's (the average and Compare reviews, marked as the chair's; the authors see comments only if
   shared, never the name or scores), the review form, and a bar that says how many required fields are answered, keeps a draft while you type and
   sends the review. Not ported: the paper beside the form (the prototype's split view with the paper and its chat). */

const DRAFT = "smartconferu.chairReviewDraft:";
const AUTOSAVE_MS = 600;

/** The form's answers for a review the chair already wrote: the stored answers plus the score, confidence and the two comments. */
function valuesOf(r: ChairReviewer | undefined): ReviewValues {
  const v = r?.review;
  if (!v) return {};
  return { ...(v.answers as ReviewValues), "f-score": (v.answers["f-score"] as number | undefined) ?? v.score ?? undefined, "f-confidence": (v.answers["f-confidence"] as string | undefined) ?? v.confidence, "f-to-author": v.commentsToAuthor, "f-to-chair": v.commentsToChair };
}
const readDraft = (key: string): { values: ReviewValues; savedAt: number } | null => { try { return JSON.parse(window.sessionStorage.getItem(DRAFT + key) || "null"); } catch { return null; } };
const writeDraft = (key: string, d: { values: ReviewValues; savedAt: number } | null) => { try { if (d) window.sessionStorage.setItem(DRAFT + key, JSON.stringify(d)); else window.sessionStorage.removeItem(DRAFT + key); } catch { /* storage off */ } };

export function ChairAddReviewPage({ label }: { label: string }) {
  const { state, retry } = useChairPaper(label);
  useCanonicalPath(state.status === "ready" ? chairPaperHref(state.conference.id, label, "review/add") : null);
  const gate = workspaceGate(state, retry, { title: label, loadingLabel: "Loading this paper", missingTitle: "We couldn't find that paper.", missingText: "It doesn't exist, or you are not a chair of its conference.", errorTitle: "Couldn't load this paper." });
  if (gate || state.status !== "ready") return gate;
  return <AddReview label={label} state={state} />;
}

function AddReview({ label, state }: { label: string; state: Extract<ReturnType<typeof useChairPaper>["state"], { status: "ready" }> }) {
  const router = useRouter();
  const { conference, roles, others, detail } = state;
  const { paper, data } = detail;
  const mine = detail.reviewers.find((r) => r.byChair);
  const initial = valuesOf(mine);
  const baseline = JSON.stringify(initial);
  // An unsent draft wins over the saved review (it is newer).
  const [values, setValues] = useState<ReviewValues>(() => readDraft(label)?.values ?? initial);
  const [savedAt, setSavedAt] = useState<number | null>(() => readDraft(label)?.savedAt ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [polish, setPolish] = useState(false);
  const dirty = JSON.stringify(values) !== baseline;
  useEffect(() => {
    if (!dirty || !Object.keys(values).length) return undefined;
    const t = setTimeout(() => { const at = Date.now(); writeDraft(label, { values, savedAt: at }); setSavedAt(at); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [values, dirty, label]);

  const fields = detail.form.flatMap((s) => s.fields);
  const required = fields.filter((f) => f.required);
  const answered = required.filter((f) => isFieldAnswered(values[f.id])).length;
  const complete = answered === required.length;
  const confBase = `/chair/${encodeURIComponent(conference.id)}`;
  const back = chairPaperHref(conference.id, paper.id, "review");
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const svc = await getChairService();
      if (mine?.review) await svc.editReview(mine.review.id, values); else await svc.submitOwnReview(paper.dbId, values);
      writeDraft(label, null);
      setPendingToast({ title: mine?.review ? "Your review is updated" : "Your review is submitted", text: `${paper.id} · it now counts in the average score and Compare reviews.` });
      router.push(back);
    } catch (e) {
      setError(e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };
  const change = (id: string, v: string | number) => setValues((x) => ({ ...x, [id]: v }));
  const title = mine?.review ? "Your review" : "Add your review";
  // The newest paper file shows beside the form.
  const paperFile = detail.files.at(-1);
  const openFile = async (download: boolean) => {
    if (!paperFile?.storagePath) { setError("The paper's file isn't available."); return; }
    try { window.open(await (await getChairService()).fileUrl(paperFile.storagePath, download ? paperFile.name : undefined), "_blank", "noopener"); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't open the file."); }
  };
  const loadUrl = useCallback(async (path: string) => (await getChairService()).fileUrl(path), []);

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="peer-review/list" screening={data.screening} foldMenu>
      <PageHeader title={`${title} — ${paper.id}`} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: "Submissions", href: confBase }, { label: paper.id, href: back }, { label: mine?.review ? "Your review" : "Add review" }]}
        actions={<Link href={back} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink-soft hover:bg-canvas"><ChevronLeft size={14} aria-hidden="true" /> Back to review</Link>} />
      <div className="hd-page p-8">
        <PaperSplit title={paper.id} file={paperFile ?? null} loadUrl={loadUrl} chat={{ id: paper.id, dbId: paper.dbId, title: paper.title, abstract: detail.abstract, keywords: detail.keywords, track: paper.track }}>
          {(open) => (
            <div>
              <PaperHeader paper={paper} acronym={conference.acronym} keywords={detail.keywords} compact={open} file={paperFile ?? null} onFile={(download) => void openFile(download)} />
              <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5">
                <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-navy">Your review counts like any reviewer&apos;s: it&apos;s part of the average score and shows in <b>Compare reviews</b>, marked <b>Chair</b>. Authors only see your comments if you share them — never your name or scores.</p>
              </div>
              {detail.abstract && <AbstractCard text={detail.abstract} compact={open} />}
              <div className="space-y-5"><ReviewFormBody form={detail.form} values={values} onChange={change} disabled={busy} onPolish={() => setPolish(true)} /></div>
              <EnhanceReviewDialog open={polish} input={{ review: String(values["f-summary"] ?? ""), title: paper.title, abstract: detail.abstract, ratings: detail.form.flatMap((s) => s.fields).filter((f) => f.type === "score" && Number(values[f.id]) > 0).map((f) => ({ label: f.label, value: Number(values[f.id]) })), submissionId: paper.dbId || undefined }} onApply={(t) => { change("f-summary", t); setPolish(false); }} onClose={() => setPolish(false)} />
              {error && <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-ink">{error}</p>}
              <div style={{ border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(15,23,42,0.08)" }} className="sticky bottom-4 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-4 py-3">
                <span className="flex flex-col">
                  <span style={{ color: complete ? "var(--success-ink)" : "var(--ink-muted)" }} className="text-xs font-semibold">{complete ? "All required fields answered" : `${answered} of ${required.length} required fields answered`}</span>
                  {savedAt && <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint"><Check size={11} aria-hidden="true" /> Draft saved {age(savedAt)}</span>}
                </span>
                <div className="flex items-center gap-3">
                  <Link href={back} className="text-sm font-semibold text-ink-muted transition-colors hover:text-navy">{savedAt ? "Save draft & close" : "Cancel"}</Link>
                  <button type="button" onClick={() => void submit()} disabled={!complete || !dirty || busy} style={{ background: complete && dirty ? "var(--primary)" : "var(--muted)", color: complete && dirty ? "#FFFFFF" : "var(--ink-faint)" }} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed"><FileCheck size={15} aria-hidden="true" /> {busy ? "Sending…" : mine?.review ? "Update review" : "Submit review"}</button>
                </div>
              </div>
            </div>
          )}
        </PaperSplit>
      </div>
    </ConferenceShell>
  );
}
