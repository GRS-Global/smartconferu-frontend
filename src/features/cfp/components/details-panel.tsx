"use client";

import { Calendar, Check, Info, MapPin, Settings, Tag, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COUNTRIES } from "@/lib/country-codes";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import type { ConferenceInfo } from "@/types/chair";
import { SUBMISSION_LINK_PENDING } from "./cfp-public-preview";

/* Edit details (the prototype's EditCFPDetailsPage): the conference's operational details — website, title, dates and deadlines, venue, topics. They are
   the conference's own details, so they are saved the way Conference Settings › Conference Details saves them (the same fields, the same save). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const FIELD = "w-full rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-primary";
const LABEL = "mb-1.5 block text-xs font-semibold text-ink-soft";
const MAX_TOPICS = 40;

function Card({ icon: Icon, title, children, pad = "p-5" }: { icon: typeof Settings; title: string; children: React.ReactNode; pad?: string }) {
  return (
    <div style={CARD} className={`rounded-2xl bg-white ${pad}`}>
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><Icon size={16} aria-hidden="true" className="text-primary" /> {title}</h2>
      {children}
    </div>
  );
}
const readOnly = (value: string) => <div className="truncate rounded-lg border-[1.5px] border-line bg-canvas px-3.5 py-2.5 text-sm text-ink-faint">{value}</div>;

export function DetailsPanel({ slug, info, submissionLink, onDone, onSaved, onSessionEnded }: { slug: string; info: ConferenceInfo; submissionLink: string; onDone: () => void; onSaved: () => void; onSessionEnded: () => void }) {
  const [form, setForm] = useState({
    name: info.name, webPage: info.webPage, venue: info.venue, city: info.city, state: info.state, country: info.country,
    startDate: info.startDate, endDate: info.endDate, abstractDeadline: info.abstractDeadline, submissionDeadline: info.submissionDeadline, topics: [...info.topics],
  });
  const [topic, setTopic] = useState("");
  // What the form held when it opened: Save is offered once something differs.
  const [start] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== start;
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const addTopic = () => {
    const t = topic.trim();
    if (!t || form.topics.includes(t) || form.topics.length >= MAX_TOPICS) return;
    set("topics", [...form.topics, t]); setTopic("");
  };
  const problem = !form.name.trim() ? "Give the conference a title."
    : form.startDate && form.endDate && form.endDate < form.startDate ? "The end date can't be before the start date."
      : form.abstractDeadline && form.submissionDeadline && form.abstractDeadline > form.submissionDeadline ? "The abstract deadline must be on or before the submission deadline." : "";
  const save = async () => {
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    try { await (await getChairService()).saveInfo(slug, { ...info, ...form, name: form.name.trim(), webPage: form.webPage.trim() }); setSaved(true); onSaved(); } catch (e) {
      if (e instanceof AuthRequiredError) onSessionEnded(); else setError(e instanceof Error ? e.message : "Couldn't save the details.");
    } finally { setBusy(false); }
  };

  if (saved) {
    return (
      <div className="flex items-center justify-center p-8" style={{ minHeight: "60vh" }}>
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft"><Check size={28} strokeWidth={2.5} aria-hidden="true" className="text-success-ink" /></div>
          <h2 className="mb-2 text-lg font-bold text-navy">Details saved</h2>
          <p className="mb-6 text-sm text-ink-muted">Your changes to the {info.acronym} CFP details have been saved.</p>
          <Button onClick={onDone}>Back to Overview</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div style={{ border: "1px solid var(--primary-soft-border)" }} className="flex items-start gap-2.5 rounded-xl bg-primary-soft px-4 py-3">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-[#1E4E8C]">These are {info.acronym}&apos;s operational details — dates, venue and links. Update the fields below, then click &quot;Save Changes&quot;. Acronym and submission link are assigned by Smartconferu and can&apos;t be changed here.</p>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <Card icon={Settings} title="Conference Information">
            <div className="space-y-3">
              <div><span className={LABEL}>Type</span>{readOnly("Conference")}</div>
              <div><label htmlFor="cd-website" className={LABEL}>Website</label><input id="cd-website" value={form.webPage} onChange={(e) => set("webPage", e.target.value)} className={FIELD} /></div>
              <div><label htmlFor="cd-title" className={LABEL}>Conference title <span className="text-danger-ink">*</span></label><input id="cd-title" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={300} className={FIELD} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className={LABEL}>Acronym</span>{readOnly(info.acronym)}</div>
                <div><span className={LABEL}>Submission link</span>{readOnly(submissionLink || SUBMISSION_LINK_PENDING)}</div>
              </div>
            </div>
          </Card>
          <Card icon={Calendar} title="Dates & Deadlines">
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="cd-start" className={LABEL}>Start date <span className="text-danger-ink">*</span></label><input id="cd-start" type="date" value={form.startDate} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, startDate: v, endDate: f.endDate && f.endDate < v ? v : f.endDate })); }} className={FIELD} /></div>
              <div><label htmlFor="cd-end" className={LABEL}>End date <span className="text-danger-ink">*</span></label><input id="cd-end" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} className={FIELD} /></div>
              <div><label htmlFor="cd-abstract" className={LABEL}>Abstract deadline</label><input id="cd-abstract" type="date" value={form.abstractDeadline} onChange={(e) => set("abstractDeadline", e.target.value)} className={FIELD} /></div>
              <div><label htmlFor="cd-deadline" className={LABEL}>Submission deadline</label><input id="cd-deadline" type="date" value={form.submissionDeadline} onChange={(e) => set("submissionDeadline", e.target.value)} className={FIELD} /></div>
            </div>
          </Card>
        </div>
        <Card icon={MapPin} title="Location">
          <div className="space-y-3">
            <div><label htmlFor="cd-venue" className={LABEL}>Venue</label><input id="cd-venue" value={form.venue} onChange={(e) => set("venue", e.target.value)} className={FIELD} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="cd-city" className={LABEL}>City</label><input id="cd-city" value={form.city} onChange={(e) => set("city", e.target.value)} className={FIELD} /></div>
              <div>
                <label htmlFor="cd-country" className={LABEL}>Country / region</label>
                <select id="cd-country" value={form.country} onChange={(e) => set("country", e.target.value)} className={`${FIELD} cursor-pointer ${form.country ? "" : "text-ink-faint"}`}>
                  <option value="">Select…</option>
                  {COUNTRIES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div><label htmlFor="cd-state" className={LABEL}>State / province</label><input id="cd-state" value={form.state} onChange={(e) => set("state", e.target.value)} className={FIELD} /></div>
          </div>
        </Card>
      </div>
      <Card icon={Tag} title="Topics" pad="p-6">
        <label htmlFor="cd-topic" className={LABEL}>Topics ({form.topics.length} added)</label>
        <div className="flex gap-2">
          <input id="cd-topic" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }} placeholder="Add a topic and press Enter" maxLength={120} className={FIELD} />
          <Button variant="outline" onClick={addTopic} disabled={!topic.trim() || form.topics.length >= MAX_TOPICS}>Add</Button>
        </div>
        {form.topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {form.topics.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                {t}
                <button type="button" onClick={() => set("topics", form.topics.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="cursor-pointer text-primary/70 hover:text-primary"><X size={12} aria-hidden="true" /></button>
              </span>
            ))}
          </div>
        )}
      </Card>
      {error && <p role="alert" className="text-sm font-semibold text-danger-ink">{error}</p>}
      <div className="flex items-center justify-between pb-4 pt-1">
        <Button variant="outline" onClick={onDone} disabled={busy}>Cancel</Button>
        <Button onClick={() => void save()} disabled={busy || !dirty} title={dirty ? undefined : "No changes to save"}>{busy ? "Saving…" : "Save Changes"}</Button>
      </div>
    </div>
  );
}
