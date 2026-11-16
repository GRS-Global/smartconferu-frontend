"use client";

import { useState } from "react";

/* The prototype's dependency-free HSV colour picker: a saturation / brightness square over the current hue, plus a hue bar. Works with the mouse, touch
   (pointer events with capture) and the keyboard (arrow keys on either slider). It keeps its own HSV so the hue survives passing through greys and black,
   where a hex code loses it. */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
interface Hsv { h: number; s: number; v: number }

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: max ? d / max : 0, v: max };
}
function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((k) => Math.round((k + m) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

const RING = "0 0 0 2px #FFFFFF, 0 0 0 3px rgba(15,23,42,0.25), 0 2px 6px rgba(15,23,42,0.3)";
const THUMB = "pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full";

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  // Re-sync when the colour changes from outside (the hex box, quick picks, the eyedropper): derived state, skipped when it is just our own change coming back.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (value.toUpperCase() !== hsvToHex(hsv)) setHsv(hexToHsv(value));
  }
  const emit = (next: Hsv) => { setHsv(next); onChange(hsvToHex(next)); };
  const point = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };
  const onSv = (e: React.PointerEvent<HTMLDivElement>) => { const { x, y } = point(e); emit({ ...hsv, s: x, v: 1 - y }); };
  const onHue = (e: React.PointerEvent<HTMLDivElement>) => { const { x } = point(e); emit({ ...hsv, h: Math.min(359.9, x * 360) }); };
  const drag = (handler: (e: React.PointerEvent<HTMLDivElement>) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); handler(e); },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => { if (e.buttons & 1) handler(e); },
  });
  return (
    <div className="min-w-0">
      <div
        {...drag(onSv)} role="slider" tabIndex={0} aria-label="Saturation and brightness" aria-valuetext={value} aria-valuenow={Math.round(hsv.s * 100)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
          const mv = moves[e.key];
          if (!mv) return;
          e.preventDefault();
          emit({ ...hsv, s: clamp01(hsv.s + mv[0]), v: clamp01(hsv.v + mv[1]) });
        }}
        style={{ background: `hsl(${hsv.h} 100% 50%)`, touchAction: "none" }}
        className="relative h-40 cursor-crosshair rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <div style={{ background: "linear-gradient(to right, #FFFFFF, rgba(255,255,255,0))" }} className="absolute inset-0 rounded-xl" />
        <div style={{ background: "linear-gradient(to top, #000000, rgba(0,0,0,0))" }} className="absolute inset-0 rounded-xl" />
        <span style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value, boxShadow: RING }} className={THUMB} />
      </div>
      <div
        {...drag(onHue)} role="slider" tabIndex={0} aria-label="Hue" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 20 : 4;
          const delta = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "ArrowRight" || e.key === "ArrowUp" ? step : 0;
          if (!delta) return;
          e.preventDefault();
          emit({ ...hsv, h: Math.min(359.9, Math.max(0, hsv.h + delta)) });
        }}
        style={{ background: "linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)", touchAction: "none" }}
        className="relative mt-4 h-3 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span style={{ left: `${(hsv.h / 360) * 100}%`, top: "50%", background: `hsl(${hsv.h} 100% 50%)`, boxShadow: RING }} className={THUMB} />
      </div>
    </div>
  );
}
