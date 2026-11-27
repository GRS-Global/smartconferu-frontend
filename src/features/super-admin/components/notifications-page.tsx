"use client";
/* The Super Admin's notifications (the website's /notifications, inside the console): what the platform told this account (new conference
   requests, CFPs waiting, licence and deletion requests, profile requests, cancelled requests…), newest first in day groups, with All / Unread
   tabs. Clicking one marks it read and opens where it is answered (features/notifications/destinations.ts), e.g. the CFP's review drawer.
   Read through the console's own session: GET /me/notifications, POST /me/notifications/read|unread. Dismiss only hides it on this page.
   The newest 500 are loaded (100 at a time) and shown 10 to a page with the console's own pagination, as its other lists. */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { NotificationCard } from "@/features/notifications/components/notification-card";
import { actionOf, audienceOf, type NotificationAction } from "@/features/notifications/destinations";
import { GROUPS, groupOf } from "@/features/notifications/grouping";
import type { AppNotification } from "@/types/notification";
import { get, post } from "../api";
import { notificationsChanged } from "../notification-events";
import { Button, Card, errorText, Failed, Loading, PageTitle, Pagination, usePaging } from "./ui";

interface Row {
  id: string; kind: string; title: string; body: string | null; readAt: string | null; createdAt: string;
  conferenceSlug: string | null; conferenceAcronym: string | null; paperLabel: string | null;
}
interface PageOf { data: Row[]; nextCursor: string | null; unread: number }

const toItem = (r: Row): AppNotification => ({
  id: r.id, kind: String(r.kind ?? ""), title: String(r.title ?? ""), body: r.body ?? "", read: r.readAt !== null, createdAt: r.createdAt,
  paperLabel: r.paperLabel,
  conference: r.conferenceSlug && r.conferenceAcronym ? { slug: r.conferenceSlug, acronym: r.conferenceAcronym } : null,
});

type Tab = "all" | "unread";
const NO_CHAIRS: ReadonlySet<string> = new Set();

export function AdminNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const all: AppNotification[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 5; i += 1) {
        const page: PageOf = await get<PageOf>(`/me/notifications?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        all.push(...page.data.map(toItem));
        cursor = page.nextCursor;
        if (!cursor) break;
      }
      setItems(all);
    } catch (e) { setError(e); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the list once on mount
  useEffect(() => { void load(); }, [load]);

  const setRead = async (id: string, read: boolean): Promise<boolean> => {
    setBusy((b) => new Set(b).add(id));
    setActionError("");
    try {
      await post(`/me/notifications/${read ? "read" : "unread"}`, { ids: [id] });
      setItems((cur) => cur?.map((x) => (x.id === id ? { ...x, read } : x)) ?? cur);
      notificationsChanged();
      return true;
    } catch (e) {
      setActionError(errorText(e));
      return false;
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(id); return n; });
    }
  };
  const markAll = async () => {
    setMarkingAll(true); setActionError("");
    try {
      await post("/me/notifications/read");
      setItems((cur) => cur?.map((x) => ({ ...x, read: true })) ?? cur);
      notificationsChanged();
    } catch (e) { setActionError(errorText(e)); } finally { setMarkingAll(false); }
  };
  const open = async (item: AppNotification, action: NotificationAction) => {
    if (!item.read && !(await setRead(item.id, true))) return;
    if (action.external) window.open(action.href, "_blank", "noopener"); else router.push(action.href);
  };

  const visible = useMemo(() => (items ?? []).filter((x) => !dismissed.has(x.id)), [items, dismissed]);
  const unread = visible.filter((x) => !x.read).length;
  const shown = visible.filter((x) => tab === "all" || !x.read).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const paging = usePaging(shown, tab);
  const groups = GROUPS.map((g) => ({ g, rows: paging.rows.filter((x) => groupOf(x.createdAt) === g) })).filter((x) => x.rows.length);


  if (error) return <Failed error={error} onRetry={() => void load()} />;
  if (!items) return <Loading />;

  return (
    <>
      <PageTitle
        title="Notifications"
        icon={Bell}
        description="Everything the platform told you: new requests, CFPs waiting for approval, and what chairs did with their requests."
        actions={unread > 0 ? (
          <Button tone="neutral" variant="outline" disabled={markingAll} onClick={() => void markAll()}>
            <CheckCheck size={16} /> {markingAll ? "Marking…" : "Mark all as read"}
          </Button>
        ) : undefined}
      />
      <Card className="!p-0 overflow-hidden">
        <div role="tablist" aria-label="Notifications" className="flex items-center gap-1 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          {([["all", "All", visible.length], ["unread", "Unread", unread]] as const).map(([key, label, n]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-semibold cursor-pointer" style={tab === key ? { background: "var(--primary-soft)", color: "var(--primary)" } : { color: "var(--text-soft)" }}>
              {label}
              <span className="rounded-full px-1.5 text-[11.5px] font-bold" style={{ background: tab === key ? "#fff" : "var(--muted, #F1F5F9)" }}>{n}</span>
            </button>
          ))}
        </div>
        {actionError && <p role="alert" className="px-5 py-3 text-[13px]" style={{ color: "var(--danger-ink)", background: "var(--danger-soft)" }}>{actionError}</p>}
        {groups.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Bell size={26} className="mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
            <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>{tab === "unread" ? "You're all caught up" : "No notifications yet"}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>{tab === "unread" ? "Nothing new since you last looked." : "New requests and CFPs waiting for approval will show up here."}</p>
          </div>
        ) : (
          groups.map(({ g, rows }) => (
            <div key={g}>
              <h2 className="px-5 py-2.5 text-[11.5px] font-extrabold uppercase tracking-wide" style={{ color: "var(--text-muted)", background: "var(--canvas, #F8FAFC)", borderBottom: "1px solid var(--border)" }}>{g}</h2>
              <ul>
                {rows.map((item) => {
                  const action = actionOf(item, NO_CHAIRS);
                  return (
                    <li key={item.id}>
                      <NotificationCard
                        item={item}
                        action={action}
                        audience={audienceOf(item, NO_CHAIRS)}
                        busy={markingAll || busy.has(item.id)}
                        onAction={() => { if (action) void open(item, action); }}
                        onViewEmail={() => { void setRead(item.id, true); }}
                        onToggleRead={() => { void setRead(item.id, !item.read); }}
                        onDismiss={() => { setDismissed((d) => new Set(d).add(item.id)); if (!item.read) void setRead(item.id, true); }}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        <Pagination paging={paging} />
      </Card>
    </>
  );
}
