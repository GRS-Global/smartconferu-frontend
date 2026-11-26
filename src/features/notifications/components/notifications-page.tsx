"use client";

import { Bell, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { cn } from "@/lib/cn";
import { openPrototypePage } from "@/lib/navigation";
import { actionOf, audienceOf, type NotificationAction } from "../destinations";
import { GROUPS, groupOf } from "../grouping";
import { TABS, inTab, type TabKey } from "../kinds";
import { useNotifications } from "../use-notifications";
import type { AppNotification } from "@/types/notification";
import { EmailViewer } from "./email-viewer";
import { NotificationCard } from "./notification-card";

/** Notifications: one inbox for everything addressed to the signed-in user — the prototype's NotificationsPage
 *  (src/author-module/NotificationsPage.jsx) on the global page: the four tabs (All, Paper updates, Announcements, Emails), the
 *  conference filter, day groups, each card's action and its read / unread and Dismiss buttons, "Mark all as read", and the
 *  "How should we tell you?" box. "Mark all as read" marks the whole account's unread notifications, whichever tab or
 *  conference is showing. */
const PER_PAGE = 20;

export function NotificationsPage({ scope }: { scope?: { slug: string; role: "author" | "reviewer"; acronym: string } } = {}) {
  const router = useRouter();
  const n = useNotifications();
  // The prototype's "How should we tell you?" boxes: its own page state (not saved there either).
  const [prefs, setPrefs] = useState({ email: true, whatsapp: false });
  const [tab, setTab] = useState<TabKey>("all");
  const [conference, setConference] = useState("all");
  // 20 to a page, as the app's other long lists (Activity Logs, Email Logs); a new tab or conference starts on page 1.
  const [page, setPage] = useState(1);
  const [openEmail, setOpenEmail] = useState<AppNotification | null>(null); // an email copy being read in full
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  const ready = n.state.status === "ready" ? n.state.items : null;
  // The header number counts notifications only; the emails' own unread count is on the Emails tab.
  const loadedUnread = ready ? ready.filter((x) => !x.read && !x.email).length : 0;
  const unreadTotal = n.unreadCount ?? loadedUnread;

  // Inside a conference (the prototype's conference mode) only what that conference sent to that role is shown, and only that is marked read.
  const scopedItems = ready && scope ? ready.filter((x) => !n.dismissed.has(x.id) && x.conference?.slug === scope.slug && audienceOf(x, n.chairOf) === scope.role) : null;
  const scopedUnread = scopedItems ? scopedItems.filter((x) => !x.read) : [];
  const [markingScoped, setMarkingScoped] = useState(false);
  const markScoped = async () => { setMarkingScoped(true); try { await Promise.all(scopedUnread.map((x) => n.markRead(x.id))); } finally { setMarkingScoped(false); } };
  const header = (
    <PageHeader
      title={scope ? "Updates" : "Notifications"}
      breadcrumbs={scope ? [{ label: "My Conferences", href: "/dashboard" }, { label: `${scope.acronym} · Updates` }] : undefined}
      actions={ready && (
        (scope ? scopedUnread.length > 0 : (unreadTotal > 0 || ready.some((x) => x.email && !x.read))) && (
          <button
            type="button"
            onClick={() => { void (scope ? markScoped() : n.markAll()); }}
            disabled={n.markingAll || markingScoped || n.pending.size > 0}
            className="shrink-0 text-[13px] font-bold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
          >
            {n.markingAll || markingScoped ? "Marking all as read…" : "Mark all as read"}
          </button>
        )
      )}
    />
  );
  const intro = <p className="mt-1 px-4 text-sm text-ink-muted sm:px-8">{scope ? (scope.role === "reviewer" ? `Your review assignments, deadlines and news from the ${scope.acronym} chair.` : `Everything about your papers and news from the ${scope.acronym} organisers.`) : "Everything about your papers and conferences, in one place."}</p>;

  if (n.state.status === "loading") {
    return (
      <>
        {header}{intro}
        <div role="status" aria-label="Loading notifications" className="space-y-3 p-4 sm:p-8">
          <div className="h-9 w-72 max-w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-80 max-w-4xl animate-pulse rounded-2xl border border-line bg-white" />
        </div>
      </>
    );
  }
  if (n.state.status === "auth") {
    return (
      <>
        {header}{intro}
        <div role="status" aria-label="Loading notifications" className="p-4 sm:p-8"><div className="h-80 max-w-4xl animate-pulse rounded-2xl border border-line bg-white" /></div>
        <SessionEnded onRecovered={n.retry} />
      </>
    );
  }
  if (n.state.status === "error") {
    return (
      <>
        {header}{intro}
        <div className="p-4 sm:p-8">
          <div className="max-w-4xl rounded-2xl border border-line bg-white">
            <EmptyState
              icon={TriangleAlert}
              title={n.state.config ? "The database connection isn't set up." : "Couldn't load your notifications."}
              description={n.state.message}
              action={n.state.config ? undefined : <Button size="sm" onClick={n.retry}>Try again</Button>}
            />
          </div>
        </div>
      </>
    );
  }

  // Inside a conference (Updates in the Author or Reviewer menu): only what that conference sent to that role.
  const items = n.state.items.filter((x) => !n.dismissed.has(x.id)).filter((x) => !scope || (x.conference?.slug === scope.slug && audienceOf(x, n.chairOf) === scope.role));
  const conferences = [...new Map(items.filter((x) => x.conference).map((x) => [x.conference!.slug, x.conference!.acronym])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const activeConference = conferences.some(([slug]) => slug === conference) ? conference : "all";
  const inConference = items.filter((x) => activeConference === "all" || x.conference?.slug === activeConference);
  // Newest first within each day group.
  const shown = inConference.filter((x) => inTab(x, tab)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const safe = Math.min(page, pages);
  const onPage = shown.slice((safe - 1) * PER_PAGE, safe * PER_PAGE);
  const groups = GROUPS.map((g) => ({ g, items: onPage.filter((x) => groupOf(x.createdAt) === g) })).filter((x) => x.items.length);
  const arrow = (disabled: boolean) => ({ border: "1px solid var(--border)", color: disabled ? "var(--ink-faint)" : "var(--ink-muted)" });
  const goPage = (p: number) => { setPage(p); document.getElementById("notifications-list")?.scrollIntoView({ block: "start", behavior: "smooth" }); };

  const act = async (item: AppNotification, action: NotificationAction) => {
    // The prototype marks it read, then goes. Here it is read first; if that fails nothing is shown as read and the person stays to see why.
    if (!item.read && !(await n.markRead(item.id))) return;
    // A page of this app, or (until it is ported) the prototype's own page.
    if (action.external) openPrototypePage(action.href);
    else router.push(action.href);
  };

  const pickTab = (key: TabKey) => { setTab(key); setPage(1); };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const next = e.key === "ArrowRight" ? (index + 1) % TABS.length : e.key === "ArrowLeft" ? (index + last) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    pickTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  };

  return (
    <>
      {header}{intro}
      <p role="status" aria-live="polite" className="sr-only">{n.announcement}</p>
      <div className="flex flex-col gap-4 p-4 sm:p-8 sm:pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Filter notifications" className="flex flex-wrap gap-1.5">
            {TABS.map((t, i) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  ref={(el) => { tabRefs.current[t.key] = el; }}
                  type="button"
                  role="tab"
                  id={`notifications-tab-${t.key}`}
                  aria-selected={on}
                  aria-controls="notifications-list"
                  tabIndex={on ? 0 : -1}
                  onClick={() => pickTab(t.key)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={cn("rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors", on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink-soft hover:bg-canvas hover:text-navy")}
                >
                  {scope && t.key === "update" ? (scope.role === "reviewer" ? "Review updates" : "Paper updates") : t.label}
                </button>
              );
            })}
          </div>
          {!scope && conferences.length > 1 && (
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
              Conference
              <select value={activeConference} onChange={(e) => { setConference(e.target.value); setPage(1); }} className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-primary">
                <option value="all">All conferences</option>
                {conferences.map(([slug, acronym]) => <option key={slug} value={slug}>{acronym}</option>)}
              </select>
            </label>
          )}
        </div>

        {n.emailsError && (
          <div role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
            Couldn&apos;t load your emails. {n.emailsError} <button type="button" onClick={n.retry} className="font-bold underline">Try again</button>
          </div>
        )}

        {n.actionError && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
            <span>{n.actionError}</span>
            <button type="button" onClick={n.clearError} className="shrink-0 text-xs font-bold underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          <section id="notifications-list" role="tabpanel" aria-labelledby={`notifications-tab-${tab}`} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card xl:col-span-2">
            {groups.length === 0 && <div className="py-14 text-center"><Bell size={28} aria-hidden="true" className="mx-auto mb-2 text-line-strong" /><p className="text-sm text-ink-faint">Nothing here right now.</p></div>}
            {groups.map(({ g, items: rows }) => (
              <div key={g}>
                <h2 className="border-b border-muted bg-canvas px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-ink-muted sm:px-5">{g}</h2>
                <ul>
                  {rows.map((item) => {
                    const action = actionOf(item, n.chairOf);
                    return (
                      <li key={item.id}>
                        <NotificationCard
                          item={item}
                          action={action}
                          audience={audienceOf(item, n.chairOf)}
                          busy={n.markingAll || n.pending.has(item.id)}
                          onAction={() => { if (action) void act(item, action); }}
                          onViewEmail={() => { void n.markRead(item.id); setOpenEmail(item); }}
                          onToggleRead={() => { void (item.read ? n.markUnread(item.id) : n.markRead(item.id)); }}
                          onDismiss={() => n.dismiss(item.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {shown.length > PER_PAGE && (
              <div style={{ borderTop: "1px solid var(--border)" }} className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-ink-faint">Showing {(safe - 1) * PER_PAGE + 1}–{Math.min(safe * PER_PAGE, shown.length)} of {shown.length}</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => goPage(Math.max(1, safe - 1))} disabled={safe === 1} style={arrow(safe === 1)} aria-label="Previous page" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-canvas disabled:cursor-not-allowed"><ChevronLeft size={14} aria-hidden="true" /></button>
                  <span className="px-1 text-xs font-semibold text-ink-muted">Page {safe} of {pages}</span>
                  <button type="button" onClick={() => goPage(Math.min(pages, safe + 1))} disabled={safe === pages} style={arrow(safe === pages)} aria-label="Next page" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-canvas disabled:cursor-not-allowed"><ChevronRight size={14} aria-hidden="true" /></button>
                </div>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <section aria-labelledby="notification-prefs" className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 id="notification-prefs" className="text-[15px] font-extrabold text-navy">How should we tell you?</h2>
              {([
                ["email", "Email me as well", false],
                ["whatsapp", "WhatsApp / SMS for urgent ones", true],
              ] as const).map(([key, label, soon]) => (
                <label key={key} className={`flex items-center justify-between gap-2 text-[13.5px] font-semibold ${soon ? "cursor-not-allowed text-ink-faint" : "cursor-pointer text-ink"}`}>
                  <span className="flex items-center gap-2">{label}{soon && <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-ink-muted">Coming soon</span>}</span>
                  <input type="checkbox" checked={prefs[key]} disabled={soon} onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))} className="h-[18px] w-[18px] cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50" />
                </label>
              ))}
              {/* Back with WhatsApp / SMS: <p className="text-xs text-ink-faint">WhatsApp / SMS uses the mobile number in your profile.</p> */}
            </section>
          </aside>
        </div>
      </div>
      <EmailViewer item={openEmail} onClose={() => setOpenEmail(null)} />
    </>
  );
}
