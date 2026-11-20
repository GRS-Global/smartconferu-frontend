"use client";
/* License Extensions and CFP Page Review (the prototype's queues.jsx 2 and 3), on the shared QueuePage. */
import { useMemo } from "react";
import { AlertTriangle, Check, FileCheck2, Globe, Hourglass, Send, X } from "lucide-react";
import { decideCfp, decideLicenseRequest, loadCfps, loadConferences, loadLicenseRequests, type AdminConference, type LicenseRequest } from "../services";
import { useData } from "../use-data";
import { QueuePage, type QueueConfig } from "./queue-page";
import { Avatar, Badge, daysSince, Failed, Fields, fmtDate, Loading, Section } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);
export const daysUntil = (isoDay: string) => Math.round((new Date(isoDay).getTime() - new Date(today()).getTime()) / 86_400_000);
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

function TitleCell({ title, sub }: { title: string; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </p>
      {sub && (
        <p className="text-[12.5px] truncate max-w-[320px]" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
function Person({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} size={32} />
      <span className="whitespace-nowrap">{name}</span>
    </div>
  );
}
function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string | null }) {
  return (
    <li className="flex items-start gap-2.5 py-2 text-[13.5px]">
      <span className="w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 mt-px" style={{ background: ok ? "var(--success-soft)" : "var(--warning-soft)", color: ok ? "var(--success)" : "var(--warning)" }}>
        {ok ? <Check size={12} strokeWidth={3} /> : <AlertTriangle size={12} />}
      </span>
      <span>
        <span style={{ color: "var(--text)" }}>{label}</span>
        {detail && (
          <span className="block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            {detail}
          </span>
        )}
      </span>
    </li>
  );
}

// ---------- License Extensions ----------

type LicenseItem = LicenseRequest & { conference: AdminConference | null };

export function LicenseRequestsPage() {
  const { data, error, loading, reload } = useData(async () => {
    const [conferences, ...lists] = await Promise.all([loadConferences(), loadLicenseRequests("pending"), loadLicenseRequests("approved"), loadLicenseRequests("declined"), loadLicenseRequests("withdrawn")]);
    const byId = new Map(conferences.map((c) => [c.id, c]));
    return lists.flat().map((r) => ({ ...r, conference: byId.get(r.conferenceId) ?? null }));
  });
  const config = useMemo<QueueConfig<LicenseItem>>(
    () => ({
      queueKey: "licenses",
      title: "License Extensions",
      icon: Hourglass,
      noun: "request",
      idOf: (r) => r.id,
      statusOf: (r) => r.status,
      since: (r) => r.createdAt,
      resolution: (r) => (r.status === "approved" && r.newExpiry ? `Extended to ${fmtDate(r.newExpiry)}` : r.decisionReason),
      search: (r) => `${r.conferenceTitle} ${r.conferenceAcronym} ${r.requestedByName}`,
      columns: [
        { label: "Conference", sort: (r) => r.conferenceAcronym, render: (r) => <TitleCell title={r.conferenceAcronym} sub={r.conferenceTitle} /> },
        { label: "Chair", sort: (r) => r.requestedByName, render: (r) => <Person name={r.requestedByName} /> },
        {
          label: "Expires",
          sort: (r) => r.conference?.licenseExpiry ?? "",
          render: (r) => {
            const expiry = r.conference?.licenseExpiry;
            if (!expiry) return "—";
            const left = daysUntil(expiry);
            return (
              <div>
                <p className="whitespace-nowrap">{fmtDate(expiry)}</p>
                {r.status === "pending" && left <= 7 && (
                  <Badge tone={left < 3 ? "danger" : "warning"} className="mt-1">
                    {left <= 0 ? "Expired" : `${left} days left`}
                  </Badge>
                )}
              </div>
            );
          },
        },
        {
          label: "Asked for",
          sort: (r) => r.requestedDate,
          render: (r) => (
            <span className="whitespace-nowrap font-semibold" style={{ color: "var(--text)" }}>
              {fmtDate(r.requestedDate)}
            </span>
          ),
        },
      ],
      drawerTitle: (r) => `${r.conferenceAcronym} — license extension`,
      drawerSubtitle: (r) => r.conferenceTitle,
      detail: (r) => {
        const current = r.conference?.licenseExpiry ?? r.currentExpiry;
        return (
          <>
            <Section title="Request">
              <Fields
                rows={[
                  ["Current expiry", current ? `${fmtDate(current)}${r.conference?.onTrial ? " (30-day trial)" : ""}` : "—"],
                  ["Asked for", fmtDate(r.requestedDate)],
                  ["Extra time", current ? `${daysBetween(current, r.requestedDate)} days` : "—"],
                  ["Submissions so far", r.conference ? String(r.conference.papers) : "—"],
                  ["Chair", `${r.requestedByName}${r.requestedByEmail ? ` · ${r.requestedByEmail}` : ""}`],
                ]}
              />
            </Section>
            <Section title="Reason">
              <p className="text-[13.5px] rounded-xl p-4" style={{ background: "var(--muted)", color: "var(--text)" }}>
                {r.reason ?? "No reason given."}
              </p>
            </Section>
          </>
        );
      },
      actions: [
        {
          key: "decline",
          label: "Decline",
          icon: X,
          tone: "danger",
          variant: "outline",
          status: "declined",
          form: () => [
            {
              name: "reason",
              label: "Reason (shown to the chair)",
              type: "textarea",
              required: true,
              templates: ["The conference has ended — certificates can still be sent from the archive.", "Please ask again when the license is within 14 days of expiry.", "Extensions are limited to 12 months at a time."],
            },
          ],
          run: (r, v) => decideLicenseRequest(r.id, false, { reason: v.reason }),
          toast: (r) => `Extension for ${r.conferenceAcronym} declined`,
        },
        {
          key: "approve",
          label: "Approve",
          icon: Check,
          tone: "success",
          status: "approved",
          form: (r) => [{ name: "date", label: "New expiry date (change it to approve a different date)", type: "date", required: true, initial: r.requestedDate, min: today() }],
          run: (r, v) => decideLicenseRequest(r.id, true, { newExpiry: v.date }),
          toast: (r, v) => `${r.conferenceAcronym} extended to ${fmtDate(v.date)}`,
        },
      ],
    }),
    [],
  );
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  return <QueuePage config={config} items={data} onChanged={reload} />;
}

// ---------- CFP Page Review ----------

const PAYMENT_WORDS = /\b(paypal|western union|bank transfer|upi|pay now|payment link)\b/i;
const cfpFlags = (c: AdminConference) => {
  const flags: string[] = [];
  if (c.submissionDeadline && c.submissionDeadline.slice(0, 10) < today()) flags.push("Submission deadline is already in the past");
  if (c.licenseExpiry < today()) flags.push("The license has ended");
  if (PAYMENT_WORDS.test(c.about ?? "")) flags.push("Mentions an external payment");
  return flags;
};
const topicsOf = (c: AdminConference) => (Array.isArray(c.details?.topics) ? (c.details.topics as unknown[]).length : 0);

export function CfpReviewPage() {
  const { data, error, loading, reload } = useData(async () => {
    const [waiting, published, rejected] = await Promise.all([loadCfps("in_review"), loadCfps("published"), loadCfps("rejected")]);
    return [...waiting.map((c) => ({ ...c, cfpState: "pending" })), ...published.map((c) => ({ ...c, cfpState: "published" })), ...rejected.map((c) => ({ ...c, cfpState: "sent_back" }))];
  });
  const config = useMemo<QueueConfig<AdminConference & { cfpState: string }>>(
    () => ({
      queueKey: "cfps",
      title: "CFP Page Review",
      icon: FileCheck2,
      noun: "page",
      idOf: (c) => c.id,
      statusOf: (c) => c.cfpState,
      since: (c) => c.createdAt ?? "",
      search: (c) => `${c.title} ${c.acronym} ${c.slug}`,
      columns: [
        { label: "CFP page", sort: (c) => c.acronym, render: (c) => <TitleCell title={c.acronym} sub={`smartconferu.com/cfp/${c.slug}`} /> },
        { label: "Chair", sort: (c) => c.requester?.name ?? "", render: (c) => <Person name={c.requester?.name ?? "—"} /> },
        { label: "Deadline", sort: (c) => c.submissionDeadline ?? "", render: (c) => <span className="whitespace-nowrap">{fmtDate(c.submissionDeadline)}</span> },
        {
          label: "Checks",
          sort: (c) => cfpFlags(c).length,
          render: (c) => {
            const n = cfpFlags(c).length;
            return n ? (
              <Badge tone="warning">
                <AlertTriangle size={12} />
                {n} issue{n === 1 ? "" : "s"}
              </Badge>
            ) : (
              <Badge tone="success">
                <Check size={12} />
                Clean
              </Badge>
            );
          },
        },
      ],
      drawerTitle: (c) => `CFP — ${c.acronym}`,
      drawerSubtitle: (c) => c.title,
      detail: (c) => {
        const flags = cfpFlags(c);
        return (
          <>
            <Section title="Preview">
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                <div className="px-5 py-4 text-white" style={{ background: "var(--gradient-primary)" }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Call for papers</p>
                  <p className="text-[16px] font-bold mt-1">{c.title}</p>
                  <p className="text-[12.5px] opacity-85 mt-0.5">Submission deadline · {fmtDate(c.submissionDeadline)}</p>
                </div>
                <div className="p-5 text-[13.5px]" style={{ color: "var(--text-soft)" }}>
                  <p className="line-clamp-4">{c.about ?? "No description yet."}</p>
                  <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                    {topicsOf(c)} topics listed
                  </p>
                </div>
              </div>
              <a className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-semibold" style={{ color: "var(--primary)" }} href={`/cfp/${c.slug}`} target="_blank" rel="noreferrer">
                <Globe size={14} /> Open full preview
              </a>
            </Section>
            <Section title="Automatic checks">
              <ul>
                <CheckRow ok={!flags.includes("Submission deadline is already in the past")} label="Submission deadline is in the future" detail={fmtDate(c.submissionDeadline)} />
                <CheckRow ok={!flags.includes("The license has ended")} label="Conference has an active or trial license" detail={`Until ${fmtDate(c.licenseExpiry)}${c.onTrial ? " (trial)" : ""}`} />
                <CheckRow ok={!flags.includes("Mentions an external payment")} label="No external payment links" />
              </ul>
            </Section>
            {c.cfpState === "pending" && daysSince(c.createdAt ?? "") > 30 && (
              <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                Conference created {fmtDate(c.createdAt)}.
              </p>
            )}
          </>
        );
      },
      actions: [
        {
          key: "back",
          label: "Send back",
          icon: Send,
          tone: "warning",
          variant: "outline",
          status: "sent_back",
          form: () => [{ name: "reason", label: "What should the chair change?", type: "textarea", required: true, templates: ["The submission deadline is in the past.", "Please add the topics and submission guidelines.", "Please remove external payment links."] }],
          email: (c) => ({ to: c.requester?.email ?? "the chairs", subject: `The Call for Papers of ${c.acronym} was not approved`, body: `Dear ${c.requester?.name.split(" ")[0] ?? "chair"},\n\nThe Call for Papers of ${c.acronym} was not approved. Please update it and send it for approval again.` }),
          run: (c, v) => decideCfp(c.id, false, v.reason),
          toast: (c) => `CFP for ${c.acronym} sent back`,
        },
        {
          key: "publish",
          label: "Approve & publish",
          icon: Check,
          tone: "success",
          status: "published",
          confirm: (c) => `smartconferu.com/cfp/${c.slug} goes live and ${c.requester?.name ?? "the chair"} is notified.`,
          email: (c) => ({ to: c.requester?.email ?? "the chairs", subject: `The Call for Papers of ${c.acronym} is live`, body: `Dear ${c.requester?.name.split(" ")[0] ?? "chair"},\n\nThe Call for Papers of ${c.acronym} has been approved. Submissions are open now.` }),
          run: (c) => decideCfp(c.id, true),
          toast: (c) => `CFP for ${c.acronym} is live`,
        },
      ],
    }),
    [],
  );
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  return <QueuePage config={config} items={data} onChanged={reload} />;
}
