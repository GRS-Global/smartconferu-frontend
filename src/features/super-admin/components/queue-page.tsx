"use client";
/* One approval queue, driven by a config (the prototype's QueuePage + queues.jsx): Pending /
   Resolved / All tabs, search, sortable columns, a card list on phones, the "All caught up" state,
   and a drawer with the item and its decisions. A decision is confirmed in a popup (its form with
   one-click reasons, and the email that goes out), shown at once, and held back 10 seconds with
   Undo before it is sent. Used by License Extensions and CFP Page Review. */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Mail, PartyPopper, Search } from "lucide-react";
import type { QueueKey } from "../pending";
import type { AdminNote } from "../services";
import { ClaimBar, ClaimMarks, InternalNotes, useQueueState } from "./queue-extras";
import { Badge, Button, Card, Drawer, errorText, fmtDate, Modal, PageTitle, SortTh, Toast, UNDO_MS, useSort, WaitingBadge, type Icon, type Tone } from "./ui";

/** Outcome badges for resolved items, shared by every queue (the prototype's OUTCOMES). */
export const OUTCOMES: Record<string, [string, Tone]> = {
  pending: ["Pending", "warning"],
  approved: ["Approved", "success"],
  published: ["Published", "success"],
  corrected: ["Corrected", "primary"],
  merged: ["Merged", "accent"],
  sent_back: ["Sent back", "warning"],
  declined: ["Declined", "danger"],
  rejected: ["Rejected", "danger"],
  removed: ["Link removed", "danger"],
  locked: ["Link locked", "danger"],
  dismissed: ["Dismissed", "neutral"],
  withdrawn: ["Withdrawn by chair", "neutral"],
  cancelled: ["Cancelled by chair", "neutral"],
};
export function OutcomeBadge({ status }: { status: string }) {
  const [label, tone] = OUTCOMES[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

export interface QueueColumn<T> {
  label: string;
  sort?: (r: T) => string | number | null;
  render: (r: T) => ReactNode;
}
export interface QueueField {
  name: string;
  label: string;
  type: "textarea" | "text" | "date" | "select";
  required?: boolean;
  templates?: string[];
  options?: string[];
  initial?: string;
  min?: string;
}
export type Values = Record<string, string>;
export interface QueueAction<T> {
  key: string;
  label: string;
  icon: Icon;
  tone: Tone;
  variant?: "solid" | "soft" | "outline";
  /** Shown, disabled, "Coming soon". */
  soon?: boolean;
  /** The outcome shown at once while the decision is held for Undo. */
  status: string;
  confirm?: (r: T) => string;
  form?: (r: T) => QueueField[];
  email?: (r: T, v: Values) => { to: string; subject: string; body: string } | null;
  run: (r: T, v: Values) => Promise<unknown>;
  toast: (r: T, v: Values) => string;
}
export interface QueueConfig<T> {
  /** The API's key for this queue: claims and internal notes. */
  queueKey: QueueKey;
  title: string;
  icon: Icon;
  noun: string;
  idOf: (r: T) => string;
  statusOf: (r: T) => string;
  since: (r: T) => string;
  resolvedAt?: (r: T) => string | null;
  resolution?: (r: T) => string | null;
  search: (r: T) => string;
  columns: QueueColumn<T>[];
  drawerTitle: (r: T) => string;
  drawerSubtitle: (r: T) => string;
  detail: (r: T) => ReactNode;
  actions: QueueAction<T>[];
}

type Tab = "pending" | "resolved" | "all";

function useOpenParam() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("open");
  const setOpen = (id: string | null) => router.replace(id ? `?open=${id}` : "?", { scroll: false });
  return [open, setOpen] as const;
}

export function QueuePage<T>({ config: q, items, onChanged }: { config: QueueConfig<T>; items: T[]; onChanged: () => void }) {
  const [open, setOpen] = useOpenParam();
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [held, setHeld] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; send: () => void }>());
  const work = useQueueState(q.queueKey);

  // Leaving the page sends what is still held back.
  useEffect(() => {
    const map = timers.current;
    const flush = () =>
      map.forEach((h) => {
        clearTimeout(h.timer);
        h.send();
      });
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const statusOf = useCallback((r: T) => held[q.idOf(r)] ?? q.statusOf(r), [held, q]);
  const counts = { pending: items.filter((r) => statusOf(r) === "pending").length, resolved: items.filter((r) => statusOf(r) !== "pending").length, all: items.length };
  const rows = useMemo(() => {
    const s = query.trim().toLowerCase();
    return items
      .filter((r) => tab === "all" || (tab === "pending" ? statusOf(r) === "pending" : statusOf(r) !== "pending"))
      .filter((r) => !s || q.search(r).toLowerCase().includes(s))
      .sort((a, b) => {
        const pa = statusOf(a) === "pending";
        if (pa !== (statusOf(b) === "pending")) return pa ? -1 : 1;
        return pa ? q.since(a).localeCompare(q.since(b)) : (q.resolvedAt?.(b) ?? q.since(b)).localeCompare(q.resolvedAt?.(a) ?? q.since(a));
      });
  }, [items, tab, query, q, statusOf]);
  const spec = Object.fromEntries([
    ...q.columns.flatMap((c, i) => (c.sort ? [[`c${i}`, { get: c.sort }]] : [])),
    ["waiting", { get: (r: T) => (statusOf(r) === "pending" ? q.since(r) : (q.resolvedAt?.(r) ?? "")), first: tab === "pending" ? "asc" : "desc" }],
  ]);
  const { sorted, sort, toggle } = useSort(rows, spec);
  const current = items.find((r) => q.idOf(r) === open) ?? null;

  const decide = (r: T, action: QueueAction<T>, values: Values) => {
    const id = q.idOf(r);
    const key = `${id}:${Date.now()}`;
    const release = () =>
      setHeld((h) => {
        const next = { ...h };
        delete next[id];
        return next;
      });
    setHeld((h) => ({ ...h, [id]: action.status }));
    setOpen(null);
    const send = () => {
      timers.current.delete(key);
      action
        .run(r, values)
        .then(() => onChanged())
        .catch((e: unknown) => {
          release();
          setToast({ text: `Couldn't save the decision: ${errorText(e)}` });
        });
    };
    timers.current.set(key, { timer: setTimeout(send, UNDO_MS), send });
    setToast({
      text: action.toast(r, values),
      undo: () => {
        const t = timers.current.get(key);
        if (t) clearTimeout(t.timer);
        timers.current.delete(key);
        release();
        setToast({ text: "Undone — nothing was sent" });
      },
    });
  };

  const colCount = q.columns.length + 2;
  const statusCell = (r: T) =>
    statusOf(r) === "pending" ? (
      <div className="flex items-center gap-2">
        <WaitingBadge since={q.since(r)} />
        <ClaimMarks claim={work.claimOf(q.idOf(r))} notes={work.notesOf(q.idOf(r)).filter((n) => n.kind === "note").length} />
      </div>
    ) : (
      <OutcomeBadge status={statusOf(r)} />
    );
  return (
    <>
      <PageTitle title={q.title} icon={q.icon} />
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
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${q.title.toLowerCase()}`} aria-label={`Search ${q.title.toLowerCase()}`} className="sa-input !pl-9" />
          </label>
        </div>

        {/* Phones: one card per item instead of a wide table. */}
        <ul className="md:hidden border-t" style={{ borderColor: "var(--border)" }}>
          {sorted.map((r) => (
            <li key={q.idOf(r)} className="flex items-start gap-3 px-4 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setOpen(q.idOf(r))} className="flex-1 min-w-0 text-left cursor-pointer">
                <div className="min-w-0">{q.columns[0].render(r)}</div>
                {q.columns[1] && <div className="mt-2 text-[13px]">{q.columns[1].render(r)}</div>}
                <div className="flex items-center gap-2 mt-2">{statusCell(r)}</div>
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
                {q.columns.map((c, i) =>
                  c.sort ? (
                    <SortTh key={i} label={c.label} sortKey={`c${i}`} sort={sort} onSort={toggle} className={i === 0 ? "!pl-6" : ""} />
                  ) : (
                    <th key={i} className={i === 0 ? "!pl-6" : ""}>
                      {c.label}
                    </th>
                  ),
                )}
                <SortTh label={tab === "pending" ? "Waiting" : tab === "resolved" ? "Resolved" : "Status"} sortKey="waiting" sort={sort} onSort={toggle} />
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={q.idOf(r)} className="sa-clickable cursor-pointer" onClick={() => setOpen(q.idOf(r))}>
                  {q.columns.map((c, i) => (
                    <td key={i} className={i === 0 ? "!pl-6" : ""}>
                      {c.render(r)}
                    </td>
                  ))}
                  <td>{statusCell(r)}</td>
                  <td className="pr-6 text-right">
                    <ChevronRight size={18} style={{ color: "var(--text-faint)" }} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="!py-16 text-center">
                    <div className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-3" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                      <PartyPopper size={26} />
                    </div>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {query ? "Nothing matches your search" : tab === "pending" ? "All caught up" : "Nothing here yet"}
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {query ? "Try a different name or acronym." : tab === "pending" ? `No ${q.noun}s are waiting for a decision.` : ""}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {current && (
        <QueueDrawer
          key={q.idOf(current)}
          q={q}
          item={current}
          status={statusOf(current)}
          claim={work.claimOf(q.idOf(current))}
          notes={work.notesOf(q.idOf(current))}
          onWorkChanged={work.reload}
          onClose={() => setOpen(null)}
          onDecide={decide}
        />
      )}
      <Toast text={toast?.text ?? null} undo={toast?.undo} onDone={() => setToast(null)} />
    </>
  );
}

function QueueDrawer<T>({
  q,
  item,
  status,
  claim,
  notes,
  onWorkChanged,
  onClose,
  onDecide,
}: {
  q: QueueConfig<T>;
  item: T;
  status: string;
  claim: { admin: { id: string; name: string }; claimedAt: string } | null;
  notes: AdminNote[];
  onWorkChanged: () => void;
  onClose: () => void;
  onDecide: (r: T, a: QueueAction<T>, v: Values) => void;
}) {
  const [active, setActive] = useState<QueueAction<T> | null>(null);
  const [values, setValues] = useState<Values>({});
  const pending = status === "pending";
  const fields = active?.form?.(item) ?? [];
  const missing = fields.some((f) => f.required && !String(values[f.name] ?? "").trim());
  const start = (a: QueueAction<T>) => {
    setValues(Object.fromEntries((a.form?.(item) ?? []).map((f) => [f.name, f.initial ?? ""])));
    setActive(a);
  };
  const footer = !pending ? (
    <div className="flex items-center gap-3 text-[13.5px]">
      <OutcomeBadge status={status} />
      <span style={{ color: "var(--text-soft)" }}>
        {q.resolution?.(item) ?? "No note"}
        {q.resolvedAt?.(item) && ` · ${fmtDate(q.resolvedAt(item))}`}
      </span>
    </div>
  ) : (
    <div className="flex flex-wrap justify-end gap-2">
      {q.actions.map((a) => (
        <Button key={a.key} tone={a.tone} variant={a.variant ?? "solid"} disabled={a.soon} title={a.soon ? "Coming soon" : undefined} onClick={() => start(a)}>
          <a.icon size={16} />
          {a.label}
        </Button>
      ))}
    </div>
  );
  const email = active?.email?.(item, values) ?? null;
  return (
    <Drawer open onClose={onClose} title={q.drawerTitle(item)} subtitle={q.drawerSubtitle(item)} footer={footer}>
      {pending && <ClaimBar queue={q.queueKey} itemId={q.idOf(item)} since={q.since(item)} waiting={<WaitingBadge since={q.since(item)} />} claim={claim} onChanged={onWorkChanged} />}
      {q.detail(item)}
      <InternalNotes queue={q.queueKey} itemId={q.idOf(item)} notes={notes} onChanged={onWorkChanged} />
      {pending && active && (
        <Modal
          title={`${active.label}?`}
          subtitle={q.drawerTitle(item)}
          onClose={() => setActive(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button tone="neutral" variant="soft" onClick={() => setActive(null)}>
                Cancel
              </Button>
              <Button tone={active.tone === "neutral" ? "primary" : active.tone} disabled={missing} onClick={() => onDecide(item, active, values)}>
                <active.icon size={16} />
                {active.label}
              </Button>
            </div>
          }
        >
          {active.confirm && (
            <p className="text-[13.5px] mb-4" style={{ color: "var(--text-soft)" }}>
              {active.confirm(item)}
            </p>
          )}
          {fields.length > 0 && (
            <div className="flex flex-col gap-3 mb-4">
              {fields.map((f) => (
                <FormField key={f.name} field={f} value={values[f.name] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
              ))}
            </div>
          )}
          {email && <EmailPreview email={email} />}
        </Modal>
      )}
    </Drawer>
  );
}

/* The email this decision sends, live as the form is filled in; collapsed to the subject line. */
export function EmailPreview({ email }: { email: { to: string; subject: string; body: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl mb-4 text-[12.5px]" style={{ border: "1px solid var(--border)", background: "var(--canvas)" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left cursor-pointer">
        <Mail size={15} className="shrink-0" style={{ color: "var(--primary)" }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ color: "var(--text-muted)" }}>
            Email to {email.to}
          </span>
          <span className="block truncate font-semibold" style={{ color: "var(--text)" }}>
            {email.subject}
          </span>
        </span>
        <span className="text-[12px] font-semibold shrink-0" style={{ color: "var(--primary)" }}>
          {open ? "Hide" : "Preview"}
        </span>
      </button>
      {open && (
        <p className="px-3.5 pb-3 whitespace-pre-line max-h-[180px] overflow-y-auto border-t pt-2.5" style={{ color: "var(--text-soft)", borderColor: "var(--border)" }}>
          {email.body}
        </p>
      )}
    </div>
  );
}

function FormField({ field, value, onChange }: { field: QueueField; value: string; onChange: (v: string) => void }) {
  const label = (
    <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
      {field.label}
      {field.required && <span style={{ color: "var(--danger)" }}> *</span>}
    </span>
  );
  if (field.type === "textarea")
    return (
      <div>
        <label className="block">
          {label}
          <textarea rows={3} className="sa-input resize-none !h-auto py-2.5" value={value} onChange={(e) => onChange(e.target.value)} autoFocus maxLength={2000} />
        </label>
        {field.templates && field.templates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Common reasons">
            {field.templates.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange(t)}
                className="rounded-full px-2.5 py-1 text-[12px] text-left transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] cursor-pointer"
                style={{ border: `1px solid ${value === t ? "var(--primary)" : "var(--border)"}`, color: value === t ? "var(--primary)" : "var(--text-soft)", background: value === t ? "var(--primary-soft)" : "#FFFFFF" }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  if (field.type === "select")
    return (
      <label className="block">
        {label}
        <select className="sa-input cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
    );
  return (
    <label className="block">
      {label}
      <input type={field.type} className="sa-input" value={value} min={field.min} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
