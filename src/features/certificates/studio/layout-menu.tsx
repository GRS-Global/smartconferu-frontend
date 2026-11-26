"use client";

import { useState, type ReactNode } from "react";
import { inputClass, inputStyle, selectClass, selectStyle } from "../form-styles";
import { marginOf, unitPerPx, type StudioDoc, type Unit } from "./model";

/* The "Layout" popover: rulers, guides, grid and print margins. View settings (what is shown) are per person and live in the browser; the guides
   themselves and the margin are part of the design. */

export interface ViewSettings { rulers: boolean; unit: Unit; guides: boolean; lockGuides: boolean; centre: boolean; grid: boolean; snapGrid: boolean; gridSize: number; margins: boolean }
export const DEFAULT_VIEW: ViewSettings = { rulers: true, unit: "mm", guides: true, lockGuides: false, centre: false, grid: false, snapGrid: false, gridSize: 25, margins: true };
const KEY = "certstudio:view";
export function loadView(): ViewSettings {
  try { return { ...DEFAULT_VIEW, ...(JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<ViewSettings>) }; } catch { return DEFAULT_VIEW; }
}
export function saveView(v: ViewSettings) { try { window.localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* a per-person convenience only */ } }

function Check({ id, text, checked, onChange }: { id: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "var(--primary)" }} />
      <span style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">{text}</span>
    </label>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div><div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-1.5">{title}</div><div className="space-y-1.5">{children}</div></div>;
}

export function LayoutMenu({ view, setView, doc, page, setGuides, setMargin, onClose }: {
  view: ViewSettings; setView: (v: ViewSettings) => void; doc: StudioDoc; page: { w: number; h: number };
  setGuides: (g: { x: number[]; y: number[] }) => void; setMargin: (px: number) => void; onClose: () => void;
}) {
  const [pos, setPos] = useState("");
  const f = unitPerPx(doc, view.unit);
  const patch = (p: Partial<ViewSettings>) => setView({ ...view, ...p });
  const g = doc.guides ?? { x: [], y: [] };
  const count = g.x.length + g.y.length;
  const addGuide = (axis: "x" | "y") => {
    const px = Math.round(Number(pos) / f);
    if (!pos.trim() || !Number.isFinite(px) || px < 0 || px > (axis === "x" ? page.w : page.h)) return;
    setGuides({ ...g, [axis]: [...g[axis], px] });
    patch({ guides: true });
    setPos("");
  };
  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} aria-hidden="true" />
      <div role="dialog" aria-label="Rulers, guides and margins" style={{ background: "#fff", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(11,16,32,0.16)" }} className="absolute right-3 top-full mt-1 z-50 w-[290px] rounded-xl p-3.5 space-y-4 max-h-[75vh] overflow-y-auto">
        <Group title="RULERS">
          <Check id="lm-rulers" text="Show rulers" checked={view.rulers} onChange={(v) => patch({ rulers: v })} />
          <div className="flex items-center gap-2">
            <label htmlFor="lm-unit" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">Units</label>
            <select id="lm-unit" value={view.unit} onChange={(e) => patch({ unit: e.target.value as Unit })} style={selectStyle} className={selectClass}>
              <option value="mm">Millimetres</option><option value="in">Inches</option><option value="px">Pixels</option>
            </select>
          </div>
        </Group>
        <Group title="GUIDES">
          <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">Drag from a ruler onto the page to add a guide. Drag a guide off the page, or double-click it, to remove it.</p>
          <Check id="lm-guides" text="Show guides" checked={view.guides} onChange={(v) => patch({ guides: v })} />
          <Check id="lm-lock" text="Lock guides" checked={view.lockGuides} onChange={(v) => patch({ lockGuides: v })} />
          <Check id="lm-centre" text="Show centre guides" checked={view.centre} onChange={(v) => patch({ centre: v })} />
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <label htmlFor="lm-pos" style={{ color: "var(--ink-soft)" }} className="text-[11px] font-semibold block mb-1">Add at ({view.unit})</label>
              <input id="lm-pos" type="number" min={0} value={pos} onChange={(e) => setPos(e.target.value)} style={inputStyle} className={inputClass} />
            </div>
            <button type="button" onClick={() => addGuide("x")} title="Vertical guide at this distance from the left" style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="h-9 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer">Vertical</button>
            <button type="button" onClick={() => addGuide("y")} title="Horizontal guide at this distance from the top" style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="h-9 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer">Horizontal</button>
          </div>
          <button type="button" disabled={count === 0 || view.lockGuides} onClick={() => setGuides({ x: [], y: [] })} style={{ color: "var(--danger)" }} className="text-xs font-bold hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer disabled:cursor-default">Remove all guides{count ? ` (${count})` : ""}</button>
        </Group>
        <Group title="GRID">
          <Check id="lm-grid" text="Show grid" checked={view.grid} onChange={(v) => patch({ grid: v })} />
          <Check id="lm-snap" text="Snap to grid when moving" checked={view.snapGrid} onChange={(v) => patch({ snapGrid: v })} />
          <div className="flex items-center gap-2">
            <label htmlFor="lm-gs" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">Grid size</label>
            <select id="lm-gs" value={view.gridSize} onChange={(e) => patch({ gridSize: Number(e.target.value) })} style={selectStyle} className={selectClass}>
              {[10, 20, 25, 50, 100].map((n) => <option key={n} value={n}>{n} px</option>)}
            </select>
          </div>
        </Group>
        <Group title="PRINT MARGINS">
          <Check id="lm-margins" text="Show print-safe area" checked={view.margins} onChange={(v) => patch({ margins: v })} />
          <div>
            <label htmlFor="lm-margin" style={{ color: "var(--ink-soft)" }} className="text-[11px] font-semibold block mb-1">Safe margin ({view.unit})</label>
            <input id="lm-margin" type="number" min={0} step={view.unit === "px" ? 1 : 0.5} value={Math.round(marginOf(doc) * f * 100) / 100} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) setMargin(Math.min(Math.round(n / f), Math.floor(Math.min(page.w, page.h) / 2) - 1)); }} style={inputStyle} className={inputClass} />
          </div>
          <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">Keep text and logos inside the dashed line so printers do not trim them. Elements snap to it while moving. Bleed is not supported yet.</p>
        </Group>
        <p style={{ color: "var(--ink-faint)" }} className="text-[11px] leading-relaxed">Rulers, guides, grid and margins appear only while editing. They are never in the PDF or the recipient&apos;s copy.</p>
      </div>
    </>
  );
}
