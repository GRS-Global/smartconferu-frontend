// One-off edit helper: the chair's review page body now follows the prototype (Compare reviews, reviewer cards, decision tiles, hero buttons, Add reviewer).
import fs from "node:fs";
const file = "../src/features/chair/components/chair-paper-page.tsx";
let s = fs.readFileSync(file, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); return; } s = s.replace(a, () => b); n += 1; };

rep('import { HeroChip, HeroLink, PageHero } from "@/features/workspace/components/hero";', 'import { HeroButton, HeroChip, HeroLink, PageHero } from "@/features/workspace/components/hero";\nimport { buildZip, saveBlob } from "@/lib/zip";');
rep('import { Check, ChevronLeft, ChevronRight, FileText,', 'import { Check, ChevronLeft, ChevronRight, Download, Eye, FileText,');
rep('import { readPeerReviewView } from "../peer-review-view";', 'import { readPeerReviewView } from "../peer-review-view";\nimport { addReviewersToPaper, type AddPick } from "../add-reviewers";\nimport { newAssignmentDue, rankReviewersFor } from "../assign-rules";\nimport { prRowOf } from "../peer-review";\nimport { AddReviewersModal } from "./add-reviewers-modal";\nimport type { AssignCandidate } from "./assign-reviewer-popover";\nimport { ReviewBody } from "./chair-review-view";');
rep('  const [toast, setToast] = useState<FlowToastData | null>(null);', '  const [toast, setToast] = useState<FlowToastData | null>(null);\n  // "Add reviewer": the committee and what each member carries now, loaded when the dialog opens.\n  const [add, setAdd] = useState<null | { candidates: AssignCandidate[]; poolEmails: string[]; maxLoad: number | null; deadline: string; error: string }>(null);');

rep('  const isReview = view === "review";', `  const openAdd = async () => {
    setError("");
    try {
      const svc = await getChairService();
      const [pool, board, settings] = await Promise.all([svc.loadReviewerPool(conference.id), svc.loadReviewBoard(conference.id), svc.loadSettings(conference.id)]);
      const all = data.papers.filter((p) => !p.withdrawn).map((p) => prRowOf(p, board, data.screening));
      const row = all.find((x) => x.paper.dbId === paper.dbId);
      if (!row) { setToast({ title: "Couldn't load the committee", text: "This paper isn't in the review list." }); return; }
      const maxLoad = settings.limits.maxPapersPerReviewer;
      const list = pool.reviewers.filter((r) => r.status !== "declined");
      setAdd({ candidates: rankReviewersFor(row, list, all, maxLoad).map((c) => ({ rev: c.rev, load: c.load, conflict: c.conflict || null, full: c.full })), poolEmails: pool.reviewers.map((x) => x.email), maxLoad, deadline: newAssignmentDue(settings, board.deadline), error: "" });
    } catch (e) { setToast({ title: "Couldn't load the committee", text: e instanceof Error ? e.message : "Something went wrong." }); }
  };
  const addReviewers = async (picks: AddPick[], due: string) => {
    setBusy(true);
    try {
      const { names, count, mail } = await addReviewersToPaper(conference.id, paper.dbId, picks, due);
      setAdd(null);
      setToast({ title: names.length > 1 ? \`\${names.length} reviewers assigned\` : "Reviewer assigned", text: \`\${names.join(", ")} · \${paper.id}.\${count === 0 ? " Already on the paper." : ""}\${mail ? \` \${mail}\` : ""}\` });
      reload();
    } catch (e) { setAdd((a) => (a ? { ...a, error: e instanceof Error ? e.message : "Something went wrong." } : a)); } finally { setBusy(false); }
  };
  // The paper's own files: open the newest in a tab, or all of them in one ZIP.
  const paperFiles = [...detail.files, ...detail.supporting].filter((f) => f.storagePath);
  const viewSubmission = async () => {
    const f = detail.files.find((x) => x.storagePath) ?? paperFiles[0];
    if (!f?.storagePath) { setToast({ title: "No file to open", text: "This paper has no stored file here." }); return; }
    try { window.open(await (await getChairService()).fileUrl(f.storagePath), "_blank", "noopener"); } catch (e) { setToast({ title: "Couldn't open the file", text: e instanceof Error ? e.message : "Something went wrong." }); }
  };
  const downloadFiles = async () => {
    if (!paperFiles.length) { setToast({ title: "Nothing to download", text: "This paper has no stored file here." }); return; }
    setBusy(true);
    try {
      const svc = await getChairService();
      const out: Array<{ name: string; data: Uint8Array }> = [];
      for (const f of paperFiles) { const res = await fetch(await svc.fileUrl(f.storagePath!)); if (res.ok) out.push({ name: f.name, data: new Uint8Array(await res.arrayBuffer()) }); }
      if (!out.length) { setToast({ title: "Nothing to download", text: "None of the files could be read." }); return; }
      saveBlob(buildZip(out), \`\${paper.id}.zip\`);
    } catch (e) { setToast({ title: "Couldn't prepare the download", text: e instanceof Error ? e.message : "Something went wrong." }); } finally { setBusy(false); }
  };
  const pillText = paper.withdrawn ? "Withdrawn" : current ? current.label : stage.key === "review" ? "Under Review" : stage.label;
  const isReview = view === "review";`);

rep('          title={paper.title}\n          chips={isReview', '          title={paper.title}\n          badge={isReview ? <span style={{ color: "#B45309", background: "var(--warning-soft)" }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"><span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" aria-hidden="true" /> {pillText}</span> : undefined}\n          chips={isReview');
const c0 = s.indexOf('<><HeroChip icon={Hash}>{paper.id}</HeroChip>{paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}<HeroChip icon={FileText}>{stage.label}');
const c1 = s.indexOf('</>', c0) + 3;
if (c0 < 0) console.log("MISSING chips"); else { s = s.slice(0, c0) + '<><HeroChip icon={Hash}>{paper.id}</HeroChip>{paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}{paper.withdrawn && <HeroChip tone="danger">Withdrawn {paper.withdrawnAt}</HeroChip>}</>' + s.slice(c1); n += 1; }
rep('            ? <HeroLink icon={FileText} href={base}>Paper details</HeroLink>', '            ? <><HeroLink icon={FileText} href={base}>Paper details</HeroLink><HeroButton icon={Eye} onClick={() => void viewSubmission()} title="Open the paper in a new tab">View submission</HeroButton><HeroButton icon={Download} primary disabled={busy} onClick={() => void downloadFiles()} title="Download the files as one ZIP">Download</HeroButton></>');

const b0 = s.indexOf('        {isReview ? (\n          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">');
const b1 = s.indexOf('        ) : (\n          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">', b0);
if (b0 < 0 || b1 < 0) console.log("MISSING body", b0, b1);
else {
  s = s.slice(0, b0) + `        {isReview ? (
          <ReviewBody detail={detail} current={current} choices={reviewChoices} pick={pick} onPick={setPick} text={text} onNote={setNote} notified={notified} busy={busy} error={confirm ? "" : error} withdrawn={paper.withdrawn}
            onRecord={() => { setError(""); setConfirm(true); }} onNotify={() => void notify()} onShare={(r, v) => void share(r, v)} onEdit={(r) => { setError(""); setDlg({ kind: "edit", reviewer: r }); }}
            onAddReview={() => { setError(""); setDlg({ kind: "own" }); }} onAddReviewer={() => void openAdd()} hasMine={Boolean(mine)} />
` + s.slice(b1); n += 1;
}
rep('  const choices = data.decisionTypes.filter((t) => !NOT_CHOICES.has(t.outcome));', '  const choices = data.decisionTypes.filter((t) => !NOT_CHOICES.has(t.outcome));\n  // The review page also offers "No Decision" (to take a decision back), first, as the prototype does.\n  const reviewChoices = [...data.decisionTypes.filter((t) => t.outcome === "no_decision"), ...choices];');
rep('      <FlowToast toast={toast} onClose={closeToast} />', '      <Dialog open={add !== null} onClose={() => { if (!busy) setAdd(null); }} title="Add reviewers" size="lg">\n        {add && <AddReviewersModal paperLabel={`${paper.id} · ${paper.title}`} candidates={add.candidates} poolEmails={add.poolEmails} acronym={conference.acronym} maxLoad={add.maxLoad} deadline={add.deadline} busy={busy} error={add.error} onAdd={(picks, due) => void addReviewers(picks, due)} onClose={() => setAdd(null)} />}\n      </Dialog>\n      <FlowToast toast={toast} onClose={closeToast} />');
fs.writeFileSync(file, s); console.log("applied", n);
