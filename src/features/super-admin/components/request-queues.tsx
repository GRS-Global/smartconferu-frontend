"use client";
/* The two live approval queues (the prototype's QueuePage for "conference-requests" and its
   DeletionRequestsPage): Waiting / Decided tabs, a drawer with the request and Approve / Decline
   (decline needs a reason, which the chair is emailed). The prototype's "Ask for info", claiming
   and bulk actions are not in the launch. */
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarPlus, Check, Trash2, X } from "lucide-react";
import {
  decideConferenceRequest,
  decideDeletionRequest,
  loadConferences,
  loadDeletionRequests,
  type AdminConference,
  type DeletionRequest,
} from "../services";
import { useData } from "../use-data";
import { Avatar, Badge, Button, Card, Drawer, errorText, ExtLink, Failed, Fields, fmtDate, Loading, PageTitle, Section, Toast, Toolbar, WaitingBadge, type Icon } from "./ui";

const CONFERENCE_DECLINE_REASONS = [
  "This isn't an academic event.",
  "We couldn't verify the organizing body.",
  "The conference web page or dates are missing.",
  "This conference is already on Smartconferu.",
];
const DELETION_REJECT_REASONS = [
  "The conference still has papers under review.",
  "Please archive the conference instead; it keeps the record for authors.",
];

interface Item {
  id: string;
  title: string;
  subtitle: string;
  person: string;
  since: string;
  pending: boolean;
  outcome?: { label: string; tone: "success" | "danger" | "neutral"; note: string | null; at: string | null };
}

function DecisionForm({ reasons, approveLabel, declineLabel, approveTone, onDecide }: { reasons: string[]; approveLabel: string; declineLabel: string; approveTone: "success" | "danger"; onDecide: (approve: boolean, note: string) => Promise<void> }) {
  const [mode, setMode] = useState<"approve" | "decline" | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = mode === "decline" ? [reason, note.trim()].filter(Boolean).join(" ") : note.trim();
  const go = async () => {
    if (mode === "decline" && !text) {
      setError("Give a reason: it is emailed to the chair.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onDecide(mode === "approve", text);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  if (!mode) {
    return (
      <div className="flex justify-end gap-2">
        <Button tone="danger" variant="outline" onClick={() => setMode("decline")}>
          <X size={15} />
          {declineLabel}
        </Button>
        <Button tone={approveTone} onClick={() => setMode("approve")}>
          <Check size={15} />
          {approveLabel}
        </Button>
      </div>
    );
  }
  return (
    <div>
      {mode === "decline" && (
        <label className="block mb-3">
          <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
            Reason <span style={{ color: "var(--danger)" }}>*</span>
          </span>
          <select className="sa-input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason, or write one below</option>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block mb-3">
        <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          {mode === "decline" ? "More detail (optional)" : "Note to the chair (optional)"}
        </span>
        <textarea className="sa-input !h-auto py-2.5" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </label>
      {error && (
        <p role="alert" className="text-[13px] mb-3" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button tone="neutral" variant="outline" onClick={() => setMode(null)} disabled={busy}>
          Back
        </Button>
        <Button tone={mode === "approve" ? approveTone : "danger"} busy={busy} onClick={() => void go()}>
          {mode === "approve" ? approveLabel : declineLabel}
        </Button>
      </div>
    </div>
  );
}

function QueueList({ title, description, icon, items, onOpen }: { title: string; description: string; icon: Icon; items: Item[]; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return items
      .filter((i) => (tab === "pending" ? i.pending : !i.pending))
      .filter((i) => !q || `${i.title} ${i.subtitle} ${i.person}`.toLowerCase().includes(q))
      .sort((a, b) => (tab === "pending" ? a.since.localeCompare(b.since) : (b.outcome?.at ?? b.since).localeCompare(a.outcome?.at ?? a.since)));
  }, [items, tab, query]);
  return (
    <>
      <PageTitle title={title} description={description} icon={icon} />
      <Card className="!p-0">
        <Toolbar
          tabs={[
            ["pending", "Waiting", items.filter((i) => i.pending).length],
            ["decided", "Decided", items.filter((i) => !i.pending).length],
          ]}
          tab={tab}
          setTab={setTab}
          query={query}
          setQuery={setQuery}
          placeholder="Search requests"
        />
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="!pl-6">Request</th>
                <th>Asked by</th>
                <th>{tab === "pending" ? "Waiting" : "Outcome"}</th>
                <th>Asked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="sa-clickable" onClick={() => onOpen(i.id)}>
                  <td className="!pl-6">
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {i.title}
                    </p>
                    <p className="text-[12.5px] truncate max-w-[380px]" style={{ color: "var(--text-muted)" }}>
                      {i.subtitle}
                    </p>
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={i.person} size={32} />
                      <span className="whitespace-nowrap">{i.person}</span>
                    </div>
                  </td>
                  <td>{i.pending ? <WaitingBadge since={i.since} /> : <Badge tone={i.outcome?.tone ?? "neutral"}>{i.outcome?.label}</Badge>}</td>
                  <td className="text-[13px] whitespace-nowrap">{fmtDate(i.since)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                    {tab === "pending" ? "Nothing is waiting. Every request has been decided." : "No decided requests yet."}
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

function useOpenParam() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("open");
  const setOpen = (id: string | null) => router.replace(id ? `?open=${id}` : "?", { scroll: false });
  return [open, setOpen] as const;
}

// ---------- Conference Requests ----------

export function ConferenceRequestsPage() {
  const { data, error, loading, reload } = useData(() => loadConferences());
  const [open, setOpen] = useOpenParam();
  const [toast, setToast] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const requests = data.filter((c) => c.status !== "deleted");
  const items: Item[] = requests.map((c) => ({
    id: c.id,
    title: c.acronym,
    subtitle: c.title,
    person: c.requester?.name ?? "—",
    since: c.createdAt ?? "",
    pending: c.status === "pending_approval",
    outcome: c.status === "rejected" ? { label: "Declined", tone: "danger", note: null, at: null } : { label: "Approved", tone: "success", note: null, at: null },
  }));
  const current: AdminConference | undefined = requests.find((c) => c.id === open);
  return (
    <>
      <QueueList title="Conference Requests" description="New conferences waiting for approval. Approving makes them live and tells the chair." icon={CalendarPlus} items={items} onOpen={setOpen} />
      <Drawer open={Boolean(current)} onClose={() => setOpen(null)} title={current ? `${current.acronym} — conference request` : ""} subtitle={current?.title} footer={current?.status === "pending_approval" ? (
        <DecisionForm
          reasons={CONFERENCE_DECLINE_REASONS}
          approveLabel="Approve"
          declineLabel="Decline"
          approveTone="success"
          onDecide={async (approve, note) => {
            await decideConferenceRequest(current.id, approve, note);
            setToast(approve ? `${current.acronym} approved — the chair has been told` : `${current.acronym} declined — the chair has been told`);
            setOpen(null);
            reload();
          }}
        />
      ) : undefined}>
        {current && (
          <>
            <Section title="Conference">
              <Fields
                rows={[
                  ["Acronym", current.acronym],
                  ["Full name", current.title],
                  ["Dates", current.startDate ? `${fmtDate(current.startDate)} – ${fmtDate(current.endDate)}` : null],
                  ["Venue", [current.venue, current.city, current.country].filter(Boolean).join(", ")],
                  ["Research area", [current.primaryArea, current.secondaryArea].filter(Boolean).join(" › ")],
                  ["Website", <ExtLink key="w" href={current.webPage} />],
                  ["About", current.about],
                ]}
              />
            </Section>
            <Section title="Asked for by">
              <Fields rows={[["Name", current.requester?.name], ["Email", current.requester?.email], ["Affiliation", current.requester?.affiliation], ["Asked", fmtDate(current.createdAt)]]} />
            </Section>
            {current.status !== "pending_approval" && (
              <Section title="Decision">
                <Badge tone={current.status === "rejected" ? "danger" : "success"}>{current.status === "rejected" ? "Declined" : "Approved"}</Badge>
              </Section>
            )}
          </>
        )}
      </Drawer>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}

// ---------- Deletion Requests ----------

const DELETION_OUTCOME: Record<DeletionRequest["status"], { label: string; tone: "success" | "danger" | "neutral" }> = {
  pending: { label: "Waiting", tone: "neutral" },
  approved: { label: "Deleted", tone: "danger" },
  rejected: { label: "Kept", tone: "success" },
  cancelled: { label: "Taken back", tone: "neutral" },
};

export function DeletionRequestsPage() {
  const { data, error, loading, reload } = useData(() => loadDeletionRequests());
  const [open, setOpen] = useOpenParam();
  const [toast, setToast] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const items: Item[] = data.map((d) => ({
    id: d.id,
    title: d.acronym,
    subtitle: d.reason,
    person: d.requestedBy.name,
    since: d.createdAt,
    pending: d.status === "pending",
    outcome: { ...DELETION_OUTCOME[d.status], note: d.adminNote, at: d.decidedAt },
  }));
  const current = data.find((d) => d.id === open);
  return (
    <>
      <QueueList title="Deletion Requests" description="Chairs asking to delete an archived conference. Approving deletes it; it can be brought back from Conferences › Deleted." icon={Trash2} items={items} onOpen={setOpen} />
      <Drawer open={Boolean(current)} onClose={() => setOpen(null)} title={current ? `Delete ${current.acronym}?` : ""} subtitle={current?.title} footer={current?.status === "pending" ? (
        <DecisionForm
          reasons={DELETION_REJECT_REASONS}
          approveLabel="Delete conference"
          declineLabel="Keep it"
          approveTone="danger"
          onDecide={async (approve, note) => {
            await decideDeletionRequest(current.id, approve, note);
            setToast(approve ? `${current.acronym} deleted — the chair has been told` : `${current.acronym} kept — the chair has been told`);
            setOpen(null);
            reload();
          }}
        />
      ) : undefined}>
        {current && (
          <>
            <Section title="Request">
              <Fields rows={[["Conference", `${current.acronym} — ${current.title}`], ["Reason", current.reason], ["Asked by", `${current.requestedBy.name}${current.requestedBy.email ? ` (${current.requestedBy.email})` : ""}`], ["Asked", fmtDate(current.createdAt)]]} />
            </Section>
            {current.status !== "pending" && (
              <Section title="Decision">
                <Fields rows={[["Outcome", <Badge key="o" tone={DELETION_OUTCOME[current.status].tone}>{DELETION_OUTCOME[current.status].label}</Badge>], ["Note", current.adminNote], ["Decided", fmtDate(current.decidedAt)]]} />
              </Section>
            )}
          </>
        )}
      </Drawer>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
