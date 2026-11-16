import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const S = "../src/";
edit(S + "features/conferences/components/request-detail-page.tsx", [
  [`import { AlertTriangle, Building2,`, `import { Building2,`],
  [`                {!showAll && history.length > COLLAPSED && null}\n`, ``],
  [`history.slice(-COLLAPSED).map(`, `history.map(`],
  [`  const COLLAPSED = 3;\n`, ``],
  [`<div style={r.status === "rejected" ? { background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" } : { background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className=`, `<div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className=`],
]);
// list rows open the request
edit(S + "features/conferences/components/my-requests-page.tsx", [
  [`import Link from "next/link";`, `import Link from "next/link";\nimport { useRouter } from "next/navigation";`],
  [`export function MyRequestsPage() {\n`, `export function MyRequestsPage() {\n  const router = useRouter();\n`],
  [`<tr key={r.id} className={i < rows.length - 1 ? "border-b border-muted" : ""}>`, `<tr key={r.id} tabIndex={0} role="link" aria-label={\`Open the request for \${r.acronym || r.title}\`} onClick={() => router.push(\`/my-requests/\${encodeURIComponent(r.id)}\`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(\`/my-requests/\${encodeURIComponent(r.id)}\`); }} className={\`cursor-pointer transition-colors \${i < rows.length - 1 ? "border-b border-muted" : ""}\`}>`],
  [`<table className="w-full text-sm">`, `<table className="ui-table w-full text-sm">`],
  [`has declined, newest first. An approved one leaves this list and appears under My Conferences. Not ported: the request detail page with its\n   correspondence thread and "Cancel request" (nothing in the database for either). */`, `has declined, newest first. A row opens the request (request-detail-page.tsx). An approved one leaves this list and appears under My Conferences. */`],
  [`Requests to host a new conference on Smartconferu. Approved ones move to My Conferences.`, `Requests to host a new conference on Smartconferu. Click a row to view its details, check on its status, or cancel it.`],
]);
// QA-only sample, as the prototype's screenshot has it
edit(S + "mocks/conference-requests.ts", [[`const rows: ConferenceRequest[] = [];`, `const rows: ConferenceRequest[] = process.env.NEXT_PUBLIC_MOCK_FIXTURES === "parity"
  ? [{ id: "1", slug: "mirc2027", acronym: "MIRC 2027", title: "Manila International Research Conference 2026", status: "pending", submittedAt: "2026-10-19", decidedNote: "", type: "conference", eventType: "in_person", webPage: "https://mirc.example.org", venue: "", city: "Manila", country: "Philippines", startDate: "2027-03-10", endDate: "2027-03-12", primaryArea: "Computer Science & AI", secondaryArea: "", contactEmail: "info@mirc.example.org", about: "" }]
  : [];`]]);
console.log("applied", n);
