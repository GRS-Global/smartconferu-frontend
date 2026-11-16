/* eslint-disable @next/next/no-img-element -- the QR code is a data URL */
"use client";

import { useState } from "react";
import { Check, Download, Link2, Lock, Mail, Share2, Printer, QrCode } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import type { Conference } from "@/types/conference";
import { FlyerArtwork, type FlyerData } from "../flyer-artwork";
import { useQrDataUrl } from "../use-qr-data-url";
import { FLYER_FORMATS, paperUrlFor, hashtagFor, type FlyerDesign } from "../data";
import { renderFlyerPng, downloadDataUrl } from "../export";

const initialsOf = (name: string) => String(name || "").split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

// "17–19 Feb 2027": the conference's dates as a range (the prototype's formatRange).
function formatRange(conf: { startDate: string; endDate: string }): string {
  const toDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const s = toDate(conf.startDate);
  const e = toDate(conf.endDate);
  const mon = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${mon(e)} ${e.getFullYear()}`;
  if (s.getFullYear() === e.getFullYear()) return `${s.getDate()} ${mon(s)} – ${e.getDate()} ${mon(e)} ${e.getFullYear()}`;
  return `${s.getDate()} ${mon(s)} ${s.getFullYear()} – ${e.getDate()} ${mon(e)} ${e.getFullYear()}`;
}

/* Author · My flyer — the speaker flyer the chair designed, filled in for this author. It unlocks
   per paper once the chair's rule is met (registered, or accepted) and can be downloaded as a real
   PNG in three social sizes, printed, or shared straight to the usual apps with a ready caption. */

interface ShareTarget { key: string; label: string; dot: string; needsImage?: boolean; href: (u: string, t: string) => string }
const SHARE_TARGETS: ShareTarget[] = [
  { key: "linkedin", label: "LinkedIn", dot: "#0A66C2", href: (u, t) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}&summary=${encodeURIComponent(t)}` },
  { key: "x", label: "X", dot: "#0F1419", href: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}` },
  { key: "facebook", label: "Facebook", dot: "#1877F2", href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: "instagram", label: "Instagram", dot: "#C13584", needsImage: true, href: () => "https://www.instagram.com/" },
  { key: "whatsapp", label: "WhatsApp", dot: "#25D366", href: (u, t) => `https://wa.me/?text=${encodeURIComponent(t)}` },
  { key: "telegram", label: "Telegram", dot: "#229ED9", href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: "threads", label: "Threads", dot: "#334155", href: (u, t) => `https://www.threads.net/intent/post?text=${encodeURIComponent(t)}` },
  { key: "bluesky", label: "Bluesky", dot: "#1185FE", href: (u, t) => `https://bsky.app/intent/compose?text=${encodeURIComponent(t)}` },
];

const card = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" };
const toTag = (s: string) => `#${String(s).replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("")}`;

export interface FlyerAuthorPaper { sub: { id: string; title: string; keywords: string[] }; result: "registered" | "not_registered"; schedule: null }
export interface FlyerAuthor { firstName: string; lastName: string; affiliation: string; photoUrl: string | null }

export function FlyerAuthorBody({ conference, webPage, design, papers, author, hasOtherPapers, onDownloaded, onRegister, onEditProfile }: {
  conference: Conference; webPage: string; design: FlyerDesign | null; papers: FlyerAuthorPaper[]; author: FlyerAuthor;
  /** The author has accepted papers that are not registered yet (the "Register to get your flyer" message). */
  hasOtherPapers: boolean;
  onDownloaded: () => void; onRegister: () => void; onEditProfile: () => void;
}) {
  const eligible = design ? papers.filter((p) => {
    const ok = design.audience === "accepted" ? ["registered", "not_registered"].includes(p.result) : p.result === "registered";
    return ok && (!design.waitForSlot || p.schedule);
  }) : [];
  const locked = design ? papers.filter((p) => ["registered", "not_registered"].includes(p.result) && !eligible.includes(p)) : [];

  const [selectedId, setSelectedId] = useState<string | null>(eligible[0]?.sub.id || null);
  const [fmtKey, setFmtKey] = useState("portrait");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const current = eligible.find((p) => p.sub.id === selectedId) || eligible[0];
  const format = FLYER_FORMATS.find((f) => f.key === fmtKey) ?? FLYER_FORMATS[0];

  const url = current ? paperUrlFor({ webPage }, current.sub.id) : "";
  const qrDataUrl = useQrDataUrl(url);
  const authorName = `${author.firstName || ""} ${author.lastName || ""}`.trim() || "Your name";
  const where = [conference.city, conference.country].filter(Boolean).join(", ");
  const data: FlyerData | null = current ? {
    acronym: conference.acronym,
    conferenceName: conference.name,
    authorName,
    initials: initialsOf(authorName),
    affiliation: author.affiliation || "",
    photoUrl: author.photoUrl || null,
    paperTitle: current.sub.title,
    slotText: formatRange(conference),
    roomText: where,
    url,
    hashtag: hashtagFor(conference),
  } : null;

  const suggestedTags = [hashtagFor(conference), ...(current?.sub.keywords || []).slice(0, 3).map(toTag)];
  const [tags, setTags] = useState<string[]>(() => suggestedTags.slice(0, 2));
  const [newTag, setNewTag] = useState("");
  const defaultCaption = current
    ? `Excited to present "${current.sub.title}" at ${conference.acronym}${conference.city ? ` in ${conference.city}` : ""}. Join me on ${data?.slotText ?? ""}${data?.roomText ? `, ${data.roomText}` : ""}. Read the paper: ${url}`
    : "";
  const [captionEdits, setCaptionEdits] = useState<Record<string, string>>({});
  const caption = current ? (captionEdits[current.sub.id] ?? defaultCaption) : "";
  const fullCaption = [caption, tags.join(" ")].filter(Boolean).join("\n\n");

  const fileBase = `${conference.acronym.replace(/\s+/g, "-")}-${current?.sub.id || "flyer"}-${fmtKey}`;
  const makePng = async () => { if (!design || !data) throw new Error("No flyer."); return renderFlyerPng({ design, data, format, qrDataUrl }); };

  const flash = (key: string) => { setCopied(key); setTimeout(() => setCopied(null), 1600); };
  const copyText = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked: nothing else to do */ }
    flash(key);
  };

  const downloadPng = async () => {
    setBusy("png");
    try { downloadDataUrl(await makePng(), `${fileBase}.png`); onDownloaded(); } finally { setBusy(null); }
  };
  const printPdf = async () => {
    setBusy("pdf");
    try {
      const png = await makePng();
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<title>${fileBase}</title><style>@page{margin:0}body{margin:0;display:flex;justify-content:center}img{max-width:100%;max-height:100vh}</style><img src="${png}" onload="setTimeout(()=>print(),200)">`);
        w.document.close();
      }
    } finally { setBusy(null); }
  };
  const downloadQr = () => { if (qrDataUrl) downloadDataUrl(qrDataUrl, `${fileBase}-qr.png`); };
  const share = async (target: ShareTarget) => {
    if (target.needsImage) await downloadPng();
    window.open(target.href(url, fullCaption), "_blank", "noopener,noreferrer");
  };
  const nativeShare = async () => {
    try {
      const blob = await (await fetch(await makePng())).blob();
      const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: fullCaption });
      else if (navigator.share) await navigator.share({ text: fullCaption, url });
      else await copyText(fullCaption, "caption");
    } catch { /* share sheet dismissed */ }
  };

  const header = (
    <PageHeader
      title="My speaker flyer"
      breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: `${conference.acronym} · My flyer` }]}
      actions={current && (
        <span style={{ color: "#15803D", background: "var(--success-soft)" }} className="inline-flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-1.5 rounded-full shrink-0">
          <Check size={14} strokeWidth={2.6} /> {current.result === "registered" ? "Registered" : "Accepted"}{current.schedule ? " · slot booked" : ""}
        </span>
      )}
    />
  );

  if (!design || !data || !current) {
    const reason = !design
      ? { title: "Your flyer isn't ready yet", body: "The organisers haven't published the speaker flyer for this conference. We'll let you know when it's ready." }
      : hasOtherPapers
        ? { title: "Register to get your flyer", body: "Your flyer is made for you once you've registered for your accepted paper.", cta: true }
        : { title: "No flyer yet", body: "Flyers are for presenters of accepted papers. Yours will appear here once a paper is accepted and registered." };
    return (
      <div>
        {header}
        <div className="p-8">
          <div style={{ border: "1.5px dashed var(--border-strong)", background: "var(--row-hover)" }} className="rounded-2xl p-12 text-center max-w-2xl">
            <Lock size={26} style={{ color: "var(--ink-faint)" }} className="mx-auto mb-3" />
            <h3 style={{ color: "var(--navy)" }} className="text-base font-extrabold mb-1">{reason.title}</h3>
            <p style={{ color: "var(--ink-muted)" }} className="text-sm mb-4">{reason.body}</p>
            {reason.cta && (
              <button type="button" onClick={onRegister} style={{ background: "var(--primary)" }} className="text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-[var(--primary-hover)] cursor-pointer">Register now</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <p style={{ color: "var(--ink-muted)" }} className="px-8 mt-1 text-sm">Ready to share. Anyone who scans the QR code lands on your paper page.</p>
      <div className="p-8 pt-5 flex gap-7 items-start flex-col xl:flex-row">
        {/* Preview */}
        <section aria-label="Flyer preview" style={{ background: "#E9EDF3" }} className="w-full xl:w-[560px] shrink-0 rounded-2xl p-8 flex flex-col items-center gap-3.5 xl:sticky xl:top-24">
          <FlyerArtwork design={design} data={data} format={format} width={format.preview.w} qrDataUrl={qrDataUrl} />
          <div style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold">{format.caption}</div>
        </section>

        <div className="flex-1 min-w-0 flex flex-col gap-4 w-full">
          {eligible.length > 1 && (
            <section style={card} className="bg-white rounded-2xl p-5">
              <h2 style={{ color: "var(--navy)" }} className="text-[15px] font-extrabold mb-3">Paper</h2>
              <div className="flex flex-col gap-2">
                {eligible.map((p) => (
                  <label key={p.sub.id} style={{ border: p.sub.id === current.sub.id ? "2px solid var(--primary)" : "1px solid var(--border)", background: p.sub.id === current.sub.id ? "var(--primary-soft)" : "#FFFFFF" }} className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer">
                    <input type="radio" name="flyer-paper" checked={p.sub.id === current.sub.id} onChange={() => setSelectedId(p.sub.id)} className="accent-[var(--primary)] cursor-pointer" />
                    <span style={{ color: "var(--ink)" }} className="text-[13.5px] font-semibold">{p.sub.title}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          <section style={card} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <h2 style={{ color: "var(--navy)" }} className="text-[15px] font-extrabold">Size</h2>
            <div role="radiogroup" aria-label="Flyer size" className="grid grid-cols-3 gap-2">
              {FLYER_FORMATS.map((f) => {
                const on = f.key === fmtKey;
                return (
                  <button key={f.key} type="button" role="radio" aria-checked={on} onClick={() => setFmtKey(f.key)} style={{ border: on ? "2px solid var(--primary)" : "1px solid var(--border)", background: on ? "var(--primary-soft)" : "#FFFFFF", color: on ? "var(--primary-hover)" : "var(--ink)" }} className="text-left rounded-xl px-3 py-2.5 text-[13px] font-bold cursor-pointer">
                    {f.label}
                    <div style={{ color: "var(--ink-muted)" }} className="text-[11.5px] font-medium">{f.hint}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={downloadPng} disabled={busy === "png"} style={{ background: "var(--primary)" }} className="flex-1 min-w-[180px] h-11 rounded-xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-[var(--primary-hover)] disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed">
                <Download size={16} /> {busy === "png" ? "Preparing…" : "Download PNG"}
              </button>
              <button type="button" onClick={printPdf} disabled={busy === "pdf"} style={{ border: "1px solid var(--border)", color: "var(--navy)" }} className="h-11 px-4 rounded-xl bg-white text-sm font-bold inline-flex items-center gap-2 hover:bg-[var(--canvas)] cursor-pointer disabled:cursor-not-allowed"><Printer size={15} /> PDF (print)</button>
              <button type="button" onClick={downloadQr} style={{ border: "1px solid var(--border)", color: "var(--navy)" }} className="h-11 px-4 rounded-xl bg-white text-sm font-bold inline-flex items-center gap-2 hover:bg-[var(--canvas)] cursor-pointer"><QrCode size={15} /> QR code only</button>
            </div>
          </section>

          <section style={card} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 style={{ color: "var(--navy)" }} className="text-[15px] font-extrabold">Share on</h2>
              <span style={{ color: "var(--ink-muted)" }} className="text-xs">Opens the app with your caption ready</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SHARE_TARGETS.map((t) => (
                <button key={t.key} type="button" onClick={() => share(t)} style={{ border: "1px solid var(--border)", color: "var(--navy)" }} className="h-11 px-3 rounded-xl bg-white text-[13px] font-bold inline-flex items-center gap-2.5 hover:bg-[var(--canvas)] cursor-pointer">
                  <span style={{ background: t.dot }} className="w-2.5 h-2.5 rounded-full shrink-0" /> {t.label}
                </button>
              ))}
              <a href={`mailto:?subject=${encodeURIComponent(`I'm presenting at ${conference.acronym}`)}&body=${encodeURIComponent(fullCaption)}`} style={{ border: "1px solid var(--border)", color: "var(--navy)" }} className="h-11 px-3 rounded-xl bg-white text-[13px] font-bold inline-flex items-center gap-2.5 hover:bg-[var(--canvas)]">
                <Mail size={15} /> Email
              </a>
              <button type="button" onClick={() => copyText(url, "link")} style={{ border: "1px solid var(--border)", color: "var(--navy)" }} className="h-11 px-3 rounded-xl bg-white text-[13px] font-bold inline-flex items-center gap-2.5 hover:bg-[var(--canvas)] cursor-pointer">
                <Link2 size={15} /> {copied === "link" ? "Copied" : "Copy link"}
              </button>
              <button type="button" onClick={nativeShare} style={{ border: "1px solid var(--primary-soft-border)", background: "var(--primary-soft)", color: "var(--primary-hover)" }} className="col-span-2 h-11 px-3 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-2.5 cursor-pointer">
                <Share2 size={15} /> More apps (phone share)
              </button>
            </div>
            <div style={{ color: "var(--ink-muted)" }} className="text-xs">Instagram and WhatsApp Status need the image: we download it first, then open the app.</div>
          </section>

          <section style={card} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 style={{ color: "var(--navy)" }} className="text-[15px] font-extrabold">Caption</h2>
              <button type="button" onClick={() => copyText(fullCaption, "caption")} style={{ border: "1px solid var(--border)", color: "var(--navy)" }} className="h-9 px-3 rounded-lg bg-white text-[12.5px] font-bold hover:bg-[var(--canvas)] cursor-pointer">{copied === "caption" ? "Copied" : "Copy caption"}</button>
            </div>
            <label className="flex flex-col gap-1.5">
              <span style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold">Edit before sharing</span>
              <textarea rows={4} value={caption} onChange={(e) => setCaptionEdits((c) => ({ ...c, [current.sub.id]: e.target.value }))} style={{ border: "1px solid var(--border)", color: "var(--navy)" }} className="text-[13.5px] leading-relaxed rounded-xl p-3 resize-none outline-none focus:border-[var(--primary)]" />
            </label>
            <div className="flex gap-1.5 flex-wrap items-center">
              {Array.from(new Set([...suggestedTags, ...tags])).map((t) => {
                const on = tags.includes(t);
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => setTags((list) => (on ? list.filter((x) => x !== t) : [...list, t]))} style={on ? { border: "1px solid var(--primary-soft-border)", background: "var(--primary-soft)", color: "var(--primary-hover)" } : { border: "1px dashed var(--border-strong)", background: "#FFFFFF", color: "var(--ink-soft)" }} className="rounded-full px-3 py-1 text-xs font-bold cursor-pointer">
                    {t}
                  </button>
                );
              })}
              <form onSubmit={(e) => { e.preventDefault(); const t = newTag.trim(); if (t) { setTags((l) => [...l, t.startsWith("#") ? t : toTag(t)]); setNewTag(""); } }} className="inline-flex">
                <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="+ Add tag" aria-label="Add a hashtag" style={{ border: "1px dashed var(--border-strong)", color: "var(--ink)" }} className="rounded-full px-3 py-1 text-xs font-bold w-28 outline-none focus:border-[var(--primary)]" />
              </form>
            </div>
          </section>

          <section style={card} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <h2 style={{ color: "var(--navy)" }} className="text-[15px] font-extrabold">Where the QR code goes</h2>
            <div className="flex gap-3.5 items-center">
              <div style={{ border: "1px solid var(--border)" }} className="w-[76px] h-[76px] rounded-xl p-1 shrink-0">
                {qrDataUrl && <img src={qrDataUrl} alt={`QR code linking to ${url}`} className="w-full h-full" />}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <label className="flex flex-col gap-1">
                  <span style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold">Your paper page</span>
                  <input readOnly value={url} style={{ border: "1px solid var(--border)", background: "var(--canvas)", color: "var(--navy)" }} className="text-[13.5px] font-semibold rounded-xl px-3 py-2.5" />
                </label>
                <div style={{ color: "var(--ink-muted)" }} className="text-xs">Shows your title, abstract, session time and room. Works without logging in.</div>
              </div>
            </div>
          </section>

          {locked.length > 0 && (
            <section style={card} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
              <h2 style={{ color: "var(--navy)" }} className="text-[15px] font-extrabold">Other papers</h2>
              {locked.map((p) => (
                <div key={p.sub.id} style={{ border: "1px solid var(--border)" }} className="flex items-center gap-3 rounded-xl p-3">
                  <span style={{ background: "var(--muted)", color: "var(--ink-muted)" }} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"><Lock size={16} /></span>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: "var(--navy)" }} className="text-[13.5px] font-bold truncate">{p.sub.title}</div>
                    <div style={{ color: "var(--ink-muted)" }} className="text-[12.5px]">{p.result === "not_registered" ? "Your flyer appears here once you register for this paper." : "Your flyer appears once your presentation slot is booked."}</div>
                  </div>
                  {p.result === "not_registered" && <button type="button" onClick={onRegister} style={{ color: "var(--primary)" }} className="text-[13px] font-bold hover:underline cursor-pointer">Register</button>}
                </div>
              ))}
            </section>
          )}
          <div style={{ color: "var(--ink-muted)" }} className="text-[12.5px]">
            Photo, name and affiliation come from your profile. <button type="button" onClick={onEditProfile} style={{ color: "var(--primary)" }} className="font-bold hover:underline cursor-pointer">Edit profile</button>
          </div>
        </div>
      </div>
    </div>
  );
}
