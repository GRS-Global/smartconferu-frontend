/* eslint-disable react/no-unescaped-entities -- the page text is the prototype's, word for word */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Eye, FileText, Info, Plus, Tag, Trash2, User, X } from "lucide-react";
import { COUNTRIES } from "@/lib/country-codes";
import { PageHeader } from "@/components/layout/page-header";
import { getAccountExtrasService } from "@/services/account-extras";
import type { PaperCandidate, PublicationAuthor } from "@/types/account";
import { CardHeader, FormStepper, ResearchAreaOptions } from "./form-parts";
import { emailProblem, isValidEmail } from "@/lib/email";

/* New Slides (the prototype's CreateSlidesPage): the step form, started from one of the person's own papers (its authors, title, abstract and keywords) or from scratch.
   Creating it saves a user_publications row (migration 0050) and returns to the list. */

const CREATE_SLIDES_STEPS = [
  { key: "authors", label: "Authors" },
  { key: "title", label: "Title & Abstract" },
  { key: "areas", label: "Research Areas" },
  { key: "keywords", label: "Keywords" },
  { key: "event", label: "Date & Place" },
  { key: "review", label: "Review" },
];

const PREPRINT_LANGUAGES = ["English", "French", "German", "Spanish", "Chinese", "Other"];

export function CreateSlidesForm({ prefill }: { prefill: PaperCandidate | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [step, setStep] = useState(0);
  const [authors, setAuthors] = useState<PublicationAuthor[]>(() =>
    prefill
      ? prefill.authors.map((a, i) => {
        const [firstName, ...rest] = a.name.split(" ");
        return { firstName, lastName: rest.join(" "), email: a.email, presenter: i === 0 };
      })
      : [{ firstName: "", lastName: "", email: "", presenter: true }]
  );
  const [language, setLanguage] = useState("English");
  const [title, setTitle] = useState(prefill?.title || "");
  const [abstractText, setAbstractText] = useState(prefill?.abstract || "");
  const [primaryArea, setPrimaryArea] = useState("");
  const [secondaryArea, setSecondaryArea] = useState("");
  const [keywords, setKeywords] = useState<string[]>(prefill?.keywords || []);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [event, setEvent] = useState(prefill?.conferenceAcronym || "");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [presentDate, setPresentDate] = useState("");

  const inputStyle = { border: "1.5px solid var(--border)", color: "var(--ink)" };
  const inputClass = "w-full px-3.5 py-2.5 rounded-lg text-sm outline-none focus:border-[var(--primary)] placeholder:text-slate-400";
  const labelStyle = { color: "var(--ink-soft)" };
  const labelClass = "text-xs font-semibold mb-1 block";

  const updateAuthor = (i: number, field: keyof PublicationAuthor, value: string | boolean) => setAuthors((list) => list.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  const addAuthor = () => setAuthors((list) => [...list, { firstName: "", lastName: "", email: "", presenter: false }]);
  const removeAuthor = (i: number) => setAuthors((list) => list.filter((_, idx) => idx !== i));

  const addKeyword = () => {
    const k = keywordDraft.trim();
    if (!k || keywords.length >= 8 || keywords.includes(k)) return;
    setKeywords((list) => [...list, k]);
    setKeywordDraft("");
  };
  const removeKeyword = (k: string) => setKeywords((list) => list.filter((x) => x !== k));

  const authorNames = authors.filter((a) => a.firstName || a.lastName).map((a) => `${a.firstName} ${a.lastName}`.trim()).join(", ");

  const handleCreate = async () => {
    // Every author row that is filled in needs a real address (the field is marked required).
    const badAuthor = authors.findIndex((a) => (a.firstName.trim() || a.lastName.trim() || a.email.trim()) && !isValidEmail(a.email));
    if (badAuthor >= 0) { setProblem(`Author ${badAuthor + 1}: ${emailProblem(authors[badAuthor].email)}`); return; }
    setBusy(true);
    setProblem("");
    try {
      await (await getAccountExtrasService()).createPublication({
        kind: "slides", title, authors, language, abstract: abstractText, primaryArea, secondaryArea, keywords,
        fromPaper: prefill ? { id: prefill.id, acronym: prefill.conferenceAcronym } : null,
        event, city, country, presentDate,
      });
      router.push("/slides");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "We couldn't save that.");
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="New Slides" breadcrumbs={[{ label: "My Slides", href: "/slides" }, { label: "New Slides" }]} />
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <FormStepper steps={CREATE_SLIDES_STEPS} current={step} onStepClick={setStep} />

          {prefill && (
            <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="rounded-xl p-4 mb-5 flex items-start gap-2.5">
              <Info size={16} style={{ color: "var(--primary)" }} className="shrink-0 mt-0.5" />
              <p style={{ color: "var(--navy)" }} className="text-xs leading-relaxed">
                Pre-filled from your submission <span className="font-bold">{prefill.label}</span> to <span className="font-bold">{prefill.conferenceAcronym}</span> ({prefill.conferenceName}) — review and adjust anything below before creating it.
              </p>
            </div>
          )}

          {step === 0 && (
            <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
              <CardHeader icon={User} title="Author Information" />
              <p style={{ color: "var(--ink-faint)" }} className="text-xs -mt-3 mb-4">
                Emails are only used to reach the authors — they won't appear on the public slides page.
              </p>
              <div className="space-y-4">
                {authors.map((a, i) => (
                  <div key={i} style={{ background: "var(--row-hover)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span style={{ color: "var(--navy)" }} className="text-xs font-bold">Author {i + 1}</span>
                      {authors.length > 1 && (
                        <button onClick={() => removeAuthor(i)} style={{ color: "var(--danger-ink)" }} className="text-xs flex items-center gap-1 font-medium hover:underline cursor-pointer">
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input value={a.firstName} onChange={(e) => updateAuthor(i, "firstName", e.target.value)} placeholder="First name *" style={inputStyle} className={inputClass} />
                      <input value={a.lastName} onChange={(e) => updateAuthor(i, "lastName", e.target.value)} placeholder="Last name *" style={inputStyle} className={inputClass} />
                      <input value={a.email} onChange={(e) => updateAuthor(i, "email", e.target.value)} placeholder="Email *" style={inputStyle} className="col-span-2 px-3.5 py-2.5 rounded-lg text-sm outline-none focus:border-[var(--primary)] placeholder:text-slate-400" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={a.presenter} onChange={(e) => updateAuthor(i, "presenter", e.target.checked)} className="accent-[var(--primary)] cursor-pointer" />
                      <span style={{ color: "var(--ink-soft)" }} className="text-xs font-medium">Presenter</span>
                    </label>
                  </div>
                ))}
              </div>
              <button onClick={addAuthor} style={{ color: "var(--primary)" }} className="mt-3 text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer">
                <Plus size={13} /> Add another author
              </button>
            </div>
          )}

          {step === 1 && (
            <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
              <CardHeader icon={FileText} title="Title & Abstract" />
              <div className="space-y-3">
                <div>
                  <label style={labelStyle} className={labelClass}>Language *</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle} className={`${inputClass} bg-white cursor-pointer`}>
                    {PREPRINT_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Title *</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Plain text, no markup" style={inputStyle} className={inputClass} />
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Abstract *</label>
                  <textarea value={abstractText} onChange={(e) => setAbstractText(e.target.value)} rows={6} placeholder="A brief summary of your talk" style={inputStyle} className={`${inputClass} resize-none`} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
              <CardHeader icon={Tag} title="Research areas" />
              <p style={{ color: "var(--ink-faint)" }} className="text-xs -mt-3 mb-4">
                Pick the area that best matches your slides. Add a secondary one if it spans two fields.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle} className={labelClass}>Primary area</label>
                  <select value={primaryArea} onChange={(e) => setPrimaryArea(e.target.value)} style={{ ...inputStyle, color: primaryArea ? "var(--ink)" : "var(--ink-faint)" }} className={`${inputClass} bg-white cursor-pointer`}>
                    <option value="">Select an area</option>
                    <ResearchAreaOptions />
                  </select>
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Secondary area (optional)</label>
                  <select value={secondaryArea} onChange={(e) => setSecondaryArea(e.target.value)} style={{ ...inputStyle, color: secondaryArea ? "var(--ink)" : "var(--ink-faint)" }} className={`${inputClass} bg-white cursor-pointer`}>
                    <option value="">Select an area</option>
                    <ResearchAreaOptions />
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
              <CardHeader icon={Tag} title="Keywords" />
              <label style={labelStyle} className={labelClass}>
                Keywords <span style={{ color: "var(--ink-faint)", fontWeight: 500 }}>({keywords.length}/8 added, at least 3 recommended)</span>
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  placeholder={keywords.length >= 8 ? "Maximum of 8 keywords reached" : "Type a keyword and press Enter"}
                  disabled={keywords.length >= 8}
                  style={inputStyle}
                  className={`${inputClass} disabled:opacity-50`}
                />
                <button
                  onClick={addKeyword}
                  disabled={keywords.length >= 8 || !keywordDraft.trim()}
                  style={{ border: "1.5px solid var(--primary)", color: "var(--primary)" }}
                  className="px-3.5 py-2.5 rounded-lg text-xs font-semibold hover:bg-[var(--primary-soft)] transition-colors shrink-0 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k) => (
                    <span key={k} style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="inline-flex items-center gap-1.5 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full">
                      {k}
                      <button onClick={() => removeKeyword(k)} aria-label={`Remove ${k}`} className="hover:opacity-60 transition-opacity cursor-pointer">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
              <CardHeader icon={Calendar} title="Where and when will you present?" />
              <div className="space-y-3">
                <div>
                  <label style={labelStyle} className={labelClass}>Event</label>
                  <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Conference or seminar name" style={inputStyle} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle} className={labelClass}>City</label>
                    <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} className={inputClass} />
                  </div>
                  <div>
                    <label style={labelStyle} className={labelClass}>Country / region</label>
                    <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ ...inputStyle, color: country ? "var(--ink)" : "var(--ink-faint)" }} className={`${inputClass} bg-white cursor-pointer`}>
                      <option value="">Select a country</option>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Date</label>
                  <input type="date" value={presentDate} onChange={(e) => setPresentDate(e.target.value)} style={inputStyle} className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
              <CardHeader icon={Eye} title="Review before you create it" />
              <div className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
                <div className="col-span-2">
                  <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Authors</div>
                  <div style={{ color: authorNames ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">
                    {authorNames || "Not set"}
                    {authors.some((a) => a.presenter) && (
                      <span style={{ color: "var(--ink-faint)" }} className="font-normal"> — presenting: {authors.filter((a) => a.presenter).map((a) => `${a.firstName} ${a.lastName}`.trim()).join(", ") || "—"}</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Title</div>
                  <div style={{ color: title ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">{title || "Not set"}</div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Event</div>
                  <div style={{ color: (event || city || country) ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">{[event, city, country].filter(Boolean).join(", ") || "Not set"}</div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Date</div>
                  <div style={{ color: presentDate ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">{presentDate || "Not set"}</div>
                </div>
                <div className="col-span-2">
                  <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-1">Keywords</div>
                  {keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((k) => <span key={k} style={{ background: "var(--canvas)", color: "var(--ink-soft)" }} className="text-[11px] px-2 py-1 rounded-md font-medium">{k}</span>)}
                    </div>
                  ) : (
                    <div style={{ color: "var(--border-strong)" }} className="font-medium">Not set</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {problem && <p role="alert" style={{ color: "var(--danger-ink)" }} className="mt-4 text-sm">{problem}</p>}

          <div className="sticky bottom-6 mt-6 z-10">
            <div style={{ background: "#FFFFFF", border: "1px solid var(--border)" }} className="rounded-2xl shadow-lg p-4 flex items-center justify-between gap-4 flex-wrap">
              <p style={{ color: "var(--ink-faint)" }} className="text-xs">Step {step + 1} of {CREATE_SLIDES_STEPS.length} — you can jump between steps any time.</p>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => (step === 0 ? router.push("/slides") : setStep((s) => s - 1))}
                  style={{ border: "1.5px solid var(--border)", color: "var(--ink-muted)" }}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {step === 0 ? "Cancel" : "Back"}
                </button>
                {step < CREATE_SLIDES_STEPS.length - 1 ? (
                  <button onClick={() => setStep((s) => s + 1)} style={{ background: "var(--primary)" }} className="px-6 py-2.5 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                    Continue
                  </button>
                ) : (
                  <button onClick={() => void handleCreate()} disabled={busy || !language || !title.trim() || !abstractText.trim()} title={!title.trim() || !abstractText.trim() ? "Add the title and abstract first" : undefined} style={{ background: "var(--primary)" }} className="px-6 py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                    Create Slides
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- My Receipts ---------------- */