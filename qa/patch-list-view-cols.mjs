// One-off edit helper (Chair Peer Review slice 3): the list's saved view (sessionStorage + queue for Prev/Next), Columns menu with the two optional columns,
// the sticky Decision column, and the "Needs my decision" score cut-off bands.
import fs from "node:fs";
const file = "../src/features/chair/components/peer-review-page.tsx";
let s = fs.readFileSync(file, "utf8");
let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); return; } s = s.replace(a, b); n += 1; };

rep('import { useCallback, useState, type ReactNode } from "react";', 'import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";');
rep('import { useChairConference } from "../use-chair-conference";', 'import { useChairConference } from "../use-chair-conference";\nimport { readPeerReviewView, savePeerReviewView } from "../peer-review-view";');

// ---- constants
rep('const OUTCOME_LABEL:', `const OPTIONAL_COLUMNS = [{ key: "plagiarism", label: "Plagiarism %" }, { key: "confidence", label: "Avg confidence" }] as const;
const CONFIDENCE: Record<string, number> = { high: 3, medium: 2, low: 1 };
const BAND_EDGE = { accept: "var(--success)", borderline: "#F59E0B", reject: "var(--danger)" } as const;
const STICKY_DECISION: CSSProperties = { position: "sticky", right: 0, zIndex: 2, background: "#FFFFFF", boxShadow: "-8px 0 12px -10px rgba(11,16,32,0.25)", borderLeft: "1px solid var(--border)" };
const OUTCOME_LABEL:`);

// ---- state, restored from the saved view
rep('  const asked = useSearchParams().get("filter");\n  const [filter, setFilter] = useState(PR_FILTERS.some((x) => x.key === asked) ? (asked as string) : "all");\n  const [track, setTrack] = useState("all");\n  const [f, setF] = useState({ id: "", title: "", reviewers: "all", due: "all", score: "all", decision: "all" });\n  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });',
`  const asked = useSearchParams().get("filter");
  // The view is kept for this tab: coming back from a paper lands on the same filter, search and sort (the prototype's saved view).
  const [saved] = useState(() => readPeerReviewView(slug));
  const [filter, setFilter] = useState(PR_FILTERS.some((x) => x.key === asked) ? (asked as string) : PR_FILTERS.some((x) => x.key === saved?.filter) ? (saved?.filter as string) : "all");
  const [track, setTrack] = useState(saved?.track || "all");
  const [f, setF] = useState({ id: saved?.idq || "", title: saved?.query || "", reviewers: saved?.rv || "all", due: saved?.du || "all", score: saved?.sc || "all", decision: saved?.dc || "all" });
  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>(saved?.sort && (saved.sort.key === null || saved.sort.key in SORT_FIRST) ? { key: saved.sort.key as SortKey | null, dir: saved.sort.dir } : { key: null, dir: "asc" });
  // More columns (Columns menu) and the score cut-offs of "Needs my decision".
  const [extraCols, setExtraCols] = useState<string[]>(saved?.cols ?? []);
  const [colsOpen, setColsOpen] = useState(false);
  const [cut, setCut] = useState({ accept: 4, reject: 2.5 });`);
rep('  const [icF, setIcF] = useState("all");\n  const [plF, setPlF] = useState("all");', '  const [icF, setIcF] = useState(saved?.ic || "all");\n  const [plF, setPlF] = useState(saved?.pl || "all");');
rep('  const gate = workspaceGate(state, retry, { title: "Peer Review",', `  useEffect(() => {
    savePeerReviewView({ ...readPeerReviewView(slug), conferenceId: slug, filter, query: f.title, track, sort, ic: icF, pl: plF, idq: f.id, rv: f.reviewers, du: f.due, sc: f.score, dc: f.decision, cols: extraCols });
  }, [slug, filter, track, sort, icF, plF, f, extraCols]);

  const gate = workspaceGate(state, retry, { title: "Peer Review",`);

// ---- derived: cut-off bands, optional cells
rep('  const unsent = inTrack.filter((r) => r.unsent);', `  const unsent = inTrack.filter((r) => r.unsent);
  // Needs my decision: what the two cut-offs would mean, by the average score.
  const readyRows = inTrack.filter((r) => r.stage === "ready" && !r.decided);
  const bandOf = (r: PrRow): "accept" | "borderline" | "reject" => (r.avg == null ? "borderline" : r.avg >= cut.accept ? "accept" : r.avg < cut.reject ? "reject" : "borderline");
  const bands: Record<"accept" | "borderline" | "reject", PrRow[]> = { accept: [], borderline: [], reject: [] };
  readyRows.forEach((r) => bands[bandOf(r)].push(r));
  const acceptedNow = inTrack.filter((r) => r.decided && (typeOf(r)?.outcome ?? r.paper.outcome) === "accept").length;
  const decidedNow = inTrack.filter((r) => r.decided).length;
  // A range while borderline papers are open: all of them rejected … all of them accepted.
  const rateOf = (k: number) => (decidedNow + readyRows.length ? Math.round((k / (decidedNow + readyRows.length)) * 100) : null);
  const rateLow = rateOf(acceptedNow + bands.accept.length);
  const rateHigh = rateOf(acceptedNow + bands.accept.length + bands.borderline.length);
  const setCutAt = (key: "accept" | "reject", v: string) => setCut((c) => {
    const x = Math.round(Math.min(5, Math.max(1, Number(v) || 1)) * 10) / 10;
    // Keep reject ≤ accept: moving one past the other drags it along.
    return key === "accept" ? { accept: x, reject: Math.min(c.reject, x) } : { reject: x, accept: Math.max(c.accept, x) };
  });
  const show = (k: string) => extraCols.includes(k);
  const similarityLimit = data.criteria.similarityLimit;
  const similarityOf = (r: PrRow): number | null => r.paper.screening[String(r.paper.versions)]?.report?.similarity ?? null;
  const confidenceOf = (r: PrRow): number | null => { const v = r.reviewers.flatMap((x) => (x.r.review ? [CONFIDENCE[x.r.review.confidence.toLowerCase()]] : [])).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  // The papers shown, in order, kept so the paper page can step through them (Prev / Next).
  const rememberQueue = () => savePeerReviewView({
    ...readPeerReviewView(slug), conferenceId: slug, filter, query: f.title, track, sort, ic: icF, pl: plF, idq: f.id, rv: f.reviewers, du: f.due, sc: f.score, dc: f.decision, cols: extraCols,
    queue: rows.map((r) => r.paper.id),
    queueLabel: [active.key === "all" ? "All papers" : active.label, icNow !== "all" ? \`Initial check: \${screeningMeta(CHECK_DECISIONS, icNow).label}\` : null, plNow !== "all" ? \`Plagiarism: \${screeningMeta(PLAG_DECISIONS, plNow).label}\` : null, track !== "all" ? track : null, tq ? \`“\${f.title.trim()}”\` : null].filter(Boolean).join(" · "),
  });`);

// ---- th: style support
rep('const th = (label: string, o: { sortKey?: SortKey; filter?: ReactNode; className?: string } = {}) => {', 'const th = (label: string, o: { sortKey?: SortKey; filter?: ReactNode; className?: string; style?: CSSProperties } = {}) => {');
rep('      <th aria-sort={o.sortKey ? (on ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined} className=', '      <th style={o.style} aria-sort={o.sortKey ? (on ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined} className=');

// ---- Columns menu (after the export link)
rep('<Download size={13} aria-hidden="true" /> All reviews &amp; export</Link>', `<Download size={13} aria-hidden="true" /> All reviews &amp; export</Link>
          <div className="relative">
            <button type="button" onClick={() => setColsOpen((o) => !o)} aria-expanded={colsOpen} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft hover:bg-canvas">
              Columns{extraCols.length ? \` (+\${extraCols.length})\` : ""} <ChevronDown size={13} aria-hidden="true" />
            </button>
            {colsOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setColsOpen(false)} aria-hidden="true" />
                <div style={{ border: "1px solid var(--border)", boxShadow: "0 12px 28px rgba(11,16,32,0.12)" }} className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl bg-white p-2">
                  <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">More columns</div>
                  {OPTIONAL_COLUMNS.map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink hover:bg-canvas">
                      <input className="cursor-pointer accent-primary" type="checkbox" checked={show(c.key)} onChange={() => setExtraCols((l) => (l.includes(c.key) ? l.filter((k) => k !== c.key) : [...l, c.key]))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>`);
// The export link carried "ml-auto"; keep it there (Columns sits to its right).

// ---- cut-off bands (before the unsent strip)
rep('        {(filter === "unsent" || filter === "decided") && unsent.length > 0 && (', `        {filter === "ready" && readyRows.length > 0 && (
          <div style={CARD} className="rounded-xl bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[13px] font-bold text-navy">Score cut-offs</span>
              {([["reject", "Reject below"], ["accept", "Accept from"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[13px] text-ink-soft">
                  {label}
                  <input type="number" min={1} max={5} step={0.1} value={cut[key]} onChange={(e) => setCutAt(key, e.target.value)} aria-label={\`\${label} (average score)\`} className="h-8 w-16 rounded-lg border border-line px-2 text-[13px] font-bold tabular-nums text-navy outline-none focus:border-primary" />
                </label>
              ))}
              {rateLow != null && (
                <span className="ml-auto text-[13px] text-ink-soft">
                  Acceptance rate <b className="tabular-nums text-navy">{rateLow}%</b>
                  {rateHigh !== rateLow && <span className="text-ink-faint"> · up to {rateHigh}% if you accept the ones in the middle</span>}
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {([
                { key: "reject", label: "Reject", range: \`below \${cut.reject}\`, color: "var(--danger)", bg: "var(--danger-soft)" },
                { key: "borderline", label: "Decide yourself", range: \`\${cut.reject} – \${cut.accept}\`, color: "#B45309", bg: "var(--warning-soft)" },
                { key: "accept", label: "Accept", range: \`\${cut.accept} and above\`, color: "#15803D", bg: "var(--success-soft)" },
              ] as const).map((b) => {
                const list = bands[b.key];
                return (
                  <div key={b.key} style={{ background: b.bg, flexGrow: Math.max(list.length, 0.6), flexBasis: 0 }} className="flex min-w-[150px] items-center gap-2 rounded-lg px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div style={{ color: b.color }} className="text-[13px] font-bold"><span className="text-base tabular-nums">{list.length}</span> {b.label}</div>
                      <div className="truncate text-[11px] text-ink-muted">{b.range}</div>
                    </div>
                    {/* Reject / accept: select them for Edit decisions. The middle ones are opened one by one. */}
                    {b.key !== "borderline" && list.length > 0 && (
                      <button type="button" onClick={() => setSelected(list.map((r) => r.paper.dbId))} title="Select them, then use Edit decisions" style={{ border: \`1px solid \${b.color}\`, color: b.color }} className="h-7 shrink-0 cursor-pointer rounded-md bg-white px-2.5 text-[11px] font-bold">Select</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(filter === "unsent" || filter === "decided") && unsent.length > 0 && (`);

// ---- header: sticky Decision + optional columns
rep('{th("Decision", { className: "min-w-[150px]", filter:', '{th("Decision", { className: "min-w-[150px]", style: { right: 0, zIndex: 12, borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 12px -10px rgba(11,16,32,0.25), inset 0 -1px 0 var(--border)" }, filter:');
rep(`...decTypes.map((t): [string, string] => [t.id, t.label])]} /> })}
              </tr>`, `...decTypes.map((t): [string, string] => [t.id, t.label])]} /> })}
                {show("plagiarism") && th("Plagiarism %", { className: "text-center" })}
                {show("confidence") && th("Confidence", { className: "text-center" })}
              </tr>`);

// ---- rows: band edge, title link remembers the queue, sticky decision cell, optional cells
rep('<tr key={r.paper.dbId} {...pick.row(r.paper.dbId)} className=', '<tr key={r.paper.dbId} {...pick.row(r.paper.dbId)} style={filter === "ready" ? { boxShadow: `inset 3px 0 0 ${BAND_EDGE[bandOf(r)]}` } : undefined} className=');
rep('<Link href={`/submissions/${encodeURIComponent(r.paper.id)}/chair/review`} title={r.paper.title} className=', '<Link href={`/submissions/${encodeURIComponent(r.paper.id)}/chair/review`} onClick={rememberQueue} title={r.paper.title} className=');
rep(`                    <td className="px-3 py-3">
                      <div className="min-w-[132px]">`, `                    <td style={STICKY_DECISION} className="px-3 py-3">
                      <div className="min-w-[132px]">`);
rep(`                        {r.unsent && <div className="mt-1 text-[11px] font-semibold text-warning">Not sent to authors</div>}
                      </div>
                    </td>`, `                        {r.unsent && <div className="mt-1 text-[11px] font-semibold text-warning">Not sent to authors</div>}
                      </div>
                    </td>
                    {show("plagiarism") && (
                      <td className="px-3 py-3 text-center">
                        {similarityOf(r) === null ? <span className="text-line-strong">—</span> : (
                          <span style={{ color: similarityOf(r)! > similarityLimit ? (plCleared(r) ? "#B45309" : "var(--danger)") : "var(--ink-soft)" }} className="text-xs font-bold tabular-nums">{similarityOf(r)}%</span>
                        )}
                        {plCleared(r) && similarityOf(r) !== null && similarityOf(r)! > similarityLimit && <div className="text-[10px] text-ink-faint">cleared</div>}
                      </td>
                    )}
                    {show("confidence") && <td className="px-3 py-3 text-center text-xs font-semibold text-ink-soft">{confidenceOf(r) == null ? "—" : confidenceOf(r)! >= 2.5 ? "High" : confidenceOf(r)! >= 1.5 ? "Medium" : "Low"}</td>}`);
rep('  const show = (k: string) => extraCols.includes(k);', '  const show = (k: string) => extraCols.includes(k);\n  // Cleared = past the plagiarism step (in peer review, or marked clear) — the prototype\'s `cleared`.\n  const plCleared = (r: PrRow) => r.stage !== "plagiarism" && r.stage !== "upload";');
fs.writeFileSync(file, s);
console.log("applied", n);
