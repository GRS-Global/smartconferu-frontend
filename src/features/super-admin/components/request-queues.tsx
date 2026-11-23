"use client";
/* The live approval queues.
   Conference Requests (the prototype's QueuePage + queues.jsx "conference-requests"): Pending /
   Resolved / All, sortable columns, a card list on phones, a drawer with the request and the
   decision. A decision is confirmed in a popup (reason chips for a decline, the email that goes out),
   then held back for 10 seconds with Undo before it is sent.
   Deletion Requests (the prototype's DeletionRequestsPage): chairs asking for an archived conference
   to be deleted, oldest first; each opens the conference, where the decision is made.
   Messages to the chair ("Ask for info") are left out for now; internal notes and claiming stay. */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarPlus, Check, ChevronRight, Mail, PartyPopper, Search, Trash2, X } from "lucide-react";
import { ClaimBar, ClaimMarks, InternalNotes, useQueueState } from "./queue-extras";
import { decideConferenceRequest, loadConferencePapers, loadConferences, loadDeletionRequests, type AdminConference, type AdminNote } from "../services";
import { useData } from "../use-data";
import { Avatar, Badge, Button, Card, Drawer, errorText, ExtLink, Failed, Fields, fmtDate, Loading, Modal, PageTitle, Section, SortTh, Toast, UNDO_MS, useSort, WaitingBadge, type Tone } from "./ui";

const DECLINE_REASONS = ["This isn't an academic event.", "We couldn't verify the organizing body.", "The conference web page or dates are missing.", "This conference is already on Smartconferu."];

const OUTCOMES: Record<string, [string, Tone]> = {
  pending: ["Pending", "warning"],
  approved: ["Approved", "success"],
  declined: ["Declined", "danger"],
};
const outcomeOf = (c: AdminConference) => (c.status === "pending_approval" ? "pending" : c.status === "rejected" ? "declined" : "approved");
const detail = (c: AdminConference, key: string) => {
  const v = c.details?.[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : null;
};
const location = (c: AdminConference) => [c.city, c.country].filter(Boolean).join(", ") || "Online";
const refOf = (c: AdminConference) => c.id.slice(0, 8).toUpperCase();

function OutcomeBadge({ status }: { status: string }) {
  const [label, tone] = OUTCOMES[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

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

function Person({ name, sub }: { name: string; sub?: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} size={32} />
      <div className="min-w-0">
        <p className="whitespace-nowrap" style={{ color: "var(--text)" }}>
          {name}
        </p>
        {sub && (
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* The email this decision sends (the API's conference-emails "decided"), live as the reason is typed.
   Collapsed to the subject line; open it to read the whole message. */
function EmailPreview({ c, approve, reason }: { c: AdminConference; approve: boolean; reason: string }) {
  const [open, setOpen] = useState(false);
  const chair = c.requester?.name?.split(/\s+/)[0] ?? "there";
  const subject = approve ? `${c.acronym} is approved` : `Your request for ${c.acronym}`;
  const body = approve
    ? `Dear ${chair},\n\nYour request to host ${c.acronym} (${c.title}) on Smartconferu has been approved. Open your conference to add the call for papers, tracks, deadlines and reviewers.`
    : `Dear ${chair},\n\nThank you for your interest in hosting ${c.acronym} on Smartconferu. We weren't able to approve the request${reason.trim() ? `:\n\n“${reason.trim()}”` : "."}\n\nYou can send a new request any time from My Conferences.`;
  return (
    <div className="rounded-xl mb-4 text-[12.5px]" style={{ border: "1px solid var(--border)", background: "var(--canvas)" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left cursor-pointer">
        <Mail size={15} className="shrink-0" style={{ color: "var(--primary)" }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ color: "var(--text-muted)" }}>
            Email to {c.requester?.email ?? "the chair"}
          </span>
          <span className="block truncate font-semibold" style={{ color: "var(--text)" }}>
            {subject}
          </span>
        </span>
        <span className="text-[12px] font-semibold shrink-0" style={{ color: "var(--primary)" }}>
          {open ? "Hide" : "Preview"}
        </span>
      </button>
      {open && (
        <p className="px-3.5 pb-3 whitespace-pre-line max-h-[180px] overflow-y-auto border-t pt-2.5" style={{ color: "var(--text-soft)", borderColor: "var(--border)" }}>
          {body}
        </p>
      )}
    </div>
  );
}

function useOpenParam() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("open");
  const setOpen = (id: string | null) => router.replace(id ? `?open=${id}` : "?", { scroll: false });
  return [open, setOpen] as const;
}

/** Decisions waiting out their undo window; leaving the page sends them straight away. */
function useHeldDecisions() {
  const held = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; send: () => void }>());
  useEffect(() => {
    const map = held.current;
    const flush = () => map.forEach((h) => {
      clearTimeout(h.timer);
      h.send();
    });
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  const hold = useCallback((key: string, send: () => void) => {
    const run = () => {
      held.current.delete(key);
      send();
    };
    held.current.set(key, { timer: setTimeout(run, UNDO_MS), send: run });
  }, []);
  const cancel = useCallback((key: string) => {
    const h = held.current.get(key);
    if (h) clearTimeout(h.timer);
    held.current.delete(key);
  }, []);
  return { hold, cancel };
}

type Tab = "pending" | "resolved" | "all";

// ---------- Conference Requests ----------

export function ConferenceRequestsPage() {
  const { data, error, loading, reload } = useData(() => loadConferences());
  const [open, setOpen] = useOpenParam();
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  // Decisions shown at once (and held back for Undo) before the API confirms them.
  const [decided, setDecided] = useState<Record<string, "approved" | "declined">>({});
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const { hold, cancel } = useHeldDecisions();
  const work = useQueueState("requests");

  const requests = useMemo(() => (data ?? []).filter((c) => c.status !== "deleted"), [data]);
  const statusOf = useCallback((c: AdminConference): string => (decided[c.id] as string | undefined) ?? outcomeOf(c), [decided]);
  const counts = { pending: requests.filter((c) => statusOf(c) === "pending").length, resolved: requests.filter((c) => statusOf(c) !== "pending").length, all: requests.length };
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests
      .filter((c) => tab === "all" || (tab === "pending" ? statusOf(c) === "pending" : statusOf(c) !== "pending"))
      .filter((c) => !q || `${c.title} ${c.acronym} ${c.requester?.name ?? ""} ${c.country ?? ""}`.toLowerCase().includes(q))
      // Approval queues work oldest-first (the request that has waited longest on top); resolved ones newest first.
      .sort((a, b) => {
        const pa = statusOf(a) === "pending";
        if (pa !== (statusOf(b) === "pending")) return pa ? -1 : 1;
        return pa ? (a.createdAt ?? "").localeCompare(b.createdAt ?? "") : (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      });
  }, [requests, tab, query, statusOf]);
  const { sorted, sort, toggle } = useSort(rows, {
    conference: { get: (c) => c.acronym },
    by: { get: (c) => c.requester?.name ?? "" },
    dates: { get: (c) => c.startDate ?? "" },
    location: { get: location },
    papers: { get: (c) => Number(detail(c, "estimatedSubmissions")) || 0 },
    waiting: { get: (c) => c.createdAt ?? "", first: tab === "pending" ? "asc" : "desc" },
  });

  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  // `open` is the conference's id (the console's own links) or its slug (a notification only knows the slug).
  const current = requests.find((c) => c.id === open || c.slug === open) ?? null;
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} className={className} />;

  const decide = (c: AdminConference, approve: boolean, reason: string) => {
    const key = `${c.id}:${Date.now()}`;
    setDecided((d) => ({ ...d, [c.id]: approve ? "approved" : "declined" }));
    setOpen(null);
    hold(key, () => {
      decideConferenceRequest(c.id, approve, reason)
        .then(() => reload())
        .catch((e: unknown) => {
          setDecided((d) => {
            const next = { ...d };
            delete next[c.id];
            return next;
          });
          setToast({ text: `Couldn't save the decision on ${c.acronym}: ${errorText(e)}` });
        });
    });
    setToast({
      text: approve ? `${c.acronym} approved — chair notified` : `${c.acronym} declined`,
      undo: () => {
        cancel(key);
        setDecided((d) => {
          const next = { ...d };
          delete next[c.id];
          return next;
        });
        setToast({ text: "Undone — nothing was sent" });
      },
    });
  };

  return (
    <>
      <PageTitle title="Conference Requests" icon={CalendarPlus} />
      <Card className="!p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 pt-5 pb-4">
          <div className="flex gap-1" role="tablist">
            {(["pending", "resolved", "all"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`sa-tab ${tab === t ? "active" : ""} cursor-pointer`}>
                {t === "pending" ? "Pending" : t === "resolved" ? "Resolved" : "All"} <span className="ml-1 opacity-70">{counts[t]}</span>
              </button>
            ))}
          </div>
          <label className="relative md:w-72">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conference requests" aria-label="Search conference requests" className="sa-input !pl-9" />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
          </label>
        </div>

        {/* Phones: one card per item instead of a wide table. */}
        <ul className="md:hidden border-t" style={{ borderColor: "var(--border)" }}>
          {sorted.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setOpen(c.id)} className="flex-1 min-w-0 text-left cursor-pointer">
                <TitleCell title={c.acronym} sub={c.title} />
                <div className="mt-2 text-[13px]">
                  <Person name={c.requester?.name ?? "—"} sub="Chair" />
                </div>
                <div className="flex items-center gap-2 mt-2">{statusOf(c) === "pending" ? <WaitingBadge since={c.createdAt ?? ""} /> : <OutcomeBadge status={statusOf(c)} />}</div>
              </button>
              <ChevronRight size={18} className="mt-1 shrink-0" style={{ color: "var(--text-faint)" }} />
            </li>
          ))}
          {!rows.length && (
            <li className="px-4 py-12 text-center text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              {query ? "Nothing matches your search." : "All caught up."}
            </li>
          )}
        </ul>
        <div className="hidden md:block overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                {th("Conference", "conference", "!pl-6")}
                {th("Requested by", "by")}
                {th("Dates", "dates")}
                {th("Location", "location")}
                {th("Est. papers", "papers")}
                {th(tab === "pending" ? "Waiting" : tab === "resolved" ? "Resolved" : "Status", "waiting")}
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="sa-clickable cursor-pointer" onClick={() => setOpen(c.id)}>
                  <td className="!pl-6">
                    <TitleCell title={c.acronym} sub={c.title} />
                  </td>
                  <td>
                    <Person name={c.requester?.name ?? "—"} sub={detail(c, "requesterRole") ?? "Chair"} />
                  </td>
                  <td>
                    <span className="whitespace-nowrap">{fmtDate(c.startDate)}</span>
                  </td>
                  <td>{location(c)}</td>
                  <td>{detail(c, "estimatedSubmissions") ?? "—"}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {statusOf(c) === "pending" ? <WaitingBadge since={c.createdAt ?? ""} /> : <OutcomeBadge status={statusOf(c)} />}
                      {statusOf(c) === "pending" && <ClaimMarks claim={work.claimOf(c.id)} notes={work.notesOf(c.id).filter((n) => n.kind === "note").length} />}
                    </div>
                  </td>
                  <td className="pr-6 text-right">
                    <ChevronRight size={18} style={{ color: "var(--text-faint)" }} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="!py-16 text-center">
                    <div className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-3" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                      <PartyPopper size={26} />
                    </div>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {query ? "Nothing matches your search" : tab === "pending" ? "All caught up" : "Nothing here yet"}
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {query ? "Try a different name or acronym." : tab === "pending" ? "No requests are waiting for a decision." : ""}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {current && (
        <RequestDrawer
          key={current.id}
          c={current}
          status={statusOf(current)}
          claim={work.claimOf(current.id)}
          notes={work.notesOf(current.id)}
          onWorkChanged={work.reload}
          onClose={() => setOpen(null)}
          onDecide={decide}
        />
      )}
      <Toast text={toast?.text ?? null} undo={toast?.undo} onDone={() => setToast(null)} />
    </>
  );
}

function RequestDrawer({
  c,
  status,
  claim,
  notes,
  onWorkChanged,
  onClose,
  onDecide,
}: {
  c: AdminConference;
  status: string;
  claim: { admin: { id: string; name: string }; claimedAt: string } | null;
  notes: AdminNote[];
  onWorkChanged: () => void;
  onClose: () => void;
  onDecide: (c: AdminConference, approve: boolean, reason: string) => void;
}) {
  const [active, setActive] = useState<"approve" | "decline" | null>(null);
  const [reason, setReason] = useState("");
  const pending = status === "pending";
  const footer = !pending ? (
    <div className="flex items-center gap-3 text-[13.5px]">
      <OutcomeBadge status={status} />
      <span style={{ color: "var(--text-soft)" }}>{status === "declined" ? "Declined" : "Approved"}</span>
    </div>
  ) : (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        tone="danger"
        variant="outline"
        onClick={() => {
          setReason("");
          setActive("decline");
        }}
      >
        <X size={16} />
        Decline
      </Button>
      <Button tone="success" onClick={() => setActive("approve")}>
        <Check size={16} />
        Approve
      </Button>
    </div>
  );

  return (
    <Drawer open onClose={onClose} title={c.title} subtitle={`${c.acronym} · ${refOf(c)}`} footer={footer}>
      {pending && <ClaimBar queue="requests" itemId={c.id} since={c.createdAt ?? ""} waiting={<WaitingBadge since={c.createdAt ?? ""} />} claim={claim} onChanged={onWorkChanged} />}
      <Section title="Conference">
        <Fields
          rows={[
            ["Acronym", c.acronym],
            ["Web page", <ExtLink key="w" href={c.webPage} />],
            ["Dates", c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : null],
            ["Venue", [c.venue, c.city, c.country].filter(Boolean).join(", ")],
            ["Research area", [c.primaryArea, c.secondaryArea].filter(Boolean).join(" › ")],
            ["Est. submissions", detail(c, "estimatedSubmissions")],
          ]}
        />
      </Section>
      <Section title="Organizer">
        <Fields
          rows={[
            ["Organizing body", detail(c, "organizer") ?? c.requester?.affiliation ?? null],
            ["Chair", c.requester?.name],
            ["Role", detail(c, "requesterRole") ?? "Chair"],
            ["Email", c.requester?.email ?? c.contactEmail],
            ["Phone", detail(c, "contactPhone")],
          ]}
        />
      </Section>
      <InternalNotes queue="requests" itemId={c.id} notes={notes} onChanged={onWorkChanged} />

      {/* The decision is confirmed in a popup over the drawer: what happens, any reason, the email that goes out. */}
      {pending && (active === "approve" || active === "decline") && (
        <Modal
          title={`${active === "approve" ? "Approve" : "Decline"}?`}
          subtitle={c.title}
          onClose={() => setActive(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button tone="neutral" variant="soft" onClick={() => setActive(null)}>
                Cancel
              </Button>
              <Button tone={active === "approve" ? "success" : "danger"} disabled={active === "decline" && !reason.trim()} onClick={() => onDecide(c, active === "approve", active === "decline" ? reason.trim() : "")}>
                {active === "approve" ? <Check size={16} /> : <X size={16} />}
                {active === "approve" ? "Approve" : "Decline"}
              </Button>
            </div>
          }
        >
          {active === "approve" && (
            <p className="text-[13.5px] mb-4" style={{ color: "var(--text-soft)" }}>
              The conference goes live and {c.requester?.name ?? "the chair"} gets an email to set it up.
            </p>
          )}
          {active === "decline" && (
            <div className="mb-4">
              <label className="block">
                <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                  Reason (shown to the chair)<span style={{ color: "var(--danger)" }}> *</span>
                </span>
                <textarea rows={3} className="sa-input resize-none !h-auto py-2.5" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={1000} />
              </label>
              <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Common reasons">
                {DECLINE_REASONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setReason(t)}
                    className="rounded-full px-2.5 py-1 text-[12px] text-left transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] cursor-pointer"
                    style={{ border: `1px solid ${reason === t ? "var(--primary)" : "var(--border)"}`, color: reason === t ? "var(--primary)" : "var(--text-soft)", background: reason === t ? "var(--primary-soft)" : "#FFFFFF" }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <EmailPreview c={c} approve={active === "approve"} reason={reason} />
        </Modal>
      )}
    </Drawer>
  );
}

// ---------- Deletion Requests ----------

export function DeletionRequestsPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useData(async () => {
    const asks = (await loadDeletionRequests("pending")).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // Papers each conference holds (what deleting would hide).
    const papers = await Promise.all(asks.map((d) => loadConferencePapers(d.conferenceId).then((p) => p.filter((x) => x.status !== "draft").length).catch(() => null)));
    return asks.map((d, i) => ({ ...d, papers: papers[i] }));
  });
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const open = (conferenceId: string) => router.push(`/super-admin/conferences/${conferenceId}`);
  return (
    <>
      <PageTitle title="Deletion Requests" description="Chairs asking for an archived conference to be deleted. Oldest first." icon={Trash2} />
      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="!pl-6">Conference</th>
                <th>Asked by</th>
                <th>Reason</th>
                <th>Papers</th>
                <th>Asked on</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="sa-clickable cursor-pointer" onClick={() => open(d.conferenceId)}>
                  <td className="!pl-6">
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {d.acronym}
                    </p>
                    <p className="text-[12.5px] truncate max-w-[300px]" style={{ color: "var(--text-muted)" }}>
                      {d.title}
                    </p>
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={d.requestedBy.name} size={32} />
                      <span className="whitespace-nowrap">{d.requestedBy.name}</span>
                    </div>
                  </td>
                  <td className="text-[13px] max-w-[320px]" style={{ color: "var(--text-muted)" }}>
                    “{d.reason}”
                  </td>
                  <td className="font-semibold" style={{ color: "var(--text)" }}>
                    {d.papers ?? "—"}
                  </td>
                  <td className="text-[13px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {fmtDate(d.createdAt)}
                  </td>
                  <td className="text-right !pr-6">
                    <Button tone="neutral" variant="soft">
                      Review
                      <ArrowRight size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td colSpan={6} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                    No deletion requests are waiting.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
