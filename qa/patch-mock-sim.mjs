// One-off edit helper: parity mock — the plagiarism similarity of each paper's newest version (so the list's "Plagiarism %" column has data).
import fs from "node:fs";
const f = "../src/mocks/chair.ts"; let s = fs.readFileSync(f, "utf8");
const a = 'const { PEER_PATCH, PEER_DECISION_TYPES } = await import("@/mocks/parity-peerreview");';
const b = 'SCREENING_PAPERS.map((p) => ({ ...p, ...(PEER_PATCH[p.dbId] ?? {}) }))';
if (!s.includes(a) || !s.includes(b)) { console.log("MISSING"); process.exit(1); }
s = s.replace(a, 'const { PEER_PATCH, PEER_DECISION_TYPES, PEER_SIMILARITY } = await import("@/mocks/parity-peerreview");');
s = s.replace(b, 'SCREENING_PAPERS.map((p) => { const v = String(p.versions); const rec = p.screening[v]; const sim = PEER_SIMILARITY[p.dbId]; return { ...p, ...(PEER_PATCH[p.dbId] ?? {}), ...(rec?.report && sim !== undefined ? { screening: { ...p.screening, [v]: { ...rec, report: { ...rec.report, similarity: sim } } } } : {}) }; })');
fs.writeFileSync(f, s); console.log("ok");
