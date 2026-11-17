"use client";
/* Users (the prototype's UsersPage + UserDetailPage, database parts): everyone with an account,
   their roles and status; suspend / reactivate. Reset two-step, merge accounts and "view as" are
   not in the launch. The list is paged by the API (50 at a time, "Load more"). */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Ban, RotateCcw, Users } from "lucide-react";
import { useAdmin } from "../session";
import { loadUser, loadUsers, reactivateUser, suspendUser, type AdminUser } from "../services";
import { useData } from "../use-data";
import { activityText } from "./activity";
import { Avatar, Badge, Button, Card, CardTitle, errorText, Failed, Fields, fmtDate, fmtDateTime, Loading, Modal, PageTitle, Toast, Toolbar, type Tone } from "./ui";

const ROLE_LABEL: Record<string, [string, Tone]> = {
  super_admin: ["Super Admin", "secondary"],
  chair: ["Chair", "primary"],
  cfp_manager: ["CFP Manager", "accent"],
  reviewer: ["Reviewer", "warning"],
  author: ["Author", "success"],
};
const RoleBadges = ({ roles }: { roles: string[] }) => (
  <div className="flex flex-wrap gap-1">
    {roles.length === 0 ? <span style={{ color: "var(--text-faint)" }}>—</span> : roles.map((r) => <Badge key={r} tone={(ROLE_LABEL[r] ?? [r, "neutral"])[1]}>{(ROLE_LABEL[r] ?? [r])[0]}</Badge>)}
  </div>
);
const StatusBadge = ({ status }: { status: AdminUser["status"] }) => (status === "disabled" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>);

type Tab = "all" | "author" | "reviewer" | "chair" | "suspended";

/** Suspend / reactivate with a confirmation; calls back with the updated user. */
function StatusAction({ user, onDone }: { user: AdminUser; onDone: (u: AdminUser) => void }) {
  const { me } = useAdmin();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (user.id === me.id || user.roles.includes("super_admin")) return null;
  const suspending = user.status === "active";
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(suspending ? await suspendUser(user.id, reason.trim()) : await reactivateUser(user.id));
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {suspending ? (
        <Button tone="danger" variant="outline" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          <Ban size={15} />
          Suspend
        </Button>
      ) : (
        <Button tone="success" variant="soft" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          <RotateCcw size={15} />
          Reactivate
        </Button>
      )}
      {open && (
        <Modal
          title={suspending ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`}
          onClose={() => setOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button tone="neutral" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button tone={suspending ? "danger" : "success"} busy={busy} onClick={() => void run()}>
                {suspending ? "Suspend" : "Reactivate"}
              </Button>
            </div>
          }
        >
          <p className="text-[13.5px] mb-4" style={{ color: "var(--text-muted)" }}>
            {suspending ? "They are signed out everywhere and can't sign in until reactivated. Their papers, reviews and conferences stay as they are." : "They can sign in again straight away."}
          </p>
          {suspending && (
            <label className="block">
              <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                Reason (kept in the activity log)
              </span>
              <input className="sa-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Spam submissions" />
            </label>
          )}
          {error && (
            <p role="alert" className="text-[13px] mt-3" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

export function UsersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const shown = useMemo(() => rows.filter((u) => (tab === "all" ? true : tab === "suspended" ? u.status === "disabled" : u.roles.includes(tab))), [rows, tab]);
  const count = (t: Tab) => rows.filter((u) => (t === "all" ? true : t === "suspended" ? u.status === "disabled" : u.roles.includes(t))).length;

  return (
    <>
      <PageTitle title="Users" description="Everyone with a Smartconferu account, newest first." icon={Users} />
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
                  <th className="!pl-6">User</th>
                  <th>Institution</th>
                  <th>Roles</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id} className="sa-clickable" onClick={() => router.push(`/super-admin/users/${u.id}`)}>
                    <td className="!pl-6">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} size={34} />
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: "var(--text)" }}>
                            {u.name}
                          </p>
                          <p className="text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>
                            {u.email ?? "no email"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[260px] truncate">{u.affiliation ?? "—"}</td>
                    <td>
                      <RoleBadges roles={u.roles} />
                    </td>
                    <td className="text-[13px] whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="text-right !pr-6" onClick={(e) => e.stopPropagation()}>
                      <StatusAction
                        user={u}
                        onDone={(next) => {
                          setRows((r) => r.map((x) => (x.id === next.id ? next : x)));
                          setToast(next.status === "disabled" ? `${next.name} suspended` : `${next.name} reactivated`);
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
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

export function UserDetailPage({ id }: { id: string }) {
  const { data, error, loading, reload, setData } = useData(() => loadUser(id), [id]);
  const [toast, setToast] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const u = data;
  return (
    <>
      <PageTitle
        title={u.name}
        description={u.email ?? undefined}
        parent={{ label: "Users", href: "/super-admin/users" }}
        actions={
          <>
            <StatusBadge status={u.status} />
            <StatusAction
              user={u}
              onDone={(next) => {
                setData(Object.assign({}, u, next));
                setToast(next.status === "disabled" ? `${next.name} suspended` : `${next.name} reactivated`);
              }}
            />
          </>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <div className="flex items-center gap-3 mb-5">
            <Avatar name={u.name} size={52} />
            <div>
              <p className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
                {u.name}
              </p>
              <RoleBadges roles={u.roles} />
            </div>
          </div>
          <Fields
            rows={[
              ["Email", u.email],
              ["Email confirmed", u.emailVerified ? "Yes" : "No"],
              ["Institution", u.affiliation],
              ["Country", u.country],
              ["Two-step sign-in", u.twoStepOn ? "Authenticator app on" : "Off"],
              ["Joined", fmtDate(u.createdAt)],
              ["Last sign-in", fmtDateTime(u.lastSignInAt)],
            ]}
          />
        </Card>
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="!p-0">
            <div className="px-6 pt-6">
              <CardTitle title={`Conferences (${u.conferences.length})`} />
            </div>
            <table className="sa-table">
              <thead>
                <tr>
                  <th className="!pl-6">Conference</th>
                  <th>Roles</th>
                  <th>Papers</th>
                </tr>
              </thead>
              <tbody>
                {u.conferences.map((c) => (
                  <tr key={c.id}>
                    <td className="!pl-6">
                      <Link href={`/super-admin/conferences/${c.id}`} className="font-semibold hover:underline" style={{ color: "var(--text)" }}>
                        {c.acronym}
                      </Link>
                      <p className="text-[12.5px] truncate max-w-[300px]" style={{ color: "var(--text-muted)" }}>
                        {c.title}
                      </p>
                    </td>
                    <td>
                      <RoleBadges roles={c.roles} />
                    </td>
                    <td className="tabular-nums">{c.papers || "—"}</td>
                  </tr>
                ))}
                {u.conferences.length === 0 && (
                  <tr>
                    <td colSpan={3} className="!pl-6 py-6 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                      Not part of any conference yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
          <Card>
            <CardTitle title="Recent activity" subtitle="The last 20 things they did" />
            {u.recentActivity.length === 0 ? (
              <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                Nothing yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {u.recentActivity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-[13px]">
                    <span className="w-[130px] shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {fmtDateTime(a.occurredAt)}
                    </span>
                    <span style={{ color: "var(--text-soft)" }}>{activityText(a)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
