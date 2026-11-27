"use client";
/* CFP Page Review › the drawer of one Call for Papers: what was sent (when, the page address, the conference facts the CFP shows), a short
   preview and the full page exactly as authors will see it (a popup with the CFP's own text and theme; the public address is not live until
   it is approved, so it can't be opened in a new tab). The CFP is read through GET /conferences/:id/cfp (a verified Super Admin counts as a chair). */
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { CfpPublicPreview } from "@/features/cfp/components/cfp-public-preview";
import { docOf } from "@/features/cfp/content";
import { themeOf } from "@/features/cfp/themes";
import { get } from "../api";
import type { AdminConference } from "../services";
import { errorText, ExtLink, Fields, fmtDate, Modal, Section } from "./ui";

interface CfpDetail { status: string; content: Record<string, unknown>; theme: Record<string, unknown>; submittedAt?: string | null }
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
// The day as written (a deadline is stored at the end of that day UTC, which a local clock may show as the next day).
const showDate = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export function CfpReviewDetail({ c }: { c: AdminConference }) {
  const [cfp, setCfp] = useState<CfpDetail | null>(null);
  const [error, setError] = useState("");
  const [full, setFull] = useState(false);
  useEffect(() => {
    let alive = true;
    get<CfpDetail>(`/conferences/${c.id}/cfp`).then((d) => { if (alive) setCfp(d); }, (e: unknown) => { if (alive) setError(errorText(e)); });
    return () => { alive = false; };
  }, [c.id]);

  const d = c.details ?? {};
  const topics = list(d.topics);
  const page = str(cfp?.content.publicSlug);
  const theme = themeOf(str(cfp?.theme.id) || "classic");
  const html = docOf(str(cfp?.content.doc), { about: c.about ?? "", topics, venue: c.venue ?? "", city: c.city ?? "", country: c.country ?? "", contactEmail: c.contactEmail ?? "" }, c.acronym);
  const preview = { acronym: c.acronym, name: c.title, venue: c.venue ?? "", country: c.country ?? "", deadline: showDate(c.submissionDeadline), webPage: c.webPage ?? "", html, accent: theme.accent };
  const where = [c.venue, c.city, c.country].filter(Boolean).join(", ");

  return (
    <>
      <Section title="Request">
        <Fields
          rows={[
            ["Sent for approval", cfp?.submittedAt ? fmtDate(cfp.submittedAt) : cfp ? "—" : "…"],
            ["CFP page", page ? `smartconferu.com/cfp/${page}` : cfp ? "Not chosen" : "…"],
            ["Chair", c.requester ? `${c.requester.name}${c.requester.email ? ` · ${c.requester.email}` : ""}` : "—"],
            ["Organization", c.requester?.affiliation || "—"],
          ]}
        />
      </Section>

      <Section title="Preview">
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          <div className="px-5 py-4 text-white" style={{ background: theme.accent }}>
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Call for papers</p>
            <p className="text-[16px] font-bold mt-1">{c.title}</p>
            <p className="text-[12.5px] opacity-85 mt-0.5">Submission deadline · {fmtDate(c.submissionDeadline)}</p>
          </div>
          <div className="p-5 text-[13.5px]" style={{ color: "var(--text-soft)" }}>
            <p className="line-clamp-4">{c.about || "No description yet."}</p>
            <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>{topics.length} topic{topics.length === 1 ? "" : "s"} listed · {theme.label} theme</p>
          </div>
        </div>
        {error ? (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger-ink)" }}>Couldn&apos;t load the full page: {error}</p>
        ) : (
          <button type="button" disabled={!cfp} onClick={() => setFull(true)} className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-semibold cursor-pointer disabled:cursor-wait disabled:opacity-50" style={{ color: "var(--primary)" }}>
            <Eye size={14} /> {cfp ? "Open full preview" : "Loading the page…"}
          </button>
        )}
      </Section>

      <Section title="What the CFP shows">
        <Fields
          rows={[
            ["Conference dates", c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : "—"],
            ["Format", c.mode ? c.mode.replace("_", "-").replace(/^./, (m) => m.toUpperCase()) : "—"],
            ["Venue", where || "—"],
            ["Website", c.webPage ? <ExtLink key="w" href={c.webPage} /> : "—"],
            ["Abstract deadline", str(d.abstractDeadline) ? fmtDate(str(d.abstractDeadline)) : "—"],
            ["Submission deadline", fmtDate(c.submissionDeadline) || "—"],
            ["Research area", [c.primaryArea, c.secondaryArea].filter(Boolean).join(" › ") || "—"],
            ["Language", str(d.language) || "—"],
            ["Contact email", c.contactEmail || "—"],
          ]}
        />
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {topics.map((t) => (
              <span key={t} className="rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{t}</span>
            ))}
          </div>
        )}
      </Section>

      {full && cfp && (
        <Modal wide title={`Call for Papers — ${c.acronym}`} subtitle={page ? `smartconferu.com/cfp/${page} · not live until approved` : "Not live until approved"} onClose={() => setFull(false)}>
          <CfpPublicPreview {...preview} submissionLink="" heading="Exactly as authors will see it" />
        </Modal>
      )}
    </>
  );
}
