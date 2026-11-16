// One-off edit helper: the review deadline falls back like the prototype's reviewDueISO (review period end, review deadline, four weeks after submissions close, ...), so the Peer Review header badge and due dates show for a conference that never set a review deadline.
import fs from "node:fs";
const f = "../src/services/supabase/chair.ts"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, () => b); n += 1; };
rep('const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");', `const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const shiftDay = (iso: string, days: number) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + days)); return t.toISOString().slice(0, 10); };
/** When reviews are due, as the prototype works it out (reviewDueISO without an assignment): the end of the review period the chair set, else the review
 *  deadline in Conference info, else four weeks after submissions close, else four weeks before... the conference starts minus 75 days plus 28. */
const reviewDeadlineOf = (c: { review_deadline: string | null; settings: { reviewTimeline?: { closesAt?: string } } | null; submission_deadline: string | null; start_date: string | null } | undefined): string => {
  if (!c) return "";
  const closes = c.settings?.reviewTimeline?.closesAt;
  if (closes) return closes.slice(0, 10);
  if (c.review_deadline) return isoDay(c.review_deadline);
  const close = c.submission_deadline ? isoDay(c.submission_deadline) : c.start_date ? shiftDay(isoDay(c.start_date), -75) : "";
  return close ? shiftDay(close, 28) : "";
};
const REVIEW_DEADLINE_COLS = "review_deadline, settings, submission_deadline, start_date";
type ReviewDeadlineRow = { review_deadline: string | null; settings: { reviewTimeline?: { closesAt?: string } } | null; submission_deadline: string | null; start_date: string | null };`);
rep('rows<{ review_deadline: string | null }>(db.from("conferences").select("review_deadline").eq("slug", conferenceSlug).limit(1), "read this conference"),', 'rows<ReviewDeadlineRow>(db.from("conferences").select(REVIEW_DEADLINE_COLS).eq("slug", conferenceSlug).limit(1), "read this conference"),');
rep('const fallbackDue = isoDay(conf[0]?.review_deadline ?? null);', 'const fallbackDue = reviewDeadlineOf(conf[0]);');
rep('const conf = await rows<{ id: string; review_deadline: string | null }>(db.from("conferences").select("id, review_deadline").eq("slug", conferenceSlug).limit(1), "read this conference");\n    const board: ReviewBoard = { target: 2, deadline: isoDay(conf[0]?.review_deadline ?? null), papers: {} };', 'const conf = await rows<ReviewDeadlineRow & { id: string }>(db.from("conferences").select(`id, ${REVIEW_DEADLINE_COLS}`).eq("slug", conferenceSlug).limit(1), "read this conference");\n    const board: ReviewBoard = { target: 2, deadline: reviewDeadlineOf(conf[0]), papers: {} };');
fs.writeFileSync(f, s); console.log("applied", n);
