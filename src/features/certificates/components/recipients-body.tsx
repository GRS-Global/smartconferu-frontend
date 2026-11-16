"use client";

import { useState } from "react";
import { ChevronLeft, AlertTriangle, Eye, Download, Search, Send, Check, Plus, Upload, SlidersHorizontal, FileText } from "lucide-react";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import type { Conference } from "@/types/conference";
import { useIdSort } from "@/lib/use-id-sort";
import { IdSortLabel } from "@/features/chair/components/screening-ui";
import { CertCard, Pill, Notice, CertModal } from "../components";
import { CertificateArtwork } from "../certificate-artwork";
import { inputStyle, inputClass } from "../form-styles";
import {
  getCertificateType, getAudienceSource, AUDIENCE_SOURCES, AUDIENCE_CONDITIONS, MERGE_FIELDS, resolveAudience, deliveryStats, mergeValues, applyMerge,
  type AudienceContext, type CertificateDesign, type Distribution, type DistributionAudience, type DistributionEmail, type IssuedCertificate, type Recipient,
} from "../data";
import type { CertificateActions } from "../use-certificates";
import type { Go } from "../routes";

/* A single sanity check: enough to catch the "two dots" typo an import step lets straight through, without pretending to validate deliverability. */
const looksLikeEmail = (e: string | undefined) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e || "");

/* ---------------------------------------------------------------------------
   Certificates > Distribute > one send.

   Everything about this send lives here: who is on the list, fixing the rows
   that can't go out, the covering email, and — once it has gone — how it landed.
   It used to be three separate pages and a four-step rail.
   --------------------------------------------------------------------------- */

function FunnelRow({ label, value, total, shade }: { label: string; value: number; total: number; shade: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3.5">
      <span style={{ color: "var(--ink-soft)" }} className="w-28 shrink-0 text-xs font-semibold">{label}</span>
      <span style={{ color: "var(--navy)" }} className="w-10 shrink-0 text-sm font-extrabold text-right">{value}</span>
      <span style={{ background: "var(--muted)" }} className="flex-1 h-3 rounded-full overflow-hidden">
        <span style={{ width: `${pct}%`, background: shade }} className="block h-full rounded-full" />
      </span>
      <span style={{ color: "var(--ink-muted)" }} className="w-10 shrink-0 text-[11px] text-right">{pct}%</span>
    </div>
  );
}

function EmailModal({ dist, cert, conference, recipients, onClose, onSend, onPatch, busy }: { busy: boolean; dist: Distribution; cert: CertificateDesign | undefined; conference: AudienceContext["conference"]; recipients: Recipient[]; onClose: () => void; onSend: () => void; onPatch: (patch: Partial<DistributionEmail>) => void }) {
  const [index, setIndex] = useState(0);
  const type = getCertificateType(cert?.typeKey);
  const preview = recipients[Math.min(index, Math.max(0, recipients.length - 1))] || null;
  const values = mergeValues(preview, conference);
  const senderAddress = conference.contactEmail || `certificates@${(conference.acronym || "conference").toLowerCase().replace(/\s+/g, "")}.org`;

  return (
    <CertModal
      title="Review the email, then send"
      subtitle={`${recipients.length} ${recipients.length === 1 ? "person" : "people"} · merge fields fill in per person`}
      onClose={onClose}
      maxWidth="max-w-5xl"
      footer={
        <>
          <span style={{ color: "var(--ink-muted)" }} className="text-xs flex-1">From {conference.acronym} &lt;{senderAddress}&gt;</span>
          <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] transition-colors cursor-pointer">Not yet</button>
          <button
            onClick={onSend}
            disabled={recipients.length === 0 || busy}
            style={{ background: "var(--gradient-primary)" }}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
          >
            <Send size={15} /> {busy ? "Sending…" : <>Issue &amp; send {recipients.length}</>}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div>
            <label htmlFor="mail-subject" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Subject</label>
            <input id="mail-subject" value={dist.email.subject} onChange={(e) => onPatch({ subject: e.target.value })} style={inputStyle} className={inputClass} />
          </div>
          <div>
            <label htmlFor="mail-body" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Message</label>
            <textarea id="mail-body" value={dist.email.body} onChange={(e) => onPatch({ body: e.target.value })} rows={10} style={inputStyle} className={`${inputClass} leading-relaxed resize-y`} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.flatMap((g) => g.fields).map((f) => (
              <button
                key={f.token}
                onClick={() => onPatch({ body: `${dist.email.body}{{${f.token}}}` })}
                style={{ border: "1px solid var(--border)", background: "var(--canvas)", color: "var(--ink-soft)" }}
                className="px-2.5 py-1 rounded-full text-[11.5px] font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {[
              { key: "attachPdf", label: "Attach the certificate PDF" },
              { key: "saveToAccount", label: "Save it to their Smartconferu account", note: "A bounced email then isn't a lost certificate." },
              { key: "bccConference", label: "BCC the conference inbox" },
            ].map((o) => (
              <label key={o.key} className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={dist.email[o.key as "attachPdf" | "saveToAccount" | "bccConference"]} onChange={(e) => onPatch({ [o.key]: e.target.checked } as Partial<DistributionEmail>)} style={{ accentColor: "var(--primary)" }} className="w-4 h-4 mt-0.5 shrink-0 cursor-pointer" />
                <span>
                  <span style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">{o.label}</span>
                  {o.note && <span style={{ color: "var(--ink-muted)" }} className="block text-[11px] mt-0.5">{o.note}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span style={{ color: "var(--navy)" }} className="text-xs font-bold">Preview as</span>
            <button
              onClick={() => setIndex((i) => (recipients.length ? (i + 1) % recipients.length : 0))}
              style={{ border: "1px solid var(--border-strong)", color: "var(--ink)" }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[var(--canvas)] transition-colors cursor-pointer"
            >
              {preview?.name || "—"}
            </button>
            <span style={{ color: "var(--ink-muted)" }} className="text-[11px]">{recipients.length ? `${index + 1} of ${recipients.length}` : ""}</span>
          </div>

          <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ color: "var(--navy)" }} className="text-[13px] font-bold">{applyMerge(dist.email.subject, values)}</div>
              <div style={{ color: "var(--ink-muted)" }} className="text-[11px] mt-0.5">to {preview?.email || "—"}</div>
            </div>
            <div style={{ background: "var(--canvas)" }} className="p-4">
              <div className="bg-white rounded-lg px-5 py-4" style={{ boxShadow: "0 1px 3px rgba(11,16,32,0.08)" }}>
                <div style={{ background: "var(--gradient-accent)" }} className="w-12 h-1 rounded mb-3" />
                <div style={{ color: "var(--ink)" }} className="text-[12.5px] leading-relaxed whitespace-pre-line">{applyMerge(dist.email.body, values)}</div>
                {dist.email.attachPdf && (
                  <div style={{ border: "1px solid var(--border)" }} className="rounded-lg px-3 py-2.5 mt-3.5 flex items-center gap-3">
                    <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger-300)", color: "var(--danger)" }} className="w-8 h-9 rounded flex items-center justify-center shrink-0">
                      <FileText size={14} />
                    </div>
                    <div className="min-w-0">
                      <div style={{ color: "var(--ink)" }} className="text-xs font-semibold truncate">
                        {(preview?.name || "certificate").replace(/[^A-Za-z]+/g, "-")}-{type.short.replace(/\s+/g, "-")}.pdf
                      </div>
                      <div style={{ color: "var(--ink-muted)" }} className="text-[11px]">ID {preview?.serial || "—"}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CertModal>
  );
}

function AddPersonModal({ onClose, onAdd }: { onClose: () => void; onAdd: (form: { name: string; email: string; affiliation: string; roleLabel: string }) => void }) {
  const [form, setForm] = useState({ name: "", email: "", affiliation: "", roleLabel: "Guest" });
  const canAdd = form.name.trim() && form.email.trim();
  return (
    <CertModal
      title="Add someone by hand"
      subtitle="For invited guests and anyone else your conference data doesn't know about."
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <>
          <div className="flex-1" />
          <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] transition-colors cursor-pointer">Cancel</button>
          <button onClick={() => onAdd(form)} disabled={!canAdd} style={{ background: "var(--primary)" }} className="px-5 py-2 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed">Add</button>
        </>
      }
    >
      <div className="space-y-3">
        {[
          { key: "name", label: "Full name", placeholder: "Dr. Anika Rao" },
          { key: "email", label: "Email", placeholder: "name@university.edu" },
          { key: "affiliation", label: "Affiliation", placeholder: "IIT Bombay" },
          { key: "roleLabel", label: "Role on the certificate", placeholder: "Keynote Speaker" },
        ].map((f) => (
          <div key={f.key}>
            <label htmlFor={`add-${f.key}`} style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">{f.label}</label>
            <input id={`add-${f.key}`} value={form[f.key as keyof typeof form]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} style={inputStyle} className={inputClass} />
          </div>
        ))}
      </div>
    </CertModal>
  );
}

export function RecipientsBody({ conference, dist, cert, audience, serialBase, actions, go }: { conference: Conference; dist: Distribution; cert: CertificateDesign | undefined; audience: AudienceContext; serialBase: number; actions: CertificateActions; go: Go }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState<(Recipient & Partial<IssuedCertificate>) | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAudience, setShowAudience] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<FlowToastData | null>(null);
  const idSort = useIdSort();

  const type = getCertificateType(cert?.typeKey);
  const sent = dist.status === "sent";
  const source = getAudienceSource(dist.audience.sourceKey);

  const patchAudience = (patch: Partial<DistributionAudience>) => {
    actions.updateDistribution(dist.id, { audience: (a) => ({ ...a, ...patch }) });
  };
  const patchEmail = (patch: Partial<DistributionEmail>) => {
    actions.updateDistribution(dist.id, { email: (e) => ({ ...e, ...patch }) });
  };

  const { recipients, excluded } = resolveAudience(dist, { ...audience, serialBase }, cert?.typeKey);
  const stats = deliveryStats(dist.issued);

  /* Before sending, the list is the rule's output plus the rows that failed it, shown together —
     a chair who can't see who dropped off has no way to notice the rule was wrong. After sending,
     the list is simply what went out. */
  type Row = Recipient & Partial<IssuedCertificate> & { issue?: string | null };
  const rows: Row[] = sent
    ? dist.issued
    : [
      ...recipients.map((r) => ({ ...r, issue: looksLikeEmail(r.email) ? null : "Check this address" })),
      ...excluded.map((r) => ({ ...r, issue: r.reason })),
    ];

  const issueCount = sent ? stats.bounced : rows.filter((r) => r.issue).length;
  const sendable = sent ? [] : rows.filter((r) => !r.issue);

  const filtered = idSort.sort(rows.filter((r) => {
    if (!sent) {
      if (filter === "issues" && !r.issue) return false;
      if (filter === "ready" && r.issue) return false;
    } else {
      if (filter === "not-opened" && (r.opened || r.status === "bounced")) return false;
      if (filter === "downloaded" && !r.downloaded) return false;
      if (filter === "bounced" && r.status !== "bounced") return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r.email, r.paperTitle, r.affiliation].some((v) => (v || "").toLowerCase().includes(q));
  }), (r) => r.serial ?? "");

  const filters = sent
    ? [
      { key: "all", label: `Everyone ${rows.length}` },
      { key: "not-opened", label: `Not opened ${rows.filter((r) => !r.opened && r.status !== "bounced").length}` },
      { key: "downloaded", label: `Downloaded ${stats.downloaded}` },
      { key: "bounced", label: `Bounced ${stats.bounced}` },
    ]
    : [
      { key: "all", label: `All ${rows.length}` },
      { key: "ready", label: `Ready ${rows.length - issueCount}` },
      { key: "issues", label: `Needs a fix ${issueCount}` },
    ];

  const send = async () => {
    if (sending) return;
    setSending(true);
    const mail = await actions.issue(dist, sendable);
    setSending(false);
    setShowEmail(false);
    setFilter("all");
    if (mail) setNotice({ title: "Issued, but some emails didn't go out", text: mail });
  };

  const conditionsForSource = AUDIENCE_CONDITIONS.filter((c) => !c.appliesTo || c.appliesTo.includes(dist.audience.sourceKey));

  return (
    <div>
      <div className="px-4 sm:px-8 pt-8 pb-0">
        <button onClick={() => go("chair-certificates-distribute")} style={{ color: "var(--ink-muted)" }} className="flex items-center gap-1.5 text-[13px] font-semibold hover:text-[var(--navy)] transition-colors mb-3 cursor-pointer">
          <ChevronLeft size={15} /> All sends
        </button>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 style={{ color: "var(--navy)", letterSpacing: "-0.02em" }} className="text-[28px] leading-tight font-extrabold">{dist.name}</h1>
              {sent ? <Pill tone="success"><Check size={10} strokeWidth={3} /> Sent</Pill> : <Pill tone="muted">Draft — nothing sent yet</Pill>}
            </div>
            <p style={{ color: "var(--ink-muted)" }} className="text-sm mt-1">
              {cert?.name} · {type.label} · {source.label}
              {sent && dist.sentAt ? ` · sent ${new Date(dist.sentAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--canvas)] transition-colors cursor-pointer">
              <Download size={15} /> {sent ? "Download all PDFs" : "Export CSV"}
            </button>
            {!sent && (
              <button
                onClick={() => setShowEmail(true)}
                disabled={sendable.length === 0}
                style={{ background: "var(--gradient-primary)" }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
              >
                <Send size={15} /> Review email &amp; send {sendable.length}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-5">

        {sent && (
          <CertCard title={`What happened to the ${stats.total}`} subtitle="Tracking does not stop at 'opened' — a certificate has done its job when it is downloaded, and proved itself when someone else verifies it.">
            <div className="space-y-2.5 mt-1">
              <FunnelRow label="Issued" value={stats.total} total={stats.total} shade="#4C1D95" />
              <FunnelRow label="Delivered" value={stats.delivered} total={stats.total} shade="var(--primary)" />
              <FunnelRow label="Opened" value={stats.opened} total={stats.total} shade="#8B5CF6" />
              <FunnelRow label="Downloaded" value={stats.downloaded} total={stats.total} shade="#A78BFA" />
              <FunnelRow label="Verified" value={stats.verified} total={stats.total} shade="var(--accent)" />
            </div>
          </CertCard>
        )}

        {!sent && (
          <CertCard
            title="Who is on this list"
            subtitle={source.note}
            action={
              <button onClick={() => setShowAudience((v) => !v)} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold hover:bg-[var(--canvas)] transition-colors shrink-0 cursor-pointer">
                <SlidersHorizontal size={12} /> {showAudience ? "Done" : "Change"}
              </button>
            }
          >
            {showAudience && (
              <div className="space-y-4 pt-1">
                <div>
                  <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">GROUP</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {AUDIENCE_SOURCES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => !s.blockedReason && patchAudience({ sourceKey: s.key })}
                        disabled={!!s.blockedReason}
                        title={s.blockedReason || s.note}
                        style={s.key === dist.audience.sourceKey
                          ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" }
                          : { border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                        className="px-3 py-2 rounded-lg text-[11.5px] font-semibold text-left transition-colors disabled:opacity-55 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">ONLY INCLUDE PEOPLE WHO…</div>
                  <div className="flex flex-wrap gap-2">
                    {conditionsForSource.map((c) => {
                      const on = dist.audience.conditions.includes(c.key);
                      return (
                        <label
                          key={c.key}
                          style={on ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" } : { border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11.5px] font-semibold cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox" checked={on}
                            onChange={() => patchAudience({ conditions: on ? dist.audience.conditions.filter((k) => k !== c.key) : [...dist.audience.conditions, c.key] })}
                            style={{ accentColor: "var(--primary)" }} className="w-3.5 h-3.5 cursor-pointer"
                          />
                          {c.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {!showAudience && (
              <p style={{ color: "var(--ink-muted)" }} className="text-xs leading-relaxed">
                <strong style={{ color: "var(--navy)" }}>{recipients.length}</strong> match right now
                {excluded.length > 0 && <> · {excluded.length} left out</>}
              </p>
            )}
          </CertCard>
        )}

        {issueCount > 0 && (
          <Notice
            tone={sent ? "danger" : "warning"} icon={AlertTriangle}
            action={
              <button onClick={() => setFilter(sent ? "bounced" : "issues")} style={{ border: `1px solid ${sent ? "var(--danger-border)" : "var(--warning-border)"}`, color: sent ? "var(--danger)" : "var(--warning)" }} className="shrink-0 px-3 py-1.5 rounded-lg text-[11.5px] font-bold bg-white transition-colors cursor-pointer">
                Show {sent ? "them" : `these ${issueCount}`}
              </button>
            }
          >
            {sent
              ? <><strong>{issueCount} email{issueCount === 1 ? "" : "s"} bounced.</strong> Those certificates are issued and waiting in the recipients&apos; Smartconferu accounts either way — the address is the only thing that failed.</>
              : <><strong>{issueCount} row{issueCount === 1 ? "" : "s"} can&apos;t go out yet.</strong> Add or correct the address and they join the send. Their certificate is created either way.</>}
          </Notice>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <Search size={14} style={{ color: "var(--ink-faint)" }} />
            <label htmlFor="cert-r-search" className="sr-only">Search recipients</label>
            <input
              id="cert-r-search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or paper…"
              style={{ color: "var(--ink)" }} className="bg-transparent text-sm outline-none w-60 placeholder:text-slate-400"
            />
          </div>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={filter === f.key
                ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" }
                : { border: "1px solid var(--border)", background: "#FFFFFF", color: "var(--ink-muted)" }}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          {!sent && (
            <>
              <button onClick={() => setShowAdd(true)} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-[var(--canvas)] transition-colors cursor-pointer">
                <Plus size={13} /> Add someone
              </button>
              <button style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-[var(--canvas)] transition-colors cursor-pointer">
                <Upload size={13} /> Import CSV
              </button>
            </>
          )}
        </div>

        <CertCard padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm" style={{ minWidth: 940 }}>
              <thead>
                <tr style={{ background: "var(--canvas)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3 whitespace-nowrap">{sent ? "Progress" : "Status"}</th>
                  <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Recipient</th>
                  <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Email</th>
                  <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Role</th>
                  <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Paper</th>
                  <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap"><IdSortLabel label="Certificate ID" dir={idSort.dir} onToggle={idSort.toggle} /></th>
                  <th className="px-3 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const rowBorder = i < filtered.length - 1 ? "1px solid var(--muted)" : "none";
                  const bounced = r.status === "bounced";
                  const bg = bounced ? "var(--danger-soft)" : (!sent && r.issue) ? "var(--warning-soft)" : undefined;
                  return (
                    <tr key={r.key || r.serial} style={{ borderBottom: rowBorder, background: bg }}>
                      <td className="px-5 py-3">
                        {sent ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {bounced ? (
                              <>
                                <Pill tone="danger">Bounced — {r.bounceReason}</Pill>
                                <Pill tone="primary">In their account</Pill>
                              </>
                            ) : (
                              <>
                                <Pill tone="success"><Check size={10} strokeWidth={3} /> Sent</Pill>
                                {r.opened ? <Pill tone="success">Opened</Pill> : <Pill tone="muted">Not opened</Pill>}
                                {r.downloaded && <Pill tone="success">Downloaded</Pill>}
                                {(r.verifiedCount ?? 0) > 0 && <Pill tone="accent">Verified ×{r.verifiedCount}</Pill>}
                              </>
                            )}
                          </div>
                        ) : r.issue
                          ? <Pill tone="warning">{r.issue === "Has an email address on file" ? "No email" : r.issue === "Already has this certificate" ? "Already sent" : "Check"}</Pill>
                          : <Pill tone="primary">Ready</Pill>}
                      </td>
                      <td style={{ color: "var(--ink)" }} className="px-3 py-3 font-medium whitespace-nowrap">{r.name}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {!sent && r.issue && r.issue !== "Already has this certificate" ? (
                          <>
                            <label htmlFor={`fix-${r.key}`} className="sr-only">Email for {r.name}</label>
                            <input
                              id={`fix-${r.key}`} type="email" defaultValue={r.email || ""}
                              placeholder="Add an email address"
                              onBlur={(e) => { if (r.key) actions.updateDistribution(dist.id, { overrides: { ...dist.overrides, [r.key]: { ...(dist.overrides[r.key] || {}), email: e.target.value.trim() } } }); }}
                              style={{ ...inputStyle, borderColor: "var(--warning)" }}
                              className="px-2.5 py-1.5 rounded-lg text-xs outline-none focus:border-[var(--primary)] w-56 placeholder:text-slate-400"
                            />
                          </>
                        ) : (
                          <span style={{ color: bounced ? "var(--danger)" : "var(--ink-muted)" }}>{r.email || "—"}</span>
                        )}
                      </td>
                      <td style={{ color: "var(--ink-muted)" }} className="px-3 py-3 text-xs whitespace-nowrap">{r.roleLabel || "—"}</td>
                      <td style={{ color: "var(--ink-muted)" }} className="px-3 py-3 text-xs max-w-[240px] truncate" title={r.paperTitle || ""}>{r.paperTitle || "—"}</td>
                      <td style={{ color: "var(--ink-faint)" }} className="px-3 py-3 text-xs whitespace-nowrap">{r.serial || "—"}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setPreview(r)}
                          aria-label={`Preview the certificate for ${r.name}`}
                          style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white hover:bg-[var(--canvas)] transition-colors cursor-pointer"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--ink-faint)" }}>Nothing here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CertCard>
      </div>

      {notice && <FlowToast toast={notice} onClose={() => setNotice(null)} />}

      {preview && cert && (
        <CertModal
          title={preview.name}
          subtitle={`Exactly what this person receives · ${preview.serial || "ID assigned on send"}`}
          onClose={() => setPreview(null)}
          maxWidth="max-w-3xl"
        >
          <div className="flex justify-center">
            <CertificateArtwork design={cert.design} recipient={preview} conference={conference} width={620} />
          </div>
        </CertModal>
      )}

      {showEmail && (
        <EmailModal
          dist={dist} cert={cert} conference={conference} recipients={sendable}
          onClose={() => setShowEmail(false)} onSend={() => void send()} onPatch={patchEmail} busy={sending}
        />
      )}

      {showAdd && (
        <AddPersonModal
          onClose={() => setShowAdd(false)}
          onAdd={(person) => { actions.updateDistribution(dist.id, { manual: [...dist.manual, { ...person, key: `manual:${crypto.randomUUID()}` }] }); setShowAdd(false); }}
        />
      )}
    </div>
  );
}
