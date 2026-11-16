// One-off edit helper: split the chair's paper page into the prototype's two pages: details (/submissions/:id/chair) and review (/submissions/:id/chair/review).
import fs from "node:fs";
const file = "../src/features/chair/components/chair-paper-page.tsx";
let s = fs.readFileSync(file, "utf8");
let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, b); n += 1; };

rep('import { Check, FileText, Pencil, Send, Share2, UserCheck, Users, XCircle } from "lucide-react";', 'import { Check, FileText, Hash, Pencil, Send, Share2, Tag, UserCheck, Users, XCircle } from "lucide-react";');
rep('import { HeroChip, PageHero } from "@/features/workspace/components/hero";', 'import { HeroChip, HeroLink, PageHero } from "@/features/workspace/components/hero";');
rep('export function ChairPaperPage({ label }: { label: string }) {', `/** The chair has two pages per paper, linked to each other (the prototype's SubmissionDetailPage): "details" (/submissions/:id/chair), the paper itself and
 *  the actions on it (desk reject), and "review" (/submissions/:id/chair/review), its reviewers, their reviews and the decision. */
export function ChairPaperPage({ label, view = "review" }: { label: string; view?: "details" | "review" }) {`);

const a = s.indexOf('  return (\n    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="submissions/list"');
const b = s.indexOf("      <ConfirmDecision detail={detail}");
if (a < 0 || b < 0) console.log("MISSING main block");
else {
  const e = "encodeURIComponent(paper.id)";
  const body = `  const isReview = view === "review";
  const base = \`/submissions/\${${e}}/chair\`;
  const confBase = \`/chair/\${encodeURIComponent(conference.id)}\`;
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active={isReview ? "peer-review/list" : "submissions/list"} screening={data.screening}>
      <PageHeader title={paper.id} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym, href: confBase }, ...(isReview ? [{ label: "Peer Review", href: \`\${confBase}/peer-review\` }] : []), { label: paper.id }]} />
      <div className="hd-page space-y-6 p-8">
        <PageHero
          label="Submission"
          tile={monogram(conference.acronym)}
          title={paper.title}
          chips={isReview
            // Review page: only what bears on the decision; the dates live on the details page.
            ? <><HeroChip icon={Hash}>{paper.id}</HeroChip>{paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}<HeroChip icon={FileText}>{stage.label}: {stage.status}</HeroChip>{paper.withdrawn && <HeroChip tone="danger">Withdrawn {paper.withdrawnAt}</HeroChip>}</>
            : <><HeroChip tone="var(--primary)">{conference.acronym}</HeroChip><HeroChip icon={Hash}>{paper.id}</HeroChip>{paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}<HeroChip>Submitted {paper.submittedAt || "—"}</HeroChip>{paper.lastUpdate && <HeroChip>Last updated {paper.lastUpdate}</HeroChip>}{paper.withdrawn && <HeroChip tone="danger">Withdrawn {paper.withdrawnAt}</HeroChip>}</>}
          actions={isReview
            ? <HeroLink icon={FileText} href={base}>Paper details</HeroLink>
            : <HeroLink icon={Users} href={\`\${base}/review\`}>Peer Review</HeroLink>}
        />
        {isReview ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-6">
              <Card title="Reviewers & Scores" icon={Users} aside={scores.length > 0 && <span className="text-[12px] font-bold text-ink-soft">Average {(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} · {scores.length} of {detail.reviewers.length} in</span>}>
                {detail.reviewers.length === 0 ? <p className="text-sm text-ink-soft">No reviewers assigned yet.</p> : (
                  <ul className="space-y-3">{detail.reviewers.map((r) => <ReviewerRow key={r.assignmentId} r={r} locked={busy || notified || paper.withdrawn} onShare={share} onEdit={(x) => { setError(""); setDlg({ kind: "edit", reviewer: x }); }} />)}</ul>
                )}
                {detail.declined.length > 0 && (
                  <div className="mt-4 text-[12.5px] text-ink-soft"><b className="text-navy">Declined: </b>{detail.declined.map((d) => \`\${d.name} (\${d.reason})\`).join("; ")}</div>
                )}
              </Card>
            </div>
            <Card title="Record decision" icon={Check}>
              {current && <p className="mb-3 text-[13px] text-ink-soft">Recorded: <b className="text-navy">{current.label}</b>{notified ? <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Authors notified{detail.notifiedAt ? \` · \${detail.notifiedAt}\` : ""}</span> : <span className="ml-2 text-[11px] font-semibold text-warning">Not sent to the authors yet</span>}</p>}
              <div role="group" aria-label="Decision" className="flex flex-wrap gap-2">
                {choices.map((t) => <button key={t.id} type="button" disabled={paper.withdrawn || notified} onClick={() => setPick(t)} aria-pressed={pick?.id === t.id || current?.id === t.id} className="rounded-xl border-[1.5px] border-line px-3 py-1.5 text-[12.5px] font-bold text-navy transition-colors hover:bg-canvas disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary-soft">{t.label}</button>)}
                {choices.length === 0 && <p className="text-sm text-ink-soft">This conference has no decision types yet.</p>}
              </div>
              <label className="mt-4 block text-[12px] font-bold text-navy" htmlFor="decision-note">Note to the authors</label>
              <textarea id="decision-note" value={text} onChange={(e) => setNote(e.target.value)} disabled={notified} rows={4} maxLength={5000} className="mt-1 w-full rounded-xl border-[1.5px] border-line p-2.5 text-[13px] outline-none focus:border-primary" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={!pick || busy} onClick={() => { setError(""); setConfirm(true); }}>Record decision</Button>
                {current && !notified && <Button variant="outline" disabled={busy} onClick={notify}><Send size={14} aria-hidden="true" /> Notify authors</Button>}
              </div>
              {error && !confirm && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
              <div className="mt-5 space-y-1 border-t border-muted pt-4">
                <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">Paper actions</h3>
                <button type="button" disabled={paper.withdrawn || notified} onClick={() => { setError(""); setDlg({ kind: "own" }); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50"><UserCheck size={15} aria-hidden="true" className="text-primary" /> {mine?.review ? "Edit my review" : "Review this paper myself"}</button>
              </div>
              <Link href={\`\${confBase}/peer-review\`} className="mt-4 inline-block text-[12px] font-bold text-primary hover:underline">Back to Peer Review</Link>
            </Card>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card title="Paper" icon={FileText}>
              {detail.keywords.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{detail.keywords.map((k) => <span key={k} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-primary">{k}</span>)}</div>}
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">{detail.abstract || "No abstract."}</p>
              <h3 className="mb-1.5 mt-4 text-[12px] font-extrabold uppercase tracking-wider text-ink-faint">Authors</h3>
              <ul className="space-y-1 text-[13px] text-navy">{paper.authors.map((a) => <li key={\`\${a.email}-\${a.name}\`}><b>{a.name}</b>{a.corresponding && <span className="ml-1.5 text-[10px] font-bold text-primary">Corresponding</span>} <span className="text-ink-soft">· {a.affiliation}{a.country ? \`, \${a.country}\` : ""}</span></li>)}</ul>
              <h3 className="mb-1.5 mt-4 text-[12px] font-extrabold uppercase tracking-wider text-ink-faint">Files</h3>
              <ul className="space-y-1 text-[13px] text-navy">{[...detail.files, ...detail.supporting].map((f) => <li key={\`\${f.name}-\${f.uploadedAt}\`}>{f.name} <span className="text-ink-soft">· {f.uploadedAt}</span></li>)}{detail.files.length + detail.supporting.length === 0 && <li className="text-ink-soft">No files.</li>}</ul>
            </Card>
            <Card title="Paper actions" icon={Pencil}>
              <div className="space-y-1">
                <button type="button" disabled={paper.withdrawn || notified} onClick={() => { setError(""); setDlg({ kind: "desk" }); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50"><XCircle size={15} aria-hidden="true" className="text-danger" /> Desk reject</button>
              </div>
              {error && dlg === null && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
              <Link href={confBase} className="mt-4 inline-block text-[12px] font-bold text-primary hover:underline">Back to all submissions</Link>
            </Card>
          </div>
        )}
      </div>
`;
  s = s.slice(0, a) + body + s.slice(b);
  n += 1;
}
fs.writeFileSync(file, s);
console.log("applied", n);
