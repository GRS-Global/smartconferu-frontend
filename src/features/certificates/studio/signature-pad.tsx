"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Eraser, Undo2 } from "lucide-react";
import { CertModal } from "../components";

/* Draw a signature with the mouse, a trackpad, a finger or a pen. The result is a PNG with a transparent background, cropped to the ink, and goes
   through the same path as an uploaded picture (the signature library), so everything else about signatures works the same. It is an image of a
   handwritten signature, not a cryptographic one. */

const W = 900, H = 300;
const COLOURS = [{ key: "black", css: "#111827", label: "Black" }, { key: "blue", css: "#1D4ED8", label: "Blue" }] as const;
const WIDTHS = [{ key: "thin", w: 3.5, label: "Thin" }, { key: "medium", w: 6, label: "Medium" }, { key: "thick", w: 9.5, label: "Thick" }] as const;

interface Point { x: number; y: number }
interface Stroke { points: Point[]; width: number; colour: string }

/** Smooth lines: each segment is a curve through the midpoints of the points, so a shaky hand does not show as corners. */
function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    ctx.strokeStyle = s.colour; ctx.fillStyle = s.colour; ctx.lineWidth = s.width;
    const p = s.points;
    if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0].x, p[0].y, s.width / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    ctx.stroke();
  }
}

/** The ink as a PNG file, or null when there is (nearly) none. Transparent, cropped to the drawing with a small margin. */
async function exportPng(strokes: Stroke[]): Promise<File | null> {
  const pts = strokes.flatMap((s) => s.points.map((p) => ({ ...p, r: s.width / 2 })));
  if (pts.length === 0) return null;
  const minX = Math.min(...pts.map((p) => p.x - p.r)), maxX = Math.max(...pts.map((p) => p.x + p.r));
  const minY = Math.min(...pts.map((p) => p.y - p.r)), maxY = Math.max(...pts.map((p) => p.y + p.r));
  if (maxX - minX < 24 && maxY - minY < 24) return null; // a dot or a stray touch is not a signature
  const pad = 14;
  const w = Math.ceil(maxX - minX + pad * 2), h = Math.ceil(maxY - minY + pad * 2);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.translate(pad - minX, pad - minY);
  paint(ctx, strokes);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
  return blob ? new File([blob], "signature-drawn.png", { type: "image/png" }) : null;
}

export function SignaturePadDialog({ onClose, onUse }: { onClose: () => void; onUse: (file: File) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [count, setCount] = useState(0);
  const [colour, setColour] = useState<(typeof COLOURS)[number]["key"]>("black");
  const [width, setWidth] = useState<(typeof WIDTHS)[number]["key"]>("medium");
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [problem, setProblem] = useState("");

  const redraw = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !canvas.current) return;
    ctx.clearRect(0, 0, W, H);
    paint(ctx, current.current ? [...strokes.current, current.current] : strokes.current);
  }, []);
  useEffect(() => { redraw(); }, [redraw]);

  const at = (e: RPointerEvent<HTMLCanvasElement>): Point => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    current.current = { points: [at(e)], width: WIDTHS.find((x) => x.key === width)!.w, colour: COLOURS.find((x) => x.key === colour)!.css };
    setProblem("");
    setDrawing(true);
    redraw();
  };
  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = current.current;
    if (!s) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const r = canvas.current!.getBoundingClientRect();
    const list = events.length ? events : [e.nativeEvent];
    for (const ev of list) s.points.push({ x: ((ev.clientX - r.left) * W) / r.width, y: ((ev.clientY - r.top) * H) / r.height });
    redraw();
  };
  const up = () => {
    const s = current.current;
    current.current = null;
    if (s) { strokes.current.push(s); setCount(strokes.current.length); }
    setDrawing(false);
    redraw();
  };

  const undo = () => { strokes.current.pop(); setCount(strokes.current.length); setProblem(""); redraw(); };
  const clear = () => { strokes.current = []; setCount(0); setProblem(""); redraw(); };
  const use = async () => {
    setBusy(true);
    try {
      const file = await exportPng(strokes.current);
      if (!file) { setProblem("Draw your signature first (a dot is not enough)."); return; }
      onUse(file);
    } finally { setBusy(false); }
  };

  const chip = (on: boolean) => (on ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" } : { border: "1px solid var(--border)", background: "#fff", color: "var(--ink-muted)" });
  return (
    <CertModal
      title="Draw the signature"
      subtitle="Use the mouse, a trackpad, your finger or a pen. The background stays transparent."
      onClose={onClose} maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={undo} disabled={count === 0} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"><Undo2 size={14} /> Undo</button>
          <button type="button" onClick={clear} disabled={count === 0} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"><Eraser size={14} /> Clear</button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] cursor-pointer">Cancel</button>
          <button type="button" onClick={() => void use()} disabled={count === 0 || busy} style={{ background: "var(--gradient-primary)" }} className="px-5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed">Use this signature</button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Pen colour">
          {COLOURS.map((c) => (
            <button key={c.key} type="button" aria-pressed={colour === c.key} onClick={() => setColour(c.key)} style={chip(colour === c.key)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer">
              <span style={{ background: c.css }} className="w-3 h-3 rounded-full" aria-hidden="true" /> {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Pen thickness">
          {WIDTHS.map((x) => <button key={x.key} type="button" aria-pressed={width === x.key} onClick={() => setWidth(x.key)} style={chip(width === x.key)} className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer">{x.label}</button>)}
        </div>
      </div>
      <div style={{ border: "1.5px solid var(--border)", background: "#fff", aspectRatio: `${W} / ${H}` }} className="relative rounded-xl overflow-hidden">
        {count === 0 && !drawing && <span aria-hidden="true" style={{ color: "var(--ink-faint)" }} className="absolute inset-0 flex items-center justify-center text-sm font-semibold pointer-events-none select-none">Sign here</span>}
        <span aria-hidden="true" style={{ borderTop: "1.5px dashed var(--border)", top: "74%" }} className="absolute left-[6%] right-[6%] pointer-events-none" />
        <canvas
          ref={canvas} width={W} height={H} role="img" aria-label="Signature drawing area. Draw with a mouse, finger or pen; to use a picture of your signature instead, close this and upload it."
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ touchAction: "none", cursor: "crosshair" }} className="absolute inset-0 w-full h-full"
        />
      </div>
      {problem && <p role="alert" style={{ color: "var(--danger-ink)" }} className="text-sm font-semibold mt-3">{problem}</p>}
      <p style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-3 leading-relaxed">A drawn signature is a picture of handwriting, not a digital signature. A trackpad, touch screen or pen gives the smoothest result. Prefer a scan? Close this and use Upload.</p>
    </CertModal>
  );
}
