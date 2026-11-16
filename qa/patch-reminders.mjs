// One-off edit helper: "Send reminder" (designed as in the prototype; the email event is for the backend to add later): under Due, the overdue strip, and the bulk bar.
import fs from "node:fs";
let n = 0;
function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); continue; } s = s.replace(a, () => b); n += 1; }
  fs.writeFileSync(file, s);
}
patch("../src/services/action-emails.ts", [
  ['| "reviewer_invited" |', '| "reviewer_invited" | "reviewer_reminder" |'],
]);
patch("../src/features/chair/components/peer-review-page.tsx", [
  ['import { Check, ChevronDown,', 'import { Bell, Check, ChevronDown,'],
  // state
  ['  const [addError, setAddError] = useState("");', '  const [addError, setAddError] = useState("");\n  // Reviewer reminders sent from this page in this tab (assignment ids) — shown as "Reminded"; the database keeps no "last reminded" yet.\n  const [reminded, setReminded] = useState<string[]>([]);'],
  // handlers (before the assignHint helper)
  ['  const assignHint = (r: PrRow) =>', `  // A reminder goes to a reviewer who is overdue, hasn't accepted the paper, or hasn't accepted the committee invitation. It is the email event "reviewer_reminder",
  // which the email server does not have yet: until it does, the server's refusal comes back as the notice below and nothing is marked as reminded.
  const canRemind = (x: PrRow["reviewers"][number]) => x.state === "overdue" || x.state === "waiting" || x.state === "invite";
  const remindMany = async (targets: Array<{ row: PrRow; x: PrRow["reviewers"][number] }>) => {
    const todo = targets.filter((t) => !reminded.includes(t.x.r.assignmentId));
    if (!todo.length) return;
    setBusy(true);
    let notice: string | null = null; const ok: string[] = [];
    for (const t of todo) {
      const mail = await sendActionEmails("reviewer_reminder", { submissionId: t.row.paper.dbId, assignmentId: t.x.r.assignmentId });
      if (mail) notice = mail; else ok.push(t.x.r.assignmentId);
    }
    setBusy(false);
    if (ok.length) setReminded((l) => [...new Set([...l, ...ok])]);
    const names = [...new Set(todo.filter((t) => ok.includes(t.x.r.assignmentId)).map((t) => t.x.r.name))];
    const papers = [...new Set(todo.map((t) => t.row.paper.id))];
    if (!ok.length) setToast({ title: "Reminder not sent", text: notice ?? "Something went wrong." });
    else setToast({ title: \`Reminder sent to \${names.slice(0, 3).join(", ")}\${names.length > 3 ? \` +\${names.length - 3} more\` : ""}\`, text: \`\${papers.length === 1 ? papers[0] : \`\${papers.length} papers\`} · review reminder emailed.\${notice ? \` \${notice}\` : ""}\` });
  };
  const overdueReviews = inTrack.filter((r) => !r.decided).flatMap((r) => r.reviewers.filter((x) => x.state === "overdue").map((x) => ({ row: r, x })));
  const overdueToRemind = overdueReviews.filter((t) => !reminded.includes(t.x.r.assignmentId));
  const remindTargets = (list: PrRow[]) => list.flatMap((r) => (r.decided ? [] : r.reviewers.filter(canRemind).map((x) => ({ row: r, x }))));
  const assignHint = (r: PrRow) =>`],
  // the strip (before the cut-off bands)
  ['        {filter === "ready" && readyRows.length > 0 && (', `        {["waiting", "overdue"].includes(filter) && overdueReviews.length > 0 && (
          <div style={{ background: "var(--danger-soft)", border: "1px solid var(--border)" }} className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
            <Bell size={16} aria-hidden="true" className="shrink-0 text-danger" />
            <div className="min-w-0 flex-1 text-[13px] text-ink-soft"><b className="text-navy">{overdueReviews.length} review{overdueReviews.length === 1 ? " is" : "s are"} overdue.</b></div>
            <button type="button" disabled={!overdueToRemind.length || busy} onClick={() => void remindMany(overdueToRemind)} title={overdueToRemind.length ? "One reminder email to each overdue reviewer" : "Every overdue reviewer was already reminded"} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white enabled:hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              <Bell size={13} aria-hidden="true" /> {overdueToRemind.length ? \`Send reminder to \${overdueToRemind.length} overdue reviewer\${overdueToRemind.length === 1 ? "" : "s"}\` : "All reminded"}
            </button>
          </div>
        )}

        {filter === "ready" && readyRows.length > 0 && (`],
  // bulk bar
  ['<UserPlus size={13} aria-hidden="true" /> Assign same reviewers</button>', '<UserPlus size={13} aria-hidden="true" /> Assign same reviewers</button>\n            {remindTargets(selectedRows).length > 0 && <button type="button" disabled={busy} onClick={() => void remindMany(remindTargets(selectedRows))} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20 disabled:opacity-50"><Bell size={13} aria-hidden="true" /> Send reminder</button>}'],
  // the Due cell
  ['<td className="px-3 py-2.5"><Lines r={r} cell={(x) => <><span className={`text-xs font-bold ${x.lateDays ? "text-danger" : x.r.review ? "text-ink-faint" : "text-ink"}`}>{x.r.due ? day(x.r.due) : "—"}</span>{x.lateDays > 0 && <span className="text-[11px] text-danger">{x.lateDays}d late</span>}</>} /></td>',
   '<td data-nav-stop className="px-3 py-2.5"><Lines r={r} cell={(x) => <><span className={`text-xs font-bold ${x.lateDays ? "text-danger" : x.r.review ? "text-ink-faint" : "text-ink"}`}>{x.r.due ? day(x.r.due) : "—"}</span>{x.lateDays > 0 && <span className="text-[11px] text-danger">{x.lateDays}d late</span>}{!r.decided && canRemind(x) && (reminded.includes(x.r.assignmentId)\n                      ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-faint"><Check size={11} aria-hidden="true" /> Reminded</span>\n                      : <button type="button" disabled={busy} onClick={() => void remindMany([{ row: r, x }])} className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline disabled:opacity-50"><Bell size={11} aria-hidden="true" /> Send reminder</button>)}</>} /></td>'],
]);
console.log("applied", n);
