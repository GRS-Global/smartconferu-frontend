"use client";

import { Camera, Crop, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { DefaultAvatar } from "../showcase/parts";
import { initialsOf } from "./profile-avatar";
import type { EditorProps } from "./editor-types";

const CROP_VIEW = 260; // the crop frame on screen, px
const CROP_OUT = 256; // the saved avatar, px
const CROP_MAX_ZOOM = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_STYLES = [{ id: "male", label: "Male" }, { id: "female", label: "Female" }, { id: "neutral", label: "Neutral" }];

/** Reads an image file, scaled down to at most `max` px on its long side, as a data URL. */
function readImageDataUrl(file: Blob, max = 1200): Promise<string> {
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

const dataUrlToBlob = (url: string): Promise<Blob> => fetch(url).then((r) => r.blob());

/** Drag, zoom (slider, wheel, +/−), rotate and keyboard-position a photo inside a round frame, then apply (the prototype's PhotoCropper). */
function PhotoCropper({ src, onCancel, onApply }: { src: string; onCancel: () => void; onApply: (dataUrl: string, source: string) => void }) {
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

  const apply = () => {
    if (!img) return;
    try {
      const k = CROP_OUT / CROP_VIEW;
      const c = document.createElement("canvas");
      c.width = CROP_OUT;
      c.height = CROP_OUT;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CROP_OUT, CROP_OUT);
      ctx.drawImage(img, (CROP_VIEW / 2 + pos.x - dw / 2) * k, (CROP_VIEW / 2 + pos.y - dh / 2) * k, dw * k, dh * k);
      onApply(c.toDataURL("image/jpeg", 0.88), source);
    } catch {
      setError("That photo can't be edited here — upload it again.");
    }
  };

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
      {error && <p role="alert" className="text-[11.5px] text-danger">{error}</p>}
      <div className="flex w-full justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-lg px-4 text-sm font-semibold text-ink-muted hover:bg-canvas">Cancel</button>
        <button type="button" onClick={apply} disabled={!img} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><Crop size={14} aria-hidden="true" /> Apply</button>
      </div>
    </div>
  );
}

/** My Profile › photo, as the prototype's popup: pick or drop an image, crop it (drag / zoom / rotate) right above the default-avatar choices, and
 *  press Done. Like the prototype there is no Save button: the cropped photo is uploaded and saved when Apply is pressed, "Remove" takes it off at
 *  once, and picking a default avatar is saved when it is picked. */
export function PhotoEditor({ profile, save, uploadPhoto, onDone, onCancel }: EditorProps & { uploadPhoto: (photo: Blob) => Promise<string> }) {
  const [cropping, setCropping] = useState<{ src: string; name: string } | null>(null);
  const [localSource, setLocalSource] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const changed = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const initials = initialsOf(profile.firstName, profile.lastName, profile.mainEmail);

  const shown = profile.photoUrl;
  const name = profile.photo;
  const run = async (job: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await job(); changed.current = true; return true; } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that. Please try again."); return false; } finally { setBusy(false); }
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setError("Only PNG, JPEG or WebP photos can be uploaded."); return; }
    if (file.size > MAX_BYTES) { setError("That photo is too large — the limit is 5 MB."); return; }
    try { setCropping({ src: await readImageDataUrl(file), name: file.name }); } catch { setError("That image couldn't be read — try another one."); }
  };
  const apply = async (dataUrl: string, source: string) => {
    const ok = await run(async () => { const blob = await dataUrlToBlob(dataUrl); await save({ photoPath: await uploadPhoto(blob) }); });
    if (ok) { setLocalSource(source); setCropping(null); }
  };
  const close = () => { if (!busy) { if (changed.current) onDone("Photo updated"); else onCancel(); } };
  const adjustFrom = localSource || shown;

  return (
    <Modal title="Profile photo" subtitle="A clear headshot helps organizers recognize you." icon={Camera} onClose={close} maxWidth="max-w-[480px]" roomy
      actions={<button type="button" onClick={close} disabled={busy} className="h-10 cursor-pointer rounded-lg bg-primary px-[22px] text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60">Done</button>}>
      {cropping ? (
        <PhotoCropper src={cropping.src} onCancel={() => setCropping(null)} onApply={(d, s) => void apply(d, s)} />
      ) : (
        <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); void pick(e.dataTransfer.files?.[0]); }} className="flex items-center gap-4">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={shown ? "Change profile photo" : "Add a profile photo"} title={shown ? "Change photo" : "Add a photo"} className="group relative h-20 w-20 shrink-0 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <span style={{ border: dragOver ? "2px dashed var(--primary)" : "none" }} className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary-soft transition-colors">
              {shown ? (
                // eslint-disable-next-line @next/next/no-img-element -- the stored or just-cropped photo
                <img src={shown} alt="Profile preview" className="h-full w-full object-cover" />
              ) : <DefaultAvatar variant={profile.avatarStyle || "initials"} size={80} initials={initials} />}
            </span>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/45 opacity-0 transition-opacity group-hover:opacity-100"><Camera size={24} className="text-white" aria-hidden="true" /></span>
            <span aria-hidden="true" style={{ width: 27, height: 27, border: "2px solid #FFFFFF" }} className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-primary shadow-sm"><Camera size={14} className="text-white" /></span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <label htmlFor={inputId} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-all focus-within:ring-2 focus-within:ring-primary hover:border-primary">
                <Camera size={13} className="text-primary" aria-hidden="true" /> {shown ? "Change photo" : "Upload photo"}
                <input ref={input} id={inputId} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {shown && adjustFrom && <button type="button" onClick={() => setCropping({ src: adjustFrom, name })} className="inline-flex cursor-pointer items-center gap-1 rounded text-xs font-semibold text-primary hover:underline"><Crop size={12} aria-hidden="true" /> Adjust photo</button>}
              {shown && <button type="button" disabled={busy} onClick={() => { setLocalSource(""); void run(() => save({ photoPath: null })); }} className="cursor-pointer rounded text-xs font-semibold text-ink-muted transition-colors hover:text-danger">Remove</button>}
            </div>
            {error ? <p role="alert" className="mt-1 text-[11.5px] text-danger">{error}</p> : <p className="mt-1 truncate text-[11px] text-ink-faint">{busy ? "Saving…" : name || "Profile photo (optional) · JPG or PNG, or drag & drop"}</p>}
          </div>
        </div>
      )}
      {cropping && error && <p role="alert" className="mt-2 text-[11.5px] text-danger">{error}</p>}
      <div className="mt-5 border-t border-muted pt-4">
        <div className="text-sm font-semibold text-ink">Default avatar</div>
        <p className="mb-3 text-xs text-ink-muted">{shown ? "Shown if you remove your photo. " : "Shown until you upload a photo. "}Your initials by default — or pick an illustration.</p>
        <div className="flex flex-wrap gap-3">
          {[{ id: "", label: "Initials" }, ...AVATAR_STYLES].map((s) => {
            const active = (profile.avatarStyle || "") === s.id;
            return (
              <button key={s.id || "auto"} type="button" disabled={busy} onClick={() => void run(() => save({ avatarStyle: s.id }))} aria-pressed={active} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 transition-colors ${active ? "border-primary bg-primary-soft" : "border-line bg-white"}`}>
                <DefaultAvatar variant={s.id || "initials"} size={44} initials={initials} />
                <span className={`text-[11px] font-semibold ${active ? "text-primary" : "text-ink-soft"}`}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
