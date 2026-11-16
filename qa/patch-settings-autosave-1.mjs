// One-off edit helper (part 1): shared pieces for the autosaving Review settings panel.
import fs from "node:fs";
let n = 0;
function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); continue; } s = s.replace(a, () => b); n += 1; }
  fs.writeFileSync(file, s);
}
// the timeline editor: exported, saves only the fields it owns
patch("../src/features/chair/components/review-timeline-strip.tsx", [
  ["function Editor({ timeline, emailsHref, onSave }: { timeline: ReviewTimeline; emailsHref: string; onSave: (t: ReviewTimeline) => Promise<void> }) {", "export function ReviewTimelineEditor({ timeline, emailsHref, onSave }: { timeline: ReviewTimeline; emailsHref: string; onSave: (patch: Partial<ReviewTimeline>) => Promise<void> }) {"],
  ["onSave({ ...timeline, reviewDays: Number(next.reviewDays),", "onSave({ reviewDays: Number(next.reviewDays),"],
  ["  const save = async (t: ReviewTimeline) => { await (await getChairService()).saveReviewTimeline(slug, t); setFresh(t); };", "  const save = async (patch: Partial<ReviewTimeline>) => { const t = { ...(fresh ?? saved), ...patch }; await (await getChairService()).saveReviewTimeline(slug, t); setFresh(t); };"],
  ["<Editor timeline={saved} emailsHref", "<ReviewTimelineEditor timeline={saved} emailsHref"],
]);
// visibility card: every change is saved at once
patch("../src/features/chair/components/policy-cards.tsx", [
  ["export function VisibilityCard({ initial, mode, fields, busy, onSave }: { initial: ReviewPolicy; mode: ReviewMode; fields: ReviewField[]; busy: boolean; onSave: (policy: ReviewPolicy, mode: ReviewMode) => void }) {", "export function VisibilityCard({ initial, mode, fields, onChange }: { initial: ReviewPolicy; mode: ReviewMode; fields: ReviewField[]; onChange: (policy: ReviewPolicy, mode: ReviewMode) => void }) {"],
  ["  const dirty = JSON.stringify(p) !== JSON.stringify(initial) || m !== mode;\n", "  // Like the prototype there is no Save button: each switch / checkbox is saved as soon as it changes.\n  const put = (np: ReviewPolicy, nm: ReviewMode = m) => { setP(np); setM(nm); onChange(np, nm); };\n"],
  ["  const toggle = (id: string) => setP({ ...p, hiddenFields: p.hiddenFields.includes(id) ? p.hiddenFields.filter((x) => x !== id) : [...p.hiddenFields, id] });", "  const toggle = (id: string) => put({ ...p, hiddenFields: p.hiddenFields.includes(id) ? p.hiddenFields.filter((x) => x !== id) : [...p.hiddenFields, id] });"],
  ['desc="Control what reviewers can access and what authors are asked to provide."\n      footer={<Button disabled={!dirty || busy} onClick={() => onSave(p, m)}>{busy ? "Saving…" : "Save visibility"}</Button>}>', 'desc="Control what reviewers can access and what authors are asked to provide.">'],
  ['onChange={(v) => setM(v ? "double_blind" : "single_blind")}', 'onChange={(v) => put(p, v ? "double_blind" : "single_blind")}'],
  ['onChange={(v) => setP({ ...p, unassignedAccess: v })}', 'onChange={(v) => put({ ...p, unassignedAccess: v })}'],
  ['onChange={(v) => setP({ ...p, abstractFirst: v })}', 'onChange={(v) => put({ ...p, abstractFirst: v })}'],
  ['onChange={(v) => setP({ ...p, presenterRequired: v })}', 'onChange={(v) => put({ ...p, presenterRequired: v })}'],
  ['onChange={(v) => setP({ ...p, shareResults: v })}', 'onChange={(v) => put({ ...p, shareResults: v })}'],
]);
// the "How reviewers see it" preview of the instructions
patch("../src/features/chair/components/review-form-preview.tsx", [
  ["export function ReviewFormPreview(", `/** The instructions card as the reviewer sees it (also shown under the instructions editor as "How reviewers see it"). */
export function InstructionsPreview({ text }: { text: string }) {
  const [show, setShow] = useState(true);
  return (
    <section style={CARD} className="overflow-hidden rounded-2xl bg-white">
      <div className="flex items-center gap-3 bg-primary-soft/60 px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary"><FileText size={15} aria-hidden="true" /></span>
        <div className="flex-1"><div className="text-sm font-bold text-navy">Reviewer instructions</div><div className="text-[11px] text-ink-faint">Please read before you start your review</div></div>
        <button type="button" onClick={() => setShow(!show)} aria-expanded={show} className="inline-flex items-center gap-1 text-xs font-bold text-primary">{show ? "Hide" : "Show"} <ChevronUp size={13} aria-hidden="true" className={show ? "" : "rotate-180"} /></button>
      </div>
      {show && <div className="px-5 py-4 text-sm leading-[1.7] text-ink-soft"><Rich text={text.trim() ? text : STANDARD.join("\n\n")} /></div>}
    </section>
  );
}

export function ReviewFormPreview(`],
]);
console.log("applied", n);
