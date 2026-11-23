"use client";
/* "New requests" on a master-data page (Institutions, Societies, Research Areas): names members typed because they were not
   on the list (they show "Pending review" on the member's profile). The Super Admin approves one into the list right here,
   links it to an entry already listed, or rejects it with a reason. People who typed the same name are one item. */
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
  approveProfileRequest,
  loadInstitutions,
  loadProfileRequests,
  loadResearchAreas,
  loadSocieties,
  rejectProfileRequest,
  type ProfileRequest,
} from "../services";
import { useData } from "../use-data";
import { Badge, Button, Drawer, Empty, errorText, ExtLink, fmtDate, Pagination, TextField, Toast, usePaging, waitingLabel } from "./ui";

type Mode = "add" | "link" | "reject";
type Option = { id: string; label: string };

const NOUN = { institution: "institution", society: "society", research_area: "research area" } as const;
const LIST_NAME = { institution: "Institutions", society: "Societies", research_area: "Research Areas" } as const;
const people = (r: ProfileRequest) => (r.requesters.length === 1 ? r.requesters[0].name : `${r.requesters[0].name} +${r.requesters.length - 1} more`);

/** The entries a request can be linked to ("same as one already on the list"). */
async function listedOptions(r: ProfileRequest): Promise<{ options: Option[]; groups: string[] }> {
  if (r.kind === "society") return { groups: [], options: (await loadSocieties()).filter((x) => x.status === "active").map((x) => ({ id: x.id, label: `${x.name} (${x.acronym})` })) };
  if (r.kind === "institution") return { groups: [], options: (await loadInstitutions()).filter((x) => x.status === "active").map((x) => ({ id: x.id, label: x.name })) };
  const groups = await loadResearchAreas();
  const secondary = Boolean(r.parentName);
  return {
    groups: groups.map((g) => g.label),
    options: groups.flatMap((g) => g.areas.filter((a) => a.status === "active").flatMap((a) => (secondary ? a.subareas.filter((s) => s.status === "active").map((s) => ({ id: s.id, label: `${a.name} › ${s.name}` })) : [{ id: a.id, label: a.name }]))),
  };
}

function Decision({ request, onClose, onDone }: { request: ProfileRequest; onClose: () => void; onDone: (text: string) => void }) {
  const { kind } = request;
  const pending = request.status === "pending";
  const [mode, setMode] = useState<Mode>("add");
  const [name, setName] = useState(request.name);
  const [acronym, setAcronym] = useState("");
  const [url, setUrl] = useState(request.url ?? "");
  const [country, setCountry] = useState("");
  const [group, setGroup] = useState("");
  const [intoId, setIntoId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listed = useData(() => listedOptions(request), [request.id]);
  const options = useMemo(() => [...(listed.data?.options ?? [])].sort((a, b) => a.label.localeCompare(b.label)), [listed.data]);
  const groups = listed.data?.groups ?? [];

  const needsGroup = kind === "research_area" && !request.parentName;
  const valid = mode === "add" ? name.trim().length >= 2 && (kind !== "society" || acronym.trim().length > 0) && (!needsGroup || group.trim().length > 0) : mode === "link" ? Boolean(intoId) : reason.trim().length >= 3;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "reject") {
        await rejectProfileRequest(request.id, reason.trim());
        onDone(`“${request.name}” was rejected — the member was told why`);
      } else if (mode === "link") {
        await approveProfileRequest(request.id, { intoId });
        onDone(`“${request.name}” was linked — “Pending review” is cleared`);
      } else {
        const body = kind === "society" ? { acronym: acronym.trim(), url: url.trim() || undefined } : kind === "institution" ? { country: country.trim() || undefined } : needsGroup ? { group: group.trim() } : {};
        await approveProfileRequest(request.id, { name: name.trim(), ...body });
        onDone(`“${name.trim()}” was added to ${LIST_NAME[kind]} — “Pending review” is cleared`);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={request.name}
      subtitle={request.parentName ? `Secondary area under “${request.parentName}”` : `New ${NOUN[kind]}`}
      footer={
        pending ? (
          <div className="flex justify-end gap-2">
            <Button tone="neutral" variant="soft" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button tone={mode === "reject" ? "danger" : "primary"} onClick={() => void submit()} busy={busy} disabled={!valid}>
              {mode === "reject" ? "Reject" : mode === "link" ? "Link to this entry" : "Approve and add to list"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <p className="mb-1 text-[13px] font-semibold" style={{ color: "var(--text)" }}>
        Requested by {request.requesters.length === 1 ? "1 member" : `${request.requesters.length} members`}
      </p>
      <ul className="mb-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
        {request.requesters.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.email ? ` · ${p.email}` : ""}
          </li>
        ))}
      </ul>
      {request.url && (
        <p className="mb-4 text-[13px]">
          <span className="font-semibold" style={{ color: "var(--text)" }}>Website they gave: </span>
          <ExtLink href={request.url} />
        </p>
      )}

      {!pending ? (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          {request.status === "approved" ? `Approved on ${fmtDate(request.resolvedAt)} as “${request.resolvedName}”.` : `Rejected on ${fmtDate(request.resolvedAt)}: ${request.reason}`}
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-2" role="radiogroup" aria-label="Decision">
            {([
              ["add", `Add as a new ${NOUN[kind]}`],
              ["link", "Same as one already on the list"],
              ["reject", "Reject"],
            ] as [Mode, string][]).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-[13.5px]" style={{ color: "var(--text)" }}>
                <input type="radio" name="decision" checked={mode === k} onChange={() => setMode(k)} />
                {label}
              </label>
            ))}
          </div>

          {mode === "add" && (
            <>
              <TextField label="Official name" value={name} onChange={setName} required hint="Fix the spelling here if needed — this is what the list and the members' profiles will show." />
              {kind === "society" && (
                <>
                  <TextField label="Acronym" value={acronym} onChange={setAcronym} placeholder="e.g. ARS" required />
                  <TextField label="Website" value={url} onChange={setUrl} placeholder="https://" />
                </>
              )}
              {kind === "institution" && <TextField label="Country" value={country} onChange={setCountry} placeholder="e.g. India" />}
              {needsGroup && (
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    Heading <span style={{ color: "var(--danger)" }}>*</span>
                  </span>
                  <input className="sa-input" list="pr-groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Natural Sciences" />
                  <datalist id="pr-groups">
                    {groups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                  <span className="mt-1 block text-[12px]" style={{ color: "var(--text-muted)" }}>Pick an existing heading or type a new one.</span>
                </label>
              )}
              {kind === "research_area" && request.parentName && (
                <p className="mb-4 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                  It is added under the primary area “{request.parentName}”. If that primary area is not on the list yet, approve it first.
                </p>
              )}
            </>
          )}
          {mode === "link" && (
            <label className="mb-4 block">
              <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                Which entry is it?
              </span>
              <select className="sa-input cursor-pointer" value={intoId} onChange={(e) => setIntoId(e.target.value)}>
                <option value="">Choose…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[12px]" style={{ color: "var(--text-muted)" }}>
                The member&apos;s profile will show the listed name.
              </span>
            </label>
          )}
          {mode === "reject" && (
            <label className="mb-4 block">
              <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                Reason (the member sees this) <span style={{ color: "var(--danger)" }}>*</span>
              </span>
              <textarea className="sa-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. We couldn't verify this. Please pick one from the list." />
            </label>
          )}
          {error && (
            <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </>
      )}
    </Drawer>
  );
}

/** The requests of one master-data page: what is waiting, and what was answered. Shared by the page (for its tab count) and the tab. */
export function useProfileRequests(kind: ProfileRequest["kind"]) {
  const pending = useData(() => loadProfileRequests(kind, "pending"), [kind]);
  const resolved = useData(() => loadProfileRequests(kind, "resolved"), [kind]);
  const reload = () => { pending.reload(); resolved.reload(); };
  return { pending: pending.data ?? [], resolved: resolved.data ?? [], waiting: pending.data?.length ?? 0, reload };
}
export type ProfileRequestsState = ReturnType<typeof useProfileRequests>;

/** The "New requests" tab of a master-data page: Waiting / Answered, one row per name (people who typed the same name are one row). */
export function ProfileRequestsPanel({ kind, reqs, query = "", onApproved }: { kind: ProfileRequest["kind"]; reqs: ProfileRequestsState; query?: string; onApproved?: () => void }) {
  const [view, setView] = useState<"waiting" | "answered">("waiting");
  const [open, setOpen] = useState<ProfileRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const source = view === "waiting" ? reqs.pending : reqs.resolved;
  const rows = source.filter((r) => !q || `${r.name} ${r.parentName ?? ""} ${r.requesters.map((p) => p.name).join(" ")}`.toLowerCase().includes(q));
  const paging = usePaging(rows, `${view}|${q}`);
  const done = (text: string) => {
    setOpen(null);
    setToast(text);
    reqs.reload();
    onApproved?.();
  };
  const chip = (k: "waiting" | "answered", label: string, n: number) => (
    <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`sa-tab ${view === k ? "active" : ""} cursor-pointer`}>
      {label} <span className="ml-1 opacity-70">{n}</span>
    </button>
  );

  return (
    <>
      <div className="px-6 pb-3">
        <p className="mb-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
          {NOUN[kind][0].toUpperCase()}{NOUN[kind].slice(1)} names members typed because they were not on the list. They show “Pending review” on the member&apos;s profile until you answer.
        </p>
        <div className="flex gap-1">
          {chip("waiting", "Waiting", reqs.pending.length)}
          {chip("answered", "Answered", reqs.resolved.length)}
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty>{view === "waiting" ? (reqs.pending.length ? "No request matches your search." : "All caught up — nothing is waiting for review.") : reqs.resolved.length ? "No request matches your search." : "Nothing answered yet."}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="!pl-6">Name typed</th>
                <th>Requested by</th>
                <th>{view === "waiting" ? "Waiting" : "Answered"}</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {paging.rows.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                  <td className="!pl-6">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{r.name}</span>
                    {r.parentName && <span className="block text-[12.5px]" style={{ color: "var(--text-muted)" }}>under {r.parentName}</span>}
                  </td>
                  <td className="text-[13px]">{people(r)}</td>
                  <td className="text-[13px]">{r.status === "pending" ? waitingLabel(r.createdAt) : fmtDate(r.resolvedAt)}</td>
                  <td className="pr-6 text-right">
                    {r.status === "pending" ? (
                      <Button variant="soft" onClick={() => setOpen(r)}>Review</Button>
                    ) : r.status === "approved" ? (
                      <Badge tone="success"><Check size={12} className="mr-1 inline" aria-hidden="true" />Approved</Badge>
                    ) : (
                      <Badge tone="danger"><X size={12} className="mr-1 inline" aria-hidden="true" />Rejected</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination paging={paging} />
      {open && <Decision request={open} onClose={() => setOpen(null)} onDone={done} />}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
