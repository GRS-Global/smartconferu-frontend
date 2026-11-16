/* eslint-disable react/no-unescaped-entities -- the page text is the prototype's, word for word */
"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Calendar, Check, ChevronDown, ChevronsUpDown, ChevronUp, Eye, FileCheck, FileUp, Info, Layers, Plus, Search, Send, User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LoadMore } from "@/components/ui/load-more";
import { COUNTRIES } from "@/lib/country-codes";
import { RESEARCH_AREA_GROUPS } from "@/lib/research-areas";
import { getAccountExtrasService } from "@/services/account-extras";
import type { ProposalConference } from "@/types/account";
import { CardHeader, FormStepper, ResearchAreaOptions } from "./form-parts";
import { PageLoading, PageProblem } from "./page-states";

/* Publish with Us (the prototype's PublishWithUsPage): the open-access publishing programme, how it works, the conferences the person chairs to
   propose a volume for (held in the last two years or later), and the three-step proposal form. Sending saves the proposal (publishing_proposals,
   migration 0050) for the editorial team. */

/* Our own series, grouped by the same areas used across the rest of the app rather than
   inventing an unrelated taxonomy just for this page. */
const PUBLISHING_SERIES = [
  { name: "Smartconferu Computing Series", area: "Computer Science & AI", bg: "var(--navy)" },
  { name: "Smartconferu Business Series", area: "Business & Management", bg: "var(--primary)" },
  { name: "Smartconferu Health Sciences Series", area: "Health & Medicine", bg: "var(--danger-hover)" },
  { name: "Smartconferu Interdisciplinary Series", area: "Social Sciences & Education", bg: "#134E4A" },
];

/* A proposal's series follows from the research area picked in step 1 — no need to make
   the submitter pick it again in a separate step. */
// Built per taxonomy group, so every primary area has a series (falls back to Interdisciplinary).
const SERIES_BY_GROUP: Record<string, string> = {
  "Computing & Engineering": "Smartconferu Computing Series",
  "Natural Sciences": "Smartconferu Interdisciplinary Series",
  "Health": "Smartconferu Health Sciences Series",
  "Business & Social Sciences": "Smartconferu Interdisciplinary Series",
  "Arts & Humanities": "Smartconferu Interdisciplinary Series",
  "Multidisciplinary": "Smartconferu Interdisciplinary Series",
};
const AREA_TO_SERIES: Record<string, string> = {
  ...Object.fromEntries(RESEARCH_AREA_GROUPS.flatMap((g) => g.areas.map((a) => [a, SERIES_BY_GROUP[g.label] || "Smartconferu Interdisciplinary Series"]))),
  "Mathematics & Statistics": "Smartconferu Computing Series",
  "Business & Management": "Smartconferu Business Series",
  "Economics & Finance": "Smartconferu Business Series",
  "Life Sciences & Biotechnology": "Smartconferu Health Sciences Series",
};

const PUBLISHING_WORKFLOW = [
  { icon: FileUp, title: "Submit your proposal", desc: "Tell us about the volume you'd like to publish — its scope, expected size, and timeline." },
  { icon: Eye, title: "We review it", desc: "Our editorial team evaluates the proposal and may follow up with a few questions." },
  { icon: Send, title: "We make an offer", desc: "If it's a good fit, we'll send over publishing terms and an estimated schedule." },
  { icon: FileCheck, title: "Sign & confirm", desc: "Accept the offer, sign the publishing agreement, and pay the deposit to get started." },
  { icon: Layers, title: "Assemble your volume", desc: "We set up your volume on Smartconferu and assign editors to help you put it together." },
  { icon: BookOpen, title: "We publish it", desc: "Once the volume is complete and payment is settled, it goes live as an open-access publication." },
];

const PROPOSAL_VOLUME_TYPES = ["Conference Proceedings", "Edited Book", "Special Issue Collection", "Workshop Proceedings", "Other"];

const PROPOSAL_STEPS = [
  { key: "volume", label: "Volume" },
  { key: "customer", label: "Customer Info" },
  { key: "review", label: "Review" },
];

interface ProposalFormState {
  sourceConference: string | null; volumeType: string; title: string; description: string; primaryArea: string; secondaryArea: string; showAreaNotes: boolean; areaNotes: string;
  estimatedPapers: string; targetDate: string; otherInfo: string; proposeNewSeries: boolean; newSeriesName: string; customerKind: string; customerName: string; customerEmail: string;
  addressLine1: string; addressLine2: string; city: string; postCode: string; country: string; phone: string; vatNumber: string; agreedToTerms: boolean;
}

const DASHBOARD_LOAD_MORE_COUNT = 15;

const PROPOSAL_INITIAL_FORM: ProposalFormState = {
  sourceConference: null,
  volumeType: "Conference Proceedings",
  title: "",
  description: "",
  primaryArea: "",
  secondaryArea: "",
  showAreaNotes: false,
  areaNotes: "",
  estimatedPapers: "",
  targetDate: "",
  otherInfo: "",
  proposeNewSeries: false,
  newSeriesName: "",
  customerKind: "person",
  customerName: "",
  customerEmail: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postCode: "",
  country: "",
  phone: "",
  vatNumber: "",
  agreedToTerms: false,
};

/* Proposals can only be attached to your own conferences held recently — mirrors the
   real constraint that a volume needs an actual event with actual papers behind it. */
const PROPOSAL_ELIGIBLE_YEARS_BACK = 2;

export function PublishPage() {
  const [conferences, setConferences] = useState<ProposalConference[] | null>(null);
  const [problem, setProblem] = useState("");
  const [tick, setTick] = useState(0);
  const [sendProblem, setSendProblem] = useState("");
  const [sending, setSending] = useState(false);
  const [view, setView] = useState("info"); // "info" | "select" | "form"
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState(PROPOSAL_INITIAL_FORM);
  const [selectSearch, setSelectSearch] = useState("");
  const [selectSortBy, setSelectSortBy] = useState<"acronym" | "name" | "year" | null>(null);
  const [selectSortDir, setSelectSortDir] = useState("asc");
  const [selectVisibleCount, setSelectVisibleCount] = useState(DASHBOARD_LOAD_MORE_COUNT);
  const [selectLoadingMore, setSelectLoadingMore] = useState(false);
  const selectSentinelRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof ProposalFormState>(field: K, value: ProposalFormState[K]) => setForm((f) => ({ ...f, [field]: value }));
  const inputStyle = { border: "1.5px solid var(--border)", color: "var(--ink)" };
  const inputClass = "w-full px-3.5 py-2.5 rounded-lg text-sm outline-none focus:border-[var(--primary)] placeholder:text-slate-400";
  const labelStyle = { color: "var(--ink-soft)" };
  const labelClass = "text-xs font-semibold mb-1 block";

  const toggleSelectSort = (key: "acronym" | "name" | "year") => {
    if (selectSortBy === key) setSelectSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSelectSortBy(key); setSelectSortDir("asc"); }
  };

  const eligibleConferences = (conferences ?? [])
    .filter((c) => Number(c.endDate.slice(0, 4)) >= new Date().getFullYear() - PROPOSAL_ELIGIBLE_YEARS_BACK)
    .filter((c) => {
      const q = selectSearch.trim().toLowerCase();
      if (!q) return true;
      return c.acronym.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });

  if (selectSortBy) {
    eligibleConferences.sort((a, b) => {
      let av: string = selectSortBy === "year" ? a.endDate.slice(0, 4) : a[selectSortBy];
      let bv: string = selectSortBy === "year" ? b.endDate.slice(0, 4) : b[selectSortBy];
      av = av.toLowerCase(); bv = bv.toLowerCase();
      if (av < bv) return selectSortDir === "asc" ? -1 : 1;
      if (av > bv) return selectSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  const selectPageItems = eligibleConferences.slice(0, selectVisibleCount);
  const selectHasMore = selectVisibleCount < eligibleConferences.length;

  useEffect(() => {
    if (view !== "select" || !selectHasMore || selectLoadingMore) return;
    const el = selectSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        setSelectLoadingMore(true);
        setTimeout(() => {
          setSelectVisibleCount((v) => Math.min(v + DASHBOARD_LOAD_MORE_COUNT, eligibleConferences.length));
          setSelectLoadingMore(false);
        }, 1000);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [view, selectHasMore, selectLoadingMore, eligibleConferences.length]);

  const startProposal = () => { setForm(PROPOSAL_INITIAL_FORM); setStep(0); setView("form"); };
  const startProposalFor = (conf: ProposalConference) => {
    setForm({
      ...PROPOSAL_INITIAL_FORM,
      sourceConference: conf.acronym,
      title: `Proceedings of ${conf.acronym}`,
      description: `Proceedings volume for ${conf.name}.`,
    });
    setStep(0);
    setView("form");
  };
  const startNewSeriesProposal = () => { setForm({ ...PROPOSAL_INITIAL_FORM, proposeNewSeries: true }); setStep(0); setView("form"); };

  useEffect(() => {
    let alive = true;
    getAccountExtrasService().then((svc) => svc.proposalConferences()).then(
      (r) => { if (alive) { setConferences(r); setProblem(""); } },
      (e: unknown) => { if (alive) setProblem(e instanceof Error ? e.message : "Something went wrong."); },
    );
    return () => { alive = false; };
  }, [tick]);

  const send = async () => {
    setSending(true);
    setSendProblem("");
    try {
      await (await getAccountExtrasService()).submitProposal({ ...form });
      setSubmitted(true);
    } catch (e) { setSendProblem(e instanceof Error ? e.message : "We couldn't send your proposal."); }
    finally { setSending(false); }
  };

  if (problem) return <PageProblem title="Publish with Us" heading="Couldn't load this page." message={problem} onRetry={() => { setProblem(""); setTick((t) => t + 1); }} />;
  if (!conferences) return <PageLoading title="Publish with Us" label="Loading" />;

  if (submitted) {
    return (
      <div>
        <PageHeader title="Publish with Us" />
        <div className="p-8 flex items-center justify-center" style={{ minHeight: "60vh" }}>
          <div className="text-center max-w-sm">
            <div style={{ background: "var(--success-soft)" }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={28} style={{ color: "var(--success)" }} strokeWidth={2.5} />
            </div>
            <h2 style={{ color: "var(--navy)" }} className="text-lg font-bold mb-2">Proposal submitted</h2>
            <p style={{ color: "var(--ink-muted)" }} className="text-sm mb-6">
              We've received your proposal for {form.title || "your volume"}. Our editorial team will review it and reach out at the contact details you provided.
            </p>
            <button
              onClick={() => { setSubmitted(false); setView("info"); }}
              style={{ background: "var(--primary)" }}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
            >
              Back to Publish with Us
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "info") {
    return (
      <div>
        <PageHeader title="Publish with Us" />
        <div className="p-8">
          <div className="max-w-4xl">
            <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-xl p-6 mb-8">
              <p style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed mb-2">
                Smartconferu runs its own open-access publishing program for conference proceedings, edited books, and other paper collections — organized into a handful of series by subject area. Every volume we publish is free to read online.
              </p>
              <p style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed mb-5">
                Have a volume in mind? Submit a proposal and our editorial team will take it from there.
              </p>
              <button
                onClick={() => setView("select")}
                style={{ background: "var(--primary)" }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
              >
                <FileUp size={16} /> Submit a Proposal
              </button>
            </div>

            <h2 style={{ color: "var(--navy)" }} className="text-base font-bold mb-4">Our Series</h2>
            <div className="grid grid-cols-5 gap-3 mb-10">
              {PUBLISHING_SERIES.map((s) => (
                <div key={s.name} style={{ background: s.bg }} className="rounded-xl p-4 aspect-square flex flex-col justify-between text-white">
                  <div className="text-[10px] font-bold opacity-80 tracking-wide">Smartconferu</div>
                  <div>
                    <div className="text-sm font-bold leading-tight">{s.name.replace("Smartconferu ", "")}</div>
                    <div className="text-[11px] opacity-80 mt-1">{s.area}</div>
                  </div>
                </div>
              ))}
              <button
                onClick={startNewSeriesProposal}
                style={{ border: "1.5px dashed var(--border-strong)", color: "var(--ink-faint)" }}
                className="rounded-xl p-4 aspect-square flex flex-col items-center justify-center gap-1.5 text-center hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
              >
                <Plus size={18} />
                <span className="text-xs font-semibold leading-tight">Propose a<br />new series</span>
              </button>
            </div>

            <h2 style={{ color: "var(--navy)" }} className="text-base font-bold mb-1">Proposal & Publishing Workflow</h2>
            <p style={{ color: "var(--ink-faint)" }} className="text-sm mb-6">
              Proceedings from a conference hosted on Smartconferu or any other collection of papers can apply — here's what happens after you submit.
            </p>
            <div className="space-y-4 mb-6">
              {PUBLISHING_WORKFLOW.map((w, i) => {
                const Icon = w.icon;
                return (
                  <div key={w.title} className="flex items-start gap-4">
                    <div className="flex flex-col items-center shrink-0">
                      <div style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="w-10 h-10 rounded-full flex items-center justify-center">
                        <Icon size={17} />
                      </div>
                      {i < PUBLISHING_WORKFLOW.length - 1 && <div style={{ background: "var(--border)" }} className="w-px flex-1 mt-1.5" />}
                    </div>
                    <div className="pb-4">
                      <div style={{ color: "var(--ink)" }} className="text-sm font-bold mb-0.5">{w.title}</div>
                      <p style={{ color: "var(--ink-muted)" }} className="text-sm leading-relaxed">{w.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p style={{ color: "var(--ink-faint)" }} className="text-xs">
              For informal inquiries about the publishing program, reach us at{" "}
              <a href="mailto:publishing@gr-conferences.com" style={{ color: "var(--primary)" }} className="font-medium hover:underline">publishing@gr-conferences.com</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === "select") {
    return (
      <div>
        <PageHeader title="Submit a Proposal" breadcrumbs={[{ label: "Publish with Us", onClick: () => setView("info") }, { label: "Submit a Proposal" }]} />
        <div className="p-8">
          <div>
            <p style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed mb-1">
              We currently accept proposals for proceedings from conferences you've chaired or managed on Smartconferu, held within the last {PROPOSAL_ELIGIBLE_YEARS_BACK} years or later.
            </p>
            <p style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed mb-5">
              Pick a conference below to propose its proceedings as a volume — we'll carry over its title and details for you.
            </p>

            {(conferences ?? []).length > 0 && (
              <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 w-72">
                <Search size={15} style={{ color: "var(--ink-faint)" }} />
                <input
                  value={selectSearch}
                  onChange={(e) => { setSelectSearch(e.target.value); setSelectVisibleCount(DASHBOARD_LOAD_MORE_COUNT); setSelectLoadingMore(false); }}
                  placeholder="Search conferences..."
                  style={{ color: "var(--ink)" }}
                  className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400"
                />
              </div>
            )}

            {eligibleConferences.length === 0 ? (
              <div style={{ background: "var(--primary-soft)", border: "1.5px dashed var(--primary)" }} className="rounded-xl p-10 text-center mb-6">
                <Calendar size={26} style={{ color: "var(--primary)" }} className="mx-auto mb-3" />
                <p style={{ color: "var(--navy)" }} className="text-sm font-semibold mb-1">
                  {selectSearch ? "No conferences match your search" : "No eligible conferences yet"}
                </p>
                <p style={{ color: "var(--ink-muted)" }} className="text-xs">
                  {selectSearch
                    ? "Try a different acronym or name."
                    : `You'll see conferences here once you've chaired or managed one on Smartconferu within the last ${PROPOSAL_ELIGIBLE_YEARS_BACK} years.`}
                </p>
              </div>
            ) : (
              <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl overflow-hidden mb-2">
                <table className="ui-table w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--canvas)", borderBottom: "1px solid var(--border)" }}>
                      <SortHeader label="Acronym" sortKey="acronym" sortBy={selectSortBy} sortDir={selectSortDir} onSort={toggleSelectSort} />
                      <SortHeader label="Name" sortKey="name" sortBy={selectSortBy} sortDir={selectSortDir} onSort={toggleSelectSort} />
                      <SortHeader label="Year" sortKey="year" sortBy={selectSortBy} sortDir={selectSortDir} onSort={toggleSelectSort} />
                      <th style={{ color: "var(--ink-muted)" }} className="text-center font-semibold text-xs px-5 py-3">Propose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectPageItems.map((c, i) => (
                      <tr
                        key={c.slug}
                        style={{ borderBottom: i < selectPageItems.length - 1 ? "1px solid var(--muted)" : "none" }}
                        className="transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="text-xs font-semibold px-2.5 py-1 rounded-full">{c.acronym}</span>
                        </td>
                        <td className="px-5 py-3.5" style={{ color: "var(--ink)" }}>{c.name}</td>
                        <td className="px-5 py-3.5" style={{ color: "var(--ink-muted)" }}>{c.endDate.slice(0, 4)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => startProposalFor(c)}
                            style={{ border: "1.5px solid var(--primary)", color: "var(--primary)" }}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--primary-soft)] transition-colors cursor-pointer"
                            aria-label={`Propose proceedings for ${c.acronym}`}
                          >
                            Propose
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ borderTop: "1px solid var(--muted)" }} className="flex flex-col items-center gap-2 px-5 py-4">
                  <span style={{ color: "var(--ink-muted)" }} className="text-xs">
                    Showing {selectPageItems.length} of {eligibleConferences.length}
                  </span>
                  {selectLoadingMore ? (
                    <LoadMore label="Loading more conferences…" />
                  ) : selectHasMore ? (
                    <div ref={selectSentinelRef} style={{ height: 1 }} />
                  ) : (
                    eligibleConferences.length > DASHBOARD_LOAD_MORE_COUNT && (
                      <span style={{ color: "var(--ink-faint)" }} className="text-xs">You've reached the end of the list.</span>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap mt-4">
              <span style={{ color: "var(--ink-faint)" }} className="text-xs">Don't see your conference, or publishing something else entirely?</span>
              <button onClick={startProposal} style={{ color: "var(--primary)" }} className="text-xs font-semibold hover:underline cursor-pointer">
                Start a manual proposal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Submit a Proposal" breadcrumbs={[{ label: "Publish with Us", onClick: () => setView("info") }, { label: "Submit a Proposal" }]} />
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <FormStepper steps={PROPOSAL_STEPS} current={step} onStepClick={setStep} />

          {form.sourceConference && (
            <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="rounded-xl p-4 mb-5 flex items-start gap-2.5">
              <Info size={16} style={{ color: "var(--primary)" }} className="shrink-0 mt-0.5" />
              <p style={{ color: "var(--navy)" }} className="text-xs leading-relaxed">
                Pre-filled for <span className="font-bold">{form.sourceConference}</span>'s proceedings — review and adjust anything below before submitting.
              </p>
            </div>
          )}

          {step === 0 && (
            <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
              <CardHeader icon={BookOpen} title="What are you publishing?" />
              <div className="space-y-3 mb-5">
                <div>
                  <label style={labelStyle} className={labelClass}>Volume type *</label>
                  <select value={form.volumeType} onChange={(e) => update("volumeType", e.target.value)} style={inputStyle} className={`${inputClass} bg-white cursor-pointer`}>
                    {PROPOSAL_VOLUME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Volume title *</label>
                  <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Proceedings of ISBM 2026" style={inputStyle} className={inputClass} />
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Description *</label>
                  <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} placeholder="What's this volume about, and who's it for?" style={inputStyle} className={`${inputClass} resize-none`} />
                </div>
              </div>

              <p style={{ color: "var(--ink-faint)" }} className="text-xs -mt-1 mb-2">Pick the area that best matches your volume. Add a secondary one if it spans two fields.</p>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label style={labelStyle} className={labelClass}>Main area *</label>
                  <select value={form.primaryArea} onChange={(e) => update("primaryArea", e.target.value)} style={{ ...inputStyle, color: form.primaryArea ? "var(--ink)" : "var(--ink-faint)" }} className={`${inputClass} bg-white cursor-pointer`}>
                    <option value="">Select an area</option>
                    <ResearchAreaOptions />
                  </select>
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Second area (optional)</label>
                  <select value={form.secondaryArea} onChange={(e) => update("secondaryArea", e.target.value)} style={{ ...inputStyle, color: form.secondaryArea ? "var(--ink)" : "var(--ink-faint)" }} className={`${inputClass} bg-white cursor-pointer`}>
                    <option value="">Select an area</option>
                    <ResearchAreaOptions />
                  </select>
                </div>
              </div>
              {!form.showAreaNotes ? (
                <button onClick={() => update("showAreaNotes", true)} style={{ color: "var(--primary)" }} className="text-xs font-semibold hover:underline mb-5 cursor-pointer">
                  My volume doesn't fit these areas
                </button>
              ) : (
                <div className="mb-5">
                  <label style={labelStyle} className={labelClass}>Tell us more about your volume's area</label>
                  <textarea value={form.areaNotes} onChange={(e) => update("areaNotes", e.target.value)} rows={2} style={inputStyle} className={`${inputClass} resize-none`} />
                </div>
              )}

              <div style={{ background: "var(--row-hover)", border: "1px solid var(--border)" }} className="rounded-xl p-4 mb-5">
                {!form.proposeNewSeries ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p style={{ color: "var(--ink-soft)" }} className="text-xs">
                      Based on the area above, this will be proposed for the{" "}
                      <span style={{ color: "var(--navy)" }} className="font-semibold">{AREA_TO_SERIES[form.primaryArea] || "series our editorial team judges the best fit"}</span>.
                    </p>
                    <button onClick={() => update("proposeNewSeries", true)} style={{ color: "var(--primary)" }} className="text-xs font-semibold hover:underline shrink-0 cursor-pointer">
                      Propose a new series instead
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label style={labelStyle} className="text-xs font-semibold block mb-0">New series name *</label>
                      <button onClick={() => update("proposeNewSeries", false)} style={{ color: "var(--primary)" }} className="text-xs font-semibold hover:underline shrink-0 cursor-pointer">
                        Use an existing series instead
                      </button>
                    </div>
                    <input value={form.newSeriesName} onChange={(e) => update("newSeriesName", e.target.value)} placeholder="e.g. Smartconferu Robotics Series" style={inputStyle} className={inputClass} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label style={labelStyle} className={labelClass}>Estimated number of papers *</label>
                  <input type="number" min="0" value={form.estimatedPapers} onChange={(e) => update("estimatedPapers", e.target.value)} placeholder="Your best guess is fine" style={inputStyle} className={inputClass} />
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Target publish date *</label>
                  <input type="date" value={form.targetDate} onChange={(e) => update("targetDate", e.target.value)} style={inputStyle} className={inputClass} />
                </div>
              </div>
              <div>
                <label style={labelStyle} className={labelClass}>Anything else? (optional)</label>
                <textarea
                  value={form.otherInfo}
                  onChange={(e) => update("otherInfo", e.target.value.slice(0, 500))}
                  rows={2}
                  maxLength={500}
                  placeholder="Keep it concise — no need to repeat your call for papers or web page"
                  style={inputStyle}
                  className={`${inputClass} resize-none`}
                />
                <p style={{ color: "var(--ink-faint)" }} className="text-xs mt-1.5 text-right">{form.otherInfo.length}/500</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
              <CardHeader icon={User} title="Who's the publishing agreement with?" />
              <p style={{ color: "var(--ink-faint)" }} className="text-xs -mt-3 mb-4">
                If your proposal is accepted, we'll send a publishing agreement to sign — this is who it's addressed to. It can be an organization (e.g. a university) or you personally.
              </p>

              <div className="flex items-center gap-3 mb-4">
                {[{ key: "person", label: "Person" }, { key: "organization", label: "Organization" }].map((k) => (
                  <label
                    key={k.key}
                    style={{ border: form.customerKind === k.key ? "1.5px solid var(--primary)" : "1.5px solid var(--border)", background: form.customerKind === k.key ? "var(--primary-soft)" : "#FFFFFF" }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-colors flex-1"
                  >
                    <input type="radio" name="customerKind" checked={form.customerKind === k.key} onChange={() => update("customerKind", k.key)} style={{ accentColor: "var(--primary)" }} className="w-4 h-4 cursor-pointer" />
                    <span style={{ color: "var(--ink)" }} className="text-sm font-semibold">{k.label}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle} className={labelClass}>{form.customerKind === "organization" ? "Organization name *" : "Full name *"}</label>
                    <input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} style={inputStyle} className={inputClass} />
                  </div>
                  <div>
                    <label style={labelStyle} className={labelClass}>Email *</label>
                    <input type="email" value={form.customerEmail} onChange={(e) => update("customerEmail", e.target.value)} style={inputStyle} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Address, line 1 *</label>
                  <input value={form.addressLine1} onChange={(e) => update("addressLine1", e.target.value)} style={inputStyle} className={inputClass} />
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>Address, line 2</label>
                  <input value={form.addressLine2} onChange={(e) => update("addressLine2", e.target.value)} style={inputStyle} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle} className={labelClass}>City *</label>
                    <input value={form.city} onChange={(e) => update("city", e.target.value)} style={inputStyle} className={inputClass} />
                  </div>
                  <div>
                    <label style={labelStyle} className={labelClass}>Post code *</label>
                    <input value={form.postCode} onChange={(e) => update("postCode", e.target.value)} style={inputStyle} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle} className={labelClass}>Country / region *</label>
                    <select value={form.country} onChange={(e) => update("country", e.target.value)} style={{ ...inputStyle, color: form.country ? "var(--ink)" : "var(--ink-faint)" }} className={`${inputClass} bg-white cursor-pointer`}>
                      <option value="">Select a country</option>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle} className={labelClass}>Phone number *</label>
                    <input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 555 123 4567" style={inputStyle} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle} className={labelClass}>VAT number</label>
                  <input value={form.vatNumber} onChange={(e) => update("vatNumber", e.target.value)} placeholder="Only if you're in the EU or UK and VAT-registered" style={inputStyle} className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-6">
                <CardHeader icon={Eye} title="Review before you submit" />
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
                  <div>
                    <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Type</div>
                    <div style={{ color: "var(--ink)" }} className="font-medium">{form.volumeType}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Series</div>
                    <div style={{ color: "var(--ink)" }} className="font-medium">
                      {form.proposeNewSeries ? (form.newSeriesName || "New series — not named") : (AREA_TO_SERIES[form.primaryArea] || "To be assigned by our editorial team")}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Title</div>
                    <div style={{ color: form.title ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">{form.title || "Not set"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Area</div>
                    <div style={{ color: form.primaryArea ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">
                      {[form.primaryArea, form.secondaryArea].filter(Boolean).join(", ") || "Not set"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Estimated papers</div>
                    <div style={{ color: form.estimatedPapers ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">{form.estimatedPapers || "Not set"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Target date</div>
                    <div style={{ color: form.targetDate ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">{form.targetDate || "Not set"}</div>
                  </div>
                  <div className="col-span-2">
                    <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-0.5">Customer</div>
                    <div style={{ color: form.customerName ? "var(--ink)" : "var(--border-strong)" }} className="font-medium">
                      {form.customerName || "Not set"}{form.customerEmail ? ` · ${form.customerEmail}` : ""}
                    </div>
                    <div style={{ color: "var(--ink-faint)" }} className="text-xs mt-0.5">
                      {[form.addressLine1, form.city, form.postCode, form.country].filter(Boolean).join(", ") || "No address set"}
                    </div>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: "var(--ink)" }}>
                <input
                  type="checkbox"
                  checked={form.agreedToTerms}
                  onChange={(e) => update("agreedToTerms", e.target.checked)}
                  className="w-4 h-4 rounded mt-0.5 shrink-0 cursor-pointer"
                  style={{ accentColor: "var(--primary)" }}
                />
                <span>
                  I confirm the papers in this volume are original and I have the right to have them published under Smartconferu's open-access <span style={{ color: "var(--primary)" }} className="font-semibold cursor-pointer hover:underline">Terms of Service</span>.
                </span>
              </label>
            </div>
          )}

          {sendProblem && <p role="alert" style={{ color: "var(--danger)" }} className="mt-4 text-sm">{sendProblem}</p>}

          <div className="sticky bottom-6 mt-6 z-10">
            <div style={{ background: "#FFFFFF", border: "1px solid var(--border)" }} className="rounded-2xl shadow-lg p-4 flex items-center justify-between gap-4 flex-wrap">
              <p style={{ color: "var(--ink-faint)" }} className="text-xs">Step {step + 1} of {PROPOSAL_STEPS.length} — you can jump between steps any time.</p>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => (step === 0 ? setView("info") : setStep((s) => s - 1))}
                  style={{ border: "1.5px solid var(--border)", color: "var(--ink-muted)" }}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {step === 0 ? "Cancel" : "Back"}
                </button>
                {step < PROPOSAL_STEPS.length - 1 ? (
                  <button onClick={() => setStep((s) => s + 1)} style={{ background: "var(--primary)" }} className="px-6 py-2.5 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={() => void send()}
                    disabled={!form.agreedToTerms || sending}
                    style={{ background: form.agreedToTerms ? "var(--primary)" : "var(--ink-faint)" }}
                    className="px-6 py-2.5 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors disabled:cursor-not-allowed disabled:hover:bg-[var(--ink-faint)] cursor-pointer"
                  >
                    {sending ? "Sending…" : "Submit Proposal"}
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


function SortHeader({ label, sortKey, sortBy, sortDir, onSort }: { label: string; sortKey: "acronym" | "name" | "year"; sortBy: string | null; sortDir: string; onSort: (k: "acronym" | "name" | "year") => void }) {
  const active = sortBy === sortKey;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ color: active ? "var(--navy)" : "var(--ink-muted)" }}
      className="text-left font-semibold text-xs px-5 py-3 cursor-pointer select-none hover:text-[var(--navy)] transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon size={12} style={{ opacity: active ? 1 : 0.4 }} />
      </span>
    </th>
  );
}
