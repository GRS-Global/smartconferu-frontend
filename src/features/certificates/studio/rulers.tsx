"use client";

import type { PointerEvent as RPointerEvent } from "react";
import type { Unit } from "./model";

/* Rulers drawn in screen space beside the canvas. `origin` is where the page's 0 sits inside the ruler (it moves with scrolling), `zoom` is screen
   px per page px. The ruler also shades the selection's extent. Pressing on a ruler starts a new guide (handled by the editor). */

export const RULER = 22;
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export function Ruler({ axis, origin, length, zoom, unit, unitPx, extent, onGuideStart }: {
  axis: "x" | "y"; origin: number; length: number; zoom: number; unit: Unit; /** How many `unit`s one base pixel is on this paper. */ unitPx: number; extent: { from: number; to: number } | null;
  onGuideStart: (axis: "x" | "y", e: RPointerEvent) => void;
}) {
  const perUnit = zoom / unitPx; // screen px per ruler unit
  const major = STEPS.find((s) => s * perUnit >= 64) ?? 1000;
  const div = [10, 5, 2].find((d) => (major / d) * perUnit >= 6) ?? 1;
  const minor = major / div;
  const first = Math.floor(-origin / perUnit / minor), last = Math.ceil((length - origin) / perUnit / minor);
  const ticks: Array<{ at: number; big: boolean; label: string }> = [];
  for (let k = first; k <= last && ticks.length < 600; k++) {
    const v = k * minor;
    const big = k % div === 0;
    ticks.push({ at: origin + v * perUnit, big, label: big ? String(Math.round(v * 100) / 100) : "" });
  }
  const horizontal = axis === "x";
  return (
    <svg
      width={horizontal ? length : RULER} height={horizontal ? RULER : length} role="img" aria-label={`${horizontal ? "Horizontal" : "Vertical"} ruler in ${unit}. Drag from it to add a guide.`}
      onPointerDown={(e) => onGuideStart(axis, e)}
      style={{ background: "#fff", display: "block", cursor: horizontal ? "row-resize" : "col-resize", touchAction: "none", userSelect: "none", [horizontal ? "borderBottom" : "borderRight"]: "1px solid var(--border)" }}
    >
      {extent && (horizontal
        ? <rect x={origin + extent.from * zoom} y={0} width={Math.max(1, (extent.to - extent.from) * zoom)} height={RULER} fill="rgba(124,58,237,0.14)" />
        : <rect x={0} y={origin + extent.from * zoom} width={RULER} height={Math.max(1, (extent.to - extent.from) * zoom)} fill="rgba(124,58,237,0.14)" />)}
      {ticks.map((t, i) => horizontal ? (
        <g key={i}>
          <line x1={t.at} x2={t.at} y1={t.big ? 8 : 15} y2={RULER} stroke="#94A3B8" strokeWidth={1} />
          {t.label && <text x={t.at + 3} y={10} fontSize={9} fill="#64748B" fontFamily="system-ui, sans-serif">{t.label}</text>}
        </g>
      ) : (
        <g key={i}>
          <line y1={t.at} y2={t.at} x1={t.big ? 8 : 15} x2={RULER} stroke="#94A3B8" strokeWidth={1} />
          {t.label && <text transform={`translate(10 ${t.at + 3}) rotate(-90)`} textAnchor="end" fontSize={9} fill="#64748B" fontFamily="system-ui, sans-serif" x={0} y={0}>{t.label}</text>}
        </g>
      ))}
    </svg>
  );
}
