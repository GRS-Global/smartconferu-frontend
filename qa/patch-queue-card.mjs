// One-off edit helper: Prev / Next through the Peer Review list on the chair's review page (the prototype's queue card).
import fs from "node:fs";
const file = "../src/features/chair/components/chair-paper-page.tsx";
let s = fs.readFileSync(file, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, b); n += 1; };
rep('import { Check, FileText, Hash,', 'import { Check, ChevronLeft, ChevronRight, FileText, Hash,');
rep('import { useCallback, useState, type ReactNode } from "react";', 'import { useCallback, useState, type ReactNode } from "react";');
rep('import { useChairPaper } from "../use-chair-paper";', 'import { useChairPaper } from "../use-chair-paper";\nimport { readPeerReviewView } from "../peer-review-view";');
rep('  const isReview = view === "review";', `  const isReview = view === "review";
  // The Peer Review list's order, kept when a paper was opened from it: step to the previous / next paper without going back to the list.
  const queueView = isReview ? readPeerReviewView(conference.id) : null;
  const queue = isReview ? (queueView?.queue ?? []) : [];
  const at = queue.indexOf(paper.id);
  const prevId = at > 0 ? queue[at - 1] : null;
  const nextId = at >= 0 && at < queue.length - 1 ? queue[at + 1] : null;`);
rep('        <PageHero\n          label="Submission"', `        {isReview && at >= 0 && (
          <div style={{ border: "1px solid var(--border)" }} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2">
            <Link href={\`\${confBase}/peer-review\`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-ink-muted hover:bg-canvas hover:text-navy"><ChevronLeft size={14} aria-hidden="true" /> Peer Review</Link>
            <span className="h-5 w-px bg-line" aria-hidden="true" />
            <span className="min-w-0 truncate text-xs text-ink-soft">Paper <b className="tabular-nums text-navy">{at + 1} of {queue.length}</b>{queueView?.queueLabel && <span className="text-ink-faint"> · {queueView.queueLabel}</span>}</span>
            <div className="ml-auto flex items-center gap-1.5">
              {prevId ? <Link href={\`/submissions/\${encodeURIComponent(prevId)}/chair/review\`} title={\`Previous: \${prevId}\`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft hover:bg-canvas"><ChevronLeft size={14} aria-hidden="true" /> Prev</Link>
                : <span title="This is the first paper" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft opacity-50"><ChevronLeft size={14} aria-hidden="true" /> Prev</span>}
              {/* Once this paper is decided, Next becomes the main action — decide, move on. */}
              {nextId ? <Link href={\`/submissions/\${encodeURIComponent(nextId)}/chair/review\`} title={\`Next: \${nextId}\`} className={\`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-bold \${current ? "border-primary bg-primary text-white" : "border-line bg-white text-ink-soft hover:bg-canvas"}\`}>{current ? "Next paper" : "Next"} <ChevronRight size={14} aria-hidden="true" /></Link>
                : <span title="This is the last paper in the list" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft opacity-50">Next <ChevronRight size={14} aria-hidden="true" /></span>}
            </div>
          </div>
        )}
        <PageHero
          label="Submission"`);
fs.writeFileSync(file, s); console.log("applied", n);
