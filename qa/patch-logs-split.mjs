import fs from "node:fs";
const S = "../src/";
const f = S + "features/chair/components/activity-logs-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = `export const AuthorActivityLogsPage = ({ slug }: { slug: string }) => <MyActivityLogsPage slug={slug} role="author" />;\nexport const ReviewerActivityLogsPage = ({ slug }: { slug: string }) => <MyActivityLogsPage slug={slug} role="reviewer" />;\nfunction MyActivityLogsPage(`;
if (!s.includes(a)) throw new Error("x");
s = s.replace(a, () => `export function MyActivityLogsPage(`);
fs.writeFileSync(f, s);
fs.writeFileSync(S + "features/chair/components/my-activity-logs-page.tsx", `"use client";

import { MyActivityLogsPage } from "./activity-logs-page";

/** Author › Activity Log and Reviewer › Activity Log (one page each, see MyActivityLogsPage). */
export const AuthorActivityLogsPage = ({ slug }: { slug: string }) => <MyActivityLogsPage slug={slug} role="author" />;
export const ReviewerActivityLogsPage = ({ slug }: { slug: string }) => <MyActivityLogsPage slug={slug} role="reviewer" />;
`);
for (const [p, n] of [["app/(authed)/(app)/author/[slug]/(workspace)/activity-logs/page.tsx", "AuthorActivityLogsPage"], ["app/(authed)/(app)/reviewer/[slug]/activity-logs/page.tsx", "ReviewerActivityLogsPage"]]) {
  let t = fs.readFileSync(S + p, "utf8");
  t = t.replace(`import { ${n} } from "@/features/chair/components/activity-logs-page";`, `import { ${n} } from "@/features/chair/components/my-activity-logs-page";`);
  fs.writeFileSync(S + p, t);
}
console.log("ok");
