// One-off edit helper: the logo reaches the conference list (so the sidebar can show it) and ConferenceMonogram can draw it.
import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const d = "../src/";
edit(d + "services/supabase/conferences.ts", [
  ['.select("id, slug, acronym, title, city, country, start_date, end_date, review_deadline, status, created_at")', '.select("id, slug, acronym, title, city, country, start_date, end_date, review_deadline, status, created_at, logo_path")'],
  ["        ...(c.review_deadline ? { reviewDeadline: isoDay(c.review_deadline) } : {}),\n      };\n      return { conference, roles };", "        ...(c.review_deadline ? { reviewDeadline: isoDay(c.review_deadline) } : {}),\n        ...(c.logo_path ? { logoUrl: db.storage.from(\"public\").getPublicUrl(c.logo_path).data.publicUrl } : {}),\n      };\n      return { conference, roles };"],
]);
edit(d + "features/workspace/components/conference-shell.tsx", [
  [`export function ConferenceMonogram({ acronym, size = 40 }: { acronym: string; size?: number }) {
  const initials = acronym.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "C";
  return (`, `export function ConferenceMonogram({ acronym, size = 40, logoUrl, onTint = false }: { acronym: string; size?: number; /** The conference's own logo, when it has one (drawn instead of the initials). */ logoUrl?: string; /** On a tinted banner the tile is white. */ onTint?: boolean }) {
  const initials = acronym.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "C";
  // eslint-disable-next-line @next/next/no-img-element
  if (logoUrl) return <div aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), border: "1px solid var(--border)" }} className="flex shrink-0 items-center justify-center overflow-hidden bg-white p-[3px]"><img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" /></div>;
  if (onTint) return <div aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), fontSize: Math.round(size * 0.34), letterSpacing: "-0.02em" }} className="flex shrink-0 items-center justify-center bg-white font-extrabold text-primary shadow-sm">{initials}</div>;
  return (`],
  ["<div className=\"pb-2 pt-4\" title={`${conference.acronym} — ${conference.name}`}><ConferenceMonogram acronym={conference.acronym} size={40} /></div>", "<div className=\"pb-2 pt-4\" title={`${conference.acronym} — ${conference.name}`}><ConferenceMonogram acronym={conference.acronym} size={40} logoUrl={conference.logoUrl} /></div>"],
  ["                <ConferenceMonogram acronym={conference.acronym} size={40} />\n                <div className=\"min-w-0\">", "                <ConferenceMonogram acronym={conference.acronym} size={40} logoUrl={conference.logoUrl} />\n                <div className=\"min-w-0\">"],
  ["          <ConferenceMonogram acronym={conference.acronym} size={28} />", "          <ConferenceMonogram acronym={conference.acronym} size={28} logoUrl={conference.logoUrl} />"],
]);
console.log("applied", n);
