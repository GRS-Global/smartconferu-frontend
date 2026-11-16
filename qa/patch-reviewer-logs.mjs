import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 80)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const S = "../src/";
edit(S + "services/activity.ts", [
  [`/** An author's own Activity Log for one conference: what they did and what the chair did to their papers, in the Submissions module only (the
 *  database view \`my_activity_log\`, migration 0040; until it is run there is simply nothing to show). */
export async function loadMyActivityLogs(conferenceSlug: string): Promise<ChairActivityLog[]> {`, `/** A person's own Activity Log for one conference. An author: what they did and what the chair did to their papers, in the Submissions module only (the
 *  database view \`my_activity_log\`, migration 0040). A reviewer: the entries of their own reviewer role — their reviews and the chair assigning or removing
 *  them (\`my_reviewer_activity_log\`, migration 0041). Until the migration is run there is simply nothing to show. */
export async function loadMyActivityLogs(conferenceSlug: string, role: "author" | "reviewer" = "author"): Promise<ChairActivityLog[]> {`],
  [`.filter((l) => l.module === "Submissions").map(`, `.filter((l) => (role === "author" ? l.module === "Submissions" : l.module === "Peer Review")).map(`],
  [`db.from("my_activity_log")`, `db.from(role === "author" ? "my_activity_log" : "my_reviewer_activity_log")`],
]);
edit(S + "features/chair/components/activity-logs-page.tsx", [
  [`/** Author › Activity Log: the author's own view (what they did, and what the chair did to their papers). */
export function AuthorActivityLogsPage({ slug }: { slug: string }) {
  const { state, retry } = useConferenceFrame(slug, "author");`, `/** Author › Activity Log and Reviewer › Activity Log: the person's own view (an author: what they did and what the chair did to their papers; a reviewer:
 *  their reviews and the chair assigning or removing them). */
export const AuthorActivityLogsPage = ({ slug }: { slug: string }) => <MyActivityLogsPage slug={slug} role="author" />;
export const ReviewerActivityLogsPage = ({ slug }: { slug: string }) => <MyActivityLogsPage slug={slug} role="reviewer" />;
function MyActivityLogsPage({ slug, role }: { slug: string; role: "author" | "reviewer" }) {
  const { state, retry } = useConferenceFrame(slug, role);`],
  [`loadMyActivityLogs(slug).then(`, `loadMyActivityLogs(slug, role).then(`],
  [`  }, [slug]);\n  const gate = workspaceGate(state, retry, { title: "Activity Logs", loadingLabel: "Loading the activity log", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you hold no author role in it.`, `  }, [slug, role]);\n  const gate = workspaceGate(state, retry, { title: "Activity Logs", loadingLabel: "Loading the activity log", missingTitle: "We couldn't find that conference.", missingText: \`It doesn't exist, or you hold no \${role} role in it.`],
  [`Pick one from My Conferences.", errorTitle: "Couldn't load the activity log." });\n  if (gate || state.status !== "ready") return gate;\n  const { conference, roles, others } = state;\n  return (\n    <ConferenceShell role="author" conference={conference} roles={roles} others={others} active="activity-log">`, `Pick one from My Conferences.\`, errorTitle: "Couldn't load the activity log." });\n  if (gate || state.status !== "ready") return gate;\n  const { conference, roles, others } = state;\n  return (\n    <ConferenceShell role={role} conference={conference} roles={roles} others={others} active="activity-log">`],
]);
edit(S + "features/workspace/menus.ts", [[`{ key: "activity-log", label: "Activity Log", icon: History, ...p((s) => \`/reviewer/\${e(s)}/activity-logs\`) },`, `{ key: "activity-log", label: "Activity Log", icon: History, app: (s) => \`/reviewer/\${e(s)}/activity-logs\` },`]]);
edit(S + "features/reviewer/links.ts", [[`export const reviewerActivityDest = (slug: string): Dest | null => (SLUG.test(slug) ? proto(\`/prototype/reviewer/\${e(slug)}/activity-logs\`) : null);`, `/** Activity Log: a page of this app. */\nexport const reviewerActivityDest = (slug: string): Dest | null => (SLUG.test(slug) ? { href: \`/reviewer/\${e(slug)}/activity-logs\`, external: false } : null);`]]);
fs.mkdirSync(S + "app/(authed)/(app)/reviewer/[slug]/activity-logs", { recursive: true });
fs.writeFileSync(S + "app/(authed)/(app)/reviewer/[slug]/activity-logs/page.tsx", `import type { Metadata } from "next";
import { ReviewerActivityLogsPage } from "@/features/chair/components/activity-logs-page";

export const metadata: Metadata = { title: "Activity Logs" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ReviewerActivityLogs({ params }: PageProps<"/reviewer/[slug]/activity-logs">) {
  const { slug } = await params;
  return <ReviewerActivityLogsPage slug={slug} />;
}
`);
console.log("applied", n);
