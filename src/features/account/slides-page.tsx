"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Plus, PlusCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getAccountExtrasService } from "@/services/account-extras";
import type { PaperCandidate, Publication } from "@/types/account";
import { PageLoading, PageProblem } from "./page-states";

/* My Slides (the prototype's MySlidesPage): the slide decks made so far, and the person's own papers to start one from. The list is theirs
   (user_publications, migration 0050); a paper counts as added when a deck was made from it. */

export function SlidesPage() {
  const router = useRouter();
  const [data, setData] = useState<{ pubs: Publication[]; candidates: PaperCandidate[] } | null>(null);
  const [problem, setProblem] = useState("");
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    getAccountExtrasService().then(async (svc) => ({ pubs: await svc.publications("slides"), candidates: await svc.myPapers() })).then(
      (r) => { if (alive) { setData(r); setProblem(""); } },
      (e: unknown) => { if (alive) setProblem(e instanceof Error ? e.message : "Something went wrong."); },
    );
    return () => { alive = false; };
  }, [tick]);

  if (problem) return <PageProblem title="My Slides" heading="Couldn't load your slides." message={problem} onRetry={() => { setProblem(""); setTick((t) => t + 1); }} />;
  if (!data) return <PageLoading title="My Slides" label="Loading your slides" />;
  const mySlides = data.pubs;

  const filteredCandidates = data.candidates.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.conferenceAcronym.toLowerCase().includes(q) || c.authors.some((a) => a.name.toLowerCase().includes(q)) || c.title.toLowerCase().includes(q);
  });

  const openPrefilled = (candidate: PaperCandidate) => router.push(`/slides/new?paper=${encodeURIComponent(candidate.id)}`);

  return (
    <div>
      <PageHeader title="My Slides" />
      <div className="p-8">
        <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <p style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed max-w-xl">
            Turn one of your recent submissions into a slide deck, or start a brand new one from scratch — either way, it lands in your list below.
          </p>
          <button
            onClick={() => router.push("/slides/new")}
            style={{ background: "var(--primary)" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors shrink-0 cursor-pointer"
          >
            <PlusCircle size={16} /> Create New
          </button>
        </div>

        {mySlides.length > 0 && (
          <>
            <h2 style={{ color: "var(--navy)" }} className="text-base font-bold mb-4">Your Slides ({mySlides.length})</h2>
            <div className="space-y-3 mb-8">
              {mySlides.map((p) => (
                <div key={p.id} style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div style={{ color: "var(--ink)" }} className="font-semibold text-sm mb-1">{p.title}</div>
                      <div style={{ color: "var(--ink-muted)" }} className="text-xs">
                        {p.authors} · {p.source ? `for ${p.source}` : "created from scratch"}
                      </div>
                    </div>
                    <span style={{ background: "var(--success-soft)", color: "var(--success-ink)" }} className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">Added</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 style={{ color: "var(--navy)" }} className="text-base font-bold">Recent Submissions</h2>
          <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <Search size={15} style={{ color: "var(--ink-faint)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submissions..."
              style={{ color: "var(--ink)" }}
              className="bg-transparent text-sm outline-none w-56 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl overflow-x-auto">
          <table className="ui-table w-full text-sm">
            <thead>
              <tr style={{ background: "var(--canvas)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3">Conference</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3">Authors</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3">Title</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3">Date</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-right font-semibold text-xs px-5 py-3">Add</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((c, i) => {
                const added = mySlides.some((p) => p.paperId === c.id);
                return (
                  <tr
                    key={c.id}
                    style={{ borderBottom: i < filteredCandidates.length - 1 ? "1px solid var(--muted)" : "none" }}
                    className="transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="text-xs font-semibold px-2.5 py-1 rounded-full">{c.conferenceAcronym}</span>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--ink)" }}>{c.authors.map((a) => a.name).join(", ")}</td>
                    <td className="px-5 py-3.5" style={{ color: "var(--ink)" }}><span className="font-semibold">{c.title}</span></td>
                    <td className="px-5 py-3.5" style={{ color: "var(--ink-muted)" }}>{c.date}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => !added && openPrefilled(c)}
                        disabled={added}
                        style={{
                          border: added ? "none" : "1.5px solid var(--border)",
                          color: added ? "var(--success-ink)" : "var(--primary)",
                          background: added ? "var(--success-soft)" : "transparent",
                        }}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors disabled:cursor-default cursor-pointer"
                        aria-label={added ? `${c.title} already added` : `Create slides from ${c.title}`}
                      >
                        {added ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredCandidates.length === 0 && (
            <div className="py-14 text-center">
              <FileText size={28} style={{ color: "var(--border-strong)" }} className="mx-auto mb-2" />
              <p style={{ color: "var(--ink-faint)" }} className="text-sm">No submissions match your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Create Slides (multi-step) ---------------- */