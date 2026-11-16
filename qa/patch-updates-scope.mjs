import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 80)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const S = "../src/features/notifications/components/";
edit(S + "conference-updates-page.tsx", [[`<NotificationsPage scope={{ slug, role }} />`, `<NotificationsPage scope={{ slug, role, acronym: state.conference.acronym }} />`]]);
edit(S + "notifications-page.tsx", [
  [`export function NotificationsPage({ scope }: { scope?: { slug: string; role: "author" | "reviewer" } } = {}) {`, `export function NotificationsPage({ scope }: { scope?: { slug: string; role: "author" | "reviewer"; acronym: string } } = {}) {`],
  // header: breadcrumb and a scoped "Mark all as read"
  [`  const header = (
    <PageHeader
      title={scope ? "Updates" : "Notifications"}
      actions={ready && (
        (unreadTotal > 0 || ready.some((x) => x.email && !x.read)) && (
          <button
            type="button"
            onClick={() => { void n.markAll(); }}
            disabled={n.markingAll || n.pending.size > 0}`, `  // Inside a conference (the prototype's conference mode) only what that conference sent to that role is shown, and only that is marked read.
  const scopedItems = ready && scope ? ready.filter((x) => !n.dismissed.has(x.id) && x.conference?.slug === scope.slug && audienceOf(x, n.chairOf) === scope.role) : null;
  const scopedUnread = scopedItems ? scopedItems.filter((x) => !x.read) : [];
  const [markingScoped, setMarkingScoped] = useState(false);
  const markScoped = async () => { setMarkingScoped(true); try { await Promise.all(scopedUnread.map((x) => n.markRead(x.id))); } finally { setMarkingScoped(false); } };
  const header = (
    <PageHeader
      title={scope ? "Updates" : "Notifications"}
      breadcrumbs={scope ? [{ label: "My Conferences", href: "/dashboard" }, { label: \`\${scope.acronym} · Updates\` }] : undefined}
      actions={ready && (
        (scope ? scopedUnread.length > 0 : (unreadTotal > 0 || ready.some((x) => x.email && !x.read))) && (
          <button
            type="button"
            onClick={() => { void (scope ? markScoped() : n.markAll()); }}
            disabled={n.markingAll || markingScoped || n.pending.size > 0}`],
  [`            {n.markingAll ? "Marking all as read…" : "Mark all as read"}`, `            {n.markingAll || markingScoped ? "Marking all as read…" : "Mark all as read"}`],
  [`  const intro = <p className="mt-1 px-4 text-sm text-ink-muted sm:px-8">Everything about your papers and conferences, in one place.</p>;`, `  const intro = <p className="mt-1 px-4 text-sm text-ink-muted sm:px-8">{scope ? (scope.role === "reviewer" ? \`Your review assignments, deadlines and news from the \${scope.acronym} chair.\` : \`Everything about your papers and news from the \${scope.acronym} organisers.\`) : "Everything about your papers and conferences, in one place."}</p>;`],
  [`{groups.length === 0 && <EmptyState icon={Bell} title="Nothing here right now." />}`, `{groups.length === 0 && <div className="py-14 text-center"><Bell size={28} aria-hidden="true" className="mx-auto mb-2 text-line-strong" /><p className="text-sm text-ink-faint">Nothing here right now.</p></div>}`],
]);
console.log("applied", n);
