"use client";

import { Camera } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ProfileAvatar } from "./profile-avatar";

export type PhotoValue = { kind: "none" } | { kind: "stored"; url: string; name: string } | { kind: "new"; blob: Blob; previewUrl: string; name: string };

const MAX_BYTES = 5 * 1024 * 1024;
const OUTPUT = 512;

/** Centre-crops the picked image to a square and re-encodes it as a small JPEG (the prototype stores a cropped photo). */
async function cropToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, OUTPUT, OUTPUT);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9));
}

interface PhotoFieldProps {
  value: PhotoValue;
  onChange: (v: PhotoValue) => void;
  initials: string;
}

/** Profile photo: pick (or drop) an image, it is cropped to a square; uploaded when the form is saved. */
export function PhotoField({ value, onChange, initials }: PhotoFieldProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const shown = value.kind === "stored" ? value.url : value.kind === "new" ? value.previewUrl : "";
  const name = value.kind === "none" ? "" : value.name;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setError("Only PNG, JPEG or WebP photos can be uploaded."); return; }
    if (file.size > MAX_BYTES) { setError("That photo is too large — the limit is 5 MB."); return; }
    try {
      const blob = await cropToSquare(file);
      const previewUrl = URL.createObjectURL(blob);
      urls.current.push(previewUrl);
      onChange({ kind: "new", blob, previewUrl, name: file.name });
    } catch {
      setError("That image couldn't be read — try another one.");
    }
  };

  return (
    <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); void pick(e.dataTransfer.files?.[0]); }} className="flex items-center gap-4">
      <button
        type="button" onClick={() => input.current?.click()} aria-label={shown ? "Change profile photo" : "Add a profile photo"}
        className={`group relative flex shrink-0 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${dragOver ? "outline-2 outline-dashed outline-primary" : ""}`}
      >
        <ProfileAvatar photoUrl={shown} initials={initials} size={64} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Camera size={18} className="text-white" aria-hidden="true" /></span>
        {/* The prototype's camera badge: says the avatar itself picks a photo (size 34 % of the avatar, 2 px white ring). */}
        <span aria-hidden="true" style={{ width: 22, height: 22 }} className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-white bg-primary shadow-sm"><Camera size={11} className="text-white" /></span>
      </button>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {/* As in the prototype: the label is the focusable button (Enter / Space open the file dialog); the file input itself is hidden. */}
          <label
            htmlFor={inputId} tabIndex={0} role="button" aria-label="Upload photo"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
            className="smart-field inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <Camera size={13} className="text-primary" aria-hidden="true" /> {shown ? "Change photo" : "Upload photo"}
            <input ref={input} id={inputId} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" tabIndex={-1} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {value.kind !== "none" && <button type="button" onClick={() => { setError(""); onChange({ kind: "none" }); }} className="text-xs font-semibold text-ink-muted hover:text-danger">Remove</button>}
        </div>
        {error ? <p role="alert" className="mt-1 text-[11.5px] text-danger">{error}</p> : <p className="mt-1 truncate text-[11px] text-ink-faint">{name || "Profile photo (optional) · JPG or PNG, or drag & drop"}</p>}
      </div>
    </div>
  );
}
