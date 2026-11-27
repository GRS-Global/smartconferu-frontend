"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CUSTOM_KEY, MAX_MM, MIN_MM, PAPER_GROUPS, labelOf, loadCustom, parseCustom, saveCustom, savePaper, sheetOf, type PaperKey, type PaperSpec } from "./paper";
import { inputClass, inputStyle, selectClass, selectStyle } from "./form-styles";

/** The width and height fields of a custom paper size (millimetres or inches, either order). Calls `onUse` with a valid size already saved. */
export function CustomSizeFields({ onUse, compact = false }: { onUse: () => void; compact?: boolean }) {
  const start = loadCustom();
  const [unit, setUnit] = useState<"mm" | "in">("mm");
  const [a, setA] = useState(String(start.w));
  const [b, setB] = useState(String(start.h));
  const [error, setError] = useState("");
  const use = () => {
    const r = parseCustom(a, b, unit);
    if ("error" in r) { setError(r.error); return; }
    saveCustom(r.size);
    setError("");
    onUse();
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div><label htmlFor="cs-w" style={{ color: "var(--ink-soft)" }} className="text-[11px] font-semibold block mb-1">Width</label><input id="cs-w" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} style={inputStyle} className={inputClass} /></div>
        <div><label htmlFor="cs-h" style={{ color: "var(--ink-soft)" }} className="text-[11px] font-semibold block mb-1">Height</label><input id="cs-h" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} style={inputStyle} className={inputClass} /></div>
        <div><label htmlFor="cs-u" className="sr-only">Unit</label><select id="cs-u" value={unit} onChange={(e) => { const u = e.target.value as "mm" | "in"; const k = u === "in" ? 1 / 25.4 : 25.4; const conv = (v: string) => { const n = Number(v.replace(",", ".")); return Number.isFinite(n) ? String(Math.round(n * k * 100) / 100) : v; }; setA(conv(a)); setB(conv(b)); setUnit(u); }} style={selectStyle} className={selectClass}><option value="mm">mm</option><option value="in">in</option></select></div>
      </div>
      <button type="button" onClick={use} style={{ background: "var(--primary)" }} className={`${compact ? "py-1.5" : "py-2"} w-full rounded-lg text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer`}>Use this size</button>
      {error && <p role="alert" style={{ color: "var(--danger-ink)" }} className="text-[11px] font-semibold leading-snug">{error}</p>}
      <p style={{ color: "var(--ink-faint)" }} className="text-[10.5px] leading-snug">Either order; the sheet is turned to suit the design. From {MIN_MM} mm to {MAX_MM / 10} cm on each side.</p>
    </div>
  );
}

/** The page-size button ("A4 ▾") and its list. Choosing a size changes the certificate's page (and so the paper it prints and saves on). */
export function PaperMenu({ value, onChange, orientation, align = "right", up = false }: {
  value: PaperSpec; onChange: (key: PaperKey) => void; orientation: "landscape" | "portrait"; align?: "left" | "right"; up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sheet = sheetOf(value, orientation);
  const pick = (key: PaperKey) => { savePaper(key); onChange(key); setOpen(false); };
  const label = labelOf(value);
  const custom = value.key === CUSTOM_KEY;
  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`Page size: ${label}. Change it`}
        title={`Page size (the certificate is made for this paper and prints on it): ${label}, ${Math.round(sheet.w * 10) / 10} × ${Math.round(sheet.h * 10) / 10} mm`}
        style={{ border: "1px solid var(--border)", color: "var(--ink-soft)", background: "#fff" }}
        className="h-8 px-2 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer max-w-[130px]"
      >
        <span className="truncate">{custom ? "Custom" : label}</span> <ChevronDown size={12} className="shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu" aria-label="Page size"
            style={{ background: "#fff", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(11,16,32,0.16)", maxHeight: "min(70vh, 560px)" }}
            className={`absolute ${align === "right" ? "right-0" : "left-0"} ${up ? "bottom-full mb-1" : "top-full mt-1"} z-50 w-72 rounded-xl p-1.5 overflow-y-auto`}
          >
            {PAPER_GROUPS.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider px-3 pt-2 pb-1">{g.label.toUpperCase()}</div>
                {g.papers.map((p) => (
                  <button key={p.key} role="menuitemradio" aria-checked={value.key === p.key} type="button" onClick={() => pick(p.key)} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[var(--canvas)] flex items-center gap-2 cursor-pointer">
                    <span className="w-4 shrink-0" aria-hidden="true">{value.key === p.key && <Check size={14} style={{ color: "var(--primary)" }} />}</span>
                    <span className="flex-1 min-w-0 flex items-baseline justify-between gap-2"><span style={{ color: "var(--navy)" }} className="text-[13px] font-bold truncate">{p.label}</span><span style={{ color: "var(--ink-muted)" }} className="text-[11px] shrink-0">{p.note}</span></span>
                  </button>
                ))}
              </div>
            ))}
            <div role="group" aria-label="Custom size" className="px-3 pt-3 pb-2" style={{ borderTop: "1px solid var(--muted)", marginTop: 6 }}>
              <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider pb-2 flex items-center gap-1.5">CUSTOM SIZE {custom && <Check size={12} style={{ color: "var(--primary)" }} aria-label="in use" />}</div>
              <CustomSizeFields compact onUse={() => pick(CUSTOM_KEY)} />
            </div>
            <p style={{ color: "var(--ink-faint)" }} className="text-[10.5px] px-3 pb-1.5 leading-snug">This sets the page itself: what is on it is kept and moved to the new proportions. Print and PDF use this paper. In the print dialog choose the same paper size.</p>
          </div>
        </>
      )}
    </div>
  );
}
