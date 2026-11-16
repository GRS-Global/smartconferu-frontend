// One-off edit helper: Peer Review › Manage › Form: Form / Settings tabs in place, and "Edit form" edits in place (no trip to Conference Settings).
import fs from "node:fs";
let n = 0;
function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); continue; } s = s.replace(a, b); n += 1; }
  fs.writeFileSync(file, s);
}
patch("../src/features/chair/components/review-form-preview.tsx", [
  ["hiddenFields, editHref, tryHref, tryLabel }: { acronym: string; instructions: string; form: ReviewSection[]; hiddenFields: string[]; editHref: string; tryHref?: string; tryLabel?: string }) {", "hiddenFields, editHref, onEdit, tryHref, tryLabel }: { acronym: string; instructions: string; form: ReviewSection[]; hiddenFields: string[]; editHref?: string; onEdit?: () => void; tryHref?: string; tryLabel?: string }) {"],
  ['<Link href={editHref} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</Link>', '{onEdit ? <button type="button" onClick={onEdit} className="mt-4 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</button> : <Link href={editHref ?? "#"} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</Link>}'],
]);
patch("../src/features/chair/components/peer-review-manage-page.tsx", [
  ['import { ReviewFormPreview } from "./review-form-preview";', 'import { ReviewFormPreview } from "./review-form-preview";\nimport { ReviewFormEditors, ReviewSettingsPanel } from "./review-settings-page";'],
  ['  const [colsOpen, setColsOpen] = useState(false);', '  const [colsOpen, setColsOpen] = useState(false);\n  // Form tab: its two sub-tabs (Form / Settings) and whether the form is being edited in place.\n  const [sub, setSub] = useState<"form" | "settings">("form");\n  const [editing, setEditing] = useState(false);'],
  ['  const { state, retry } = useChairConference(slug, { board: true, setup: true, settings: true });', '  const { state, retry, reload } = useChairConference(slug, { board: true, setup: true, settings: true });'],
  [`            <div role="tablist" aria-label="Form or settings" className="mb-5 flex border-b border-line">
              <span role="tab" aria-selected="true" className="-mb-px border-b-2 border-primary px-4 py-3 text-sm font-semibold text-primary">Form</span>
              <Link href={\`/chair/\${e}/settings/review\`} className="px-4 py-3 text-sm font-semibold text-ink-muted hover:text-navy">Settings</Link>
            </div>
            <ReviewFormPreview acronym={conference.acronym} instructions={setup.instructions} form={setup.form} hiddenFields={state.settings?.review.hiddenFields ?? []} editHref={\`/chair/\${e}/settings/review\`}`, `            <div role="tablist" aria-label="Form or settings" className="mb-5 flex border-b border-line">
              {([["form", "Form"], ["settings", "Settings"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={sub === k} onClick={() => setSub(k)} className={\`-mb-px cursor-pointer border-b-[2.5px] px-3 py-2.5 text-sm font-semibold transition-colors hover:text-navy \${sub === k ? "border-primary text-navy" : "border-transparent text-ink-muted"}\`}>{l}</button>)}
            </div>
            {sub === "settings" && state.settings && <ReviewSettingsPanel slug={slug} conferenceId={conference.id} settings={state.settings} setup={setup} reload={reload} />}
            {sub === "form" && editing && state.settings && <ReviewFormEditors slug={slug} settings={state.settings} setup={setup} reload={reload} onDone={() => setEditing(false)} />}
            {sub === "form" && !editing && <ReviewFormPreview acronym={conference.acronym} instructions={setup.instructions} form={setup.form} hiddenFields={state.settings?.review.hiddenFields ?? []} onEdit={state.settings ? () => setEditing(true) : undefined} editHref={\`/chair/\${e}/settings/review\`}`],
]);
console.log("applied", n);
