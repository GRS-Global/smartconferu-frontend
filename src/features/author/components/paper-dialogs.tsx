"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Download, Eye, FileCheck, FileUp, Paperclip, Pencil, Trash2, User, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { AuthorPlaces } from "./author-places";
import { useEmailLaterAsk } from "./email-later-ask";
import { INPUT_CLASS } from "@/components/ui/field";
import { AuthRequiredError } from "@/services/errors";
import { ApiError } from "@/lib/api-client";
import { sendActionEmails } from "@/services/action-emails";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import { autoCheckOf } from "@/lib/auto-check";
import { requestPaperIngest } from "@/services/paper-ai";
import type { AuthorInput, AuthorPaper, PaperFile } from "@/types/author-submission";
import { isValidEmail } from "@/lib/email";
import { COUNTRIES } from "@/lib/country-codes";

const STAR = <span className="text-danger-ink" aria-hidden="true"> *</span>;
import { KeywordTags } from "@/components/ui/keyword-tags";

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
  /** `handled`: the form shows this failure itself, next to the field it is about (answer true), instead of the sentence at the bottom. */
  const run = async (action: () => Promise<Saved>, handled?: (e: unknown) => boolean) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await action();
      onClose();
      onSaved(saved);
    } catch (e) {
      if (e instanceof AuthRequiredError) { onClose(); onSessionEnded(); } else if (!handled?.(e)) setError(failure(e));
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}

const Error_ = ({ message }: { message: string }) => (message ? <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-ink">{message}</p> : null);

interface CommonProps { /** The chair of the conference editing the paper for its authors (not one of them). */ asChair?: boolean; paper: AuthorPaper; open: boolean; onClose: () => void; onSaved: (s: Saved) => void; onSessionEnded: () => void }

/* ---------------- title, abstract, keywords ---------------- */

function DetailsForm({ paper, onClose, onSaved, onSessionEnded }: Omit<CommonProps, "open">) {
  const [title, setTitle] = useState(paper.title);
  const [abstract, setAbstract] = useState(paper.abstract);
  const [keywords, setKeywords] = useState(paper.keywords);
  // The conference's tracks (when it uses them): the paper can be moved to another one here.
  const [track, setTrack] = useState(paper.track);
  const [tracks, setTracks] = useState<string[]>([]);
  useEffect(() => {
    let off = false;
    void getAuthorSubmissionService().then((s) => s.loadSubmitForm(paper.conference.id, false)).then((info) => {
      if (off || !info || info.tracksOn === false) return;
      setTracks(info.tracks.includes(paper.track) || !paper.track ? info.tracks : [paper.track, ...info.tracks]);
    }).catch(() => undefined);
    return () => { off = true; };
  }, [paper.conference.id, paper.track]);
  const { saving, error, run } = useSave(onClose, onSaved, onSessionEnded);
  // Save always answers: what is missing (or a title another paper already has) shows under its field, and the page scrolls to it.
  const [tried, setTried] = useState(false);
  const [takenTitle, setTakenTitle] = useState("");
  const valid = title.trim() !== "" && abstract.trim() !== "" && keywords.length > 0;
  const titleError = tried && !title.trim() ? "The title can't be empty." : takenTitle && takenTitle === title.trim() ? "A paper with this title is already submitted to this conference. Please use a different title." : "";
  const abstractError = tried && !abstract.trim() ? "The abstract can't be empty." : "";
  const keywordsError = tried && keywords.length === 0 ? "Add at least one keyword (press Enter after each)." : "";
  const words = abstract.trim().split(/\s+/).filter(Boolean).length;
  const save = () => {
    setTried(true);
    if (!valid) return;
    void run(
      async () => { await (await getAuthorSubmissionService()).updateDetails(paper.dbId, { title, abstract, keywords, track: track !== paper.track ? track : undefined }); return { notice: null }; },
      (e) => { if (e instanceof ApiError && e.code === "DUPLICATE_TITLE") { setTakenTitle(title.trim()); return true; } return false; },
    );
  };
  return (
    <>
      <div className="space-y-4">
        <div>
          <label htmlFor="paper-title" className={LABEL}>Title<span className="text-danger-ink" aria-hidden="true"> *</span></label>
          <input id="paper-title" value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} aria-invalid={Boolean(titleError) || undefined} aria-describedby={titleError ? "paper-title-error" : undefined} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
          {titleError && <p id="paper-title-error" role="alert" className="mt-1 text-[11.5px] font-semibold text-danger-ink">{titleError}</p>}
        </div>
        <div>
          <label htmlFor="paper-keywords" className={LABEL}>Keywords<span className="text-danger-ink" aria-hidden="true"> *</span></label>
          <KeywordTags id="paper-keywords" value={keywords} onChange={setKeywords} invalid={Boolean(keywordsError)} describedBy={keywordsError ? "paper-keywords-error" : undefined} placeholder="e.g. Machine Learning — press Enter to add" />
          {keywordsError && <p id="paper-keywords-error" role="alert" className="mt-1 text-[11.5px] font-semibold text-danger-ink">{keywordsError}</p>}
        </div>
        {tracks.length > 0 && (
          <div>
            <div id="paper-track-label" className={LABEL}>Track</div>
            <div role="group" aria-labelledby="paper-track-label" className="grid gap-2 sm:grid-cols-3">
              {tracks.map((t) => (
                <button key={t} type="button" aria-pressed={track === t} onClick={() => setTrack(t)} className={`rounded-lg border px-3 py-2.5 text-sm ${track === t ? "border-primary bg-primary-soft font-semibold text-primary" : "border-line bg-white text-ink hover:border-line-strong"}`}>{t}</button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label htmlFor="paper-abstract" className={LABEL}>Abstract<span className="text-danger-ink" aria-hidden="true"> *</span></label>
          <textarea id="paper-abstract" value={abstract} maxLength={20000} rows={7} onChange={(e) => setAbstract(e.target.value)} aria-invalid={Boolean(abstractError) || undefined} aria-describedby={abstractError ? "paper-abstract-error" : undefined} className={`${INPUT_CLASS} resize-y bg-canvas leading-relaxed focus:bg-white`} />
          {abstractError && <p id="paper-abstract-error" role="alert" className="mt-1 text-[11.5px] font-semibold text-danger-ink">{abstractError}</p>}
          <span className="mt-1 block text-right text-[11px] text-ink-faint">{words} words</span>
        </div>
      </div>
      <Error_ message={error} />
      <Actions onCancel={onClose} saving={saving} onSave={save} />
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

/** `later`: "Will add later" — this author's email is left out for now (an empty email on the paper is one still to come). */
interface Row extends AuthorInput { key: number; later: boolean }
let rowKey = 0;
/** An author editing their paper gives their own email and a co-author's (just their own on a one-author paper); a chair editing for the authors needs only the corresponding authors'. Same rule in the backend. */
const AUTHOR_EMAILS_REQUIRED = 2;

function AuthorsForm({ paper, asChair = false, onClose, onSaved, onSessionEnded }: Omit<CommonProps, "open">) {
  const [rows, setRows] = useState<Row[]>(() => paper.authors.map((a) => ({ name: a.name, email: a.email, affiliation: a.affiliation, department: a.department ?? "", city: a.city ?? "", country: a.country, otherAffiliations: a.otherAffiliations ?? [], corresponding: a.corresponding, later: a.email.trim() === "", key: ++rowKey })));
  const { saving, error, run } = useSave(onClose, onSaved, onSessionEnded);
  const mine = new Set(paper.myEmails);
  const update = (key: number, patch: Partial<AuthorInput>) => setRows((l) => l.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  // Any number of corresponding authors, at least one when saving. A corresponding author's email can't be left for later.
  const toggleCorresponding = (key: number) => setRows((l) => l.map((a) => (a.key === key ? { ...a, corresponding: !a.corresponding, later: a.corresponding ? a.later : false } : a)));
  const setLater = (key: number, on: boolean) => setRows((l) => l.map((a) => (a.key === key ? { ...a, later: on, email: on ? "" : a.email } : a)));
  // The first "Will add later" asks (once) why the email matters; the answer holds for the other authors.
  const laterAsk = useEmailLaterAsk(setLater, (key) => document.getElementById(`author-email-${key}`)?.focus());
  const toggleLater = (key: number) => laterAsk.toggle(key, Boolean(rows.find((a) => a.key === key)?.later));
  const [tried, setTried] = useState(false);
  const move = (i: number, dir: -1 | 1) => setRows((l) => { const next = [...l]; [next[i], next[i + dir]] = [next[i + dir], next[i]]; return next; });
  const remove = (key: number) => setRows((l) => l.filter((a) => a.key !== key));
  // The author editing their paper must stay on it.
  const isMine = (a: Row) => !asChair && mine.has(a.email.trim().toLowerCase());
  const meListed = asChair || rows.some(isMine);
  const canLater = (a: Row) => !a.corresponding && !isMine(a);
  const emailOk = (a: Row) => (a.later && canLater(a)) || isValidEmail(a.email.trim());
  // Every author needs an affiliation and a country (the city is optional), as on the submission form.
  const placeOk = (a: (typeof rows)[number]) => Boolean(a.affiliation.trim() && a.country);
  const corresponding = rows.some((a) => a.corresponding);
  const emailsGiven = rows.filter((a) => !a.later && isValidEmail(a.email.trim())).length;
  const enoughEmails = asChair || emailsGiven >= Math.min(AUTHOR_EMAILS_REQUIRED, rows.length);
  const valid = rows.length > 0 && meListed && corresponding && enoughEmails && rows.every((a) => a.name.trim() && emailOk(a) && placeOk(a));
  const missing = (bad: boolean) => (tried && bad) || undefined;
  const iconBtn = "flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-white disabled:opacity-30";

  const save = () => {
    setTried(true);
    if (!valid) return;
    void run(async () => {
    const authors: AuthorInput[] = rows.map((a) => ({ name: a.name.trim(), email: a.later && canLater(a) ? "" : a.email.trim(), affiliation: a.affiliation.trim(), department: a.department.trim(), city: a.city.trim(), country: a.country, otherAffiliations: (a.otherAffiliations ?? []).filter((p) => p.affiliation.trim()), corresponding: a.corresponding }));
    await (await getAuthorSubmissionService()).saveAuthors(paper.dbId, authors);
    // The people added are told they were added as a co-author (only the addresses that are new on the paper).
    const known = new Set(paper.authors.map((a) => a.email.trim().toLowerCase()));
    const added = authors.filter((a) => a.email !== "" && !known.has(a.email.toLowerCase())).map((a) => a.email);
    return { notice: added.length ? await sendActionEmails("paper_authors_updated", { submissionId: paper.dbId, added }) : null };
    });
  };

  return (
    <>
      {laterAsk.dialog}
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
                <button type="button" onClick={() => remove(a.key)} disabled={rows.length === 1} aria-label="Remove author" className={`${iconBtn} text-ink-faint hover:text-danger-ink`}><Trash2 size={14} aria-hidden="true" /></button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`author-name-${a.key}`} className={LABEL}>Full name<span className="text-danger-ink" aria-hidden="true"> *</span></label>
                <input id={`author-name-${a.key}`} value={a.name} maxLength={200} onChange={(e) => update(a.key, { name: e.target.value })} aria-invalid={missing(!a.name.trim())} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
                {tried && !a.name.trim() && <p id={`author-name-${a.key}-error`} role="alert" className="mt-1 text-[11.5px] font-semibold text-danger-ink">Every author needs a name.</p>}
              </div>
              <div>
                <label htmlFor={`author-email-${a.key}`} className={LABEL}>Email{!(a.later && canLater(a)) && <span className="text-danger-ink" aria-hidden="true"> *</span>}</label>
                <input id={`author-email-${a.key}`} type="email" value={a.later && canLater(a) ? "" : a.email} maxLength={254} disabled={a.later && canLater(a)} placeholder={a.later && canLater(a) ? "Will be added later" : undefined} onChange={(e) => update(a.key, { email: e.target.value })} aria-invalid={missing(!emailOk(a))} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
                {canLater(a) && (a.later || !a.email.trim()) && <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-ink-soft"><input type="checkbox" checked={a.later} onChange={() => toggleLater(a.key)} /> Will add later</label>}
                {tried && !emailOk(a) && <p role="alert" className="mt-1 text-[11.5px] font-semibold text-danger-ink">{a.email.trim() ? "That isn't a valid email address." : a.corresponding ? "The corresponding author needs an email." : canLater(a) ? "Enter the email, or tick “Will add later”." : "Enter the email."}</p>}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`author-dept-${a.key}`} className={LABEL}>Department</label>
                <input id={`author-dept-${a.key}`} value={a.department} maxLength={300} placeholder="e.g. Department of Computer Science" onChange={(e) => update(a.key, { department: e.target.value })} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`author-aff-${a.key}`} className={LABEL}>Affiliation{STAR}</label>
                <input id={`author-aff-${a.key}`} value={a.affiliation} maxLength={300} placeholder="Institution only, e.g. IIT Bombay" onChange={(e) => update(a.key, { affiliation: e.target.value })} aria-invalid={missing(!a.affiliation.trim())} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
              </div>
              <div>
                <label htmlFor={`author-city-${a.key}`} className={LABEL}>City</label>
                <input id={`author-city-${a.key}`} value={a.city} maxLength={120} placeholder="e.g. Mumbai" onChange={(e) => update(a.key, { city: e.target.value })} className={`${INPUT_CLASS} bg-canvas focus:bg-white`} />
              </div>
              <div>
                <label htmlFor={`author-country-${a.key}`} className={LABEL}>Country{STAR}</label>
                <select id={`author-country-${a.key}`} value={a.country} onChange={(e) => update(a.key, { country: e.target.value })} aria-invalid={missing(!a.country)} className={`${INPUT_CLASS} bg-canvas focus:bg-white`}><option value="">Select…</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}{a.country && !COUNTRIES.includes(a.country) && <option value={a.country}>{a.country}</option>}</select>
              </div>
            </div>
            <AuthorPlaces idPrefix={`author-${a.key}`} primary={{ affiliation: a.affiliation, department: a.department, city: a.city, country: a.country }} others={a.otherAffiliations ?? []} onChange={(n) => update(a.key, { ...n.primary, otherAffiliations: n.others })} />
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={a.corresponding} onChange={() => toggleCorresponding(a.key)} aria-invalid={missing(!corresponding)} className="h-4 w-4 accent-primary" />
              <span className={`text-xs font-semibold ${a.corresponding ? "text-primary" : "text-ink-soft"}`}>Corresponding author</span>
            </label>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows((l) => (l.length < 50 ? [...l, { key: ++rowKey, name: "", email: "", affiliation: "", department: "", city: "", otherAffiliations: [], country: "", corresponding: false, later: false }] : l))} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-line-strong py-2.5 text-sm font-bold text-primary hover:bg-primary-soft">
        <UserPlus size={15} aria-hidden="true" /> Add co-author
      </button>
      {tried && rows.some((a) => !placeOk(a)) && <p role="alert" className="mt-2 text-xs font-semibold text-danger-ink">Every author needs an affiliation and a country.</p>}
      {tried && !corresponding && <p role="alert" className="mt-2 text-xs font-semibold text-danger-ink">Choose the corresponding author: tick “Corresponding author” on their card.</p>}
      {tried && !enoughEmails && <p role="alert" className="mt-2 text-xs font-semibold text-danger-ink">Give the email of at least one co-author as well as your own. The others can be added later.</p>}
      {!meListed && <p role="alert" className="mt-2 text-xs font-semibold text-danger-ink">You have to stay on the paper as an author or co-author. Put your own name and email back to save.</p>}
      <Error_ message={error} />
      <Actions onCancel={onClose} saving={saving} onSave={save} />
    </>
  );
}

export function EditAuthorsDialog(props: CommonProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Update / add authors" description="The first author is the main author. Tick every corresponding author (at least one). Emails you don't have yet can be added later." icon={Users} size="lg">
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
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft"><AlertTriangle size={18} className="text-danger-ink" /></span>
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
          <p role={problem ? "alert" : undefined} className={`text-xs ${problem ? "font-semibold text-danger-ink" : "text-ink-faint"}`}>{problem || "Ready to upload."}</p>
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
