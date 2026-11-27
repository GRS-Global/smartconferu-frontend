"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, Eye, ImagePlus, Mail, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import type { ChairAuthor } from "@/types/chair";
import type { Conference } from "@/types/conference";
import { FlyerArtwork, type FlyerData } from "../flyer-artwork";
import { useQrDataUrl } from "../use-qr-data-url";
import { FLYER_TEMPLATES, FLYER_ACCENTS, FLYER_FIELDS, FLYER_FORMATS, paperUrlFor, hashtagFor, templateOf, type FlyerDesign, type FlyerFieldKey, type SavedFlyer } from "../data";

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

/* Chair · Speaker flyer — design once; every presenter who meets the rule gets their own copy
   (name, photo, paper, slot filled in) on their "My flyer" page, and by email if switched on.
   Same idea as the certificate designer: the chair edits a template, never individual flyers. */

const card = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" };
const MAX_BG_BYTES = 700 * 1024;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label style={{ color: "var(--ink)" }} className="flex items-center justify-between gap-3 text-[13px] font-semibold cursor-pointer">
      {label}
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} style={{ background: checked ? "var(--primary)" : "var(--border-strong)" }} className="relative w-10 h-6 rounded-full shrink-0 transition-colors cursor-pointer">
        <span style={{ left: checked ? 18 : 2 }} className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" />
      </button>
    </label>
  );
}

export interface FlyerPaper { sub: { id: string; title: string; authors: ChairAuthor[] }; /** "registered": accepted and registered; "not_registered": accepted, not registered yet; "other": anything else (under review, rejected …). */ result: "registered" | "not_registered" | "other"; schedule: null }

export function FlyerDesignerBody({ conference, webPage, papers, saved, onSave }: {
  conference: Conference; webPage: string; papers: FlyerPaper[]; saved: SavedFlyer;
  onSave: (design: FlyerDesign, published: boolean) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<FlyerDesign>(() => ({ ...saved.design, fields: { ...saved.design.fields } }));
  const [previewReal, setPreviewReal] = useState(false);
  const [fmtKey, setFmtKey] = useState("portrait");
  const [toast, setToast] = useState<string | null>(null);
  const [bgProblem, setBgProblem] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<FlyerDesign>) => setDraft((d) => ({ ...d, ...patch }));
  const setField = (key: FlyerFieldKey, on: boolean) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: on } }));

  // Accepted papers that are registered are the presenters; the programme has no slots here yet, so a paper has none.
  const registered = papers.filter((p) => p.result === "registered");
  const notRegistered = papers.filter((p) => p.result === "not_registered");
  const ready = (draft.audience === "accepted" ? [...registered, ...notRegistered] : registered).filter((p) => !draft.waitForSlot || p.schedule);
  const sample = ready[0] || registered[0] || papers[0];
  const format = FLYER_FORMATS.find((f) => f.key === fmtKey) ?? FLYER_FORMATS[0];

  const sampleUrl = paperUrlFor({ webPage }, sample?.sub.id || "1042");
  const qrDataUrl = useQrDataUrl(sampleUrl);
  const presenter = sample?.sub.authors?.find((a) => a.corresponding) || sample?.sub.authors?.[0];
  const data: FlyerData = previewReal && sample
    ? {
      acronym: conference.acronym, conferenceName: conference.name,
      authorName: presenter?.name || "Presenter", initials: String(presenter?.name || "P").split(" ").map((w) => w[0]).join("").slice(0, 2),
      affiliation: presenter?.affiliation || "", photoUrl: null,
      paperTitle: sample.sub.title,
      slotText: formatRange(conference),
      roomText: [conference.city, conference.country].filter(Boolean).join(", "),
      url: sampleUrl, hashtag: hashtagFor(conference),
    }
    : {
      acronym: conference.acronym, conferenceName: conference.name,
      authorName: "[Author name]", initials: "", affiliation: "[Affiliation]", photoUrl: null,
      paperTitle: "[Paper title]", slotText: "[Date · Time]", roomText: "[Room / Hall]",
      url: sampleUrl, hashtag: hashtagFor(conference),
    };

  // The published flag and the download count change outside the editor, so they don't count as edits.
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.design);
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const publish = async () => { const problem = await onSave(draft, true); flash(problem ?? `Published. ${ready.length} presenter${ready.length === 1 ? "" : "s"} can now download their flyer.`); };
  const unpublish = async () => { const problem = await onSave(draft, false); flash(problem ?? "Unpublished. Authors no longer see the flyer."); };

  const onBgFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // The picture is saved inside the design (as a data URL), so it has to stay small.
    if (file.size > MAX_BG_BYTES) { setBgProblem("That picture is too big — please use one under 700 KB."); return; }
    setBgProblem("");
    const reader = new FileReader();
    reader.onload = () => set({ bgImage: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <PageHeader
        title="Speaker flyer"
        breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: `${conference.acronym} · Flyers` }]}
        actions={(
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" aria-pressed={previewReal} onClick={() => setPreviewReal((v) => !v)} style={{ border: "1px solid var(--border)", color: "var(--navy)", background: previewReal ? "var(--primary-soft)" : "#FFFFFF" }} className="h-11 px-4 rounded-xl text-[13.5px] font-bold inline-flex items-center gap-2 cursor-pointer">
              <Eye size={15} /> {previewReal ? "Showing a real presenter" : "Preview as an author"}
            </button>
            {saved.published && !dirty ? (
              <button type="button" onClick={() => void unpublish()} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="h-11 px-4 rounded-xl bg-white text-[13.5px] font-bold cursor-pointer">Unpublish</button>
            ) : (
              <button type="button" onClick={() => void publish()} style={{ background: "var(--primary)" }} className="h-11 px-4 rounded-xl text-white text-[13.5px] font-bold inline-flex items-center gap-2 hover:bg-[var(--primary-hover)] cursor-pointer">
                <Send size={15} /> {saved.published ? "Publish changes" : "Publish flyer"}
              </button>
            )}
          </div>
        )}
      />
      <p style={{ color: "var(--ink-muted)" }} className="px-8 mt-1 text-sm flex items-center gap-2 flex-wrap">
        Design once. Every presenter gets their own copy automatically.
        <span style={saved.published ? { color: "#15803D", background: "var(--success-soft)" } : { color: "var(--ink-soft)", background: "var(--muted)" }} className="text-xs font-bold px-2 py-0.5 rounded-full">{saved.published ? "Live for authors" : "Not published"}</span>
        {dirty && <span style={{ color: "var(--warning-ink)" }} className="text-xs font-bold">Unpublished changes</span>}
      </p>

      <div className="p-8 pt-5 flex gap-5 items-start flex-col 2xl:flex-row">
        <div className="flex gap-5 items-start w-full 2xl:w-auto 2xl:flex-1">
          {/* Templates */}
          <section aria-label="Templates" style={card} className="w-48 shrink-0 bg-white rounded-2xl p-3.5 flex flex-col gap-2.5">
            <div style={{ color: "var(--navy)" }} className="text-[13px] font-extrabold">Templates</div>
            {FLYER_TEMPLATES.map((t) => {
              const on = draft.template === t.key;
              return (
                <button key={t.key} type="button" aria-pressed={on} onClick={() => set({ template: t.key })} style={{ border: on ? "2px solid var(--primary)" : "1px solid var(--border)", padding: on ? 5 : 6 }} className="rounded-xl bg-white text-left cursor-pointer">
                  <div style={{ background: t.bg, border: `1px solid ${t.panelBorder}` }} className="h-24 rounded-lg relative overflow-hidden">
                    <div style={{ background: draft.accent }} className="absolute left-0 top-0 bottom-0 w-1" />
                    <div style={{ background: t.ink, opacity: 0.85 }} className="absolute left-3 top-8 h-1.5 w-3/5 rounded" />
                    <div style={{ background: t.ink, opacity: 0.5 }} className="absolute left-3 top-11 h-1.5 w-2/5 rounded" />
                  </div>
                  <div style={{ color: "var(--ink)" }} className="text-xs font-bold mt-1.5">{t.label}</div>
                </button>
              );
            })}
            <input ref={fileRef} type="file" accept="image/*" onChange={onBgFile} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} style={{ border: "1px dashed var(--border-strong)", color: "var(--ink-soft)", background: "var(--canvas)" }} className="rounded-xl p-3 text-[12.5px] font-bold inline-flex flex-col items-center gap-1 cursor-pointer">
              <ImagePlus size={16} /> {draft.bgImage ? "Change background" : "Upload your own background"}
            </button>
            {bgProblem && <p role="alert" style={{ color: "var(--danger-ink)" }} className="text-xs font-semibold">{bgProblem}</p>}
            {draft.bgImage && (
              <button type="button" onClick={() => { set({ bgImage: null }); setBgProblem(""); }} style={{ color: "var(--danger-ink)" }} className="text-xs font-bold inline-flex items-center gap-1 justify-center cursor-pointer"><Trash2 size={12} /> Remove background</button>
            )}
          </section>

          {/* Canvas */}
          <section aria-label="Flyer preview" style={{ background: "#EEF2F7" }} className="flex-1 min-w-0 rounded-2xl p-6 flex flex-col items-center gap-3">
            <div role="radiogroup" aria-label="Preview size" style={{ background: "#FFFFFF", border: "1px solid var(--border)" }} className="flex gap-1 p-1 rounded-xl">
              {FLYER_FORMATS.map((f) => (
                <button key={f.key} type="button" role="radio" aria-checked={f.key === fmtKey} onClick={() => setFmtKey(f.key)} style={{ background: f.key === fmtKey ? "var(--navy)" : "transparent", color: f.key === fmtKey ? "#FFFFFF" : "var(--ink-soft)" }} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">{f.label}</button>
              ))}
            </div>
            <FlyerArtwork design={draft} data={data} format={format} width={Math.min(format.preview.w, 420)} qrDataUrl={qrDataUrl} />
            <div style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold">
              {previewReal ? `Showing ${sample ? `"${sample.sub.title}"` : "a sample"}.` : "Highlighted parts are filled in for each presenter."} Template: {templateOf(draft).label}
            </div>
          </section>
        </div>

        {/* Settings */}
        <section aria-label="Settings" className="w-full 2xl:w-80 shrink-0 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-1 gap-4">
          <div style={card} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <div style={{ color: "var(--navy)" }} className="text-[13px] font-extrabold">Words</div>
            <label className="flex flex-col gap-1">
              <span style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold">Headline <span style={{ color: "var(--ink-faint)" }}>· {"{acronym}"} becomes {conference.acronym}</span></span>
              <input value={draft.headline} onChange={(e) => set({ headline: e.target.value })} style={{ border: "1px solid var(--border)", color: "var(--ink)" }} className="rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[var(--primary)]" />
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold">Badge</span>
              <input value={draft.badge} maxLength={16} onChange={(e) => set({ badge: e.target.value.toUpperCase() })} style={{ border: "1px solid var(--border)", color: "var(--ink)" }} className="rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[var(--primary)]" />
            </label>
            <div>
              <div style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold mb-1.5">Accent colour</div>
              <div className="flex gap-2">
                {FLYER_ACCENTS.map((c) => (
                  <button key={c} type="button" aria-label={`Accent ${c}`} aria-pressed={draft.accent === c} onClick={() => set({ accent: c })} style={{ background: c, boxShadow: draft.accent === c ? "0 0 0 2px #FFFFFF, 0 0 0 4px var(--navy)" : "none" }} className="w-8 h-8 rounded-full cursor-pointer" />
                ))}
              </div>
            </div>
          </div>

          <div style={card} className="bg-white rounded-2xl p-4 flex flex-col gap-2.5">
            <div style={{ color: "var(--navy)" }} className="text-[13px] font-extrabold">Show on the flyer</div>
            <div style={{ color: "var(--ink-muted)" }} className="text-xs -mt-1">Name is always shown. The rest is filled in per presenter.</div>
            <div className="flex flex-wrap gap-1.5">
              {FLYER_FIELDS.map((f) => {
                const on = draft.fields[f.key];
                return (
                  <button key={f.key} type="button" aria-pressed={on} onClick={() => setField(f.key, !on)} style={on ? { border: "1px solid var(--primary-soft-border)", background: "var(--primary-soft)", color: "var(--primary-hover)" } : { border: "1px dashed var(--border-strong)", background: "#FFFFFF", color: "var(--ink-muted)" }} className="rounded-lg px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                    {on && <Check size={12} strokeWidth={3} />} {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={card} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <div style={{ color: "var(--navy)" }} className="text-[13px] font-extrabold">Who gets it</div>
            {[
              { v: "registered", label: "Presenters who registered" },
              { v: "accepted", label: "All accepted authors" },
            ].map((o) => (
              <label key={o.v} style={{ color: "var(--ink)" }} className="flex items-center gap-2.5 text-[13px] font-semibold cursor-pointer">
                <input type="radio" name="flyer-audience" checked={draft.audience === o.v} onChange={() => set({ audience: o.v as FlyerDesign["audience"] })} className="w-4 h-4 accent-[var(--primary)] cursor-pointer" /> {o.label}
              </label>
            ))}
            <Toggle label={<span className="inline-flex items-center gap-1.5"><Mail size={13} /> Email it when ready</span>} checked={draft.emailWhenReady} onChange={(v) => set({ emailWhenReady: v })} />
            <Toggle label="Wait until the slot is booked" checked={draft.waitForSlot} onChange={(v) => set({ waitForSlot: v })} />
          </div>

          <div style={card} className="bg-white rounded-2xl p-4 flex flex-col gap-2">
            <div style={{ color: "var(--navy)" }} className="text-[13px] font-extrabold">So far</div>
            {[
              ["Ready for presenters", ready.length],
              ["Downloaded", saved.downloads],
              ["Waiting for registration", draft.audience === "registered" ? notRegistered.length : 0],
            ].map(([label, n]) => (
              <div key={label} className="flex justify-between text-[13px]"><span style={{ color: "var(--ink-muted)" }}>{label}</span><b style={{ color: "var(--navy)" }}>{n}</b></div>
            ))}
          </div>
        </section>
      </div>

      {toast && (
        <div role="status" style={{ background: "var(--navy)" }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg inline-flex items-center gap-2">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
