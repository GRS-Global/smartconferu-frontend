"use client";

import { ChevronsUpDown, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { COLUMNS, COLUMN_GROUPS, DEFAULT_COLUMNS } from "../submission-columns";

/* The "Columns" drop-down of the Submissions list (the prototype's ColumnsPanel): the columns shown, in order (drag to rearrange),
   every column by group with a tick, a search box, "Reset to default", "Save as view" and "Apply". */
export function ColumnsPanel({ visible, onApply, onClose, onSaveView }: { visible: string[]; onApply: (keys: string[]) => void; onClose: () => void; onSaveView: (name: string, keys: string[]) => void }) {
  const [draft, setDraft] = useState(visible);
  const [query, setQuery] = useState("");
  const [naming, setNaming] = useState(false);
  const [viewName, setViewName] = useState("");
  const dragRef = useRef<string | null>(null);
  const byKey = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
  const chosen = draft.map((k) => byKey[k]).filter(Boolean);
  const q = query.trim().toLowerCase();

  const toggle = (key: string) => setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]));
  const onDrop = (targetKey: string) => {
    const fromKey = dragRef.current;
    dragRef.current = null;
    if (!fromKey || fromKey === targetKey) return;
    setDraft((d) => {
      const next = [...d];
      const from = next.indexOf(fromKey);
      const to = next.indexOf(targetKey);
      if (from === -1 || to === -1) return d;
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };

  return (
    <>
      <button type="button" aria-label="Close columns panel" onClick={onClose} className="fixed inset-0 z-30 cursor-default bg-transparent" />
      <div style={{ border: "1px solid var(--border)", boxShadow: "0 20px 48px rgba(15,23,42,0.20)" }} className="absolute right-0 top-11 z-40 w-[23rem] overflow-hidden rounded-2xl bg-white">
        <div className="border-b border-muted px-4 pb-3 pt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-sm font-extrabold text-navy">Columns</span>
            <span className="whitespace-nowrap rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">{draft.length} shown</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
            <Search size={13} aria-hidden="true" className="text-ink-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a column…" aria-label="Find a column" className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-slate-400" />
          </div>
        </div>

        <div className="max-h-[24rem] overflow-y-auto">
          {!q && (
            <div className="border-b border-muted px-2.5 py-2.5">
              <div className="px-1.5 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-faint">Shown, in order — drag to rearrange</div>
              {chosen.map((c) => (
                <div key={c.key} draggable={!c.pinned} onDragStart={() => { dragRef.current = c.key; }} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(c.key)} className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-canvas ${c.pinned ? "" : "cursor-grab"}`}>
                  <ChevronsUpDown size={12} aria-hidden="true" className={`shrink-0 ${c.pinned ? "text-line-strong" : "text-ink-faint"}`} />
                  <span className="flex-1 truncate text-xs font-semibold text-ink-soft">{c.label}</span>
                  {c.pinned ? <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-bold text-ink-faint">PINNED</span> : (
                    <button type="button" onClick={() => toggle(c.key)} aria-label={`Hide ${c.label}`} className="text-ink-faint transition-colors hover:text-danger"><X size={13} aria-hidden="true" /></button>
                  )}
                </div>
              ))}
            </div>
          )}

          {COLUMN_GROUPS.map((g) => {
            const inGroup = COLUMNS.filter((c) => c.group === g.key && (!q || c.label.toLowerCase().includes(q)));
            if (!inGroup.length) return null;
            const on = inGroup.filter((c) => draft.includes(c.key)).length;
            return (
              <div key={g.key} className="border-b border-muted px-2.5 py-2.5 last:border-b-0">
                <div className="flex items-start justify-between gap-2 px-1.5 pb-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-faint">{g.label}</div>
                  <span className="shrink-0 text-[10.5px] text-ink-faint">{on} of {inGroup.length}</span>
                </div>
                {inGroup.map((c) => {
                  const checked = draft.includes(c.key);
                  return (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-canvas">
                      <input type="checkbox" checked={checked} disabled={c.pinned} onChange={() => toggle(c.key)} style={{ accentColor: "var(--primary)" }} className="h-3.5 w-3.5 cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-40" />
                      <span className={`truncate text-xs font-medium ${checked ? "text-ink" : "text-ink-muted"}`}>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>

        {naming ? (
          <div className="border-t border-line bg-canvas px-4 py-3">
            <label htmlFor="view-name" className="mb-1.5 block text-[11px] font-bold text-ink-soft">Name this view</label>
            <div className="flex items-center gap-2">
              <input id="view-name" autoFocus value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="e.g. Decision day" className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink outline-none placeholder:text-slate-400 focus:border-primary" />
              <button type="button" disabled={!viewName.trim()} onClick={() => { onSaveView(viewName.trim(), draft); setNaming(false); setViewName(""); }} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-faint">Save</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 border-t border-line bg-canvas px-4 py-3">
            <button type="button" onClick={() => setDraft(DEFAULT_COLUMNS)} className="text-[11.5px] font-semibold text-ink-muted hover:underline">Reset to default</button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setNaming(true)} className="rounded-lg border border-line bg-white px-3 py-2 text-[11.5px] font-bold text-ink-soft transition-colors hover:bg-canvas">Save as view</button>
              <button type="button" onClick={() => onApply(draft)} className="rounded-lg bg-primary px-4 py-2 text-[11.5px] font-bold text-white hover:brightness-95">Apply</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
