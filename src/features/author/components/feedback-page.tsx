"use client";

import { Angry, CalendarCheck, Check, Clock, Coffee, FileText, Frown, Laugh, MapPin, Meh, Presentation, Smile, Ticket, Users, Video, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { useConferenceFrame } from "@/features/workspace/use-conference-frame";
import { loadMyFeedback, saveMyFeedback, type ConferenceFeedback } from "@/services/feedback";
import type { Conference } from "@/types/conference";

/* Author › Feedback (the prototype's FeedbackPage): deliberately short — one tap on a face is a complete answer; what stood out, a comment and "would you
   come again" appear after that and are optional. The "what stood out" question follows the rating: highlights for a good score, things to fix for a
   poor one. The form opens on the first conference day and stays open until three weeks after the last (archived conferences count as open). The
   answer is kept in the database (`conference_feedback`, migration 0042). */

const SCALE: Array<{ value: number; label: string; icon: LucideIcon; color: string; soft: string }> = [
  { value: 1, label: "Poor", icon: Angry, color: "var(--danger-ink)", soft: "var(--danger-soft)" },
  { value: 2, label: "Fair", icon: Frown, color: "var(--warning-ink)", soft: "var(--warning-soft)" },
  { value: 3, label: "Good", icon: Meh, color: "var(--ink-soft)", soft: "var(--muted)" },
  { value: 4, label: "Very good", icon: Smile, color: "var(--primary)", soft: "var(--primary-soft)" },
  { value: 5, label: "Excellent", icon: Laugh, color: "var(--success-ink)", soft: "var(--success-soft)" },
];
const TOPICS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "talks", label: "Talks & sessions", icon: Presentation },
  { id: "org", label: "Organisation", icon: CalendarCheck },
  { id: "network", label: "Networking", icon: Users },
  { id: "venue", label: "Venue", icon: MapPin },
  { id: "food", label: "Food & breaks", icon: Coffee },
  { id: "online", label: "Online platform", icon: Video },
  { id: "submission", label: "Paper submission", icon: FileText },
  { id: "checkin", label: "Registration & check-in", icon: Ticket },
];
const AGAIN = ["Yes", "Maybe", "No"];
const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;

const toDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const kindFor = (overall: number): "liked" | "improve" => (overall >= 4 ? "liked" : "improve");
function windowOf(c: Conference) {
  const opens = toDate(c.startDate);
  const closes = toDate(c.endDate);
  closes.setDate(closes.getDate() + 21);
  return { opens, closes };
}

export function FeedbackPage({ slug }: { slug: string }) {
  const { state, retry } = useConferenceFrame(slug, "author");
  const [sent, setSent] = useState<ConferenceFeedback | null | undefined>(undefined); // undefined while it loads
  const [problem, setProblem] = useState("");
  useEffect(() => {
    let alive = true;
    loadMyFeedback(slug).then((f) => { if (alive) setSent(f); }, (e: unknown) => { if (alive) { setSent(null); setProblem(e instanceof Error ? e.message : "Something went wrong."); } });
    return () => { alive = false; };
  }, [slug]);
  const gate = workspaceGate(state, retry, { title: "Feedback", loadingLabel: "Loading the feedback form", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you hold no author role in it. Pick one from My Conferences.", errorTitle: "Couldn't load the feedback form." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others } = state;
  return (
    <ConferenceShell role="author" conference={conference} roles={roles} others={others} active="feedback">
      <PageHeader title="Feedback" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: `${conference.acronym} · Feedback` }]} />
      {sent === undefined
        ? <div role="status" aria-label="Loading the feedback form" className="p-8"><div className="h-64 max-w-[720px] animate-pulse rounded-2xl border border-line bg-white" /></div>
        : <Form key={sent?.at ?? "new"} conference={conference} sent={sent} initialProblem={problem} onSent={setSent} />}
    </ConferenceShell>
  );
}

function Form({ conference, sent, initialProblem, onSent }: { conference: Conference; sent: ConferenceFeedback | null; initialProblem: string; onSent: (f: ConferenceFeedback) => void }) {
  const { opens, closes } = windowOf(conference);
  const notOpenYet = new Date() < opens && conference.status !== "archived";
  const [previewing, setPreviewing] = useState(false);
  const [editing, setEditing] = useState(!sent);
  const [overall, setOverall] = useState(sent?.overall ?? 0);
  const [topics, setTopics] = useState<string[]>(sent?.topics ?? []);
  const [comment, setComment] = useState(sent?.comment ?? "");
  const [again, setAgain] = useState<string | null>(sent?.again ?? null);
  const [anonymous, setAnonymous] = useState(sent?.anonymous ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialProblem);

  if (notOpenYet && !previewing) {
    return (
      <div className="p-4 sm:p-8">
        <div style={{ border: "1.5px dashed var(--border-strong)" }} className="max-w-2xl rounded-2xl bg-row-hover p-12 text-center">
          <Clock size={26} aria-hidden="true" className="mx-auto mb-3 text-ink-faint" />
          <h3 className="mb-1 text-base font-extrabold text-navy">Feedback opens on {fmt(opens)}</h3>
          <p className="mb-4 text-sm text-ink-muted">You can tell the organisers how it went from the first conference day until {fmt(closes)}. We&apos;ll remind you.</p>
          <button type="button" onClick={() => setPreviewing(true)} style={{ border: "1px solid var(--border)" }} className="cursor-pointer rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-navy hover:bg-canvas">Preview the form</button>
        </div>
      </div>
    );
  }

  if (sent && !editing) {
    const face = SCALE.find((s) => s.value === sent.overall);
    const FaceIcon = face?.icon;
    return (
      <div className="p-4 sm:p-8">
        <div style={CARD} className="max-w-xl rounded-2xl bg-white p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft"><Check size={24} strokeWidth={2.6} aria-hidden="true" className="text-success-ink" /></div>
          <h3 className="mb-1 text-lg font-extrabold text-navy">Thanks for your feedback</h3>
          <p className="mb-5 text-sm text-ink-muted">Sent {sent.anonymous ? "without your name" : "with your name"} on {fmt(new Date(sent.at))}. You can change it until {fmt(closes)}.</p>
          {face && FaceIcon && (
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
              <span style={{ background: face.soft, color: face.color }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"><FaceIcon size={14} aria-hidden="true" /> {face.label}</span>
              {sent.topics.map((id) => { const t = TOPICS.find((x) => x.id === id); return t && <span key={id} className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-soft">{sent.kind === "liked" ? "Liked" : "Improve"}: {t.label}</span>; })}
            </div>
          )}
          <button type="button" onClick={() => setEditing(true)} style={{ border: "1px solid var(--border)" }} className="cursor-pointer rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-navy hover:bg-canvas">Change my answers</button>
        </div>
      </div>
    );
  }

  const kind = kindFor(overall);
  const chosen = SCALE.find((s) => s.value === overall);
  // Flipping between a good and a poor score flips what the chips mean, so start them fresh.
  const pickOverall = (value: number) => { if (overall && kindFor(value) !== kindFor(overall)) setTopics([]); setOverall(value); };
  const toggleTopic = (id: string) => setTopics((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overall || notOpenYet || busy) return;
    setBusy(true); setError("");
    try {
      const saved = await saveMyFeedback(conference.id, { overall, kind, topics, comment: comment.trim(), again, anonymous });
      onSent(saved);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(err instanceof Error ? err.message : "We couldn't send your feedback."); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-[720px] p-4 pt-5 sm:p-8 sm:pt-5">
      <section style={CARD} className="ui-accent-card overflow-hidden rounded-2xl bg-white">
        <div className="px-7 pb-6 pt-7 text-center">
          <div className="text-[12.5px] font-bold text-primary">{conference.acronym}</div>
          <h2 style={{ letterSpacing: "-0.02em" }} className="mt-1 text-[24px] font-extrabold text-navy">How was {conference.acronym}?</h2>
          <p className="mt-1 text-sm text-ink-muted">One tap is enough. Everything after that is optional.</p>
          {notOpenYet && <p className="mt-2 text-xs font-bold text-warning-ink">Preview: the form opens on {fmt(opens)}; answers can&apos;t be sent before then.</p>}
          <div role="radiogroup" aria-label="Overall rating" className="mt-6 flex justify-center gap-2 sm:gap-3">
            {SCALE.map((s) => {
              const on = overall === s.value;
              const Icon = s.icon;
              return (
                <button key={s.value} type="button" role="radio" aria-checked={on} onClick={() => pickOverall(s.value)}
                  style={on ? { background: s.soft, border: `2px solid ${s.color}`, color: s.color } : { background: "#FFFFFF", border: "1px solid var(--border)", color: "var(--ink-faint)" }}
                  className="flex w-[76px] cursor-pointer flex-col items-center gap-1.5 rounded-2xl py-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-[88px]">
                  <Icon size={30} strokeWidth={on ? 2.2 : 1.6} aria-hidden="true" />
                  <span style={{ color: on ? s.color : "var(--ink-muted)" }} className="text-[11.5px] font-bold">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {overall > 0 && chosen && (
          <div className="flex flex-col gap-6 border-t border-muted bg-canvas px-7 py-6">
            <fieldset>
              <legend className="mb-1 text-sm font-extrabold text-navy">{kind === "liked" ? "What did you enjoy most?" : "What should the organisers improve?"}</legend>
              <p className="mb-3 text-xs text-ink-faint">Tap any that apply.</p>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => {
                  const on = topics.includes(t.id);
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" aria-pressed={on} onClick={() => toggleTopic(t.id)}
                      style={on ? { background: chosen.color, border: `1px solid ${chosen.color}`, color: "#FFFFFF" } : { background: "#FFFFFF", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors">
                      {on ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />} {t.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-navy">Anything else for the organisers? <span className="font-semibold text-ink-faint">(optional)</span></span>
              <textarea rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder={kind === "liked" ? "A highlight, a thank-you, an idea for next year…" : "What went wrong, and what would have helped?"}
                style={{ border: "1px solid var(--border)" }} className="w-full resize-none rounded-xl bg-white p-3 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft" />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-extrabold text-navy">Would you come again?</span>
              <div role="radiogroup" aria-label="Would you come again" style={{ border: "1px solid var(--border)" }} className="inline-flex rounded-full bg-white p-1">
                {AGAIN.map((a) => {
                  const on = again === a;
                  return (
                    <button key={a} type="button" role="radio" aria-checked={on} onClick={() => setAgain(on ? null : a)}
                      style={on ? { background: "var(--primary)", color: "#FFFFFF" } : { color: "var(--ink-soft)" }}
                      className="h-8 cursor-pointer rounded-full px-4 text-[13px] font-bold transition-colors">{a}</button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-muted px-7 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-soft">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--primary)]" /> Send without my name
          </label>
          <div className="flex items-center gap-3">
            {!overall && <span className="text-xs font-semibold text-ink-faint">Pick a face to continue</span>}
            <button type="submit" disabled={notOpenYet || !overall || busy} style={{ background: notOpenYet || !overall ? "var(--border-strong)" : "var(--gradient-primary)" }} className="h-11 cursor-pointer rounded-xl px-6 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed">
              {busy ? "Sending…" : sent ? "Update feedback" : "Send feedback"}
            </button>
          </div>
        </div>
      </section>
      {error && <p role="alert" className="mt-3 text-center text-sm font-semibold text-danger-ink">{error}</p>}
      <p className="mt-3 text-center text-xs text-ink-faint">Open until {fmt(closes)}. You can change your answers until then.</p>
    </form>
  );
}
