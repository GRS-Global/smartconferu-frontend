// One-off edit helper: the chair's paper details page follows the prototype (status pill, View submission / Download, the status timeline, the paper card, the files table, the chair's note).
import fs from "node:fs";
const f = "../src/features/chair/components/chair-paper-page.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); return; } s = s.replace(a, () => b); n += 1; };

rep('import { ReviewBody } from "./chair-review-view";', 'import { ReviewBody } from "./chair-review-view";\nimport { FilesCard, NoteCard, PaperCard, PaperTimeline } from "./chair-paper-details";');
// the pill shows on both pages
rep('badge={isReview ? <span style={{ color: "#B45309", background: "var(--warning-soft)" }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"><Clock size={11} aria-hidden="true" /> {pillText}</span> : undefined}', 'badge={<span style={{ color: "#B45309", background: "var(--warning-soft)" }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"><Clock size={11} aria-hidden="true" /> {pillText}</span>}\n          footer={isReview ? undefined : <PaperTimeline detail={detail} outcomeType={outcomeType} />}');
// the buttons of the details page
rep(': <HeroLink icon={Users} href={`${base}/review`}>Peer Review</HeroLink>}', ': <><HeroLink icon={Users} href={`${base}/review`}>Peer Review</HeroLink><HeroButton icon={Eye} onClick={() => void viewSubmission()} title="Open the paper in a new tab">View submission</HeroButton><HeroButton icon={Download} primary disabled={busy} onClick={() => void downloadFiles()} title="Download the files as one ZIP">Download</HeroButton></>}');
// the body
const a = s.indexOf('        ) : (\n          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">\n            <Card title="Paper" icon={FileText}>');
const b = s.indexOf("        )}\n", a);
if (a < 0 || b < 0) console.log("MISSING details body", a, b);
else {
  s = s.slice(0, a) + `        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-6">
              <PaperCard detail={detail} />
              <FilesCard detail={detail} onNotice={(title, text) => setToast({ title, text })} />
              <NoteCard detail={detail} />
            </div>
            <Card title="Paper actions" icon={Pencil}>
              <div className="space-y-1">
                <button type="button" disabled={paper.withdrawn || notified} onClick={() => { setError(""); setDlg({ kind: "desk" }); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50"><XCircle size={15} aria-hidden="true" className="text-danger" /> Desk reject</button>
              </div>
              {error && dlg === null && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
              <Link href={confBase} className="mt-4 inline-block text-[12px] font-bold text-primary hover:underline">Back to all submissions</Link>
            </Card>
          </div>
` + s.slice(b); n += 1;
}
fs.writeFileSync(f, s); console.log("applied", n);
