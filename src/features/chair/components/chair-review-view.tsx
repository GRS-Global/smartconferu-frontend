"use client";

import { Bell, Calendar, Check, Clock, KeyRound, MessageSquare, Pencil, Send, Share2, Star, UserPlus, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ChairPaperDetail, ChairReviewer, DecisionType } from "@/types/chair";
import { daysUntil } from "../peer-review";

/* The chair's peer-review page body (the prototype's SubmissionDetailPage, chair layout): "Compare reviews" (each reviewer's scores side by side,
   gaps of 2 or more highlighted, the average and the confidence-weighted overall), "Reviewers & Scores" (a card per reviewer with their stars,
   confidence, recommendation and comments, and the switch that shares the comments with the authors) and "Record decision" (one tile per
   decision type, the note to the authors). Each reviewer card also has Send reminder, Extend deadline, Message and Remove (and Approve / Decline for an extension request).
   Not ported: Email authors and the decision-email previews. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const REC_TONE: Record<string, { color: string; bg: string }> = {
  Accept: { color: "var(--success)", bg: "var(--success-soft)" },
  "Re-review": { color: "#B45309", bg: "var(--warning-soft)" },
  Reject: { color: "var(--danger)", bg: "var(--danger-soft)" },
};
const OUTCOME_SUB: Record<string, string> = { accept: "Accepted", reject: "Rejected", revise: "Revision requested", waitlist: "Waitlisted", registered: "Registered", no_decision: "No decision", plagiarism_clear: "Plagiarism cleared", upload_pending: "Paper upload pending" };
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "");
const one = (n: number) => String(Math.round(n * 10) / 10);

const recOf = (r: ChairReviewer): string => String(r.review?.answers["f-decision"] ?? "");
const scoreOf = (r: ChairReviewer, id: string): number | null => {
  const a = r.review?.answers[id];
  if (typeof a === "number") return a;
  if (id === "f-score" && r.review?.score != null) return r.review.score;
  return null;
};

function Title({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-[15px] font-extrabold text-navy">{children}</h2>{aside}</div>;
}

/** Each reviewer's scores side by side: a column per score field, then confidence and recommendation. */
function Compare({ detail }: { detail: ChairPaperDetail }) {
  const done = detail.reviewers.filter((r) => r.review);
  const fields = detail.form.flatMap((s) => s.fields).filter((f) => f.type === "score");
  if (done.length < 2) return null;
  const col = (id: string) => done.map((r) => scoreOf(r, id));
  const gap = (id: string) => { const v = col(id).filter((x): x is number => x != null); return v.length > 1 && Math.max(...v) - Math.min(...v) >= 2 ? { max: Math.max(...v), min: Math.min(...v) } : null; };
  const overall = fields.find((f) => f.id === "f-score");
  const split = fields.some((f) => gap(f.id)) || (done.some((r) => recOf(r) === "Accept") && done.some((r) => recOf(r) === "Reject"));
  const weighted = (() => {
    if (!overall) return null;
    const rows = done.flatMap((r) => { const s = scoreOf(r, overall.id); return s == null ? [] : [{ s, w: WEIGHT[(r.review?.confidence ?? "").toLowerCase()] ?? 2 }]; });
    return rows.length ? { value: rows.reduce((a, x) => a + x.s * x.w, 0) / rows.reduce((a, x) => a + x.w, 0), plain: rows.reduce((a, x) => a + x.s, 0) / rows.length } : null;
  })();
  const th = "px-3 py-2.5 text-center text-[11.5px] font-semibold text-ink-muted";
  return (
    <section style={CARD} className="rounded-2xl bg-white pt-5">
      <div className="px-5">
        <Title aside={<span style={split ? { color: "#B45309", background: "var(--warning-soft)" } : { color: "var(--success)", background: "var(--success-soft)" }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold"><Check size={12} aria-hidden="true" /> {split ? "Reviewers differ" : "Reviewers agree"}</span>}>Compare reviews</Title>
        <p className="-mt-2 mb-3 text-xs text-ink-faint">Each reviewer&apos;s scores side by side. Gaps of 2 or more points are highlighted.</p>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead><tr className="bg-[#F8FAFC]"><th className={`${th} text-left`}>Reviewer</th>{fields.map((f) => <th key={f.id} className={th}>{f.id === "f-score" ? "Overall recommendation" : f.label}</th>)}<th className={th}>Confidence</th><th className={th}>Recommends</th></tr></thead>
          <tbody>
            {done.map((r) => (
              <tr key={r.assignmentId} className="border-t border-muted">
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">{r.name}</td>
                {fields.map((f) => {
                  const v = scoreOf(r, f.id); const g = gap(f.id);
                  const hot = v != null && g && (v === g.max || v === g.min);
                  return <td key={f.id} style={hot ? { background: "var(--warning-soft)", color: "#B45309" } : undefined} className="px-3 py-2.5 text-center font-bold text-navy">{v ?? <span className="text-line-strong">—</span>}</td>;
                })}
                <td className={`px-3 py-2.5 text-center text-[12.5px] font-semibold ${(r.review?.confidence ?? "").toLowerCase() === "high" ? "text-success" : "text-ink-soft"}`}>{cap(r.review?.confidence ?? "") || "—"}</td>
                <td className="px-3 py-2.5 text-center">{recOf(r) ? <span style={REC_TONE[recOf(r)] ?? { color: "var(--ink-soft)", background: "var(--muted)" }} className="rounded-full px-2 py-0.5 text-[11px] font-bold">{recOf(r)}</span> : <span className="text-line-strong">—</span>}</td>
              </tr>
            ))}
            <tr className="border-t border-line bg-[#F8FAFC]">
              <td className="px-3 py-2.5 text-[11.5px] font-semibold text-ink-muted">Average</td>
              {fields.map((f) => { const v = col(f.id).filter((x): x is number => x != null); return <td key={f.id} className="px-3 py-2.5 text-center font-extrabold text-navy">{v.length ? <>{one(v.reduce((a, b) => a + b, 0) / v.length)}<span className="text-[10.5px] font-semibold text-ink-faint">/{f.max ?? 5}</span></> : "—"}</td>; })}
              <td /><td />
            </tr>
          </tbody>
        </table>
      </div>
      {weighted && <p className="border-t border-line px-5 py-3 text-xs text-ink-soft"><b className="text-navy">Weighted by confidence:</b> Overall recommendation {one(weighted.value)}/5 <span className="text-ink-faint">(plain average {one(weighted.plain)}).</span></p>}
    </section>
  );
}

function Stars({ n }: { n: number }) {
  return <span className="inline-flex gap-0.5" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} className={i <= n ? "fill-[#F59E0B] text-[#F59E0B]" : "text-line-strong"} />)}</span>;
}

const dayLabel = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");
function status(r: ChairReviewer): { text: string; tone: string; note: string } {
  if (r.review) return { text: `Reviewed${r.review.submittedAt ? ` · ${r.review.submittedAt}` : ""}`, tone: "text-ink-faint", note: "" };
  if (r.awaitingInvite) return { text: "Hasn't accepted the committee invitation yet", tone: "text-warning", note: "This paper starts once they accept your committee invitation." };
  if (r.response === "pending") return { text: `Waiting to accept the paper${r.assignedAt ? ` · assigned ${r.assignedAt}` : ""}`, tone: "text-warning", note: "Waiting for them to accept or decline. You'll be notified either way." };
  if (r.due && daysUntil(r.due) < 0) return { text: `Overdue · was due ${dayLabel(r.due)}`, tone: "text-danger", note: "Waiting for this reviewer to submit their review." };
  return { text: `Accepted · review due ${dayLabel(r.due)}`, tone: "text-primary", note: "Waiting for this reviewer to submit their review." };
}

const SMALL = "inline-flex cursor-pointer items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink-muted transition-colors hover:border-primary-soft-border hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";
const PILL = "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";

function ReviewerCard({ r, locked, onShare, onEdit, onDecide, onAction }: { r: ChairReviewer; locked: boolean; onShare: (r: ChairReviewer, shared: boolean) => void; onEdit: (r: ChairReviewer) => void; onDecide: (r: ChairReviewer, approve: boolean) => void; onAction: (type: "remind" | "extend" | "message" | "remove", r: ChairReviewer) => void }) {
  const st = status(r); const rec = recOf(r); const rv = r.review;
  return (
    <li className="rounded-xl border border-line p-3.5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{initials(r.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-navy">{r.name}{r.byChair && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">You</span>}</div>
          <div className={`text-xs ${st.tone}`}>{st.text}</div>
        </div>
        {rec && <span style={REC_TONE[rec] ?? { color: "var(--ink-soft)", background: "var(--muted)" }} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold">{rec}</span>}
        {!r.awaitingInvite && <button type="button" disabled={locked} onClick={() => onAction("remove", r)} aria-label={`Remove ${r.name}`} className="cursor-pointer text-ink-faint transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"><X size={14} aria-hidden="true" /></button>}
      </div>
      {!r.awaitingInvite && (!rv || !r.byChair) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {!rv && <button type="button" disabled={locked} onClick={() => onAction("remind", r)} className={SMALL}><Bell size={11} aria-hidden="true" /> Send reminder</button>}
          {!rv && <button type="button" disabled={locked} onClick={() => onAction("extend", r)} title={r.due ? `Currently due ${dayLabel(r.due)}` : undefined} className={SMALL}><Calendar size={11} aria-hidden="true" /> Extend deadline</button>}
          {!r.byChair && <button type="button" disabled={locked} onClick={() => onAction("message", r)} className={SMALL}><MessageSquare size={11} aria-hidden="true" /> Message</button>}
        </div>
      )}
      {!rv && st.note && <div className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[11px] font-medium text-ink-faint">{st.note}</div>}
      {/* The reviewer asked for more time: approve (moves their deadline) or decline. */}
      {!rv && r.extension && (
        <div style={{ border: "1px solid var(--border)" }} className="mt-2.5 flex flex-wrap items-start gap-3 rounded-lg bg-warning-soft px-3 py-2.5">
          <Clock size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
            <b className="text-navy">Asked for more time until {dayLabel(r.extension.date)}</b>
            {r.extension.reason && <span> — “{r.extension.reason}”</span>}
            <span className="block text-[11px] text-ink-faint">Requested {r.extension.at}{r.due ? ` · currently due ${dayLabel(r.due)}` : ""}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" disabled={locked} onClick={() => onDecide(r, false)} className="h-7 cursor-pointer rounded-md border border-line bg-white px-2.5 text-[11px] font-bold text-ink-soft hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50">Decline</button>
            <button type="button" disabled={locked} onClick={() => onDecide(r, true)} className="h-7 cursor-pointer rounded-md bg-primary px-2.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Approve</button>
          </div>
        </div>
      )}
      {rv && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={locked} onClick={() => onEdit(r)} style={{ color: "var(--primary)", background: "var(--primary-soft)", borderColor: "var(--primary-soft)" } as CSSProperties} className={PILL}><Pencil size={12} aria-hidden="true" /> {r.byChair ? "Edit my review" : "View & edit review"}</button>
            <button type="button" disabled={locked} onClick={() => onShare(r, !rv.shared)} aria-pressed={rv.shared} title="Send these comments to the authors with the decision (no name, no score)" className={`${PILL} ${rv.shared ? "border-success text-success" : "border-line text-ink-soft hover:bg-canvas"}`}>{rv.shared ? <Check size={12} aria-hidden="true" /> : <Share2 size={12} aria-hidden="true" />} {rv.shared ? "Shared with author" : "Share with author"}</button>

          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Stars n={rv.score ?? 0} />
            <span className="text-xs text-ink-muted tabular-nums">{rv.score ?? "–"} / 5</span>
            {rv.confidence && <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{cap(rv.confidence)} confidence</span>}
          </div>
          {rv.commentsToAuthor && (
            <div className="mt-3 border-l-2 border-line pl-3">
              <div className="text-xs font-semibold text-ink-muted">Comments to author</div>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{rv.commentsToAuthor}</p>
            </div>
          )}
          {rv.commentsToChair && (
            <div style={{ background: "var(--warning-soft)" }} className="mt-3 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#B45309]"><KeyRound size={12} aria-hidden="true" /> Confidential · to chair</div>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{rv.commentsToChair}</p>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export interface ReviewBodyProps {
  detail: ChairPaperDetail; current: DecisionType | null; outcomeType: DecisionType | null; choices: DecisionType[]; pick: DecisionType | null; onPick: (t: DecisionType) => void;
  text: string; onNote: (v: string) => void; notified: boolean; busy: boolean; error: string; withdrawn: boolean;
  onRecord: () => void; onNotify: () => void; onShare: (r: ChairReviewer, shared: boolean) => void; onEdit: (r: ChairReviewer) => void; onDecideExtension: (r: ChairReviewer, approve: boolean) => void; onReviewerAction: (type: "remind" | "extend" | "message" | "remove", r: ChairReviewer) => void;
  onAddReview: () => void; onAddReviewer: () => void; hasMine: boolean;
}

export function ReviewBody(p: ReviewBodyProps) {
  const { detail } = p;
  const done = detail.reviewers.filter((r) => r.review);
  const scores = done.flatMap((r) => (r.review?.score != null ? [r.review.score] : []));
  const recs = done.map(recOf).filter(Boolean);
  const lean = (() => { const n: Record<string, number> = {}; recs.forEach((x) => { n[x] = (n[x] ?? 0) + 1; }); const top = Object.entries(n).sort((a, b) => b[1] - a[1]); return top.length && (top.length === 1 || top[0][1] > top[1][1]) ? top[0][0] : null; })();
  const shared = done.filter((r) => r.review?.shared && r.review.commentsToAuthor).length;
  const commentable = done.filter((r) => r.review?.commentsToAuthor).length;
  const locked = p.busy || p.notified || p.withdrawn;
  // The paper's own outcome (a decision, or a stage such as "Plagiarism clear") is the selected tile, and gets a tile if it is not one of the choices.
  const tiles = p.outcomeType && !p.choices.some((t) => t.id === p.outcomeType?.id) ? [...p.choices, p.outcomeType] : p.choices;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Compare detail={detail} />
        <section style={CARD} className="rounded-2xl bg-white p-5">
          <Title aside={(
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft">{done.length} of {detail.reviewers.length} reviewed</span>
              {scores.length > 0 && <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-bold text-primary">Avg {one(scores.reduce((a, b) => a + b, 0) / scores.length)}/5</span>}
              {!p.hasMine && <button type="button" disabled={locked} onClick={p.onAddReview} className={`${PILL} border-line bg-white text-ink-soft hover:bg-canvas`}><Pencil size={12} aria-hidden="true" /> Add review</button>}
              <button type="button" disabled={locked} onClick={p.onAddReviewer} style={{ borderColor: "var(--primary)", color: "var(--primary)" }} className={`${PILL} bg-white hover:bg-primary-soft`}><UserPlus size={12} aria-hidden="true" /> Add reviewer</button>
            </div>
          )}>Reviewers &amp; Scores</Title>
          {detail.reviewers.length === 0 ? <p className="text-sm text-ink-soft">No reviewers assigned yet.</p> : (
            <ul className="space-y-3">{detail.reviewers.map((r) => <ReviewerCard key={r.assignmentId} r={r} locked={locked} onShare={p.onShare} onEdit={p.onEdit} onDecide={p.onDecideExtension} onAction={p.onReviewerAction} />)}</ul>
          )}
          {detail.declined.length > 0 && <div className="mt-4 text-[12.5px] text-ink-soft"><b className="text-navy">Declined: </b>{detail.declined.map((d) => `${d.name} (${d.reason})`).join("; ")}</div>}
        </section>
      </div>

      <section style={CARD} className="rounded-2xl bg-white p-5">
        <Title>Record decision</Title>
        {detail.reviewers.length > 0 && <div className="mb-3 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-soft">{done.length} of {detail.reviewers.length} reviewed{lean && <> · reviewers lean <b className="text-navy">{lean}</b></>}</div>}
        <div role="group" aria-label="Decision" className="space-y-2">
          {tiles.map((t) => {
            const on = (p.pick ?? p.outcomeType)?.id === t.id;
            return (
              <button key={t.id} type="button" disabled={p.withdrawn || p.notified} onClick={() => p.onPick(t)} aria-pressed={on} style={on ? { background: t.color, borderColor: t.color, color: "#FFFFFF" } : undefined} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? "" : "border-line bg-white hover:bg-canvas"}`}>
                <span aria-hidden="true" style={{ background: on ? "#FFFFFF" : t.color }} className="h-2 w-2 shrink-0 rounded-full" />
                <span className="min-w-0 flex-1"><span className={`block text-[13px] font-bold ${on ? "text-white" : "text-navy"}`}>{t.label}</span><span className={`block text-[11px] ${on ? "text-white/80" : "text-ink-faint"}`}>{OUTCOME_SUB[t.outcome] ?? t.outcome}</span></span>
                {on && <Check size={15} aria-hidden="true" />}
              </button>
            );
          })}
          {tiles.length === 0 && <p className="text-sm text-ink-soft">This conference has no decision types yet.</p>}
        </div>
        <div style={{ border: "1px solid var(--border)" }} className="mt-4 overflow-hidden rounded-xl bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-soft">
          <div className="flex items-start gap-2.5 border-b border-muted bg-canvas px-3.5 py-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><MessageSquare size={14} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <label htmlFor="decision-note" className="block text-[13px] font-bold text-navy">Note to authors <span className="font-normal text-ink-faint">· optional</span></label>
              <span className="block text-[11.5px] leading-snug text-ink-muted">Goes with the decision email. Sum up the reviews in your own words.</span>
            </span>
          </div>
          <textarea id="decision-note" value={p.text} onChange={(e) => p.onNote(e.target.value)} disabled={p.notified} rows={5} maxLength={5000} placeholder="E.g. “All three reviewers liked the method. For the final version, add the statistical tests asked for in Section 4.”" className="block w-full resize-y border-0 bg-white px-3.5 py-3 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-faint disabled:bg-canvas disabled:text-ink-muted" />
          <div className="flex items-center justify-between gap-2 border-t border-muted px-3.5 py-2 text-[11px] text-ink-faint">
            <span className="flex min-w-0 items-center gap-1.5">{commentable > 0 ? <><Share2 size={11} aria-hidden="true" /> {shared} of {commentable} reviewer comment{commentable === 1 ? "" : "s"} also go to the authors</> : "Only this note goes to the authors"}</span>
            <span className={`shrink-0 tabular-nums ${p.text.length > 4500 ? "font-semibold text-warning" : ""}`}>{p.text.length.toLocaleString()} / 5,000</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={!p.pick || p.busy} onClick={p.onRecord}>Record decision</Button>
          {p.current && !p.notified && <Button variant="outline" disabled={p.busy} onClick={p.onNotify}><Send size={14} aria-hidden="true" /> Notify authors</Button>}
        </div>
        {p.current && <p className="mt-3 text-xs text-ink-soft">Recorded: <b className="text-navy">{p.current.label}</b>{!p.notified && <span className="ml-2 font-semibold text-warning">Not sent to the authors yet</span>}</p>}
        {p.notified && <div style={{ background: "var(--success-soft)", color: "var(--success)" }} className="mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-bold"><Check size={14} aria-hidden="true" /> Authors notified{detail.notifiedAt ? ` · ${detail.notifiedAt}` : ""}</div>}
        {p.error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{p.error}</p>}
      </section>
    </div>
  );
}
