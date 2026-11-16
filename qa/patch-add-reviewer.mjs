// One-off edit helper: the list's "Add reviewer" link (non-short papers) and the Add reviewers dialog ("Invite someone new").
import fs from "node:fs";
const file = "../src/features/chair/components/peer-review-page.tsx";
let s = fs.readFileSync(file, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); return; } s = s.replace(a, b); n += 1; };
rep('import { AssignSameModal } from "./assign-same-modal";', 'import { AddReviewersModal, type AddPick } from "./add-reviewers-modal";\nimport { AssignSameModal } from "./assign-same-modal";');
rep('  const [assignFor, setAssignFor] = useState<{ id: string; rect: DOMRect } | null>(null);', '  const [assignFor, setAssignFor] = useState<{ id: string; rect: DOMRect } | null>(null);\n  // The paper whose "Add reviewers" dialog is open (opened from the popover\'s "Invite someone new").\n  const [addFor, setAddFor] = useState<string | null>(null);\n  const [addError, setAddError] = useState("");');
rep('  const mailAssigned = async', `  const addReviewers = async (r: PrRow, picks: AddPick[], due: string) => {
    setBusy(true); setAddError("");
    try {
      const svc = await getChairService();
      let mail: string | null = null; let count = 0; const names: string[] = [];
      for (const p of picks) {
        let rev: PoolReviewer;
        if ("rev" in p) rev = p.rev;
        else {
          const res = await svc.inviteReviewer(slug, { name: p.invite.name, email: p.invite.email, tracks: [] });
          if (res.created) mail = (await sendActionEmails("reviewer_invited", { memberId: res.memberId })) ?? mail;
          rev = { memberId: res.memberId, userId: res.userId, name: p.invite.name, email: p.invite.email, tracks: [], status: "invited", invitedAt: "" };
        }
        const given = await svc.assignPapers(rev, [r.paper.dbId], due);
        count += given.length; names.push(rev.name);
        mail = (await mailAssigned(rev, given)) ?? mail;
      }
      setAddFor(null);
      keep([r.paper.dbId]);
      setToast({ title: names.length > 1 ? \`\${names.length} reviewers assigned\` : "Reviewer assigned", text: \`\${names.join(", ")} · \${r.paper.id} · review due \${day(due)}.\${count === 0 ? " Already on the paper." : ""}\${mail ? \` \${mail}\` : ""}\` });
      reload();
    } catch (e) { setAddError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const mailAssigned = async`);
// the link under a paper that already has its reviewers
rep(`  ) : !r.decided && r.stage === "plagiarism" ? (`, `  ) : r.canAssign && !r.decided && r.reviewers.length > 0 ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); setAssignFor({ id: r.paper.dbId, rect: e.currentTarget.getBoundingClientRect() }); }} className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-bold text-primary hover:underline"><UserPlus size={12} aria-hidden="true" /> Add reviewer</button>
  ) : !r.decided && r.stage === "plagiarism" ? (`);
rep('onInvite={() => router.push(`/chair/${encodeURIComponent(conference.id)}/peer-review/reviewers`)}', 'onInvite={() => { setAddError(""); setAddFor(assignRow.paper.dbId); setAssignFor(null); }}');
rep('      {bulk === "auto" && <AutoAssignModal', `      <Dialog open={addFor !== null} onClose={() => { if (!busy) setAddFor(null); }} title="Add reviewers" size="lg">
        {addFor && (() => {
          const row = all.find((x) => x.paper.dbId === addFor);
          return row ? <AddReviewersModal key={addFor} paperLabel={\`\${row.paper.id} · \${row.paper.title}\`} candidates={candidatesFor(row)} poolEmails={poolList.map((x) => x.email)} acronym={conference.acronym} maxLoad={maxLoad} deadline={dueDefault} busy={busy} error={addError} onAdd={(picks, due) => void addReviewers(row, picks, due)} onClose={() => setAddFor(null)} /> : null;
        })()}
      </Dialog>
      {bulk === "auto" && <AutoAssignModal`);
fs.writeFileSync(file, s); console.log("applied", n);
