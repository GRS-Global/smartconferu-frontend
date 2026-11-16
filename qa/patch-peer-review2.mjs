// One-off edit helper (Chair Peer Review parity, slice 1): per-paper "Assign" / "Find replacement" popover in the Peer Review list.
import fs from "node:fs";
const file = "../src/features/chair/components/peer-review-page.tsx";
let s = fs.readFileSync(file, "utf8");
let n = 0;
const rep = (from, to) => { if (!s.includes(from)) { console.log("MISSING:", from.slice(0, 80)); return; } s = s.replace(from, to); n += 1; };

rep('import { Bell, Check, ChevronDown,', 'import { Bell, Check, ChevronDown, Download,');
rep('import type { ChairPaper, DecisionType } from "@/types/chair";', 'import type { ChairPaper, DecisionType, PoolReviewer } from "@/types/chair";\nimport { AssignReviewerPopover, type AssignCandidate } from "./assign-reviewer-popover";');
rep('useChairConference(slug, { board: true, settings: true })', 'useChairConference(slug, { board: true, settings: true, pool: true })');
rep('  const [reportFor, setReportFor] = useState<ChairPaper | null>(null);', '  const [reportFor, setReportFor] = useState<ChairPaper | null>(null);\n  // The paper whose "Assign" popover is open (with the button it hangs from).\n  const [assignFor, setAssignFor] = useState<{ id: string; rect: DOMRect } | null>(null);');
rep('  const { conference, roles, others, data, board, settings } = state;', '  const { conference, roles, others, data, board, settings, pool } = state;');
// handlers before the th() helper
rep('  const th = (label: string, o: { sortKey?: SortKey;', `  // Who can take a paper: the committee (not those who declined), minus the reviewers it already has; an author of the paper or someone at the
  // per-reviewer limit is shown but cannot be picked.
  const maxLoad = settings?.limits.maxPapersPerReviewer ?? null;
  const mineOn = (rev: PoolReviewer, r: PrRow) => r.reviewers.some((x) => (x.r.awaitingInvite ? x.r.reviewerId === rev.memberId : rev.userId !== null && x.r.reviewerId === rev.userId));
  const candidatesFor = (r: PrRow): AssignCandidate[] => (pool?.reviewers ?? []).filter((rev) => rev.status !== "declined" && !mineOn(rev, r)).map((rev) => {
    const load = all.filter((x) => mineOn(rev, x)).length;
    const author = r.paper.authors.some((a) => rev.email && a.email.toLowerCase() === rev.email.toLowerCase());
    return { rev, load, conflict: author ? "Conflict · Author of this paper" : null, full: maxLoad !== null && load >= maxLoad };
  });
  const assignOne = async (r: PrRow, rev: PoolReviewer, due: string) => {
    setBusy(true);
    try {
      const svc = await getChairService();
      const given = await svc.assignPapers(rev, [r.paper.dbId], due);
      let mail: string | null = null;
      if (rev.userId) for (const id of given) { mail = (await sendActionEmails("reviews_assigned", { submissionId: id, reviewerIds: [rev.userId] })) ?? mail; }
      setAssignFor(null);
      setToast({ title: "Reviewer assigned", text: \`\${rev.name} · \${r.paper.id} · review due \${day(due)}. They're emailed to accept the paper.\${mail ? \` \${mail}\` : ""}\` });
      reload();
    } catch (e) { setToast({ title: "Couldn't assign the reviewer", text: e instanceof Error ? e.message : "Something went wrong." }); } finally { setBusy(false); }
  };
  const assignHint = (r: PrRow) => (isShort(r) && r.canAssign && !r.decided ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); setAssignFor({ id: r.paper.dbId, rect: e.currentTarget.getBoundingClientRect() }); }} className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-bold text-primary hover:underline"><UserPlus size={12} aria-hidden="true" /> {r.declined.length ? "Find replacement" : "Assign"}</button>
  ) : !r.decided && r.stage === "plagiarism" ? (
    <span title="Reviewers are assigned only after the plagiarism check" className="mt-1.5 block text-[11px] text-ink-faint">Assign after plagiarism check</span>
  ) : null);
  const assignRow = assignFor ? all.find((x) => x.paper.dbId === assignFor.id) : undefined;

  const th = (label: string, o: { sortKey?: SortKey;`);
// the cell
rep('</td>\n                    <td className="px-3 py-2.5"><Lines r={r} cell={(x) => <span title={REVIEWER_STATE', '{assignHint(r)}</td>\n                    <td className="px-3 py-2.5"><Lines r={r} cell={(x) => <span title={REVIEWER_STATE');
// export link icon
rep('hover:bg-canvas">All reviews &amp; export</Link>', 'hover:bg-canvas"><Download size={13} aria-hidden="true" /> All reviews &amp; export</Link>');
// popover
rep('      {reportFor && <ScreeningReportModal', '      {assignFor && assignRow && <AssignReviewerPopover row={assignRow} candidates={candidatesFor(assignRow)} maxLoad={maxLoad} deadline={board.deadline} anchor={assignFor.rect} busy={busy} onAssign={(rev, due) => void assignOne(assignRow, rev, due)} onInvite={() => router.push(`/chair/${encodeURIComponent(conference.id)}/peer-review/reviewers`)} onClose={() => setAssignFor(null)} />}\n      {reportFor && <ScreeningReportModal');
fs.writeFileSync(file, s);
console.log("applied", n, "of 9");
