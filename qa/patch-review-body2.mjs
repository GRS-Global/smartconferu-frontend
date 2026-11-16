// One-off edit helper: review page vs the prototype (APME-4): status lines and notes on each reviewer, the paper's own stage tile, summary box, placeholder, hero buttons at the right, breadcrumb.
import fs from "node:fs";
let n = 0;
function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); continue; } s = s.replace(a, () => b); n += 1; }
  fs.writeFileSync(file, s);
}
patch("../src/features/chair/components/chair-review-view.tsx", [
  // status line, as in the prototype
  [`function status(r: ChairReviewer): { text: string; tone: string } {
  if (r.review) return { text: \`Reviewed\${r.review.submittedAt ? \` · \${r.review.submittedAt}\` : ""}\`, tone: "text-ink-faint" };
  if (r.response === "pending") return { text: "Awaiting acceptance", tone: "text-warning" };
  if (r.due && r.due < new Date().toISOString().slice(0, 10)) return { text: \`Overdue · was due \${r.due}\`, tone: "text-danger" };
  return { text: r.due ? \`Due \${r.due}\` : "Reviewing", tone: "text-ink-soft" };
}`, `const dayLabel = (iso: string) => (iso ? new Date(\`\${iso}T00:00:00\`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");
function status(r: ChairReviewer): { text: string; tone: string; note: string } {
  if (r.review) return { text: \`Reviewed\${r.review.submittedAt ? \` · \${r.review.submittedAt}\` : ""}\`, tone: "text-ink-faint", note: "" };
  if (r.awaitingInvite) return { text: "Hasn't accepted the committee invitation yet", tone: "text-warning", note: "This paper starts once they accept your committee invitation." };
  if (r.response === "pending") return { text: \`Waiting to accept the paper\${r.assignedAt ? \` · assigned \${r.assignedAt}\` : ""}\`, tone: "text-warning", note: "Waiting for them to accept or decline. You'll be notified either way." };
  if (r.due && r.due < new Date().toISOString().slice(0, 10)) return { text: \`Overdue · was due \${dayLabel(r.due)}\`, tone: "text-danger", note: "Waiting for this reviewer to submit their review." };
  return { text: \`Accepted · review due \${dayLabel(r.due)}\`, tone: "text-primary", note: "Waiting for this reviewer to submit their review." };
}`],
  [`      {rv && (
        <>`, `      {!rv && st.note && <div className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[11px] font-medium text-ink-faint">{st.note}</div>}
      {rv && (
        <>`],
  // tiles: the paper's own outcome type is the selected one, also a stage such as "Plagiarism clear"
  ["  detail: ChairPaperDetail; current: DecisionType | null; choices: DecisionType[];", "  detail: ChairPaperDetail; current: DecisionType | null; outcomeType: DecisionType | null; choices: DecisionType[];"],
  ["  const locked = p.busy || p.notified || p.withdrawn;", "  const locked = p.busy || p.notified || p.withdrawn;\n  // The paper's own outcome (a decision, or a stage such as \"Plagiarism clear\") is the selected tile, and gets a tile if it is not one of the choices.\n  const tiles = p.outcomeType && !p.choices.some((t) => t.id === p.outcomeType?.id) ? [...p.choices, p.outcomeType] : p.choices;"],
  ["          {p.choices.map((t) => {\n            const on = (p.pick ?? p.current)?.id === t.id;", "          {tiles.map((t) => {\n            const on = (p.pick ?? p.outcomeType)?.id === t.id;"],
  ["{p.choices.length === 0 && <p", "{tiles.length === 0 && <p"],
  ["        {done.length > 0 && <div className=\"mb-3 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-soft\">", "        {detail.reviewers.length > 0 && <div className=\"mb-3 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-soft\">"],
  ["rows={7} maxLength={5000} className=\"mt-1.5", "rows={5} maxLength={5000} placeholder=\"Sum up the reviews in your own words — what the authors did well and what to fix next. E.g. “All three reviewers liked the method. For the final version, add the statistical tests asked for in Section 4.”\" className=\"mt-1.5"],
]);
patch("../src/features/chair/components/chair-paper-page.tsx", [
  ["          actionsBelow={isReview}\n", ""],
  ['<span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" aria-hidden="true" /> {pillText}</span>', '<Clock size={11} aria-hidden="true" /> {pillText}</span>'],
  ["import { ChevronLeft, ChevronRight, Download, Eye,", "import { ChevronLeft, ChevronRight, Clock, Download, Eye,"],
  ["<ReviewBody detail={detail} current={current} choices={reviewChoices}", "<ReviewBody detail={detail} current={current} outcomeType={outcomeType} choices={reviewChoices}"],
  ["  const notified = paper.notifiedOutcome !== null", "  const outcomeType = data.decisionTypes.find((t) => t.id === paper.decisionTypeId) ?? data.decisionTypes.find((t) => t.outcome === paper.outcome) ?? null;\n  const notified = paper.notifiedOutcome !== null"],
  ["{ label: conference.acronym, href: confBase }, ...(isReview ? [{ label: \"Peer Review\", href: `${confBase}/peer-review` }] : []), { label: paper.id }]", "...(isReview ? [{ label: \"Peer Review\", href: `${confBase}/peer-review` }] : [{ label: conference.acronym, href: confBase }]), { label: paper.id }]"],
]);
console.log("applied", n);
