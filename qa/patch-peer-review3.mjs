// One-off edit helper (Chair Peer Review parity, slice 2): row selection and the bulk bar (Assign same reviewers, Auto-assign, Edit decisions) in the
// Peer Review list, with the prototype's "Done" rows. Fails loudly if an anchor is missing.
import fs from "node:fs";
const file = "../src/features/chair/components/peer-review-page.tsx";
let s = fs.readFileSync(file, "utf8");
let n = 0;
const rep = (from, to) => { if (!s.includes(from)) { console.log("MISSING:", from.slice(0, 90)); return; } s = s.replace(from, to); n += 1; };

rep("Send, UserPlus, X, type LucideIcon }", "Send, Sparkles, UserPlus, X, type LucideIcon }");
rep('import { AssignReviewerPopover, type AssignCandidate } from "./assign-reviewer-popover";', `import { AssignReviewerPopover, type AssignCandidate } from "./assign-reviewer-popover";
import { AssignSameModal } from "./assign-same-modal";
import { AutoAssignModal } from "./auto-assign-modal";
import { EditDecisionsModal } from "./edit-decisions-modal";
import { isOnPaper, newAssignmentDue, rankReviewersFor, reviewerConflict, type PlanItem } from "../assign-rules";
import { useRangeSelect } from "@/lib/use-range-select";`);
rep("  const [assignFor, setAssignFor] = useState<{ id: string; rect: DOMRect } | null>(null);", `  const [assignFor, setAssignFor] = useState<{ id: string; rect: DOMRect } | null>(null);
  // Row selection (kept while filters change, as in the prototype), the bulk dialog that is open, and the papers worked on in this view (marked "Done").
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<null | "auto" | "same" | "decide">(null);
  const [bulkError, setBulkError] = useState("");
  const [kept, setKept] = useState<{ view: string; ids: string[] }>({ view: "", ids: [] });
  const range = useRangeSelect();`);
// kept rows
rep("  const rows = inTrack.filter(active.match)", `  const viewKey = \`\${filter}|\${track}|\${tq}|\${icNow}|\${plNow}|\${idq}|\${f.reviewers}|\${f.due}|\${f.score}|\${f.decision}\`;
  const keptIds = kept.view === viewKey ? kept.ids : [];
  const keep = (ids: string[]) => setKept((k) => ({ view: viewKey, ids: [...new Set([...(k.view === viewKey ? k.ids : []), ...ids])] }));
  const rows = inTrack.filter((r) => active.match(r) || keptIds.includes(r.paper.dbId))`);
// selection helpers
rep("  const clear = () => {", `  const selectedRows = all.filter((r) => selected.includes(r.paper.dbId));
  const allShownSelected = rows.length > 0 && rows.every((r) => selected.includes(r.paper.dbId));
  const pick = range({ ids: rows.map((r) => r.paper.dbId), isSelected: (id) => selected.includes(id), setMany: (ids, on) => setSelected((l) => (on ? [...new Set([...l, ...ids])] : l.filter((x) => !ids.includes(x)))) });
  const clear = () => {`);
// decide keeps the row
rep('      await (await getChairService()).recordDecision(r.paper.dbId, type.id, "");\n', '      await (await getChairService()).recordDecision(r.paper.dbId, type.id, "");\n      keep([r.paper.dbId]);\n');
// candidates from the shared rules
{
  const a = s.indexOf("  const mineOn = (rev: PoolReviewer, r: PrRow)");
  const b = s.indexOf("  const assignOne = async");
  if (a < 0 || b < 0) console.log("MISSING candidates block");
  else {
    s = s.slice(0, a) + `  const poolList = (pool?.reviewers ?? []).filter((rev) => rev.status !== "declined");
  const candidatesFor = (r: PrRow): AssignCandidate[] => rankReviewersFor(r, poolList, all, maxLoad).map((c) => ({ rev: c.rev, load: c.load, conflict: c.conflict || null, full: c.full }));
  const dueDefault = newAssignmentDue(settings, board.deadline);
` + s.slice(b);
    n += 1;
  }
}
rep("      setAssignFor(null);\n      setToast({ title: \"Reviewer assigned\"", "      setAssignFor(null);\n      keep([r.paper.dbId]);\n      setToast({ title: \"Reviewer assigned\"");
rep("deadline={board.deadline} anchor={assignFor.rect}", "deadline={dueDefault} anchor={assignFor.rect}");
// bulk handlers before assignHint
rep("  const assignHint = (r: PrRow) =>", `  const mailAssigned = async (rev: PoolReviewer, given: string[]) => { let mail: string | null = null; if (rev.userId) for (const id of given) { mail = (await sendActionEmails("reviews_assigned", { submissionId: id, reviewerIds: [rev.userId] })) ?? mail; } return mail; };
  const bulkSame = async (ids: string[], due: string) => {
    setBusy(true); setBulkError("");
    try {
      const svc = await getChairService();
      let made = 0; let skipped = 0; let problem: string | null = null;
      for (const rev of poolList.filter((x) => ids.includes(x.memberId))) {
        // A reviewer is skipped for a paper they are in conflict with or already on, and for one that cannot take reviewers yet.
        const eligible = selectedRows.filter((r) => !isOnPaper(rev, r) && !reviewerConflict(rev, r.paper) && r.canAssign && !r.decided);
        skipped += selectedRows.length - eligible.length;
        if (!eligible.length) continue;
        const given = await svc.assignPapers(rev, eligible.map((r) => r.paper.dbId), due);
        made += given.length;
        problem = (await mailAssigned(rev, given)) ?? problem;
      }
      keep(selectedRows.map((r) => r.paper.dbId));
      setBulk(null); setSelected([]);
      setToast({ title: \`\${made} assignment\${made === 1 ? "" : "s"} made\`, text: \`Conflicts of interest were skipped automatically.\${skipped && made === 0 ? " Nothing could be assigned to the selected papers." : ""}\${problem ? \` \${problem}\` : ""}\` });
      reload();
    } catch (e) { setBulkError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const bulkAuto = async (plan: PlanItem[], due: string) => {
    setBusy(true); setBulkError("");
    try {
      const svc = await getChairService();
      const byReviewer = new Map<string, { rev: PoolReviewer; ids: string[] }>();
      plan.forEach((x) => x.reviewers.forEach((rev) => { const e = byReviewer.get(rev.memberId) ?? { rev, ids: [] }; e.ids.push(x.row.paper.dbId); byReviewer.set(rev.memberId, e); }));
      let made = 0; let problem: string | null = null;
      for (const { rev, ids } of byReviewer.values()) { const given = await svc.assignPapers(rev, ids, due); made += given.length; problem = (await mailAssigned(rev, given)) ?? problem; }
      keep(plan.filter((x) => x.reviewers.length).map((x) => x.row.paper.dbId));
      setBulk(null); setSelected([]);
      setToast({ title: \`\${made} assignment\${made === 1 ? "" : "s"} made\`, text: \`\${plan.filter((x) => x.reviewers.length).length} papers · \${byReviewer.size} reviewer\${byReviewer.size === 1 ? "" : "s"} emailed.\${problem ? \` \${problem}\` : ""}\` });
      reload();
    } catch (e) { setBulkError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const bulkDecide = async (type: DecisionType) => {
    setBusy(true); setBulkError("");
    try {
      const svc = await getChairService();
      let ok = 0; const failed: string[] = [];
      for (const r of selectedRows) { try { await svc.recordDecision(r.paper.dbId, type.id, ""); ok += 1; } catch { failed.push(r.paper.id); } }
      keep(selectedRows.map((r) => r.paper.dbId));
      if (failed.length === selectedRows.length) { setBulkError(\`Couldn't record the decision for \${failed.slice(0, 4).join(", ")}\${failed.length > 4 ? "…" : ""}.\`); return; }
      setBulk(null); setSelected([]);
      setToast({ title: "Decisions updated", text: \`\${ok} paper\${ok === 1 ? "" : "s"} set to “\${type.label}”.\${failed.length ? \` \${failed.length} could not be changed (\${failed.slice(0, 4).join(", ")}).\` : ""}\` });
      reload();
    } catch (e) { setBulkError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const assignHint = (r: PrRow) =>`);
// header checkbox
rep('                {th("ID", { sortKey: "id"', `                {th("", { className: "w-10", filter: <div className="flex h-7 items-center justify-center"><input className="cursor-pointer accent-primary" type="checkbox" aria-label="Select all shown" checked={allShownSelected} onChange={() => setSelected(allShownSelected ? selected.filter((id) => !rows.some((r) => r.paper.dbId === id)) : [...new Set([...selected, ...rows.map((r) => r.paper.dbId)])])} /></div> })}
                {th("ID", { sortKey: "id"`);
// row
rep('<tr key={r.paper.dbId} className={`align-top transition-colors hover:bg-canvas ${ri % 2 ? "ui-row-alt" : ""}`}>\n                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink-muted">', '<tr key={r.paper.dbId} {...pick.row(r.paper.dbId)} className={`align-top transition-colors hover:bg-canvas ${ri % 2 ? "ui-row-alt" : ""}`}>\n                    <td className="py-3 pl-4 pr-1"><input className="cursor-pointer accent-primary" type="checkbox" aria-label={`Select ${r.paper.id}`} checked={selected.includes(r.paper.dbId)} {...pick.box(r.paper.dbId)} /></td>\n                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink-muted">');
rep("                    </td>\n                    {([", '                      {keptIds.includes(r.paper.dbId) && !active.match(r) && <span title="Done here — it leaves this list when you change the filter or reopen the page" className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-success"><Check size={12} strokeWidth={3} aria-hidden="true" /> Done</span>}\n                    </td>\n                    {([');
// bulk bar before the table
rep('        <div style={{ ...CARD, maxHeight: "calc(100vh - 190px)", minHeight: 360 }}', `        {selected.length > 0 && (
          <div style={{ background: "var(--navy)" }} className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 text-white">
            <span className="mr-2 text-[13px] font-bold">{selected.length} selected</span>
            <button type="button" onClick={() => { setBulkError(""); setBulk("auto"); }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20"><Sparkles size={13} aria-hidden="true" /> Auto-assign</button>
            <button type="button" onClick={() => { setBulkError(""); setBulk("same"); }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20"><UserPlus size={13} aria-hidden="true" /> Assign same reviewers</button>
            <button type="button" onClick={() => { setBulkError(""); setBulk("decide"); }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20"><Check size={13} aria-hidden="true" /> Edit decisions</button>
            <button type="button" onClick={() => setSelected([])} className="ml-auto h-8 cursor-pointer rounded-lg px-2.5 text-xs font-semibold hover:bg-white/10">Clear</button>
          </div>
        )}
        <div style={{ ...CARD, maxHeight: "calc(100vh - 190px)", minHeight: 360 }}`);
// modals
rep("      {reportFor && <ScreeningReportModal", `      {bulk === "auto" && <AutoAssignModal rows={selectedRows.filter((r) => r.canAssign && r.reviewers.length < r.target)} all={all} scope="selected" pool={poolList} maxLoad={maxLoad} defaultDeadline={dueDefault} busy={busy} onConfirm={(plan, due) => void bulkAuto(plan, due)} onClose={() => { if (!busy) setBulk(null); }} />}
      {bulk === "same" && <AssignSameModal reviewers={poolList} submissionCount={selected.length} defaultDeadline={dueDefault} busy={busy} error={bulkError} onAssign={(ids, due) => void bulkSame(ids, due)} onClose={() => { if (!busy) setBulk(null); }} />}
      {bulk === "decide" && <EditDecisionsModal types={data.decisionTypes} papers={selectedRows.map((r) => ({ id: r.paper.id }))} currentTypeOf={(id) => { const r = selectedRows.find((x) => x.paper.id === id); return r ? (typeOf(r)?.id ?? null) : null; }} settingsHref={\`/chair/\${slug}/settings/decision\`} busy={busy} error={bulkError} onApply={(t) => void bulkDecide(t)} onClose={() => { if (!busy) setBulk(null); }} />}
      {reportFor && <ScreeningReportModal`);
fs.writeFileSync(file, s);
console.log("applied", n);
