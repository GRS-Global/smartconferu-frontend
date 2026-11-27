"use client";

import { Crop, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* The profile-photo crop tool (drag, zoom, rotate inside a round frame), shared by every place a profile photo is picked:
   My Profile, registration and Complete Profile. */

const CROP_VIEW = 260; // the crop frame on screen, px
const CROP_OUT = 256; // the saved avatar, px
const CROP_MAX_ZOOM = 4;
/** The largest photo accepted (the API's limit too). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Reads an image file, scaled down to at most `max` px on its long side, as a data URL. */
export function readImageDataUrl(file: Blob, max = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

export const dataUrlToBlob = (url: string): Promise<Blob> => fetch(url).then((r) => r.blob());

/** Drag, zoom (slider, wheel, +/−), rotate and keyboard-position a photo inside a round frame, then apply (the prototype's PhotoCropper). */
export function PhotoCropper({ src, onCancel, onApply, applyRef }: {
  src: string;
  onCancel: () => void;
  onApply: (dataUrl: string, source: string) => Promise<boolean>;
  /** Lets the dialog's Done button apply the crop too, so a picked photo is never dropped silently. */
  applyRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}) {
  const [source, setSource] = useState(src);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image centre, relative to the frame centre
  const [error, setError] = useState("");
  const drag = useRef<{ x: number; y: number; start: { x: number; y: number } } | null>(null);

  useEffect(() => {
    let live = true;
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => { if (live) { setImg(el); setZoom(1); setPos({ x: 0, y: 0 }); } };
    el.onerror = () => { if (live) setError("That photo couldn't be opened for editing."); };
    el.src = source;
    return () => { live = false; };
  }, [source]);

  const base = img ? CROP_VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const dw = img ? img.naturalWidth * base * zoom : CROP_VIEW;
  const dh = img ? img.naturalHeight * base * zoom : CROP_VIEW;
  const clamp = (p: { x: number; y: number }, w = dw, h = dh) => ({
    x: Math.max(-(w - CROP_VIEW) / 2, Math.min((w - CROP_VIEW) / 2, p.x)),
    y: Math.max(-(h - CROP_VIEW) / 2, Math.min((h - CROP_VIEW) / 2, p.y)),
  });
  const setZoomTo = (z: number) => {
    const next = Math.min(CROP_MAX_ZOOM, Math.max(1, Math.round(z * 100) / 100));
    if (!img) return;
    const r = next / zoom;
    setZoom(next);
    setPos((p) => clamp({ x: p.x * r, y: p.y * r }, img.naturalWidth * base * next, img.naturalHeight * base * next));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (m) { e.preventDefault(); setPos((p) => clamp({ x: p.x + m[0], y: p.y + m[1] })); }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoomTo(zoom + 0.1); }
    if (e.key === "-") { e.preventDefault(); setZoomTo(zoom - 0.1); }
  };

  // Rotating bakes the turn into the source, so dragging and zooming stay simple.
  const rotate = () => {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = img.naturalHeight;
    c.height = img.naturalWidth;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    setSource(c.toDataURL("image/jpeg", 0.9));
  };

  const apply = async (): Promise<boolean> => {
    if (!img) return false;
    let dataUrl: string;
    try {
      const k = CROP_OUT / CROP_VIEW;
      const c = document.createElement("canvas");
      c.width = CROP_OUT;
      c.height = CROP_OUT;
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CROP_OUT, CROP_OUT);
      ctx.drawImage(img, (CROP_VIEW / 2 + pos.x - dw / 2) * k, (CROP_VIEW / 2 + pos.y - dh / 2) * k, dw * k, dh * k);
      dataUrl = c.toDataURL("image/jpeg", 0.88);
    } catch {
      setError("That photo can't be edited here — upload it again.");
      return false;
    }
    return onApply(dataUrl, source);
  };
  useEffect(() => {
    if (!applyRef) return undefined;
    applyRef.current = img ? apply : null;
    return () => { applyRef.current = null; };
  });

  const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors enabled:hover:bg-primary-soft enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-col items-center gap-3.5">
      <div
        role="application" aria-label="Photo crop area. Drag or use the arrow keys to move the photo; plus and minus to zoom." tabIndex={0}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, start: pos }; }}
        onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y })); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onWheel={(e) => setZoomTo(zoom - Math.sign(e.deltaY) * 0.1)} onKeyDown={onKeyDown}
        style={{ width: CROP_VIEW, height: CROP_VIEW, touchAction: "none" }}
        className="relative max-w-full cursor-grab select-none overflow-hidden rounded-2xl bg-canvas outline-none focus-visible:ring-[3px] focus-visible:ring-primary-soft active:cursor-grabbing"
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element -- the in-memory source being cropped
          <img src={source} alt="" draggable={false} style={{ position: "absolute", width: dw, height: dh, left: CROP_VIEW / 2 + pos.x - dw / 2, top: CROP_VIEW / 2 + pos.y - dh / 2, maxWidth: "none" }} />
        )}
        <div aria-hidden="true" style={{ boxShadow: "0 0 0 999px rgba(15,23,42,0.55)" }} className="pointer-events-none absolute inset-2 rounded-full border-2 border-white/90" />
      </div>
      <div className="flex w-full max-w-[280px] items-center gap-2 text-ink-muted">
        <button type="button" onClick={() => setZoomTo(zoom - 0.2)} disabled={zoom <= 1} aria-label="Zoom out" title="Zoom out" className={iconBtn}><ZoomOut size={16} aria-hidden="true" /></button>
        <input type="range" min={1} max={CROP_MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZoomTo(Number(e.target.value))} aria-label="Zoom" className="flex-1 accent-[var(--primary)]" />
        <button type="button" onClick={() => setZoomTo(zoom + 0.2)} disabled={zoom >= CROP_MAX_ZOOM} aria-label="Zoom in" title="Zoom in" className={iconBtn}><ZoomIn size={16} aria-hidden="true" /></button>
        <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
        <button type="button" onClick={rotate} disabled={!img} aria-label="Rotate 90 degrees" title="Rotate" className={iconBtn}><RotateCw size={16} aria-hidden="true" /></button>
      </div>
      <p className="-mt-1 text-[11px] text-ink-muted">Drag to position · scroll or use the slider to zoom</p>
      {error && <p role="alert" className="text-[11.5px] text-danger-ink">{error}</p>}
      <div className="flex w-full justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas">Cancel</button>
        <button type="button" onClick={() => void apply()} disabled={!img} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><Crop size={14} aria-hidden="true" /> Apply</button>
      </div>
    </div>
  );
}
