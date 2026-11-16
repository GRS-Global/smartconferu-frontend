// One-off edit helper: the Peer Review fixture also carries each review's score / recommendation, the paper's confidence and the plagiarism similarity.
import fs from "node:fs";
let s = fs.readFileSync("gen-peer-fixtures.mjs", "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, b); n += 1; };
rep('review: submitted ? { id: `pr-${r.id}-${i}`, score: 4, confidence: "high", commentsToAuthor: "", commentsToChair: "", shared: false, submittedAt: "Oct 20, 2026", answers: {} } : null };',
  'review: submitted ? { id: `pr-${r.id}-${i}`, score: scoreOf(r, i), confidence: CONF[r.conf] ?? "high", commentsToAuthor: "", commentsToChair: "", shared: false, submittedAt: "Oct 20, 2026", answers: recOf(r, i) ? { "f-decision": recOf(r, i) } : {} } : null };');
rep('const board = {}, patch = {};', `const CONF = { High: "high", Medium: "medium", Low: "low" };
const lineOf = (r, i) => (r.scoreCol[i] || "").match(/^(\d(?:\.\d)?)\/5\s*(.*)$/);
const scoreOf = (r, i) => (lineOf(r, i) ? Number(lineOf(r, i)[1]) : 4);
const recOf = (r, i) => (lineOf(r, i)?.[2] || "").trim();
const similarity = {};
const board = {}, patch = {};`);
rep('  patch[dbId] = p;', '  patch[dbId] = p;\n  const sim = (r.plag || "").match(/^(\d+(?:\.\d+)?)%/); if (sim) similarity[dbId] = Number(sim[1]);');
rep('export const PEER_DECISION_TYPES', 'export const PEER_SIMILARITY: Record<string, number> = ${JSON.stringify(similarity)};\nexport const PEER_DECISION_TYPES');
rep('const p = { reviewersAssigned: reviewers.length, reviewsReceived: reviewers.filter((x) => x.review).length, averageScore: reviewers.some((x) => x.review) ? 4 : null };', 'const scored = reviewers.filter((x) => x.review);\n  const p = { reviewersAssigned: reviewers.length, reviewsReceived: scored.length, averageScore: scored.length ? Math.round((scored.reduce((a, x) => a + x.review.score, 0) / scored.length) * 10) / 10 : null };');
fs.writeFileSync("gen-peer-fixtures.mjs", s); console.log("applied", n);
