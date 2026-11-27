"use client";
/* Super Admin › Profile Verification: members who asked for their profile to be verified. Approving puts the green tick on the
   member's profile; rejecting needs a reason. The member is emailed either way. */
import { useMemo, useState } from "react";
import { BadgeCheck, Check, X } from "lucide-react";
import { approveProfileVerification, loadProfileVerifications, rejectProfileVerification, type ProfileVerificationRequest } from "../services";
import { useData } from "../use-data";
import { Avatar, Badge, Button, Card, Drawer, Empty, errorText, ExtLink, Failed, fmtDate, Loading, PageTitle, SortTh, Toast, Toolbar, useSort, waitingLabel } from "./ui";

type Tab = "pending" | "resolved";

function Signal({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[13px]" style={{ color: ok ? "var(--success-ink)" : "var(--text-muted)" }}>
      {ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
      {label}
    </li>
  );
}

function Decision({ request, onClose, onDone }: { request: ProfileVerificationRequest; onClose: () => void; onDone: (text: string) => void }) {
  const p = request.person;
  const pending = request.status === "pending";
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onDone(done);
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
      title={p.name}
      subtitle={[p.designation, p.affiliation].filter(Boolean).join(" · ") || "Profile verification request"}
      footer={
        pending ? (
          <div className="flex justify-end gap-2">
            <Button tone="neutral" variant="soft" onClick={rejecting ? () => setRejecting(false) : onClose} disabled={busy}>
              {rejecting ? "Back" : "Cancel"}
            </Button>
            {rejecting ? (
              <Button tone="danger" busy={busy} disabled={reason.trim().length < 3} onClick={() => void run(() => rejectProfileVerification(request.id, reason.trim()), `${p.name} was told why — the profile was not verified`)}>
                Reject and email
              </Button>
            ) : (
              <>
                <Button tone="danger" variant="soft" onClick={() => setRejecting(true)} disabled={busy}>
                  Reject
                </Button>
                <Button busy={busy} onClick={() => void run(() => approveProfileVerification(request.id), `${p.name}'s profile is verified — they were emailed`)}>
                  Verify profile
                </Button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={p.name} size={44} />
        <div className="min-w-0 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <p className="truncate">{p.email ?? "No email"}</p>
          <p>Asked {fmtDate(request.createdAt)}</p>
        </div>
      </div>

      {request.note && (
        <div className="mb-5">
          <p className="mb-1 text-[13px] font-semibold" style={{ color: "var(--text)" }}>What the member says</p>
          <p className="rounded-lg p-3 text-[13px]" style={{ background: "var(--muted)", color: "var(--text)" }}>{request.note}</p>
        </div>
      )}

      <p className="mb-1.5 text-[13px] font-semibold" style={{ color: "var(--text)" }}>The profile</p>
      <dl className="mb-5 grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
        <dt style={{ color: "var(--text-muted)" }}>Designation</dt><dd>{p.designation || "—"}</dd>
        <dt style={{ color: "var(--text-muted)" }}>Affiliation</dt><dd>{p.affiliation || "—"}</dd>
        <dt style={{ color: "var(--text-muted)" }}>Country</dt><dd>{p.country || "—"}</dd>
        <dt style={{ color: "var(--text-muted)" }}>ORCID iD</dt><dd>{p.orcidId || "—"}</dd>
        <dt style={{ color: "var(--text-muted)" }}>Web page</dt><dd>{p.webPage ? <ExtLink href={p.webPage} /> : "—"}</dd>
        <dt style={{ color: "var(--text-muted)" }}>Institutional email</dt><dd>{p.institutionalEmail || "—"}</dd>
      </dl>

      <p className="mb-1.5 text-[13px] font-semibold" style={{ color: "var(--text)" }}>Signals</p>
      <ul className="mb-5 grid gap-1">
        <Signal ok={p.emailVerified} label="Sign-in email confirmed" />
        <Signal ok={p.institutionalEmailVerified} label="Institutional email verified" />
        <Signal ok={Boolean(p.orcidId)} label="ORCID iD on the profile" />
        <Signal ok={Boolean(p.webPage)} label="Web page on the profile" />
      </ul>

      {!pending && (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          {request.status === "approved" ? `Verified on ${fmtDate(request.resolvedAt)}.` : `Rejected on ${fmtDate(request.resolvedAt)}: ${request.reason}`}
        </p>
      )}
      {pending && rejecting && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--text)" }}>
            Reason (the member sees it and is emailed) <span style={{ color: "var(--danger-ink)" }}>*</span>
          </span>
          <textarea className="sa-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Please add your ORCID iD or your faculty page, then ask again." />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[12.5px]" style={{ color: "var(--danger-ink)" }}>
          {error}
        </p>
      )}
    </Drawer>
  );
}

export function ProfileVerificationPage() {
  const pending = useData(() => loadProfileVerifications("pending"));
  const resolved = useData(() => loadProfileVerifications("resolved"));
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ProfileVerificationRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const all = tab === "pending" ? pending : resolved;
  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return (all.data ?? []).filter((r) => !q || `${r.person.name} ${r.person.email ?? ""} ${r.person.affiliation ?? ""}`.toLowerCase().includes(q));
  }, [all.data, query]);
  const { sorted, sort, toggle: sortBy } = useSort(rows, {
    name: { get: (r) => r.person.name },
    affiliation: { get: (r) => r.person.affiliation ?? "" },
    since: { get: (r) => r.createdAt, first: "asc" },
  });

  if ((pending.loading && !pending.data) || (resolved.loading && !resolved.data)) return <Loading />;
  if (pending.error || !pending.data) return <Failed error={pending.error} onRetry={pending.reload} />;
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={sortBy} className={className} />;
  const done = (text: string) => {
    setOpen(null);
    setToast(text);
    pending.reload();
    resolved.reload();
  };

  return (
    <>
      <PageTitle title="Profile Verification" icon={BadgeCheck} description="Members who asked for their profile to be verified. Verifying puts a green tick on their profile; both answers are emailed to them." />
      <Card className="!p-0">
        <Toolbar
          tabs={[
            ["pending", "Pending", pending.data.length],
            ["resolved", "Resolved", resolved.data?.length ?? 0],
          ]}
          tab={tab}
          setTab={setTab}
          query={query}
          setQuery={setQuery}
          placeholder="Search name, email or affiliation"
        />
        {sorted.length === 0 ? (
          <Empty>{tab === "pending" ? "All caught up — nobody is waiting for verification." : "Nothing resolved yet."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table">
              <thead>
                <tr>
                  {th("Member", "name", "!pl-6")}
                  {th("Affiliation", "affiliation")}
                  {th(tab === "pending" ? "Waiting" : "Resolved", "since")}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                    <td className="!pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.person.name} size={34} />
                        <div className="min-w-0">
                          <p className="font-semibold" style={{ color: "var(--text)" }}>{r.person.name}</p>
                          <p className="truncate text-[12.5px]" style={{ color: "var(--text-muted)" }}>{r.person.email ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-[13px]">{[r.person.designation, r.person.affiliation].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="text-[13px]">{r.status === "pending" ? waitingLabel(r.createdAt) : fmtDate(r.resolvedAt)}</td>
                    <td className="pr-6 text-right">
                      {r.status === "pending" ? (
                        <Button variant="soft" onClick={() => setOpen(r)}>Review</Button>
                      ) : r.status === "approved" ? (
                        <Badge tone="success"><Check size={12} className="mr-1 inline" aria-hidden="true" />Verified</Badge>
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
      </Card>
      {open && <Decision request={open} onClose={() => setOpen(null)} onDone={done} />}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
