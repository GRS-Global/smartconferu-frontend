// One-off edit helper: Manage submission (update submission / authors / files, withdraw for the authors), Email authors, Add supporting document, Upload on their behalf and the hero's Edit, on the chair's paper details page.
import fs from "node:fs";
let n = 0;
function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING:", file.slice(-34), a.slice(0, 80)); continue; } s = s.replace(a, () => b); n += 1; }
  fs.writeFileSync(file, s);
}
// ---------- the details page parts
patch("../src/features/chair/components/chair-paper-details.tsx", [
  ['import { AlignLeft, Check, Download, Eye, FileText, MessageSquare, Paperclip, Tag, Users } from "lucide-react";', 'import { AlignLeft, Check, ChevronRight, Download, Eye, FilePlus, FileText, FileUp, MessageSquare, Paperclip, Pencil, Tag, Upload, UserPlus, Users, XCircle } from "lucide-react";'],
  ['import type { ChairFile, ChairPaperDetail, DecisionType } from "@/types/chair";', 'import type { AuthorPaper } from "@/types/author-submission";\nimport type { ChairFile, ChairPaperDetail, DecisionType } from "@/types/chair";'],
  ['export function FilesCard({ detail, onNotice }: { detail: ChairPaperDetail; onNotice: (title: string, text: string) => void }) {', `/** The paper as the author dialogs (update details, authors, files; withdraw) read it: they only need its ids, text, authors and files, and the database
 *  decides who may change it (a chair of the conference may). */
export function toAuthorPaper(detail: ChairPaperDetail): AuthorPaper {
  const { paper } = detail;
  return {
    dbId: paper.dbId, id: paper.id, title: paper.title, abstract: detail.abstract, keywords: detail.keywords,
    status: paper.outcome === "accept" || paper.outcome === "registered" ? "accepted" : paper.outcome === "reject" ? "rejected" : "under_review",
    result: paper.outcome === "registered" ? "registered" : null,
    authors: paper.authors.map((a) => ({ ...a, isMe: false })), myEmails: [],
    versions: detail.files.map((f) => ({ name: f.name, uploadedAt: f.uploadedAt, storagePath: f.storagePath })),
    supporting: detail.supporting.map((f) => ({ name: f.name, uploadedAt: f.uploadedAt, storagePath: f.storagePath })),
    withdrawn: paper.withdrawn,
  } as unknown as AuthorPaper;
}

function ActionRow({ icon: Icon, title, subtitle, onClick, disabled }: { icon: typeof Pencil; title: string; subtitle: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={14} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-navy">{title}</span><span className="block truncate text-[11px] text-ink-faint">{subtitle}</span></span>
      <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-line-strong" />
    </button>
  );
}

/** Manage submission: the chair changes the paper for its authors (the changes are shared with them straight away). */
export function ManageCard({ detail, onDetails, onAuthors, onFiles, onWithdraw }: { detail: ChairPaperDetail; onDetails: () => void; onAuthors: () => void; onFiles: () => void; onWithdraw: () => void }) {
  const { paper } = detail;
  const lead = paper.authors.filter((a) => a.corresponding).map((a) => a.name).join(", ") || "—";
  const closed = paper.withdrawn;
  return (
    <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
      <div className="p-5 pb-3"><h3 className="text-sm font-extrabold text-navy">Manage submission</h3><p className="mt-0.5 text-[11.5px] text-ink-faint">Changes are shared with the authors straight away.</p></div>
      <div className="px-2.5 pb-2">
        <ActionRow icon={Pencil} title="Update submission" subtitle="Title, abstract & keywords" onClick={onDetails} disabled={closed} />
        <ActionRow icon={UserPlus} title="Update / add authors" subtitle={\`\${paper.authors.length} author\${paper.authors.length === 1 ? "" : "s"} · \${lead} corresponding\`} onClick={onAuthors} disabled={closed} />
        <ActionRow icon={FileUp} title="Update files" subtitle="New paper version or supporting docs" onClick={onFiles} disabled={closed} />
      </div>
      {!closed && (
        <div className="border-t border-muted p-5">
          <button type="button" onClick={onWithdraw} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-danger-soft bg-white py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger-soft"><XCircle size={14} aria-hidden="true" /> Withdraw for the authors</button>
          <p className="mt-1.5 text-center text-[10.5px] text-ink-faint">Only when the authors ask. The authors are emailed. This can&apos;t be undone.</p>
        </div>
      )}
    </div>
  );
}

export function FilesCard({ detail, onNotice, onAddSupporting }: { detail: ChairPaperDetail; onNotice: (title: string, text: string) => void; onAddSupporting?: (() => void) | null }) {`],
  ['<h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-navy"><FileText size={15} aria-hidden="true" className="text-primary" /> Files</h2>', '<div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-[15px] font-extrabold text-navy"><FileText size={15} aria-hidden="true" className="text-primary" /> Files</h2>{onAddSupporting && <button type="button" onClick={onAddSupporting} className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline"><FilePlus size={13} aria-hidden="true" /> Add supporting document</button>}</div>'],
  ['export function NoteCard({ detail }: { detail: ChairPaperDetail }) {', 'export function NoteCard({ detail, onUpload }: { detail: ChairPaperDetail; onUpload?: (() => void) | null }) {'],
  ['  if (!note && shared.length === 0) return null;', '  const asked = detail.paper.outcome === "revise" && !detail.paper.withdrawn;\n  if (!note && shared.length === 0 && !asked) return null;'],
  ['    </section>\n  );\n}\n', '      {asked && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-muted pt-4"><p className="text-xs font-semibold text-[#B45309]">You asked the authors for changes — waiting for their revised paper.</p>{onUpload && <button type="button" onClick={onUpload} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--primary-soft-border)] bg-white px-3 text-xs font-bold text-primary hover:bg-primary-soft"><Upload size={13} aria-hidden="true" /> Upload on their behalf</button>}</div>}\n    </section>\n  );\n}\n'],
]);
// ---------- the page
patch("../src/features/chair/components/chair-paper-page.tsx", [
  ['import { FilesCard, NoteCard, PaperCard, PaperTimeline } from "./chair-paper-details";', 'import { FilesCard, ManageCard, NoteCard, PaperCard, PaperTimeline, toAuthorPaper } from "./chair-paper-details";\nimport { EditAuthorsDialog, EditDetailsDialog, UpdateFilesDialog, WithdrawDialog } from "@/features/author/components/paper-dialogs";\nimport { EmailAuthorsDialog } from "./email-authors-dialog";'],
  ['import { ChevronLeft, ChevronRight, Clock, Download, Eye,', 'import { ChevronLeft, ChevronRight, Clock, Download, Eye, Mail,'],
  ['  const [add, setAdd] = useState<null |', '  // Manage submission: which author dialog is open (they change the paper for its authors), and the Email authors dialog.\n  const [manage, setManage] = useState<null | "details" | "authors" | "withdraw" | "files-paper" | "files-supporting">(null);\n  const [emailOpen, setEmailOpen] = useState(false);\n  const [add, setAdd] = useState<null |'],
  ['  const pillText =', `  const asAuthor = toAuthorPaper(detail);
  const saved = ({ notice }: { notice: string | null }) => { reload(); setToast({ title: "Saved", text: notice ?? "The change is saved and shared with the authors." }); };
  const openFile = (f: { storagePath: string | null; name: string }, download: boolean) => { if (!f.storagePath) return; void getChairService().then((s) => s.fileUrl(f.storagePath!, download ? f.name : undefined)).then((u) => window.open(u, "_blank", "noopener")); };
  const pillText =`],
  ['<><HeroLink icon={Users} href={`${base}/review`}>Peer Review</HeroLink><HeroButton icon={Eye}', '<><HeroLink icon={Users} href={`${base}/review`}>Peer Review</HeroLink>{!paper.withdrawn && <HeroButton icon={Mail} onClick={() => setEmailOpen(true)} title="Write to this paper\'s authors">Email authors</HeroButton>}<HeroButton icon={Eye}'],
  ['title="Download the files as one ZIP">Download</HeroButton></>}', 'title="Download the files as one ZIP">Download</HeroButton>{!paper.withdrawn && <HeroButton icon={Pencil} onClick={() => setManage("details")} title="Change the title, abstract and keywords">Edit</HeroButton>}</>}'],
  ['              <FilesCard detail={detail} onNotice={(title, text) => setToast({ title, text })} />\n              <NoteCard detail={detail} />', '              <FilesCard detail={detail} onNotice={(title, text) => setToast({ title, text })} onAddSupporting={paper.withdrawn ? null : () => setManage("files-supporting")} />\n              <NoteCard detail={detail} onUpload={() => setManage("files-paper")} />'],
  ['            <Card title="Paper actions" icon={Pencil}>', '            <div className="space-y-6">\n            <ManageCard detail={detail} onDetails={() => setManage("details")} onAuthors={() => setManage("authors")} onFiles={() => setManage("files-paper")} onWithdraw={() => setManage("withdraw")} />\n            <Card title="Paper actions" icon={Pencil}>'],
  ['              <Link href={confBase} className="mt-4 inline-block text-[12px] font-bold text-primary hover:underline">Back to all submissions</Link>\n            </Card>\n          </div>', '              <Link href={confBase} className="mt-4 inline-block text-[12px] font-bold text-primary hover:underline">Back to all submissions</Link>\n            </Card>\n            </div>\n          </div>'],
  ['      <FlowToast toast={toast} onClose={closeToast} />', `      <EditDetailsDialog asChair paper={asAuthor} open={manage === "details"} onClose={() => setManage(null)} onSaved={saved} onSessionEnded={retry} />
      <EditAuthorsDialog asChair paper={asAuthor} open={manage === "authors"} onClose={() => setManage(null)} onSaved={saved} onSessionEnded={retry} />
      <WithdrawDialog asChair paper={asAuthor} open={manage === "withdraw"} onClose={() => setManage(null)} onSaved={saved} onSessionEnded={retry} />
      <UpdateFilesDialog asChair paper={asAuthor} open={manage === "files-paper" || manage === "files-supporting"} initialTab={manage === "files-supporting" ? "supporting" : "paper"} onOpenFile={openFile} onClose={() => setManage(null)} onSaved={saved} onSessionEnded={retry} />
      {emailOpen && <EmailAuthorsDialog open paper={paper} conferenceName={conference.name} acronym={conference.acronym} onClose={() => setEmailOpen(false)} onSent={(count) => { setEmailOpen(false); setToast({ title: \`Email sent to \${count} author\${count === 1 ? "" : "s"}\`, text: "Every email is listed in Email Logs." }); }} />}
      <FlowToast toast={toast} onClose={closeToast} />`],
]);
console.log("applied", n);
