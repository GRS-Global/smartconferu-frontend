"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Download, QrCode, Search, Share2, ShieldCheck, X } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { Conference } from "@/types/conference";
import type { MyCertificate } from "@/services/certificates";
import { CertCard, EmptyState, Pill, CertModal } from "../components";
import { CertificateArtwork } from "../certificate-artwork";
import { PrintCertificate } from "../print-certificate";
import { recordCertificateEvent } from "../record-event";
import { getCertificateType, verifyUrl, verifyPath, type CertTypeKey, type Design } from "../data";

type PageConference = { id: string; acronym: string; name: string; startDate?: string; endDate?: string; city?: string; country?: string; contactEmail?: string; status: string };

/* ---------------------------------------------------------------------------
   The recipient's own copy. The reference tool ends at the email, which makes the
   inbox the system of record — so a bounce, a deleted message or a changed job
   loses the certificate. Here the email is a notification and this page is the
   record: it survives all three.

   One person often holds several certificates — from different conferences, and
   several from the same one (presented + accepted author + attended). So the page
   leads with a count per certificate type, filters by type and year, and groups
   the cards by conference so everything from one event sits together.
   --------------------------------------------------------------------------- */

// The five types in the order the client lists them.
const TYPE_ORDER: CertTypeKey[] = ["appreciation", "participation", "publication", "presentation", "author"];

// The year a person thinks of a conference by: the one in its name ("ISBM 2026"), else its dates.
function conferenceYear(conference: { acronym?: string; endDate?: string } | undefined, issuedAt: number): string {
  const fromName = (conference?.acronym || "").match(/\b(19|20)\d{2}\b/)?.[0];
  if (fromName) return fromName;
  if (conference?.endDate) return conference.endDate.slice(0, 4);
  return String(new Date(issuedAt).getFullYear());
}
const issuedLabel = (ts: number) => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const datesLabel = (c: { startDate?: string; endDate?: string } | undefined) => {
  if (!c?.startDate) return "";
  const f = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return c.endDate && c.endDate !== c.startDate ? `${f(c.startDate)} – ${f(c.endDate)}` : f(c.startDate);
};

/* Also the author's per-conference "Certificates" menu: pass `conference` (and the app's TopBar)
   and the page shows only that conference's certificates, with a plain-words "why not yet". */
/* Inside a conference the page is per role (`role`): an author sees only certificates for their
   papers and attendance, a reviewer only the Certificate of Appreciation for reviewing — one
   role's information never shows in another role's view. */
type Mine = {
  conferenceId: string;
  cert: { typeKey: CertTypeKey; design: Design };
  recipient: { name: string; affiliation: string; roleLabel: string; paperId: string; paperTitle: string; serial: string; issuedAt: number };
  conference: PageConference;
  type: ReturnType<typeof getCertificateType>;
  year: string;
};
const ROLE_CERTIFICATE: Record<string, (m: Mine) => boolean> = {
  author: (m) => ["presentation", "author", "publication", "participation"].includes(m.cert.typeKey),
  reviewer: (m) => m.cert.typeKey === "appreciation" && /review/i.test(m.recipient.roleLabel || ""),
};
const ROLE_EMPTY: Record<string, string> = {
  author: "Present your registered paper and your Certificate of Presentation arrives here and by email once the organisers send it.",
  reviewer: "Reviewers get a Certificate of Appreciation for each paper they review. Send a review and its certificate arrives here and by email.",
};

export function MyCertificatesBody({ certs, scope, role }: { certs: MyCertificate[]; scope?: Conference; role?: "author" | "reviewer" }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Pick<Mine, "cert" | "recipient" | "conference"> | null>(null);
  const [printing, setPrinting] = useState<Pick<Mine, "cert" | "recipient" | "conference"> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [query, setQuery] = useState("");
  const setPage = (_page: "certificate-verify", ctx: { serial: string }) => router.push(verifyPath(ctx.serial));

  // The certificates issued to this person (the database matches them by email), as the prototype's page reads them.
  const mine: Mine[] = certs.map((c) => ({
    conferenceId: c.conference.id,
    cert: { typeKey: c.typeKey, design: c.design },
    recipient: { name: c.name, affiliation: c.affiliation, roleLabel: c.roleLabel, paperId: c.paperId, paperTitle: c.paperTitle, serial: c.serial, issuedAt: new Date(c.issuedAt).getTime() },
    conference: { ...c.conference, startDate: c.conference.startDate ?? undefined, endDate: c.conference.endDate ?? undefined, city: c.conference.city ?? undefined, country: c.conference.country ?? undefined, contactEmail: c.conference.contactEmail ?? undefined },
    type: getCertificateType(c.typeKey),
    year: conferenceYear({ acronym: c.conference.acronym, endDate: c.conference.endDate ?? undefined }, new Date(c.issuedAt).getTime()),
  })).filter((m) => !scope || (m.conferenceId === scope.id && (!role || !ROLE_CERTIFICATE[role] || ROLE_CERTIFICATE[role](m))));

  const q = query.trim().toLowerCase();
  const matchesText = (m: Mine) => !q || [m.conference?.acronym, m.conference?.name, m.recipient.paperTitle, m.recipient.serial].some((v) => (v || "").toLowerCase().includes(q));
  const byYear = mine.filter((m) => (yearFilter === "all" || m.year === yearFilter) && matchesText(m));
  const shown = byYear.filter((m) => typeFilter === "all" || m.cert.typeKey === typeFilter);

  const years = Array.from(new Set(mine.map((m) => m.year))).sort((a, b) => b.localeCompare(a));
  const typeCount = (key: string) => byYear.filter((m) => m.cert.typeKey === key).length;
  const conferenceCount = new Set(mine.map((m) => m.conferenceId)).size;

  // Group what's shown by conference, newest conference first; inside a group, in type order.
  const groups = Object.values(shown.reduce((acc, m) => {
    (acc[m.conferenceId] ||= { conference: m.conference, conferenceId: m.conferenceId, year: m.year, items: [] }).items.push(m);
    return acc;
  }, {} as Record<string, { conference: PageConference; conferenceId: string; year: string; items: Mine[] }>))
    .map((g) => ({ ...g, items: g.items.sort((a, b) => TYPE_ORDER.indexOf(a.cert.typeKey) - TYPE_ORDER.indexOf(b.cert.typeKey)) }))
    .sort((a, b) => `${b.year}|${b.conference?.endDate || ""}`.localeCompare(`${a.year}|${a.conference?.endDate || ""}`));

  const filtersOn = typeFilter !== "all" || yearFilter !== "all" || q;
  const clearFilters = () => { setTypeFilter("all"); setYearFilter("all"); setQuery(""); };

  const copyVerifyLink = (serial: string) => {
    const url = verifyUrl(serial);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {});
    setCopied(serial);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div>
      <div className="px-4 sm:px-8 pt-8 pb-0">
        {/* Inside a conference the TopBar already says "Certificates"; only the summary line follows. */}
        {!scope && <h1 style={{ color: "var(--navy)", letterSpacing: "-0.02em" }} className="text-[28px] leading-tight font-extrabold">My certificates</h1>}
        <p style={{ color: "var(--ink-muted)" }} className="text-sm mt-1">
          {scope ? (mine.length > 0
            ? `${mine.length} certificate${mine.length === 1 ? "" : "s"} from this conference. Download or share any of them, any time.`
            : scope.status === "archived" ? "The organisers haven't sent certificates for this conference yet." : `Certificates are issued after the conference ends on ${datesLabel({ startDate: scope.endDate })}.`)
          : mine.length > 0
            ? `${mine.length} certificate${mine.length === 1 ? "" : "s"} from ${conferenceCount} conference${conferenceCount === 1 ? "" : "s"}, kept here for good. Download any of them, any time.`
            : "Everything you have earned across conferences, kept here for good — download any of them, any time."}
        </p>
      </div>

      <div className="p-4 sm:p-8 flex flex-col gap-5">
        {mine.length === 0 ? (
          <EmptyState icon={Award} title="No certificates yet">
            {scope
              ? (role && ROLE_EMPTY[role]) || ROLE_EMPTY.author
              : "When a conference you took part in issues certificates, yours arrives by email and lands here at the same time — so it is still yours if the email never shows up."}
          </EmptyState>
        ) : (
          <>
            {/* Count per certificate type — also the type filter */}
            <div role="radiogroup" aria-label="Certificate type" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[{ key: "all", label: "All certificates", count: byYear.length }, ...TYPE_ORDER.filter((k) => !role || mine.some((m) => m.cert.typeKey === k)).map((k) => ({ key: k, label: getCertificateType(k).label, count: typeCount(k) }))].map((t) => {
                const on = typeFilter === t.key;
                const empty = t.count === 0 && t.key !== "all";
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={empty && !on}
                    onClick={() => setTypeFilter(t.key)}
                    style={{ background: on ? "var(--primary-soft)" : "#FFFFFF", border: on ? "2px solid var(--primary)" : "1px solid var(--border)", padding: on ? "11px 13px" : "12px 14px", opacity: empty && !on ? 0.55 : 1 }}
                    className="text-left rounded-xl flex flex-col gap-1 transition-colors enabled:hover:border-[var(--primary)] disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span style={{ color: on ? "var(--primary)" : "var(--navy)", letterSpacing: "-0.02em" }} className="text-2xl font-extrabold leading-none"><AnimatedNumber value={t.count} /></span>
                    <span style={{ color: on ? "var(--primary-hover)" : "var(--ink-soft)" }} className="text-xs font-semibold leading-snug">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Year + search */}
            {!scope && <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: "var(--ink-muted)" }} className="text-[13px] font-semibold">Year</span>
                <div role="radiogroup" aria-label="Year" className="flex gap-1.5 flex-wrap">
                  {["all", ...years].map((y) => {
                    const on = yearFilter === y;
                    const count = y === "all" ? mine.filter(matchesText).length : mine.filter((m) => m.year === y && matchesText(m)).length;
                    return (
                      <button key={y} type="button" role="radio" aria-checked={on} onClick={() => setYearFilter(y)} style={on ? { background: "var(--navy)", color: "#FFFFFF", border: "1px solid var(--navy)" } : { background: "#FFFFFF", color: "var(--ink-soft)", border: "1px solid var(--border)" }} className="px-3.5 py-1.5 rounded-full text-[13px] font-bold cursor-pointer">
                        {y === "all" ? "All years" : y} <span style={{ opacity: 0.7 }} className="font-semibold">{count}</span>
                      </button>
                    );
                  })}
                </div>
                {filtersOn && (
                  <button type="button" onClick={clearFilters} style={{ color: "var(--primary)" }} className="text-[13px] font-bold inline-flex items-center gap-1 ml-1 hover:underline cursor-pointer"><X size={13} /> Clear filters</button>
                )}
              </div>
              <label style={{ background: "#FFFFFF", border: "1px solid var(--border)" }} className="flex items-center gap-2 px-3 h-10 rounded-lg w-72 max-w-full">
                <Search size={15} style={{ color: "var(--ink-faint)" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conference, paper or ID…" style={{ color: "var(--ink)" }} className="bg-transparent text-[13px] outline-none flex-1 placeholder:text-slate-400" />
              </label>
            </div>}

            {/* Grouped by conference */}
            {groups.length === 0 ? (
              <EmptyState icon={Award} title="No certificates match these filters" action={<button type="button" onClick={clearFilters} style={{ background: "var(--primary)" }} className="px-4 py-2 rounded-lg text-white text-sm font-bold cursor-pointer">Clear filters</button>} />
            ) : groups.map((g) => (
              <section key={g.conferenceId} aria-label={g.conference?.acronym} className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 style={{ color: "var(--navy)" }} className="text-lg font-extrabold tracking-tight">{g.conference?.acronym}</h2>
                      <span style={{ color: "var(--primary)", background: "var(--primary-soft)" }} className="text-xs font-bold px-2 py-0.5 rounded-full">{g.items.length} certificate{g.items.length === 1 ? "" : "s"}</span>
                    </div>
                    <p style={{ color: "var(--ink-muted)" }} className="text-[13px]">{[g.conference?.name, datesLabel(g.conference)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {g.items.map((m) => <Pill key={m.recipient.serial} tone={m.type.tone}>{m.type.short}</Pill>)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {g.items.map(({ cert, recipient, conference, type }) => (
                    <CertCard key={recipient.serial} padded={false} className="overflow-hidden flex flex-col">
                      <button
                        onClick={() => { setPreview({ cert, recipient, conference }); void recordCertificateEvent(recipient.serial, "opened"); }}
                        style={{ background: "#E9EDF3" }}
                        className="p-4 flex justify-center hover:opacity-90 transition-opacity cursor-pointer"
                        aria-label={`Open ${type.label} from ${conference?.acronym}`}
                      >
                        <CertificateArtwork design={cert.design} recipient={recipient} conference={conference} width={300} />
                      </button>

                      <div className="p-4 flex flex-col gap-3 flex-1">
                        <div>
                          <Pill tone={type.tone}>{type.label}</Pill>
                          {recipient.paperTitle && <p style={{ color: "var(--navy)" }} className="text-[13px] font-semibold mt-2 leading-snug">{recipient.paperTitle}</p>}
                          {!recipient.paperTitle && recipient.roleLabel && <p style={{ color: "var(--navy)" }} className="text-[13px] font-semibold mt-2">{recipient.roleLabel}</p>}
                          <p style={{ color: "var(--ink-muted)" }} className="text-[11.5px] mt-1">
                            Issued {issuedLabel(recipient.issuedAt)} · {recipient.serial}
                          </p>
                        </div>

                        <div className="flex gap-2 mt-auto">
                          <button onClick={() => { setPreview({ cert, recipient, conference }); void recordCertificateEvent(recipient.serial, "opened"); }} style={{ background: "var(--primary)" }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-white text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                            <Download size={13} /> Download PDF
                          </button>
                          <button
                            onClick={() => setPage("certificate-verify", { serial: recipient.serial })}
                            aria-label={`Open the verify page for ${recipient.serial}`}
                            title="Open the verify page"
                            style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--canvas)] transition-colors cursor-pointer"
                          >
                            <QrCode size={14} />
                          </button>
                          <button
                            onClick={() => copyVerifyLink(recipient.serial)}
                            aria-label={`Copy the verify link for ${recipient.serial}`}
                            title="Copy the verify link"
                            style={{ border: "1px solid var(--border)", color: copied === recipient.serial ? "var(--success)" : "var(--ink-muted)" }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--canvas)] transition-colors cursor-pointer"
                          >
                            <Share2 size={14} />
                          </button>
                        </div>
                        {copied === recipient.serial && (
                          <span style={{ color: "var(--success)" }} className="text-[11px] font-semibold -mt-1">Verify link copied.</span>
                        )}
                      </div>
                    </CertCard>
                  ))}
                </div>
              </section>
            ))}

            <div className="ui-banner rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap">
              <ShieldCheck size={20} style={{ color: "var(--primary-hover)" }} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div style={{ color: "var(--navy)" }} className="text-[13px] font-bold">Every one of these can be checked by someone else</div>
                <p style={{ color: "var(--ink-soft)" }} className="text-xs mt-1 leading-relaxed">
                  Send an employer or university the verify link and they see the certificate confirmed against the conference&apos;s own record — no PDF to doubt, nothing for you to prove.
                </p>
              </div>
              <button
                onClick={() => setPage("certificate-verify", { serial: mine[0].recipient.serial })}
                style={{ border: "1px solid var(--banner-border)", color: "var(--primary-hover)" }}
                className="px-4 py-2.5 rounded-lg text-xs font-bold bg-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                See what they see
              </button>
            </div>
          </>
        )}
      </div>

      {printing && <PrintCertificate item={printing} onDone={() => setPrinting(null)} />}

      {preview && (
        <CertModal
          title={`${getCertificateType(preview.cert.typeKey).label}`}
          subtitle={`${preview.conference?.name} · ${preview.recipient.serial}`}
          onClose={() => setPreview(null)}
          maxWidth="max-w-3xl"
          footer={
            <>
              <span style={{ color: "var(--ink-muted)" }} className="text-xs flex-1">This is the PDF exactly as it was issued.</span>
              <button type="button" onClick={() => { setPrinting(preview); void recordCertificateEvent(preview.recipient.serial, "downloaded"); }} style={{ background: "var(--primary)" }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                <Download size={15} /> Download
              </button>
            </>
          }
        >
          <div className="flex justify-center">
            <CertificateArtwork design={preview.cert.design} recipient={preview.recipient} conference={preview.conference} width={640} />
          </div>
        </CertModal>
      )}
    </div>
  );
}
