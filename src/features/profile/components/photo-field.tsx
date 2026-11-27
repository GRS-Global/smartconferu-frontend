"use client";

import { Camera } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { dataUrlToBlob, MAX_PHOTO_BYTES, PhotoCropper, readImageDataUrl } from "./photo-cropper";
import { ProfileAvatar } from "./profile-avatar";

export type PhotoValue = { kind: "none" } | { kind: "stored"; url: string; name: string } | { kind: "new"; blob: Blob; previewUrl: string; name: string };

interface PhotoFieldProps {
  value: PhotoValue;
  onChange: (v: PhotoValue) => void;
  initials: string;
}

/** Profile photo: pick (or drop) an image and crop it in the same tool as My Profile; uploaded when the form is saved. */
export function PhotoField({ value, onChange, initials }: PhotoFieldProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [cropping, setCropping] = useState<{ src: string; name: string } | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const shown = value.kind === "stored" ? value.url : value.kind === "new" ? value.previewUrl : "";
  const name = value.kind === "none" ? "" : value.name;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setError("Only PNG, JPEG or WebP photos can be uploaded."); return; }
    if (file.size > MAX_PHOTO_BYTES) { setError("That photo is too large — the limit is 5 MB."); return; }
    try {
      setCropping({ src: await readImageDataUrl(file), name: file.name });
    } catch {
      setError("That image couldn't be read — try another one.");
    }
  };
  const applyCrop = async (dataUrl: string): Promise<boolean> => {
    if (!cropping) return false;
    try {
      const blob = await dataUrlToBlob(dataUrl);
      const previewUrl = URL.createObjectURL(blob);
      urls.current.push(previewUrl);
      onChange({ kind: "new", blob, previewUrl, name: cropping.name });
      setCropping(null);
      return true;
    } catch {
      setError("That image couldn't be read — try another one.");
      return false;
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
          {value.kind !== "none" && <button type="button" onClick={() => { setError(""); onChange({ kind: "none" }); }} className="text-xs font-semibold text-ink-muted hover:text-danger-ink">Remove</button>}
        </div>
        {error ? <p role="alert" className="mt-1 text-[11.5px] text-danger-ink">{error}</p> : <p className="mt-1 truncate text-[11px] text-ink-faint">{name || "Profile photo (optional) · JPG or PNG, or drag & drop"}</p>}
      </div>
      {cropping && (
        <Modal title="Crop your photo" subtitle="Drag and zoom so your face sits inside the circle." icon={Camera} onClose={() => setCropping(null)} maxWidth="max-w-[480px]" roomy>
          <PhotoCropper src={cropping.src} onCancel={() => setCropping(null)} onApply={(dataUrl) => applyCrop(dataUrl)} />
        </Modal>
      )}
    </div>
  );
}
