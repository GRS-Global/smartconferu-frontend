// One-off edit helper: the Activity Logs page for the author (shared view with the chair's).
import fs from "node:fs";
const f = "../src/features/chair/components/activity-logs-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 90)); return; } s = s.replace(a, () => b); n++; };

rep(`function Detail({ log, onClose }: { log: ChairActivityLog | null; onClose: () => void }) {`, `function Detail({ log, onClose, chair }: { log: ChairActivityLog | null; onClose: () => void; chair: boolean }) {`);
rep(`          <Row label="Reviewer" value={log.reviewerName} />`, `          {chair && <Row label="Reviewer" value={log.reviewerName} />}`);

// the shared view
const a = s.indexOf("export function ActivityLogsPage");
s = s.slice(0, a) + `/** The page itself (filters, table, paging, details), shared by the chair's Conference Settings › Activity Logs and the author's Activity Log. The chair sees
 *  everything and can filter by person; an author sees only their own entries (see \`my_activity_log\`, migration 0040), so there is no "All Users" filter. */
function LogsView({ logs, chair, crumbs }: { logs: ChairActivityLog[]; chair: boolean; crumbs: Array<{ label: string; href?: string; strong?: boolean }> }) {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");
  const [action, setAction] = useState("all");
  const [who, setWho] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<ChairActivityLog | null>(null);
  const performers = [...new Set(logs.map((l) => l.actorName))];
  const q = search.trim().toLowerCase();
  const filtered = logs
    .filter((l) => (module === "all" || l.module === module) && (action === "all" || l.action === action) && (who === "all" || l.actorName === who)
      && (!from || l.datetime.slice(0, 10) >= from) && (!to || l.datetime.slice(0, 10) <= to)
      && (!q || l.description.toLowerCase().includes(q) || l.actorName.toLowerCase().includes(q)))
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safe = Math.min(page, pages);
  const shown = filtered.slice((safe - 1) * PAGE, safe * PAGE);
  const reset = (set: (v: string) => void) => (v: string) => { set(v); setPage(1); };
  const arrow = (disabled: boolean) => ({ border: "1px solid var(--border)", color: disabled ? "var(--ink-faint)" : "var(--ink-muted)" });

  return (
    <>
      <PageHeader title="Activity Logs" breadcrumbs={crumbs} />
      <div className="hd-page p-8 [&.hd-page]:!p-8">
        <div style={{ border: "1px solid var(--border)" }} className="mb-6 max-w-3xl rounded-xl bg-canvas p-5"><p className="text-sm leading-relaxed text-ink-soft">Track relevant changes and actions performed across this conference{chair ? "" : " that involve your work"}.</p></div>
        <div data-tour="al-filters" className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select label="Module" value={module} onChange={reset(setModule)} options={MODULES} all="All Modules" />
            <Select label="Action" value={action} onChange={reset(setAction)} options={ACTIONS} all="All Actions" />
            {chair && <Select label="Performed by" value={who} onChange={reset(setWho)} options={performers} all="All Users" />}
            <div className="flex items-center gap-1.5">
              <input type="date" aria-label="From date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} style={{ border: "1px solid var(--border)", color: from ? "var(--ink)" : "var(--ink-faint)" }} className="rounded-lg bg-canvas px-2.5 py-2 text-xs outline-none" />
              <span className="text-xs text-ink-faint">to</span>
              <input type="date" aria-label="To date" value={to} onChange={(e) => reset(setTo)(e.target.value)} style={{ border: "1px solid var(--border)", color: to ? "var(--ink)" : "var(--ink-faint)" }} className="rounded-lg bg-canvas px-2.5 py-2 text-xs outline-none" />
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)" }} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2"><Search size={15} aria-hidden="true" className="text-ink-faint" /><input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Search activity..." aria-label="Search activity" className="w-52 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400" /></div>
        </div>
        <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
          {shown.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="ui-table w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }} className="bg-canvas">
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-ink-muted">Date &amp; Time (UTC)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">Performed By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">Module</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">Activity</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-ink-muted">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-ink-muted">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((l, i) => {
                      const t = parts(l.datetime);
                      return (
                        <tr key={l.id} style={{ borderBottom: i < shown.length - 1 ? "1px solid var(--muted)" : "none" }} className="transition-colors">
                          <td className="whitespace-nowrap px-4 py-3.5"><div className="text-xs font-semibold text-ink">{t.date}</div><div className="text-xs text-ink-faint">{t.time}</div></td>
                          <td className="px-4 py-3.5"><div className="font-semibold text-navy">{l.actorName}</div><div className="text-xs text-ink-faint">{ROLE[l.actorRole]}</div></td>
                          <td className="px-4 py-3.5"><ActionBadge action={l.action} /></td>
                          <td className="px-4 py-3.5 text-ink-muted">{l.module}</td>
                          <td className="max-w-[260px] px-4 py-3.5 text-ink">{l.description}</td>
                          <td className="px-4 py-3.5"><span className={\`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize \${l.status === "failed" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}\`}>{l.status}</span></td>
                          <td className="px-4 py-3.5 text-center"><button type="button" onClick={() => setOpen(l)} className="cursor-pointer whitespace-nowrap text-xs font-semibold text-primary hover:underline">View Details</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ borderTop: "1px solid var(--border)" }} className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-ink-faint">Showing {(safe - 1) * PAGE + 1}–{Math.min(safe * PAGE, filtered.length)} of {filtered.length}</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setPage(Math.max(1, safe - 1))} disabled={safe === 1} style={arrow(safe === 1)} aria-label="Previous page" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-canvas disabled:cursor-not-allowed"><ChevronLeft size={14} aria-hidden="true" /></button>
                  <span className="px-1 text-xs font-semibold text-ink-muted">Page {safe} of {pages}</span>
                  <button type="button" onClick={() => setPage(Math.min(pages, safe + 1))} disabled={safe === pages} style={arrow(safe === pages)} aria-label="Next page" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-canvas disabled:cursor-not-allowed"><ChevronRight size={14} aria-hidden="true" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-14 text-center">
              <History size={28} aria-hidden="true" className="mx-auto mb-2 text-line-strong" />
              <p className="mb-1 text-sm font-semibold text-ink">{logs.length ? "No activity matches these filters" : "No activity yet"}</p>
              <p className="text-xs text-ink-faint">{logs.length ? "Change or clear the filters." : chair ? "Conference activities will appear here as users perform actions." : "Relevant changes and actions related to your work will appear here."}</p>
            </div>
          )}
        </div>
      </div>
      <Detail log={open} onClose={() => setOpen(null)} chair={chair} />
    </>
  );
}

/** Conference Settings › Activity Logs (the chair). */
export function ActivityLogsPage({ slug }: { slug: string }) {
  const { state, retry } = useActivityLogs(slug);
  const gate = workspaceGate(state, retry, { title: "Activity Logs", loadingLabel: "Loading the activity logs", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the activity logs." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, screening, logs } = state;
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="settings/activity-logs" screening={screening}>
      <LogsView logs={logs} chair crumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: "Conference Settings" }, { label: "Activity Logs", strong: true }]} />
    </ConferenceShell>
  );
}

/** Author › Activity Log: the author's own view (what they did, and what the chair did to their papers). */
export function AuthorActivityLogsPage({ slug }: { slug: string }) {
  const { state, retry } = useConferenceFrame(slug, "author");
  const [logs, setLogs] = useState<ChairActivityLog[] | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    let alive = true;
    loadMyActivityLogs(slug).then((l) => { if (alive) setLogs(l); }, (e: unknown) => { if (alive) setProblem(e instanceof Error ? e.message : "Something went wrong."); });
    return () => { alive = false; };
  }, [slug]);
  const gate = workspaceGate(state, retry, { title: "Activity Logs", loadingLabel: "Loading the activity log", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you hold no author role in it. Pick one from My Conferences.", errorTitle: "Couldn't load the activity log." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others } = state;
  return (
    <ConferenceShell role="author" conference={conference} roles={roles} others={others} active="activity-log">
      {problem ? (
        <><PageHeader title="Activity Logs" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} /><p role="alert" className="m-8 rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{problem}</p></>
      ) : logs === null ? (
        <><PageHeader title="Activity Logs" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} /><div role="status" aria-label="Loading the activity log" className="p-8"><div className="h-48 animate-pulse rounded-2xl border border-line bg-white" /></div></>
      ) : (
        <LogsView logs={logs} chair={false} crumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      )}
    </ConferenceShell>
  );
}
`;
n++;
rep(`import { useState } from "react";`, `import { useEffect, useState } from "react";`);
rep(`import { workspaceGate } from "@/features/workspace/components/workspace-gate";`, `import { workspaceGate } from "@/features/workspace/components/workspace-gate";\nimport { useConferenceFrame } from "@/features/workspace/use-conference-frame";\nimport { loadMyActivityLogs } from "@/services/activity";`);
fs.writeFileSync(f, s);

// route and menu
fs.mkdirSync("../src/app/(authed)/(app)/author/[slug]/(workspace)/activity-logs", { recursive: true });
fs.writeFileSync("../src/app/(authed)/(app)/author/[slug]/(workspace)/activity-logs/page.tsx", `import type { Metadata } from "next";
import { AuthorActivityLogsPage } from "@/features/chair/components/activity-logs-page";

export const metadata: Metadata = { title: "Activity Logs" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorActivityLogs({ params }: PageProps<"/author/[slug]/activity-logs">) {
  const { slug } = await params;
  return <AuthorActivityLogsPage slug={slug} />;
}
`);
const m = "../src/features/workspace/menus.ts"; let ms = fs.readFileSync(m, "utf8");
const old = `{ key: "activity-log", label: "Activity Log", icon: History, ...p((s) => \`/author/\${e(s)}/activity-logs\`) },\n];\n\nexport const REVIEWER_MENU`;
if (!ms.includes(old)) console.log("MISSING menu"); else { ms = ms.replace(old, () => `{ key: "activity-log", label: "Activity Log", icon: History, app: (s) => \`/author/\${e(s)}/activity-logs\` },\n];\n\nexport const REVIEWER_MENU`); n++; }
fs.writeFileSync(m, ms);
console.log("applied", n);
