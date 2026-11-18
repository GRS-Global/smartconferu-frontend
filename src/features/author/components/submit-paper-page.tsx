"use client";

import { RichTextContent, hasRichText } from "@/components/ui/rich-text";
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronUp, Clock, FileCheck, RefreshCw, Sparkles, TriangleAlert, Trash2, Upload, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { INPUT_CLASS } from "@/components/ui/field";
import { ConferenceShell, ConferenceMonogram } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { cn } from "@/lib/cn";
import { getConferenceService } from "@/services/conferences";
import type { Conference, ConferenceRole } from "@/types/conference";
import { COUNTRIES } from "@/lib/country-codes";
import { sendActionEmails } from "@/services/action-emails";
import { autoCheckOf, startAutoCheck } from "@/lib/auto-check";
import { fillFromPdf, type FilledAuthor, type FilledPaper } from "@/lib/paper-extraction";
import { COUNTRY_SOURCE_HINT } from "@/lib/country-inference";
import { requestPaperIngest } from "@/services/paper-ai";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import type { AuthorInput, SubmissionExtra, SubmitFormInfo } from "@/types/author-submission";

/* New Submission (the prototype's SubmitPaperPage with its default submission form): the paper file, title, abstract, keywords,
   submission type and track, the authors (the signed-in author is Author 1 and must stay on the paper), and the two declarations.
   Sending saves the paper, its authors and the file, then the email server mails the confirmation (`submission_received`). The chair's
   "Submit on behalf" is the same form with the author the chair names as Author 1 (`submission_on_behalf`). Picking a PDF fills the
   title, abstract, keywords and authors from it (lib/paper-extraction.ts: Smart Fill through the AI proxy, else a basic guess); the person
   submitting stays Author 1. Not ported yet: a chair-edited submission form (the database keeps none, so every conference uses this default). */

const STEPS = [{ key: "reading", label: "Reading your PDF" }, { key: "ai", label: "Understanding the paper" }, { key: "filling", label: "Filling the form" }] as const;
type Stage = (typeof STEPS)[number]["key"];
const nameKey = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "");

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const EMAIL = /^\S+@\S+\.\S+$/;
const MAX_BYTES = 26214400;
const LABEL = "mb-1 block text-xs font-bold text-ink-soft";
// The prototype's New Submission form label (EnhancedSchemaForm): 14 px / 600, 6 px below, --text; it turns danger-red when a required field is still empty after a submit attempt.
const FIELD_LABEL = "mb-1.5 block text-sm font-semibold";
const fieldLabel = (missing = false) => `${FIELD_LABEL} ${missing ? "text-danger" : "text-ink"}`;
let rowKey = 0;
interface Row extends AuthorInput { key: number }
const blankRow = (over: Partial<Row> = {}): Row => ({ key: ++rowKey, name: "", email: "", affiliation: "", country: "", corresponding: false, ...over });
const titleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");

type FormState =
  | { status: "loading" }
  | { status: "ready"; info: SubmitFormInfo; shell: { conference: Conference; roles: ConferenceRole[]; others: Conference[] } | null }
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

function Section({ title, hint, n, children }: { title: string; hint?: string; n?: number; children: ReactNode }) {
  return <section style={CARD} className="rounded-2xl bg-white p-5 sm:p-6"><h2 className="flex items-center gap-2.5 text-[15px] font-bold text-navy">{n !== undefined && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[11px] text-white">{n}</span>}{title}</h2>{hint && <p className="mb-4 mt-0.5 text-xs text-ink-muted">{hint}</p>}<div className={hint ? "" : "mt-4"}>{children}</div></section>;
}

export function SubmitPaperPage({ slug, behalf = false }: { slug: string; behalf?: boolean }) {
  const [form, setForm] = useState<FormState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getAuthorSubmissionService().then((s) => s.loadSubmitForm(slug)), getConferenceService().then((s) => s.loadDashboard()).then((d) => d.source.conferences).catch(() => null)]).then(([info, mine]): FormState => {
        if (!info) return { status: "missing" };
        const m = mine?.find((c) => c.conference.id === slug);
        return { status: "ready", info, shell: m && mine ? { conference: m.conference, roles: m.roles, others: mine.filter((c) => c.conference.id !== slug).map((c) => c.conference) } : null };
      })
      .then((next) => { if (!cancelled) setForm(next); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setForm({ status: "auth" });
        else setForm({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [slug, tick]);
  const retry = useCallback(() => { setForm({ status: "loading" }); setTick((t) => t + 1); }, []);

  const title = behalf ? "Submit on behalf of an author" : "New Submission";
  const gate = workspaceGate(form, retry, { title, loadingLabel: "Loading the submission form", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or it isn't visible to you.", errorTitle: "Couldn't load the submission form." });
  if (gate || form.status !== "ready") return gate;
  const page = <SubmitForm info={form.info} behalf={behalf} title={title} />;
  if (!form.shell) return page;
  return <ConferenceShell role={behalf ? "chair" : "author"} conference={form.shell.conference} roles={form.shell.roles} others={form.shell.others} active={null}>{page}</ConferenceShell>;
}

function SubmitForm({ info, behalf, title }: { info: SubmitFormInfo; behalf: boolean; title: string }) {
  const router = useRouter();
  // On behalf: the chair names the author first.
  const [onBehalf, setOnBehalf] = useState<{ name: string; email: string } | null>(null);
  const [ask, setAsk] = useState({ name: "", email: "" });
  const [paperTitle, setPaperTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [track, setTrack] = useState(info.tracks.length === 1 ? info.tracks[0] : "");
  const [type, setType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState("");
  const [rows, setRows] = useState<Row[]>(() => [blankRow({ name: info.me.name, email: info.me.email, affiliation: info.me.affiliation, country: info.me.country, corresponding: true })]);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [originality, setOriginality] = useState(false);
  const [terms, setTerms] = useState(false);
  const [tried, setTried] = useState(false);
  const [dup, setDup] = useState({ key: "", found: false, mine: false });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [over, setOver] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  // Auto-fill from the PDF: while it runs the form is locked (so nothing typed is overwritten a second later).
  const [filling, setFilling] = useState(false);
  const [stage, setStage] = useState<Stage>("reading");
  const [seconds, setSeconds] = useState(0);
  const [fillNote, setFillNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [hints, setHints] = useState<Record<number, string>>({}); // how a worked-out country was found, per author row
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const rowsRef = useRef<Row[]>([]); // the author rows as they are now, for the auto-fill that lands a few seconds after the file was picked
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => {
    if (!filling) return undefined;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { clearInterval(t); setSeconds(0); };
  }, [filling]);

  // Duplicate check: the same title already sent to this conference (asked once typing pauses).
  const tk = titleKey(paperTitle);
  useEffect(() => {
    if (!tk) return undefined;
    let stale = false;
    const t = setTimeout(() => { getAuthorSubmissionService().then((s) => s.checkDuplicate(info.slug, paperTitle)).then((r) => { if (!stale) setDup({ key: tk, ...r }); }).catch(() => undefined); }, 500);
    return () => { stale = true; clearTimeout(t); };
  }, [tk, paperTitle, info.slug]);
  const duplicate = dup.key === tk && tk ? dup : { found: false, mine: false };

  if (behalf && !onBehalf) {
    const ok = ask.name.trim() && EMAIL.test(ask.email.trim());
    return (
      <>
        <PageHeader title={title} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: info.acronym, href: `/chair/${encodeURIComponent(info.slug)}` }, { label: title }]} />
        <div className="p-4 sm:p-8">
          <div style={CARD} className="mx-auto max-w-lg rounded-2xl bg-white p-6">
            <h2 className="text-base font-extrabold text-navy">Who are you submitting for?</h2>
            <p className="mb-4 mt-1 text-sm text-ink-muted">The author becomes Author 1 (the corresponding author) and gets the confirmation email. The paper is linked to their account when they register with this email.</p>
            <div className="space-y-3">
              <div><label htmlFor="b-name" className={LABEL}>Author&apos;s full name <span className="text-danger">*</span></label><input id="b-name" value={ask.name} maxLength={200} onChange={(e) => setAsk({ ...ask, name: e.target.value })} className={INPUT_CLASS} /></div>
              <div><label htmlFor="b-email" className={LABEL}>Author&apos;s email <span className="text-danger">*</span></label><input id="b-email" type="email" value={ask.email} maxLength={254} onChange={(e) => setAsk({ ...ask, email: e.target.value })} className={INPUT_CLASS} /></div>
            </div>
            <div className="mt-5 flex justify-end"><Button disabled={!ok} onClick={() => { setOnBehalf({ name: ask.name.trim(), email: ask.email.trim() }); setRows([blankRow({ name: ask.name.trim(), email: ask.email.trim(), corresponding: true })]); }}>Continue</Button></div>
          </div>
        </div>
      </>
    );
  }

  const update = (key: number, patch: Partial<AuthorInput>) => setRows((l) => l.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  const toggleCorresponding = (key: number) => setRows((l) => { const next = l.map((a) => (a.key === key ? { ...a, corresponding: !a.corresponding } : a)); return next.some((a) => a.corresponding) ? next : l; });
  const move = (i: number, dir: -1 | 1) => setRows((l) => { const next = [...l]; [next[i], next[i + dir]] = [next[i + dir], next[i]]; return next; });
  const remove = (key: number) => setRows((l) => { const next = l.filter((a) => a.key !== key); if (!next.some((a) => a.corresponding) && next[0]) next[0] = { ...next[0], corresponding: true }; return next; });
  /* The signed-in person (or, on behalf, the author the chair named) stays Author 1, whatever the PDF lists: the prototype's withSubmitterFirst. */
  const mergeAuthors = (current: Row[], fromPaper: Row[]): Row[] => {
    const myEmail = (behalf && onBehalf ? onBehalf.email : info.me.email).trim().toLowerCase();
    const isMine = (a: AuthorInput) => Boolean(myEmail) && a.email.trim().toLowerCase() === myEmail;
    const me = current.find(isMine);
    if (!me) return fromPaper.length ? fromPaper : current;
    const sameAsMe = (a: AuthorInput) => isMine(a) || (nameKey(a.name) !== "" && nameKey(a.name) === nameKey(me.name));
    const at = fromPaper.findIndex(sameAsMe);
    if (at < 0) return [{ ...me, corresponding: false }, ...fromPaper];
    const mine = fromPaper[at];
    const mineNow: Row = { ...me, affiliation: me.affiliation || mine.affiliation, country: me.country || mine.country, corresponding: mine.corresponding };
    return fromPaper.map((a, i) => (i === at ? mineNow : a)).filter((a, i) => i === at || !sameAsMe(a));
  };

  const applyFilled = (r: FilledPaper) => {
    if (r.title.trim()) setPaperTitle(r.title.trim());
    if (r.abstract.trim()) setAbstract(r.abstract.trim());
    if (r.keywords.length) setKeywords(r.keywords.join(", "));
    if (!r.authors.length) return;
    const anyCorresponding = r.authors.some((a) => a.corresponding);
    const source = new Map<string, FilledAuthor>();
    const paperRows = r.authors.map((a, i) => {
      const row = blankRow({ name: a.name, email: a.email, affiliation: a.affiliation, country: a.country, corresponding: anyCorresponding ? a.corresponding : i === 0 });
      source.set(String(row.key), a);
      return row;
    });
    let merged = mergeAuthors(rowsRef.current, paperRows);
    if (!merged.some((a) => a.corresponding) && merged[0]) merged = merged.map((a, i) => (i === 0 ? { ...a, corresponding: true } : a));
    setRows(merged);
    // Under a country that was worked out (not read from the paper): how, so the author double-checks it.
    const next: Record<number, string> = {};
    for (const a of merged) { const s = source.get(String(a.key)); const hint = s ? COUNTRY_SOURCE_HINT[s.countrySource] : undefined; if (s && hint && a.country === s.country) next[a.key] = hint; }
    setHints(next);
  };

  const runFill = async (f: File) => {
    setFilling(true); setFillNote(null); setStage("reading");
    try {
      const r = await fillFromPdf(f, setStage);
      await new Promise((done) => setTimeout(done, 450)); // the last step shows for a beat before the values land
      applyFilled(r);
      setFillNote({ tone: "ok", text: r.how === "ai" ? "Form auto-filled — please review the details below, especially the author list." : "Filled with a basic guess from your PDF (Smart Fill isn't available right now) — please check every detail, especially the authors." });
    } catch {
      setFillNote({ tone: "warn", text: "Your paper is attached, but we couldn't read it to fill in the details. Please enter the title, abstract, keywords and authors below." });
    } finally {
      setFilling(false);
    }
  };

  const pick = (f: File | null) => {
    setFile(null); setFileProblem(""); setFillNote(null);
    if (!f) return;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext)) setFileProblem("Only PDF or Word files can be uploaded.");
    else if (f.size === 0) setFileProblem("That file is empty.");
    else if (f.size > MAX_BYTES) setFileProblem("That file is too large — the limit is 25 MB.");
    else {
      setFile(f); startAutoCheck(f); // the automatic check starts at once, so it is usually done by the time Submit is pressed
      if (ext === "pdf") void runFill(f); // the title, abstract, keywords and authors are read from the PDF
      else setFillNote({ tone: "warn", text: "Your paper is attached. Only PDF files can be read for auto-fill, so please enter the title, abstract, keywords and authors below." });
    }
  };

  const emails = rows.map((a) => a.email.trim().toLowerCase()).filter(Boolean);
  const dupEmail = new Set(emails).size !== emails.length;
  const authorsOk = rows.length > 0 && rows.every((a) => a.name.trim() && EMAIL.test(a.email.trim()));
  // The person submitting must be on the paper (a chair submitting for an author is exempt).
  const listed = behalf || emails.includes(info.me.email.trim().toLowerCase());
  const answered = (f: SubmissionExtra) => (f.type === "consent" ? answers[f.id] === true : String(answers[f.id] ?? "").trim() !== "");
  const extraRequired: Array<[string, boolean]> = info.extras.filter((f) => f.required).map((f) => [f.label, answered(f)]);
  const required: Array<[string, boolean]> = [["Paper file", Boolean(file)], ["Title", Boolean(paperTitle.trim())], ["Abstract", Boolean(abstract.trim())], ["Submission type", Boolean(type)], ["Track", Boolean(track)], ["Authors", authorsOk], ["Originality declaration", originality], ["Submission terms", terms], ...extraRequired];
  const done = required.filter(([, ok]) => ok).length;
  const canSubmit = done === required.length && !dupEmail && !duplicate.found && listed && !info.closed;
  const bad = (ok: boolean) => (tried && !ok ? "border-danger" : "");

  const send = async () => {
    if (sending) return;
    if (!canSubmit || !file) { setTried(true); return; }
    setSending(true); setError("");
    try {
      const svc = await getAuthorSubmissionService();
      const autoCheck = await autoCheckOf(file);
      const made = await svc.submitPaper(info.slug, { autoCheck, title: paperTitle, abstract, keywords: keywords.split(/[,;]/).map((k) => k.trim()).filter(Boolean), authors: rows.map(({ key, ...a }) => { void key; return a; }), track, presentationType: type, file, responses: Object.fromEntries(info.extras.filter((f) => answers[f.id] !== undefined && answers[f.id] !== "").map((f) => [f.id, answers[f.id]])) });
      void requestPaperIngest(made.dbId); // the AI features are prepared in the background
      const mail = await sendActionEmails(behalf ? "submission_on_behalf" : "submission_received", { submissionId: made.dbId });
      setToast({ title: "Submission received", text: mail ?? `${made.label} was sent to ${info.acronym}.` });
      timer.current = setTimeout(() => router.push(behalf ? `/chair/${encodeURIComponent(info.slug)}` : `/author/${encodeURIComponent(info.slug)}/submissions`), 1800);
    } catch (e) {
      setError(e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong.");
      setSending(false);
    }
  };
  const iconBtn = "flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-white disabled:opacity-30";

  return (
    <>
      <PageHeader title={title} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: info.acronym, href: behalf ? `/chair/${encodeURIComponent(info.slug)}` : undefined }, { label: title }]} />
      <div className="grid items-start gap-6 p-4 sm:p-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <div style={CARD} className="flex flex-wrap items-center gap-5 rounded-2xl bg-gradient-to-r from-[#EEF2FF] via-[#F1ECFF] to-[#E6F6FB] p-6">
          <ConferenceMonogram acronym={info.acronym} size={84} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5"><h2 className="text-2xl font-extrabold tracking-tight text-navy">{info.acronym}</h2><span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-primary">{behalf ? "On behalf of an author" : "New Submission"}</span></div>
            <p className="mt-1 text-sm text-ink-soft">{info.name}</p>
            {info.deadline && <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning"><Clock size={12} aria-hidden="true" /> Submissions close {new Date(`${info.deadline}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
          </div>
        </div>
        {info.closed && <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"><TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> Submissions to {info.acronym} are closed (or it isn&apos;t open yet).</div>}
        {behalf && onBehalf && <div className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-ink-soft">Submitting for <b className="text-navy">{onBehalf.name}</b> ({onBehalf.email}).</div>}

        <section style={{ border: "1.5px solid var(--primary)" }} className="rounded-2xl bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary"><Sparkles size={16} aria-hidden="true" /></span><div><h2 className="text-sm font-bold text-navy">Auto-fill from your paper</h2><p className="text-[11px] text-ink-faint">Upload your paper (PDF or Word, up to 25 MB) and we&apos;ll fill in the title, abstract, keywords and authors below for you.</p></div></div>
          {filling ? (
            <div role="status" aria-live="polite" className="mt-4 flex flex-col items-center rounded-2xl border-[1.5px] border-[var(--primary-soft-border)] bg-gradient-to-br from-primary-soft via-white to-primary-soft px-6 py-8 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white"><Sparkles size={24} className="animate-pulse" aria-hidden="true" /></span>
              <div className="text-[17px] font-extrabold text-navy">{stage === "reading" ? "Reading your paper…" : "Smart Fill is reading your paper…"}</div>
              <p className="mt-1 max-w-md text-[13px] text-ink-muted">Filling in the title, abstract, keywords and authors from <b className="text-ink-soft">{file?.name}</b>. The form is locked until it&apos;s done.</p>
              <ol className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {STEPS.map((s, i) => {
                  const at = STEPS.findIndex((x) => x.key === stage);
                  const state = i < at ? "done" : i === at ? "on" : "todo";
                  return (
                    <li key={s.key} className="flex items-center gap-2">
                      {i > 0 && <span aria-hidden="true" className={cn("h-0.5 w-6 rounded-full", state === "todo" ? "bg-line" : "bg-primary")} />}
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-[12.5px] font-bold", state === "done" && "bg-success-soft text-success", state === "on" && "bg-primary text-white", state === "todo" && "border border-line bg-white text-ink-faint")}>
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px]", state === "done" && "bg-success text-white", state === "on" && "bg-white/25 text-white", state === "todo" && "bg-muted text-ink-faint")}>{state === "done" ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : state === "on" ? <RefreshCw size={11} className="animate-spin" aria-hidden="true" /> : i + 1}</span>
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2.5 text-xs font-medium text-ink-faint">{seconds}s · {seconds < 12 ? "usually takes 5–15 seconds" : "almost there — longer papers take a little more time"}</div>
            </div>
          ) : file ? (
            <div className={`mt-4 flex items-center gap-3 rounded-xl border-[1.5px] bg-white p-3.5 ${over ? "border-dashed border-primary bg-primary-soft" : "border-line"} ${bad(Boolean(file))}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0] ?? null); }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success"><FileCheck size={18} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink">{file.name}</div><div className="text-xs text-ink-faint">{(file.size / 1048576).toFixed(1)} MB · drop another file here to replace it</div></div>
              <label htmlFor="paper-file" className="shrink-0 cursor-pointer rounded-lg border-[1.5px] border-primary px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary-soft">Replace</label>
            </div>
          ) : (
          <label htmlFor="paper-file" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0] ?? null); }} className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-4 py-10 text-center transition-colors ${over ? "border-primary bg-primary-soft" : "border-line-strong bg-white hover:bg-canvas"} ${bad(Boolean(file))}`}>
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary"><Upload size={20} aria-hidden="true" /></span>
            <span className="text-base font-extrabold text-navy">Drag & Drop Your Paper Here</span>
            <span className="max-w-sm text-xs text-ink-muted">Drag and drop your paper as a PDF or Word file (max 25 MB) here or browse — we&apos;ll fill in the form for you.</span>
            <span className="mt-2 text-xs font-bold text-primary underline">Browse File</span>
          </label>
          )}
          <input id="paper-file" type="file" accept=".pdf,.doc,.docx" disabled={filling} className="sr-only" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          {fileProblem && <p role="alert" className="mt-2 text-xs font-semibold text-danger">{fileProblem}</p>}
          {fillNote && !filling && <p role="status" className={cn("mt-3 text-xs font-medium", fillNote.tone === "ok" ? "text-success" : "text-warning")}>{fillNote.text}</p>}
        </section>

        <div inert={filling} aria-busy={filling} className="space-y-5">
        <Section n={1} title="Basic Information">
          <div className="space-y-4">
            <div>
              <label htmlFor="p-title" className={fieldLabel(tried && !paperTitle.trim())}>Title <span className="text-danger">*</span></label>
              <input id="p-title" value={paperTitle} maxLength={500} onChange={(e) => setPaperTitle(e.target.value)} className={`${INPUT_CLASS} ${bad(Boolean(paperTitle.trim()))}`} />
              {duplicate.found && <p role="alert" className="mt-1 text-xs font-semibold text-danger">{duplicate.mine ? "You already sent a paper with this title to this conference." : "A paper with this title has already been sent to this conference."}</p>}
            </div>
            <div><label htmlFor="p-abstract" className={fieldLabel(tried && !abstract.trim())}>Abstract <span className="text-danger">*</span></label><textarea id="p-abstract" rows={7} maxLength={20000} value={abstract} onChange={(e) => setAbstract(e.target.value)} className={`${INPUT_CLASS} resize-y ${bad(Boolean(abstract.trim()))}`} /></div>
            <div><label htmlFor="p-keywords" className={fieldLabel()}>Keywords</label><input id="p-keywords" value={keywords} maxLength={600} placeholder="Separate with commas" onChange={(e) => setKeywords(e.target.value)} className={INPUT_CLASS} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><div id="p-type" className={fieldLabel(tried && !type)}>Please choose your submission type <span className="text-danger">*</span></div><div role="group" aria-labelledby="p-type" className="grid gap-2 sm:grid-cols-3">{info.presentationTypes.map((t) => <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={cn("rounded-lg border px-3 py-2.5 text-sm", type === t ? "border-primary bg-primary-soft font-semibold text-primary" : "border-line bg-white text-ink hover:border-line-strong", bad(Boolean(type)) && type !== t && "border-danger")}>{t}</button>)}</div></div>
              <div className="sm:col-span-2"><div id="p-track" className={fieldLabel(tried && !track)}>Please choose your track <span className="text-danger">*</span></div><div role="group" aria-labelledby="p-track" className="grid gap-2 sm:grid-cols-3">{info.tracks.map((t) => <button key={t} type="button" aria-pressed={track === t} onClick={() => setTrack(t)} className={cn("rounded-lg border px-3 py-2.5 text-sm", track === t ? "border-primary bg-primary-soft font-semibold text-primary" : "border-line bg-white text-ink hover:border-line-strong", bad(Boolean(track)) && track !== t && "border-danger")}>{t}</button>)}</div></div>
            </div>
          </div>
        </Section>

        <Section n={2} title="Authors" hint={behalf ? "The author you named is Author 1." : "You are Author 1 — you must stay on the paper. Add the co-authors in the order they appear on it."}>
          <div className="space-y-3">
            {rows.map((a, i) => (
              <div key={a.key} style={{ border: `1px solid ${a.corresponding ? "var(--primary-soft-border)" : "var(--border)"}`, background: a.corresponding ? "var(--primary-soft)" : "#FFFFFF" }} className="rounded-xl p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold text-navy"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-[11px] font-extrabold">{i + 1}</span>{i === 0 ? "Main author" : "Co-author"}</span>
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className={iconBtn}><ArrowUp size={14} aria-hidden="true" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" className={iconBtn}><ArrowDown size={14} aria-hidden="true" /></button>
                    <button type="button" onClick={() => remove(a.key)} disabled={rows.length === 1} aria-label="Remove author" className={`${iconBtn} hover:text-danger`}><Trash2 size={14} aria-hidden="true" /></button>
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor={`a-name-${a.key}`} className={LABEL}>Full name <span className="text-danger">*</span></label><input id={`a-name-${a.key}`} value={a.name} maxLength={200} onChange={(e) => update(a.key, { name: e.target.value })} className={`${INPUT_CLASS} ${tried && !a.name.trim() ? "border-danger" : ""}`} /></div>
                  <div><label htmlFor={`a-email-${a.key}`} className={LABEL}>Email <span className="text-danger">*</span></label><input id={`a-email-${a.key}`} type="email" value={a.email} maxLength={254} onChange={(e) => update(a.key, { email: e.target.value })} className={`${INPUT_CLASS} ${tried && !EMAIL.test(a.email.trim()) ? "border-danger" : ""}`} /></div>
                  <div><label htmlFor={`a-aff-${a.key}`} className={LABEL}>Affiliation</label><input id={`a-aff-${a.key}`} value={a.affiliation} maxLength={300} placeholder="University / organisation" onChange={(e) => update(a.key, { affiliation: e.target.value })} className={INPUT_CLASS} /></div>
                  <div><label htmlFor={`a-country-${a.key}`} className={LABEL}>Country</label><select id={`a-country-${a.key}`} value={a.country} onChange={(e) => update(a.key, { country: e.target.value })} className={INPUT_CLASS}><option value="">Select…</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>{hints[a.key] && a.country && <p className="mt-1 text-[11px] font-medium text-warning">{hints[a.key]} — please check</p>}</div>
                </div>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-soft"><input type="checkbox" checked={a.corresponding} onChange={() => toggleCorresponding(a.key)} disabled={a.corresponding && rows.filter((x) => x.corresponding).length === 1} /> Corresponding author</label>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setRows((l) => (l.length < 50 ? [...l, blankRow()] : l))} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"><UserPlus size={15} aria-hidden="true" /> Add co-author</button>
          {dupEmail && <p role="alert" className="mt-2 text-xs font-semibold text-danger">Each author needs their own email address.</p>}
          {!listed && <p role="alert" className="mt-2 text-xs font-semibold text-danger">You have to be on the paper: add yourself ({info.me.email}) as an author.</p>}
        </Section>

        {info.extras.length > 0 && (
          <Section n={3} title="Additional questions" hint="Asked by the conference's organisers.">
            <div className="space-y-4">
              {info.extras.map((f) => {
                const bad = tried && f.required && !answered(f);
                const id = `x-${f.id}`;
                return (
                  <div key={f.id}>
                    {f.type === "consent" ? (
                      <label className={`flex items-start gap-2.5 text-[13px] ${bad ? "text-danger" : "text-ink-soft"}`}><input type="checkbox" checked={answers[f.id] === true} onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.checked }))} className="mt-0.5" /> <span>{f.label}{f.required && <span className="text-danger" aria-hidden="true"> *</span>}</span></label>
                    ) : (
                      <>
                        <label htmlFor={id} className={fieldLabel(bad)}>{f.label}{f.required && <span className="text-danger" aria-hidden="true"> *</span>}</label>
                        {f.description && <p className="mb-1.5 text-xs text-ink-muted">{f.description}</p>}
                        {f.type === "short_text" && <input id={id} value={String(answers[f.id] ?? "")} maxLength={500} onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))} className={`${INPUT_CLASS} ${bad ? "border-danger" : ""}`} />}
                        {f.type === "long_text" && <textarea id={id} rows={4} value={String(answers[f.id] ?? "")} maxLength={5000} onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))} className={`${INPUT_CLASS} resize-y ${bad ? "border-danger" : ""}`} />}
                        {f.type === "single_choice" && <select id={id} value={String(answers[f.id] ?? "")} onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))} className={`${INPUT_CLASS} ${bad ? "border-danger" : ""}`}><option value="">Select…</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</select>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section n={info.extras.length ? 4 : 3} title="Declarations">
          <div className="space-y-3">
            <label className={`flex items-start gap-2.5 text-[13px] text-ink-soft ${tried && !originality ? "text-danger" : ""}`}><input type="checkbox" checked={originality} onChange={(e) => setOriginality(e.target.checked)} className="mt-0.5" /> I confirm this submission is original work and has not been previously published or plagiarized. <span className="text-danger" aria-hidden="true">*</span></label>
            <label className={`flex items-start gap-2.5 text-[13px] text-ink-soft ${tried && !terms ? "text-danger" : ""}`}><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" /> I agree to the conference&apos;s submission terms and conditions. <span className="text-danger" aria-hidden="true">*</span></label>
          </div>
        </Section>

        </div>

        {error && <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        {hasRichText(info.guidelines) && (
          <section style={CARD} className="overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center gap-3 bg-primary-soft/60 px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary"><BookOpen size={15} aria-hidden="true" /></span>
              <div className="flex-1"><div className="text-sm font-bold text-navy">Submission guidelines</div><div className="text-[11px] text-ink-faint">Please read before you submit</div></div>
              <button type="button" onClick={() => setShowGuide(!showGuide)} aria-expanded={showGuide} className="inline-flex items-center gap-1 text-xs font-bold text-primary">{showGuide ? "Hide" : "Show"} <ChevronUp size={13} className={showGuide ? "" : "rotate-180"} aria-hidden="true" /></button>
            </div>
            {showGuide && <RichTextContent value={info.guidelines} className="px-5 py-4" />}
          </section>
        )}
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.10)]">
          <span className="text-xs font-semibold text-ink-muted">{done} of {required.length} required fields answered{tried && !canSubmit ? ` · still to do: ${required.filter(([, ok]) => !ok).map(([l]) => l).join(", ") || "check the authors"}` : ""}</span>
          <Button disabled={sending || filling || info.closed} title={info.closed ? `Submissions to ${info.acronym} are closed` : undefined} onClick={() => void send()}><Check size={15} aria-hidden="true" /> {sending ? "Submitting…" : "Submit paper"}</Button>
        </div>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Before you submit">
        <div style={CARD} className="rounded-2xl bg-white p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-navy">Before you submit</h2><span className="text-xs font-semibold text-ink-faint">{done}/{required.length}</span></div>
          <ul className="space-y-2">{required.map(([l, ok]) => <li key={l} className="flex items-center gap-2.5 text-xs"><span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full", ok ? "bg-success text-white" : "border-[1.5px] border-line-strong")}>{ok && <Check size={10} strokeWidth={3} aria-hidden="true" />}</span><span className={ok ? "font-medium text-ink" : "text-ink-faint"}>{l}</span></li>)}</ul>
        </div>
        <div className="rounded-2xl border border-[var(--primary-soft-border)] bg-primary-soft/60 p-5">
          <h2 className="mb-2 text-sm font-bold text-navy">Tips for a strong submission</h2>
          <ul className="list-disc space-y-1.5 pl-4 text-xs text-ink-soft"><li>Upload your PDF first.</li><li>List every author, in author order, and mark all corresponding authors.</li><li>Keep the abstract self-contained — reviewers often read it before anything else.</li></ul>
        </div>
      </aside>
      </div>
      <FlowToast toast={toast} onClose={closeToast} />
    </>
  );
}
