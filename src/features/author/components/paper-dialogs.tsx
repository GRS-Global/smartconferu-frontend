"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Download, Eye, FileCheck, FileUp, Paperclip, Pencil, Trash2, User, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/ui/field";
import { AuthRequiredError } from "@/services/errors";
import { sendActionEmails } from "@/services/action-emails";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import { autoCheckOf } from "@/lib/auto-check";
import { requestPaperIngest } from "@/services/paper-ai";
import type { AuthorInput, AuthorPaper, PaperFile } from "@/types/author-submission";

/* The ways an author changes their paper (the prototype's EditPaperDetailsModal, EditAuthorsModal and the withdraw
   confirmation, src/author-journey.jsx). Each saves through the service (the database checks who may change the paper and
   refuses once a decision is recorded) and then asks the email server for the action's emails; a sending problem comes back
   as a notice, not as a failed save. */

/** What a dialog hands back when it has saved: the page reloads the paper and shows `notice` (an email problem) if there is one. */
export interface Saved { notice: string | null }

const LABEL = "mb-1 block text-xs font-bold text-ink-soft";
const failure = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong — please try again.");

function Actions({ onCancel, onSave, disabled, saving, saveLabel = "Save changes", danger = false }: { onCancel: () => void; onSave: () => void; disabled?: boolean; saving: boolean; saveLabel?: string; danger?: boolean }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-line pt-4">
      <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border-[1.5px] border-line bg-white px-4 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas disabled:opacity-50">Cancel</button>
      <button type="button" onClick={onSave} disabled={disabled || saving} className={`rounded-lg px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 ${danger ? "bg-danger" : "bg-primary"}`}>{saving ? "Saving…" : saveLabel}</button>
    </div>
  );
}

/** Runs a save: while it runs the buttons are off; a failure stays in the dialog as a sentence; a closed session says so. */
function useSave(onClose: () => void, onSaved: (s: Saved) => void, onSessionEnded: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<Saved>) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await action();
      onClose();
      onSaved(saved);
    } catch (e) {
      if (e instanceof AuthRequiredError) { onClose(); onSessionEnded(); } else setError(failure(e));
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}

const Error_ = ({ message }: { message: string }) => (message ? <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">{message}</p> : null);

interface CommonProps { /** The chair of the conference editing the paper for its authors (not one of them). */ asChair?: boolean; paper: AuthorPaper; open: boolean; onClose: () => void; onSaved: (s: Saved) => void; onSessionEnded: () => void }

/* ---------------- title, abstract, keywords ---------------- */

function KeywordsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v) && value.length < 30) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-3 flex items-stretch gap-2">
        <input
          id="paper-keywords" value={draft} maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. Machine Learning — press Enter to add"
          className="min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft"
        />
        <button type="button" onClick={add} disabled={!draft.trim()} className="shrink-0 rounded-xl border-[1.5px] border-primary px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">Add</button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft py-1 pl-2.5 pr-1.5 text-xs font-semibold text-primary">
              {v}
              <button type="button" onClick={() => onChange(value.filter((i) => i !== v))} aria-label={`Remove ${v}`} className="hover:opacity-60"><X size={12} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailsForm({ paper, onClose, onSaved, onSessionEnded }: Omit<CommonProps, "open">) {
  const [title, setTitle] = useState(paper.title);
  const [abstract, setAbstract] = useState(paper.abstract);
  const [keywords, setKeywords] = useState(paper.keywords);
  const { saving, error, run } = useSave(onClose, onSaved, onSessionEnded);
  const valid = title.trim() !== "" && abstract.trim() !== "";
  const words = abstract.trim().split(/\s+/).filter(Boolean).length;
  return (
    <>
      <div className="space-y-4">
        <div>
          <label htmlFor="paper-title" className={LABEL}>Title<span className="text-danger" aria-hidden="true"> *</span></label>
          <input id="paper-title" value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
        </div>
        <div>
          <label htmlFor="paper-keywords" className={LABEL}>Keywords</label>
          <KeywordsEditor value={keywords} onChange={setKeywords} />
        </div>
        <div>
          <label htmlFor="paper-abstract" className={LABEL}>Abstract<span className="text-danger" aria-hidden="true"> *</span></label>
          <textarea id="paper-abstract" value={abstract} maxLength={20000} rows={7} onChange={(e) => setAbstract(e.target.value)} className={`${INPUT_CLASS} resize-y bg-canvas leading-relaxed focus:bg-white`} />
          <span className="mt-1 block text-right text-[11px] text-ink-faint">{words} words</span>
        </div>
      </div>
      <Error_ message={error} />
      <Actions
        onCancel={onClose} saving={saving} disabled={!valid}
        onSave={() => run(async () => { await (await getAuthorSubmissionService()).updateDetails(paper.dbId, { title, abstract, keywords }); return { notice: null }; })}
      />
    </>
  );
}

export function EditDetailsDialog(props: CommonProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Update submission" description={`${props.paper.id} · title, abstract & keywords`} icon={Pencil} size="lg">
      <DetailsForm paper={props.paper} onClose={props.onClose} onSaved={props.onSaved} onSessionEnded={props.onSessionEnded} />
    </Dialog>
  );
}

/* ---------------- authors ---------------- */

interface Row extends AuthorInput { key: number }
let rowKey = 0;
const EMAIL = /\S+@\S+\.\S+/;

function AuthorsForm({ paper, asChair = false, onClose, onSaved, onSessionEnded }: Omit<CommonProps, "open">) {
  const [rows, setRows] = useState<Row[]>(() => paper.authors.map((a) => ({ name: a.name, email: a.email, affiliation: a.affiliation, country: a.country, corresponding: a.corresponding, key: ++rowKey })));
  const { saving, error, run } = useSave(onClose, onSaved, onSessionEnded);
  const mine = new Set(paper.myEmails);
  const update = (key: number, patch: Partial<AuthorInput>) => setRows((l) => l.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  // Any number of corresponding authors, but never none: the last ticked box can't be cleared.
  const toggleCorresponding = (key: number) => setRows((l) => {
    const next = l.map((a) => (a.key === key ? { ...a, corresponding: !a.corresponding } : a));
    return next.some((a) => a.corresponding) ? next : l;
  });
  const move = (i: number, dir: -1 | 1) => setRows((l) => { const next = [...l]; [next[i], next[i + dir]] = [next[i + dir], next[i]]; return next; });
  const remove = (key: number) => setRows((l) => {
    const next = l.filter((a) => a.key !== key);
    if (!next.some((a) => a.corresponding) && next[0]) next[0] = { ...next[0], corresponding: true };
    return next;
  });
  const correspondingCount = rows.filter((a) => a.corresponding).length;
  // The author editing their paper must stay on it.
  const meListed = asChair || rows.some((a) => mine.has(a.email.trim().toLowerCase()));
  const valid = rows.length > 0 && meListed && rows.every((a) => a.name.trim() && EMAIL.test(a.email.trim()));
  const iconBtn = "flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-white disabled:opacity-30";

  const save = () => run(async () => {
    const authors: AuthorInput[] = rows.map((a) => ({ name: a.name.trim(), email: a.email.trim(), affiliation: a.affiliation.trim(), country: a.country, corresponding: a.corresponding }));
    await (await getAuthorSubmissionService()).saveAuthors(paper.dbId, authors);
    // The people added are told they were added as a co-author (only the addresses that are new on the paper).
    const known = new Set(paper.authors.map((a) => a.email.trim().toLowerCase()));
    const added = authors.filter((a) => !known.has(a.email.toLowerCase())).map((a) => a.email);
    return { notice: added.length ? await sendActionEmails("paper_authors_updated", { submissionId: paper.dbId, added }) : null };
  });

  return (
    <>
      <div className="space-y-3">
        {rows.map((a, i) => (
          <div key={a.key} style={{ border: `1px solid ${a.corresponding ? "var(--primary-soft-border)" : "var(--border)"}`, background: a.corresponding ? "var(--primary-soft)" : "#FFFFFF" }} className="rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-[11px] font-extrabold text-navy">{i + 1}</span>
                <span className="text-xs font-bold text-navy">{i === 0 ? "Main author" : "Co-author"}</span>
                {mine.has(a.email.trim().toLowerCase()) && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"><User size={10} strokeWidth={2.6} aria-hidden="true" /> You</span>}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className={iconBtn}><ArrowUp size={14} aria-hidden="true" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" className={iconBtn}><ArrowDown size={14} aria-hidden="true" /></button>
                <button type="button" onClick={() => remove(a.key)} disabled={rows.length === 1} aria-label="Remove author" className={`${iconBtn} text-ink-faint hover:text-danger`}><Trash2 size={14} aria-hidden="true" /></button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`author-name-${a.key}`} className={LABEL}>Full name<span className="text-danger" aria-hidden="true"> *</span></label>
                <input id={`author-name-${a.key}`} value={a.name} maxLength={200} onChange={(e) => update(a.key, { name: e.target.value })} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
              </div>
              <div>
                <label htmlFor={`author-email-${a.key}`} className={LABEL}>Email<span className="text-danger" aria-hidden="true"> *</span></label>
                <input id={`author-email-${a.key}`} type="email" value={a.email} maxLength={254} onChange={(e) => update(a.key, { email: e.target.value })} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`author-aff-${a.key}`} className={LABEL}>Affiliation</label>
                <input id={`author-aff-${a.key}`} value={a.affiliation} maxLength={300} placeholder="University / organisation" onChange={(e) => update(a.key, { affiliation: e.target.value })} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
              </div>
            </div>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={a.corresponding} onChange={() => toggleCorresponding(a.key)} disabled={a.corresponding && correspondingCount === 1} title={a.corresponding && correspondingCount === 1 ? "At least one author must be a corresponding author" : undefined} className="h-4 w-4 accent-primary" />
              <span className={`text-xs font-semibold ${a.corresponding ? "text-primary" : "text-ink-soft"}`}>Corresponding author</span>
            </label>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows((l) => (l.length < 50 ? [...l, { key: ++rowKey, name: "", email: "", affiliation: "", country: "", corresponding: false }] : l))} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-line-strong py-2.5 text-sm font-bold text-primary hover:bg-primary-soft">
        <UserPlus size={15} aria-hidden="true" /> Add co-author
      </button>
      {!meListed && <p role="alert" className="mt-2 text-xs font-semibold text-danger">You have to stay on the paper as an author or co-author. Put your own name and email back to save.</p>}
      <Error_ message={error} />
      <Actions onCancel={onClose} saving={saving} disabled={!valid} onSave={save} />
    </>
  );
}

export function EditAuthorsDialog(props: CommonProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Update / add authors" description="The first author is the main author. Tick every corresponding author (at least one)." icon={Users} size="lg">
      <AuthorsForm paper={props.paper} asChair={props.asChair} onClose={props.onClose} onSaved={props.onSaved} onSessionEnded={props.onSessionEnded} />
    </Dialog>
  );
}

/* ---------------- withdraw ---------------- */

function WithdrawForm({ paper, registered, asChair = false, onClose, onSaved, onSessionEnded }: Omit<CommonProps, "open"> & { registered: boolean }) {
  const { saving, error, run } = useSave(onClose, onSaved, onSessionEnded);
  const message = asChair
    ? `"${paper.title}" will be withdrawn for its authors and removed from review. The authors are emailed. This can't be undone.`
    : paper.status === "accepted"
    ? `"${paper.title}" has been accepted${registered ? " and you are registered" : ""}. Withdrawing removes it from the programme and proceedings, and it can't be undone.`
    : `"${paper.title}" will be removed from review and the organisers will be notified. This can't be undone.`;
  return (
    <>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft"><AlertTriangle size={18} className="text-danger" /></span>
        <p className="text-sm leading-relaxed text-ink-soft">{message}</p>
      </div>
      <Error_ message={error} />
      <Actions
        onCancel={onClose} saving={saving} saveLabel={asChair ? "Withdraw for the authors" : "Withdraw submission"} danger
        onSave={() => run(async () => {
          await (await getAuthorSubmissionService()).withdraw(paper.dbId);
          // The authors and the conference's chairs get "Submission withdrawn".
          return { notice: await sendActionEmails("submission_withdrawn", { submissionId: paper.dbId }) };
        })}
      />
    </>
  );
}

export function WithdrawDialog(props: CommonProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.asChair ? "Withdraw for the authors?" : "Withdraw this paper?"} size="md">
      <WithdrawForm paper={props.paper} asChair={props.asChair} registered={props.paper.result === "registered"} onClose={props.onClose} onSaved={props.onSaved} onSessionEnded={props.onSessionEnded} />
    </Dialog>
  );
}

/* ---------------- files: a new version, or a supporting document ---------------- */

const ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 26214400;
const mb = (n: number) => `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;

/** The problem with a picked file, in words, or "" when it can go. (The database and storage check again.) */
function fileProblem(f: File): string {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  if (!["pdf", "doc", "docx"].includes(ext)) return "Only PDF or Word files can be uploaded.";
  if (f.size === 0) return "That file is empty.";
  if (f.size > MAX_BYTES) return "That file is too large — the limit is 25 MB.";
  return "";
}

function FileField({ id, file, onFile }: { id: string; file: File | null; onFile: (f: File | null) => void }) {
  const [over, setOver] = useState(false);
  const problem = file ? fileProblem(file) : "";
  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-4 py-7 text-center transition-colors ${over ? "border-primary bg-primary-soft" : "border-line-strong bg-canvas hover:bg-primary-soft"}`}
      >
        <FileUp size={22} aria-hidden="true" className="text-primary" />
        <span className="text-sm font-semibold text-navy">{file ? file.name : "Drop a file here, or click to choose one"}</span>
        <span className="text-[11px] text-ink-faint">{file ? mb(file.size) : "PDF or DOCX, up to 25 MB"}</span>
      </label>
      <input id={id} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      {file && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p role={problem ? "alert" : undefined} className={`text-xs ${problem ? "font-semibold text-danger" : "text-ink-faint"}`}>{problem || "Ready to upload."}</p>
          <button type="button" onClick={() => onFile(null)} className="shrink-0 text-xs font-bold text-primary hover:underline">Remove</button>
        </div>
      )}
    </div>
  );
}

type OpenFile = (f: PaperFile, download: boolean) => void;

function FilesForm({ paper, initialTab, onOpenFile, onClose, onSaved, onSessionEnded }: Omit<CommonProps, "open"> & { initialTab: "paper" | "supporting"; onOpenFile: OpenFile }) {
  const [tab, setTab] = useState(initialTab);
  const [file, setFile] = useState<File | null>(null);
  const { saving, error, run } = useSave(onClose, onSaved, onSessionEnded);
  const versions = paper.versions;
  const latest = versions.at(-1);
  const ready = file !== null && fileProblem(file) === "";
  const icon = "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40";
  const actions = (f: PaperFile) => (
    <>
      <button type="button" onClick={() => onOpenFile(f, false)} disabled={!f.storagePath} aria-label={`View ${f.name}`} className={icon}><Eye size={14} aria-hidden="true" /></button>
      <button type="button" onClick={() => onOpenFile(f, true)} disabled={!f.storagePath} aria-label={`Download ${f.name}`} className={icon}><Download size={14} aria-hidden="true" /></button>
    </>
  );
  return (
    <>
      <div className="mb-5">
        <label htmlFor="files-kind" className={LABEL}>What do you want to update?</label>
        <select id="files-kind" value={tab} onChange={(e) => { setTab(e.target.value as "paper" | "supporting"); setFile(null); }} className={`${INPUT_CLASS} cursor-pointer font-semibold`}>
          <option value="paper">{`Paper file (v${versions.length + 1} · new version)`}</option>
          <option value="supporting">{`Supporting documents${paper.supporting.length ? ` (${paper.supporting.length})` : ""}`}</option>
        </select>
      </div>
      {tab === "paper" ? (
        <div className="space-y-4">
          <div>
            <div className={LABEL}>Current version</div>
            {versions.length === 0 ? <p className="rounded-xl bg-canvas px-4 py-4 text-center text-xs text-ink-faint">No paper uploaded yet.</p> : (
              <ul className="divide-y divide-muted rounded-xl border border-line">
                {[...versions].reverse().map((v, i) => (
                  <li key={`${v.name}-${i}`} className="flex items-center gap-2.5 px-3.5 py-2.5">
                    <FileCheck size={15} aria-hidden="true" className={`shrink-0 ${i === 0 ? "text-primary" : "text-ink-faint"}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-xs font-semibold ${i === 0 ? "text-ink" : "text-ink-muted"}`}>{v.name}</div>
                      <div className="truncate text-[11px] text-ink-faint">Uploaded {v.uploadedAt || "—"}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${i === 0 ? "bg-primary-soft text-primary" : "bg-muted text-ink-muted"}`}>v{versions.length - i}{i === 0 ? " · current" : ""}</span>
                    {actions(v)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className={LABEL}>Upload a new version</div>
            <FileField id="files-new" file={file} onFile={setFile} />
            <p className="mt-1.5 text-[11px] text-ink-faint">PDF or DOCX.{latest ? ` Replaces ${latest.name} as the file reviewers and organisers see.` : ""} Earlier versions are kept.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {paper.supporting.length === 0 ? (
            <div className="rounded-xl bg-canvas px-4 py-5 text-center text-xs font-medium text-ink-faint">No supporting documents yet. Add datasets, appendices, source code or a signed copyright form.</div>
          ) : (
            <ul className="divide-y divide-muted rounded-xl border border-line">
              {paper.supporting.map((d, i) => (
                <li key={`${d.name}-${i}`} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <Paperclip size={14} aria-hidden="true" className="shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-ink">{d.name}</div>
                    <div className="text-[11px] text-ink-faint">{d.type ?? "Supporting document"} · {d.uploadedAt}</div>
                  </div>
                  {actions(d)}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-3 rounded-xl border border-line p-3.5">
            <div className={LABEL}>Add a document</div>
            <FileField id="files-supporting" file={file} onFile={setFile} />
          </div>
        </div>
      )}
      <Error_ message={error} />
      <Actions
        onCancel={onClose} saving={saving} disabled={!ready} saveLabel="Save files"
        onSave={() => run(async () => {
          if (!file) return { notice: null };
          // A new version of the paper is checked at once (rules, then an AI review when unsure); the chair's Initial Check opens with the result filled in.
          const auto = tab === "paper" ? await autoCheckOf(file) : null;
          await (await getAuthorSubmissionService()).uploadFile(paper.dbId, file, tab === "paper" ? "version" : "supporting", auto);
          // A new version rings the chairs' bell ("New version of … to check"); the server does that.
          // The AI features follow the newest version: prepared in the background, never blocking the upload.
          if (tab === "paper") void requestPaperIngest(paper.dbId);
          return { notice: tab === "paper" ? await sendActionEmails("paper_revised", { submissionId: paper.dbId }) : null };
        })}
      />
    </>
  );
}

export function UpdateFilesDialog({ initialTab, onOpenFile, ...props }: CommonProps & { initialTab: "paper" | "supporting"; onOpenFile: OpenFile }) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Update files" description={`${props.paper.id} · replace ${props.asChair ? "the" : "your"} paper or add other documents`} icon={FileUp} size="lg">
      <FilesForm paper={props.paper} initialTab={initialTab} onOpenFile={onOpenFile} onClose={props.onClose} onSaved={props.onSaved} onSessionEnded={props.onSessionEnded} />
    </Dialog>
  );
}
