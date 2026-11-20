"use client";
/* Users (the prototype's UsersPage + UserDetailPage): everyone with an account, their roles and
   status; suspend (a quiet button, red only on hover) / reactivate. Your own row is tagged "You" and
   can't be suspended. The list is paged by the API (50 at a time, "Load more").
   "View as user", "Reset 2-step", "Merge accounts" and signed-in devices need backend work: shown,
   disabled, "Coming soon". */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Ban, Eye, GitMerge, KeyRound, LogOut, Monitor, RotateCcw, Smartphone, Users as UsersIcon } from "lucide-react";
import { useAdmin } from "../session";
import { loadConferences, loadDeletionRequests, loadUser, loadUserSessions, loadUsers, mergeUsers, reactivateUser, resetUserMfa, revokeUserSession, suspendUser, type AdminSession, type AdminUser } from "../services";
import { ViewAsPanel } from "./view-as";
import { useData } from "../use-data";
import { CONF_STATUS } from "./conferences-page";
import { Avatar, Badge, Button, Card, CardTitle, errorText, Failed, fmtDate, fmtDateTime, Loading, PageTitle, SortTh, Toast, Toolbar, useSort, type Tone } from "./ui";

const ROLE_LABEL: Record<string, [string, Tone]> = {
  author: ["Author", "primary"],
  reviewer: ["Reviewer", "accent"],
  chair: ["Chair", "secondary"],
  cfp_manager: ["CFP Manager", "warning"],
  super_admin: ["Super Admin", "neutral"],
};
const RoleBadges = ({ roles }: { roles: string[] }) => (
  <div className="flex gap-1 flex-wrap">
    {roles.length === 0 ? (
      <span style={{ color: "var(--text-faint)" }}>—</span>
    ) : (
      roles.map((r) => (
        <Badge key={r} tone={(ROLE_LABEL[r] ?? [r, "neutral"])[1]}>
          {(ROLE_LABEL[r] ?? [r])[0]}
        </Badge>
      ))
    )}
  </div>
);
const StatusBadge = ({ status }: { status: AdminUser["status"] }) => (status === "disabled" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>);

type Tab = "all" | "author" | "reviewer" | "chair" | "suspended";
/** "Chrome on Windows" from a user agent, for the devices list. */
function deviceOf(ua: string | null): { label: string; phone: boolean } {
  if (!ua) return { label: "Unknown device", phone: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return { label: os ? `${browser} on ${os}` : browser, phone: /iPhone|Android|Mobile/.test(ua) };
}

/** Suspend / reactivate straight away (as in the prototype); calls back with the updated user. */
function useStatusToggle(onDone: (u: AdminUser) => void, onError: (text: string) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (u: AdminUser) => {
    setBusy(u.id);
    try {
      onDone(u.status === "active" ? await suspendUser(u.id) : await reactivateUser(u.id));
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  return { busy, toggle };
}

export function UsersPage() {
  const router = useRouter();
  const { me } = useAdmin();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { busy, toggle: toggleStatus } = useStatusToggle(
    (next) => {
      setRows((r) => r.map((x) => (x.id === next.id ? next : x)));
      setToast(next.status === "disabled" ? `${next.name} suspended` : `${next.name} reactivated`);
    },
    (text) => setToast(text),
  );

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { error, loading, reload } = useData(async () => {
    const page = await loadUsers({ search });
    setRows(page.data);
    setCursor(page.nextCursor);
    return page;
  }, [search]);

  const loadMore = async () => {
    if (!cursor) return;
    setMore(true);
    try {
      const page = await loadUsers({ search, cursor });
      setRows((r) => [...r, ...page.data]);
      setCursor(page.nextCursor);
    } finally {
      setMore(false);
    }
  };

  const inTab = (u: AdminUser, t: Tab) => (t === "all" ? true : t === "suspended" ? u.status === "disabled" : u.roles.includes(t));
  const shown = useMemo(() => rows.filter((u) => inTab(u, tab)), [rows, tab]);
  const count = (t: Tab) => rows.filter((u) => inTab(u, t)).length;
  const { sorted, sort, toggle } = useSort(shown, {
    user: { get: (u) => u.name },
    institution: { get: (u) => u.affiliation ?? "" },
    roles: { get: (u) => u.roles.length, first: "desc" },
    joined: { get: (u) => u.createdAt, first: "desc" },
    status: { get: (u) => u.status },
  });
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} className={className} />;
  const isMe = (u: AdminUser) => u.id === me.id;

  return (
    <>
      <PageTitle title="Users" icon={UsersIcon} />
      <Card className="!p-0">
        <Toolbar<Tab>
          tabs={[
            ["all", "All", count("all")],
            ["author", "Authors", count("author")],
            ["reviewer", "Reviewers", count("reviewer")],
            ["chair", "Chairs", count("chair")],
            ["suspended", "Suspended", count("suspended")],
          ]}
          tab={tab}
          setTab={setTab}
          query={query}
          setQuery={setQuery}
          placeholder="Search name, email, institution"
        />
        {error ? (
          <div className="p-6">
            <Failed error={error} onRetry={reload} />
          </div>
        ) : loading && rows.length === 0 ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table">
              <thead>
                <tr>
                  {th("User", "user", "!pl-6")}
                  {th("Institution", "institution")}
                  {th("Roles", "roles")}
                  {th("Joined", "joined")}
                  {th("Status", "status")}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => (
                  <tr key={u.id} className="sa-clickable cursor-pointer" onClick={() => router.push(`/super-admin/users/${u.id}`)} style={u.status === "disabled" ? { opacity: 0.7 } : undefined}>
                    <td className="!pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <p className="font-semibold flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                            {u.name}
                            {isMe(u) && <Badge tone="primary">You</Badge>}
                          </p>
                          <p className="text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>
                            {u.email ?? "no email"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-[13px] max-w-[260px] truncate">{u.affiliation ?? "—"}</td>
                    <td>
                      <RoleBadges roles={u.roles} />
                    </td>
                    <td className="whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                      {/* Suspend is a quiet action (red only on hover), so it isn't mistaken for the user's status. */}
                      {isMe(u) || u.roles.includes("super_admin") ? null : u.status === "active" ? (
                        <Button tone="neutral" variant="outline" busy={busy === u.id} className="!px-3 !py-1.5 !text-[12.5px] hover:!text-[var(--danger)] hover:!border-[var(--danger)]" onClick={() => void toggleStatus(u)} title={`Suspend ${u.name}`}>
                          <Ban size={14} />
                          Suspend
                        </Button>
                      ) : (
                        <Button tone="success" variant="soft" busy={busy === u.id} className="!px-3 !py-1.5 !text-[12.5px]" onClick={() => void toggleStatus(u)}>
                          <RotateCcw size={14} />
                          Reactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                      {search ? "No one matches your search." : "No users here."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {cursor && (
          <div className="flex justify-center p-4" style={{ borderTop: "1px solid var(--border)" }}>
            <Button variant="soft" busy={more} onClick={() => void loadMore()}>
              Load more
            </Button>
          </div>
        )}
      </Card>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] py-3" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

export function UserDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { me } = useAdmin();
  const { data, error, loading, reload, setData } = useData(async () => {
    const [user, conferences, deletions] = await Promise.all([loadUser(id), loadConferences().catch(() => []), loadDeletionRequests().catch(() => [])]);
    // What this person asked for: conference requests and deletion requests.
    const requests = [
      ...conferences
        .filter((c) => c.requester?.id === id)
        .map((c) => ({ key: `c-${c.id}`, title: c.acronym, queue: "conference request", status: c.status === "pending_approval" ? "pending" : c.status === "rejected" ? "declined" : "approved", href: `/super-admin/conference-requests?open=${c.id}` })),
      ...deletions
        .filter((d) => d.requestedBy.id === id)
        .map((d) => ({ key: `d-${d.id}`, title: d.acronym, queue: "deletion request", status: d.status, href: `/super-admin/conferences/${d.conferenceId}` })),
    ];
    const sessions = await loadUserSessions(id).catch(() => [] as AdminSession[]);
    return { user, requests, sessions };
  }, [id]);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<"view" | "merge" | null>(null);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeHits, setMergeHits] = useState<AdminUser[]>([]);
  const [mergeWith, setMergeWith] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    const q = mergeQuery.trim();
    if (panel !== "merge" || q.length < 2) return undefined;
    const t = setTimeout(() => {
      loadUsers({ search: q, limit: 10 })
        .then((p) => setMergeHits(p.data.filter((x) => x.id !== id && x.status === "active" && !x.roles.includes("super_admin"))))
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [mergeQuery, panel, id]);
  const act = async (key: string, work: () => Promise<unknown>, done: string, after?: () => void) => {
    setWorking(key);
    setActionError(null);
    try {
      await work();
      setToast(done);
      after?.();
      reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setWorking(null);
    }
  };
  const { busy, toggle } = useStatusToggle(
    (next) => {
      if (data) setData({ ...data, user: Object.assign({}, data.user, next) });
      setToast(next.status === "disabled" ? `${next.name} suspended` : `${next.name} reactivated`);
    },
    (text) => setToast(text),
  );
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const u = data.user;
  const chairs = u.conferences.filter((c) => c.roles.includes("chair"));
  const outcome: Record<string, [string, Tone]> = {
    pending: ["Pending", "warning"],
    approved: ["Approved", "success"],
    declined: ["Declined", "danger"],
    rejected: ["Rejected", "danger"],
    cancelled: ["Cancelled by chair", "neutral"],
  };

  return (
    <>
      <PageTitle title={u.name} crumb={u.name} icon={UsersIcon} parent={{ label: "Users", href: "/super-admin/users" }} />

      <Card className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar name={u.name} size={56} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[19px] font-bold" style={{ color: "var(--text)" }}>
                  {u.name}
                </h2>
                <StatusBadge status={u.status} />
              </div>
              <p className="text-[13.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {[u.email ?? "no email", u.affiliation].filter(Boolean).join(" · ")}
              </p>
              <div className="flex gap-1 mt-2 items-center flex-wrap">
                <RoleBadges roles={u.roles} />
                <span className="text-[12.5px] ml-2" style={{ color: "var(--text-muted)" }}>
                  Joined {fmtDate(u.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button tone="primary" variant="soft" disabled={u.status !== "active" || u.roles.includes("super_admin")} onClick={() => setPanel((p) => (p === "view" ? null : "view"))} title="Open the user app as this person, read-only — recorded in the audit log">
              <Eye size={15} />
              View as user
            </Button>
            <Button tone="primary" variant="soft" busy={working === "mfa"} disabled={u.id === me.id} onClick={() => void act("mfa", () => resetUserMfa(u.id), `${u.name} sets up two-step verification again at the next sign-in`)} title="They set up two-step verification again at their next sign-in">
              <KeyRound size={15} />
              Reset 2-step
            </Button>
            <Button tone="primary" variant="soft" onClick={() => setPanel((p) => (p === "merge" ? null : "merge"))}>
              <GitMerge size={15} />
              Merge accounts
            </Button>
            {u.id === me.id || u.roles.includes("super_admin") ? null : u.status === "active" ? (
              <Button tone="neutral" variant="outline" busy={busy === u.id} className="hover:!text-[var(--danger)] hover:!border-[var(--danger)]" onClick={() => void toggle(u)}>
                <Ban size={15} />
                Suspend
              </Button>
            ) : (
              <Button tone="success" variant="soft" busy={busy === u.id} onClick={() => void toggle(u)}>
                <RotateCcw size={15} />
                Reactivate
              </Button>
            )}
          </div>
        </div>
        {panel === "view" && <ViewAsPanel who={u.name} userId={u.id} next="/dashboard" onCancel={() => setPanel(null)} onStarted={(text) => { setPanel(null); setToast(text); }} />}
        {panel === "merge" && (
          <div className="mt-5 rounded-xl p-4 sa-pop" style={{ background: "var(--primary-soft)" }}>
            <label className="block">
              <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                Merge this account with
              </span>
              <input className="sa-input mb-2" value={mergeQuery} onChange={(e) => setMergeQuery(e.target.value)} placeholder="Search name or email" autoFocus />
              <select className="sa-input cursor-pointer" value={mergeWith} onChange={(e) => setMergeWith(e.target.value)} aria-label="Account to merge">
                <option value="">{mergeHits.length ? "Choose the other account" : "Search above to find it"}</option>
                {mergeHits.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.email ?? "no email"}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[12.5px] mt-2" style={{ color: "var(--text-soft)" }}>
              Papers, reviews, roles and profile links move to <b>{u.name}</b>; the other account is closed and its email becomes a secondary email here. Both people are emailed.
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <Button tone="neutral" variant="soft" onClick={() => setPanel(null)}>
                Cancel
              </Button>
              <Button
                tone="primary"
                busy={working === "merge"}
                disabled={!mergeWith}
                onClick={() => {
                  const other = mergeHits.find((x) => x.id === mergeWith);
                  void act("merge", () => mergeUsers(u.id, mergeWith), `${other?.email ?? "The account"} merged into ${u.name}`, () => {
                    setPanel(null);
                    setMergeWith("");
                    setMergeQuery("");
                  });
                }}
              >
                Merge
              </Button>
            </div>
          </div>
        )}
      </Card>

      {actionError && (
        <p role="alert" className="text-[13px] -mt-3 mb-4" style={{ color: "var(--danger)" }}>
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle title="Conferences they chair" />
          {chairs.length ? (
            chairs.map((c) => {
              const [label, tone] = CONF_STATUS[c.status as keyof typeof CONF_STATUS] ?? [c.status, "neutral"];
              return (
                <button key={c.id} onClick={() => router.push(`/super-admin/conferences/${c.id}`)} className="w-full flex items-center justify-between gap-3 py-2.5 border-t first:border-t-0 text-left hover:bg-[var(--row-hover)] cursor-pointer" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[13.5px]">
                    <b style={{ color: "var(--text)" }}>{c.acronym}</b>
                    <span className="block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                      {c.title}
                    </span>
                  </span>
                  <Badge tone={tone}>{label}</Badge>
                </button>
              );
            })
          ) : (
            <Empty>None.</Empty>
          )}
        </Card>
        <Card>
          <CardTitle title="Requests and reports" />
          {data.requests.length ? (
            data.requests.map((r) => {
              const [label, tone] = outcome[r.status] ?? [r.status, "neutral"];
              return (
                <button key={r.key} onClick={() => router.push(r.href)} className="w-full flex items-center justify-between gap-3 py-2.5 border-t first:border-t-0 text-left hover:bg-[var(--row-hover)] cursor-pointer" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[13.5px] min-w-0">
                    <span className="block truncate" style={{ color: "var(--text)" }}>
                      {r.title}
                    </span>
                    <span className="block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                      {r.queue}
                    </span>
                  </span>
                  <Badge tone={tone}>{label}</Badge>
                </button>
              );
            })
          ) : (
            <Empty>Nothing waiting or decided.</Empty>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle title="Signed-in devices" />
          {data.sessions.map((s) => {
            const d = deviceOf(s.userAgent);
            const DeviceIcon = d.phone ? Smartphone : Monitor;
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                <span className="flex items-center gap-3 text-[13.5px]">
                  <span className="w-9 h-9 rounded-lg inline-flex items-center justify-center" style={{ background: "var(--muted)", color: "var(--text-soft)" }}>
                    <DeviceIcon size={17} />
                  </span>
                  <span>
                    <span className="block" style={{ color: "var(--text)" }}>
                      {d.label}
                    </span>
                    <span className="block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                      {s.ipAddress ?? "Unknown place"} · last active {fmtDateTime(s.lastActiveAt)}
                    </span>
                  </span>
                </span>
                <Button tone="danger" variant="soft" busy={working === s.id} className="!px-3 !py-1.5 !text-[12.5px]" onClick={() => void act(s.id, () => revokeUserSession(u.id, s.id), `Signed ${u.name} out of ${d.label}`)}>
                  <LogOut size={14} />
                  Sign out
                </Button>
              </div>
            );
          })}
          {!data.sessions.length && <Empty>Not signed in anywhere.</Empty>}
        </Card>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
