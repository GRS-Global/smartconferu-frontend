"use client";

import { ArrowLeft, ArrowRight, Check, FilePlus2, FileText, LayoutTemplate, Copy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useConferenceInfo } from "@/features/chair/use-conference-info";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { COUNTRIES } from "@/lib/country-codes";
import { RESEARCH_AREAS, RESEARCH_SUBAREAS } from "@/lib/research-areas";
import { getChairService } from "@/services/chair";
import { getCfpService } from "@/services/cfps";
import { AuthRequiredError } from "@/services/errors";
import { sendActionEmails } from "@/services/action-emails";
import { DEFAULT_CFP_PERMISSIONS, type CfpRow } from "@/types/cfp";
import type { ConferenceInfo, PoolReviewer } from "@/types/chair";
import { TEMPLATE_SECTIONS, templateDoc, type TemplateKey } from "../template";
import { cfpManagerHref } from "@/lib/routes";

/* New Call for Papers (the prototype's NewCFPFormPage and CreateCFPContentPage) for one of your conferences: five steps over the conference's own details
   (Basics, Conference Info, Dates, Areas & Topics, Review), saved to the conference; then how the CFP's text should start — empty, from a template of
   sections, or copied from another of your CFPs. The text is saved as the draft and opens in "Edit content" to be finished. Acronym is assigned by Smartconferu.
   The Review step also picks the CFP's managers from the program committee. "Add External Conference" has nothing to attach to in the database, so it is not here. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const FIELD = "w-full rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-primary";
const LABEL = "mb-1 block text-xs font-semibold text-ink-soft";
const STEPS = ["Basics", "Conference Info", "Dates", "Areas & Topics", "Review"];
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");

type Form = Pick<ConferenceInfo, "name" | "webPage" | "venue" | "city" | "state" | "country" | "startDate" | "endDate" | "abstractDeadline" | "submissionDeadline" | "primaryArea" | "secondaryArea" | "topics">;
const pick = (i: ConferenceInfo): Form => ({ name: i.name, webPage: i.webPage, venue: i.venue, city: i.city, state: i.state, country: i.country, startDate: i.startDate, endDate: i.endDate, abstractDeadline: i.abstractDeadline, submissionDeadline: i.submissionDeadline, primaryArea: i.primaryArea, secondaryArea: i.secondaryArea, topics: [...i.topics] });

export function NewCfpWizard({ slug }: { slug: string }) {
  const { state, retry, reload } = useConferenceInfo(slug);
  const gate = workspaceGate(state, retry, { title: "New Call for Papers", loadingLabel: "Loading the conference", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load this conference." });
  if (gate || state.status !== "ready") return gate;
  return <WizardForm key={slug} slug={slug} conference={state.conference} info={state.info} retry={retry} reload={reload} />;
}

function WizardForm({ slug, conference, info, retry, reload }: { slug: string; conference: { acronym: string }; info: ConferenceInfo; retry: () => void; reload: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(() => pick(info));
  const [topic, setTopic] = useState("");
  const [how, setHow] = useState<"empty" | "template" | "copy">("empty");
  const [sections, setSections] = useState<TemplateKey[]>(["guidelines", "topics"]);
  const [others, setOthers] = useState<CfpRow[]>([]);
  const [copyFrom, setCopyFrom] = useState("");
  // The committee (reviewers of this conference) the CFP's managers can be picked from.
  const [pool, setPool] = useState<PoolReviewer[]>([]);
  const [mgrs, setMgrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCfpService().then((s) => s.list()).then((rows) => { if (!cancelled) setOthers(rows.filter((r) => r.slug !== slug && r.hasDraft)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [slug]);
  useEffect(() => {
    let cancelled = false;
    getChairService().then((c) => c.loadReviewerPool(slug)).then((p) => { if (!cancelled) setPool(p.reviewers.filter((r) => r.status !== "declined" && r.email)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [slug]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const addTopic = () => { const t = topic.trim(); if (!t || form.topics.includes(t) || form.topics.length >= 40) return; set("topics", [...form.topics, t]); setTopic(""); };
  const subareas = RESEARCH_SUBAREAS[form.primaryArea] ?? [];
  const problem = step === 0 && !form.name.trim() ? "Give the conference a title."
    : step === 2 && form.startDate && form.endDate && form.endDate < form.startDate ? "The end date can't be before the start date."
      : step === 2 && form.abstractDeadline && form.submissionDeadline && form.abstractDeadline > form.submissionDeadline ? "The abstract deadline must be on or before the submission deadline." : "";
  const next = () => { if (problem) { setError(problem); return; } setError(""); setStep((s) => s + 1); };

  const finish = async () => {
    setBusy(true); setError("");
    try {
      const chair = await getChairService();
      const cfps = await getCfpService();
      const updated: ConferenceInfo = { ...info, ...form, name: form.name.trim(), webPage: form.webPage.trim() };
      await chair.saveInfo(slug, updated);
      let doc = "<p></p>";
      if (how === "template") doc = templateDoc(sections, { about: updated.about, topics: updated.topics, venue: updated.venue, city: updated.city, country: updated.country, contactEmail: updated.contactEmail }, conference.acronym);
      if (how === "copy") {
        const from = await cfps.load(copyFrom);
        if (!from?.doc.trim()) throw new Error("That CFP has no text to copy yet.");
        doc = from.doc;
      }
      await cfps.saveContent(slug, doc);
      // The managers picked on the Review step are added and invited; if one cannot be, the chair lands on Managers to see who made it.
      let failed = false;
      for (const m of pool.filter((r) => mgrs.includes(r.memberId))) {
        try {
          const parts = m.name.trim().split(/\s+/);
          const id = await cfps.addManager(slug, { firstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : m.name, lastName: parts.length > 1 ? parts[parts.length - 1] : m.name, email: m.email, permissions: DEFAULT_CFP_PERMISSIONS });
          await sendActionEmails("cfp_manager_invited", { memberId: id });
        } catch { failed = true; }
      }
      reload();
      router.push(cfpManagerHref(slug, failed ? "managers" : "content"));
    } catch (e) {
      if (e instanceof AuthRequiredError) retry(); else setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const crumbs = [{ label: "Calls for Papers", href: "/cfp" }, { label: "Add New", href: "/cfp/new" }, { label: conference.acronym }];
  const reviewRow = (label: string, value: string) => <div className="flex gap-3 px-5 py-2.5 text-sm"><span className="w-40 shrink-0 text-xs font-semibold text-ink-faint">{label}</span><span className="min-w-0 flex-1 break-words text-ink">{value || "—"}</span></div>;
  const optionCard = (key: typeof how, icon: React.ReactNode, title: string, text: string) => (
    <button key={key} type="button" onClick={() => { setHow(key); setError(""); }} aria-pressed={how === key} style={{ border: how === key ? "2px solid var(--primary)" : "1.5px solid var(--border)", background: how === key ? "var(--primary-soft)" : "#FFFFFF" }} className="flex cursor-pointer items-start gap-3 rounded-xl p-4 text-left transition-colors">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span><span className="block text-sm font-bold text-navy">{title}</span><span className="mt-0.5 block text-xs text-ink-muted">{text}</span></span>
    </button>
  );

  return (
    <>
      <PageHeader title="New Call for Papers" breadcrumbs={crumbs} />
      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <ol className="flex flex-wrap items-center gap-2" aria-label="Steps">
            {[...STEPS, "Content"].map((label, i) => {
              const done = i < step, on = i === step;
              return (
                <li key={label} aria-current={on ? "step" : undefined} className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-success text-white" : on ? "bg-primary text-white" : "border-[1.5px] border-line text-ink-faint"}`}>{done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : i + 1}</span>
                  <span className={`text-xs font-semibold ${on ? "text-navy" : "text-ink-muted"}`}>{label}</span>
                  {i < STEPS.length && <span aria-hidden="true" className="mx-1 h-px w-5 bg-line" />}
                </li>
              );
            })}
          </ol>

          <div style={CARD} className="space-y-4 rounded-2xl bg-white p-6">
            {step === 0 && (
              <>
                <h2 className="text-[15px] font-extrabold text-navy">Basics</h2>
                <div><span className={LABEL}>Type</span><div className="rounded-lg border-[1.5px] border-line bg-canvas px-3.5 py-2.5 text-sm text-ink-faint">Conference</div></div>
                <div><label htmlFor="nw-web" className={LABEL}>Website</label><input id="nw-web" value={form.webPage} onChange={(e) => set("webPage", e.target.value)} placeholder="https://" className={FIELD} /></div>
                <div><label htmlFor="nw-title" className={LABEL}>Conference title <span className="text-danger-ink">*</span></label><input id="nw-title" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={300} className={FIELD} /></div>
                <div><span className={LABEL}>Acronym</span><div className="rounded-lg border-[1.5px] border-line bg-canvas px-3.5 py-2.5 text-sm text-ink-faint">{conference.acronym}</div></div>
              </>
            )}
            {step === 1 && (
              <>
                <h2 className="text-[15px] font-extrabold text-navy">Conference Info</h2>
                <div><label htmlFor="nw-venue" className={LABEL}>Venue</label><input id="nw-venue" value={form.venue} onChange={(e) => set("venue", e.target.value)} className={FIELD} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label htmlFor="nw-city" className={LABEL}>City</label><input id="nw-city" value={form.city} onChange={(e) => set("city", e.target.value)} className={FIELD} /></div>
                  <div><label htmlFor="nw-state" className={LABEL}>State / province</label><input id="nw-state" value={form.state} onChange={(e) => set("state", e.target.value)} className={FIELD} /></div>
                </div>
                <div><label htmlFor="nw-country" className={LABEL}>Country / region</label><select id="nw-country" value={form.country} onChange={(e) => set("country", e.target.value)} className={`${FIELD} cursor-pointer`}><option value="">Select…</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="text-[15px] font-extrabold text-navy">Dates</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><label htmlFor="nw-start" className={LABEL}>Start date</label><input id="nw-start" type="date" value={form.startDate} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, startDate: v, endDate: f.endDate && f.endDate < v ? v : f.endDate })); }} className={FIELD} /></div>
                  <div><label htmlFor="nw-end" className={LABEL}>End date</label><input id="nw-end" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} className={FIELD} /></div>
                  <div><label htmlFor="nw-abs" className={LABEL}>Abstract deadline</label><input id="nw-abs" type="date" value={form.abstractDeadline} onChange={(e) => set("abstractDeadline", e.target.value)} className={FIELD} /></div>
                  <div><label htmlFor="nw-sub" className={LABEL}>Submission deadline</label><input id="nw-sub" type="date" value={form.submissionDeadline} onChange={(e) => set("submissionDeadline", e.target.value)} className={FIELD} /></div>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h2 className="text-[15px] font-extrabold text-navy">Areas &amp; Topics</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><label htmlFor="nw-a1" className={LABEL}>Primary area</label><select id="nw-a1" value={form.primaryArea} onChange={(e) => { set("primaryArea", e.target.value); set("secondaryArea", ""); }} className={`${FIELD} cursor-pointer`}><option value="">Select…</option>{RESEARCH_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
                  <div><label htmlFor="nw-a2" className={LABEL}>Secondary area</label><select id="nw-a2" value={form.secondaryArea} onChange={(e) => set("secondaryArea", e.target.value)} disabled={!form.primaryArea} className={`${FIELD} cursor-pointer disabled:bg-canvas`}><option value="">Select…</option>{subareas.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
                </div>
                <div>
                  <label htmlFor="nw-topic" className={LABEL}>Topics ({form.topics.length} added)</label>
                  <div className="flex gap-2"><input id="nw-topic" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }} placeholder="Add a topic and press Enter" className={FIELD} /><Button variant="outline" onClick={addTopic} disabled={!topic.trim()}>Add</Button></div>
                  {form.topics.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{form.topics.map((t) => <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{t}<button type="button" onClick={() => set("topics", form.topics.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="cursor-pointer text-primary/70 hover:text-primary"><X size={12} aria-hidden="true" /></button></span>)}</div>}
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <h2 className="text-[15px] font-extrabold text-navy">Review</h2>
                <div className="divide-y divide-muted overflow-hidden rounded-xl border border-line">
                  {reviewRow("Conference", `${conference.acronym}: ${form.name}`)}
                  {reviewRow("Website", form.webPage)}
                  {reviewRow("Venue", [form.venue, form.city, form.state, form.country].filter(Boolean).join(", "))}
                  {reviewRow("Dates", `${showDate(form.startDate)} – ${showDate(form.endDate)}`)}
                  {reviewRow("Abstract deadline", showDate(form.abstractDeadline))}
                  {reviewRow("Submission deadline", showDate(form.submissionDeadline))}
                  {reviewRow("Areas", [form.primaryArea, form.secondaryArea].filter(Boolean).join(" · "))}
                  {reviewRow("Topics", form.topics.join(", "))}
                  {reviewRow("Managers", pool.filter((r) => mgrs.includes(r.memberId)).map((r) => r.name).join(", ") || "None selected")}
                </div>
                <fieldset className="rounded-xl border border-line p-4">
                  <legend className="px-1 text-xs font-bold text-ink-soft">CFP managers <span className="font-normal text-ink-faint">(optional — people from your program committee who help run this CFP)</span></legend>
                  {pool.length === 0 ? <p className="text-sm text-ink-faint">Your program committee is empty — add managers later from Managers.</p> : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pool.map((r) => <label key={r.memberId} className="flex cursor-pointer items-center gap-2 text-sm text-ink"><input type="checkbox" checked={mgrs.includes(r.memberId)} onChange={() => setMgrs((l) => (l.includes(r.memberId) ? l.filter((x) => x !== r.memberId) : [...l, r.memberId]))} className="h-4 w-4 accent-[var(--primary)]" /> <span className="truncate">{r.name}</span></label>)}
                    </div>
                  )}
                </fieldset>
                <p className="text-xs text-ink-faint">These are the conference&apos;s own details: they are saved to the conference when you create the draft. Managers you tick are invited then, with the default permissions (Edit and Publish).</p>
              </>
            )}
            {step === 5 && (
              <>
                <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-navy"><FileText size={16} aria-hidden="true" className="text-primary" /> How should the CFP&apos;s text start?</h2>
                <div className="grid gap-3">
                  {optionCard("empty", <FilePlus2 size={18} aria-hidden="true" />, "Create empty content", "Start from a blank page and write everything yourself.")}
                  {optionCard("template", <LayoutTemplate size={18} aria-hidden="true" />, "Create content from a template", "Tick the sections you want; each comes with a line saying what to write. Venue and contact are always included.")}
                  {optionCard("copy", <Copy size={18} aria-hidden="true" />, "Copy from an existing CFP", others.length ? "Start from the text of another of your CFPs." : "You have no other CFP with text to copy yet.")}
                </div>
                {how === "template" && (
                  <fieldset className="rounded-xl border border-line p-4">
                    <legend className="px-1 text-xs font-bold text-ink-soft">Sections</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {TEMPLATE_SECTIONS.map((s) => <label key={s.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink"><input type="checkbox" checked={sections.includes(s.key)} onChange={() => setSections((l) => (l.includes(s.key) ? l.filter((x) => x !== s.key) : [...l, s.key]))} className="h-4 w-4 accent-[var(--primary)]" /> {s.label}</label>)}
                    </div>
                  </fieldset>
                )}
                {how === "copy" && (
                  <div><label htmlFor="nw-copy" className={LABEL}>Copy the text of</label><select id="nw-copy" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={`${FIELD} cursor-pointer`}><option value="">Select a CFP…</option>{others.map((o) => <option key={o.slug} value={o.slug}>{o.acronym} — {o.name}</option>)}</select></div>
                )}
              </>
            )}
            {error && <p role="alert" className="text-sm font-semibold text-danger-ink">{error}</p>}
          </div>

          <div className="flex items-center justify-between pb-4">
            {step === 0 ? <Button variant="outline" onClick={() => router.push("/cfp/new")} disabled={busy}>Cancel</Button> : <Button variant="outline" onClick={() => { setError(""); setStep((s) => s - 1); }} disabled={busy}><ArrowLeft size={14} aria-hidden="true" /> Back</Button>}
            {step < 5
              ? <Button onClick={next}>{step === 4 ? "Continue" : "Next"} <ArrowRight size={14} aria-hidden="true" /></Button>
              : <Button onClick={() => void finish()} disabled={busy || (how === "copy" && !copyFrom)}>{busy ? "Saving…" : "Create the CFP draft"}</Button>}
          </div>
        </div>
      </div>
    </>
  );
}
