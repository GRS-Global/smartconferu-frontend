/* eslint-disable @next/next/no-img-element -- the uploaded logo is a data URL */
"use client";

import { useState, useRef, type ChangeEvent, type ReactNode } from "react";
import { ChevronLeft, Send, Plus, Trash2, Upload, RotateCcw, Move, QrCode, Image as ImageIcon } from "lucide-react";
import type { Conference } from "@/types/conference";
import { CertCard, Pill, Notice } from "../components";
import { CertificateArtwork } from "../certificate-artwork";
import { inputStyle, inputClass } from "../form-styles";
import {
  getCertificateType, PALETTE_PRESETS, CERTIFICATE_TEMPLATES, MERGE_FIELDS, ELEMENT_LABELS, defaultElements, reseatSignatures, sampleRecipient, BASE_SIZES,
  type CertificateDesign, type Design, type Orientation, type Signatory,
} from "../data";
import type { CertificateActions } from "../use-certificates";
import type { Go } from "../routes";

const MAX_LOGO_BYTES = 700 * 1024;

/* ---------------------------------------------------------------------------
   Certificates > Design > the designer.

   Everything on the sheet is draggable. Clicking a block on the certificate
   selects it and scrolls its settings into the left rail; the rail's fields
   also select the block, so the same job can be done with a mouse or a keyboard.
   --------------------------------------------------------------------------- */

function Field({ id, label, value, onChange, onFocus, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; onFocus: () => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} style={inputStyle} className={inputClass} />
      {hint && <p style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider">{title}</div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function DesignerBody({ conference, cert, actions, go }: { conference: Conference; cert: CertificateDesign; actions: CertificateActions; go: Go }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logoProblem, setLogoProblem] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const type = getCertificateType(cert.typeKey);
  const design = cert.design;

  const patchDesign = (patch: Partial<Design>) => {
    actions.updateDesign(cert.id, { design: (d) => ({ ...d, ...patch }) });
  };

  const moveElement = (id: string, x: number, y: number) => {
    // `moved` marks a block the chair placed deliberately, so re-seating the signature row later
    // never yanks it back to the default position.
    patchDesign({ elements: { ...design.elements, [id]: { ...design.elements[id], x, y, moved: true } } });
  };
  const sizeElement = (id: string, size: number) => {
    patchDesign({ elements: { ...design.elements, [id]: { ...design.elements[id], size } } });
  };
  const widenElement = (id: string, w: number) => {
    patchDesign({ elements: { ...design.elements, [id]: { ...design.elements[id], w } } });
  };

  const setOrientation = (orientation: Orientation) => {
    // A portrait page is not a rotated landscape one, so positions re-seed from that side's
    // defaults rather than being squeezed into a different aspect ratio.
    patchDesign({ orientation, elements: defaultElements(orientation, design.signatories.length) });
  };

  const resetLayout = () => patchDesign({ elements: defaultElements(design.orientation, design.signatories.length) });

  const setSignatories = (list: Signatory[]) => {
    patchDesign({
      signatories: list,
      elements: reseatSignatures(design.elements, design.orientation, list.length),
    });
  };
  const updateSignatory = (i: number, patch: Partial<Signatory>) => setSignatories(design.signatories.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const onLogoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // The logo is saved inside the design (as a data URL), so it has to stay small.
    if (file.size > MAX_LOGO_BYTES) { setLogoProblem("That logo is too big — please use one under 700 KB."); return; }
    setLogoProblem("");
    const reader = new FileReader();
    reader.onload = () => patchDesign({ logoSrc: String(reader.result), showLogo: true });
    reader.readAsDataURL(file);
  };

  const insertToken = (token: string) => {
    const target: "leadIn" | "bodyLine" = selectedId === "leadIn" ? "leadIn" : "bodyLine";
    patchDesign({ [target]: `${design[target]} {{${token}}}`.replace(/\s+/g, " ").trim() });
  };

  const sel = selectedId ? design.elements[selectedId] : null;
  const selKey = selectedId ?? "";
  const { w: baseW } = BASE_SIZES[design.orientation === "portrait" ? "portrait" : "landscape"];

  return (
    <div>
      <div className="px-4 sm:px-8 pt-8 pb-0">
        <button onClick={() => go("chair-certificates")} style={{ color: "var(--ink-muted)" }} className="flex items-center gap-1.5 text-[13px] font-semibold hover:text-[var(--navy)] transition-colors mb-3 cursor-pointer">
          <ChevronLeft size={15} /> All designs
        </button>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 style={{ color: "var(--navy)", letterSpacing: "-0.02em" }} className="text-[28px] leading-tight font-extrabold truncate">{cert.name}</h1>
            <p style={{ color: "var(--ink-muted)" }} className="text-sm mt-1">{type.label} · changes save as you make them</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={resetLayout}
              style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--canvas)] transition-colors cursor-pointer"
            >
              <RotateCcw size={15} /> Reset layout
            </button>
            <button
              onClick={() => go("chair-certificates-distribute", { certId: cert.id })}
              style={{ background: "var(--gradient-primary)" }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Send size={15} /> Send this certificate
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 items-start">

        {/* ---- controls ---- */}
        <CertCard className="space-y-5">
          <div>
            <label htmlFor="cert-rename" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Certificate name</label>
            <input
              id="cert-rename" value={cert.name}
              onChange={(e) => { actions.updateDesign(cert.id, { name: e.target.value }); }}
              style={inputStyle} className={inputClass}
            />
          </div>

          <Section title="PAGE">
            <div className="flex gap-1.5">
              {[{ key: "landscape", label: "Landscape" }, { key: "portrait", label: "Portrait" }].map((o) => (
                <button
                  key={o.key}
                  onClick={() => setOrientation(o.key as Orientation)}
                  style={design.orientation === o.key
                    ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" }
                    : { border: "1px solid var(--border)", color: "var(--ink-muted)" }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CERTIFICATE_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => patchDesign({ templateKey: t.key, layout: t.layout, palette: { ...t.palette } })}
                  style={design.templateKey === t.key
                    ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" }
                    : { border: "1px solid var(--border)", color: "var(--ink-muted)" }}
                  className="py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {PALETTE_PRESETS.map((p) => {
                const active = p.palette.ink === design.palette.ink && p.palette.accent === design.palette.accent;
                return (
                  <button
                    key={p.key}
                    onClick={() => patchDesign({ palette: { ...p.palette } })}
                    aria-label={`${p.label} colours`} title={p.label}
                    style={{
                      border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: `linear-gradient(90deg, ${p.palette.ink} 0 33%, ${p.palette.accent} 33% 66%, ${p.palette.rule} 66%)`,
                    }}
                    className="w-11 h-7 rounded-lg cursor-pointer"
                  />
                );
              })}
            </div>
          </Section>

          <Section title="YOUR LOGO">
            <div className="flex items-center gap-3">
              <div style={{ border: "1px solid var(--border)", background: "var(--canvas)" }} className="w-16 h-12 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                {design.logoSrc
                  ? <img src={design.logoSrc} alt="Your uploaded logo" className="max-w-full max-h-full object-contain" />
                  : <ImageIcon size={16} style={{ color: "var(--ink-faint)" }} />}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold hover:bg-[var(--canvas)] transition-colors cursor-pointer"
                >
                  <Upload size={13} /> {design.logoSrc ? "Replace" : "Upload a logo"}
                </button>
                {design.logoSrc && (
                  <button onClick={() => patchDesign({ logoSrc: null })} style={{ color: "var(--danger)" }} className="w-full text-[11px] font-semibold hover:underline cursor-pointer">
                    Remove — use the conference logo
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogoFile} className="hidden" />
            </div>
            {logoProblem && <p role="alert" style={{ color: "var(--danger)" }} className="text-[11px] font-semibold">{logoProblem}</p>}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={design.showLogo} onChange={(e) => patchDesign({ showLogo: e.target.checked })} style={{ accentColor: "var(--primary)" }} className="w-4 h-4 cursor-pointer" />
              <span style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">Show the logo</span>
            </label>
            {design.showLogo && design.elements.logo && (
              <div>
                <label htmlFor="logo-size" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Logo size</label>
                <input
                  id="logo-size" type="range" min={50} max={260} step={5}
                  value={design.elements.logo.w}
                  onChange={(e) => widenElement("logo", Number(e.target.value))}
                  style={{ accentColor: "var(--primary)" }} className="w-full"
                />
              </div>
            )}
          </Section>

          <Section title="WORDING">
            <Field id="w-headline" label="Headline" value={design.headline} onChange={(v) => patchDesign({ headline: v })} onFocus={() => setSelectedId("headline")} />
            <Field id="w-typeline" label="Type line" value={design.typeLine} onChange={(v) => patchDesign({ typeLine: v })} onFocus={() => setSelectedId("typeLine")} />
            <Field id="w-leadin" label="Lead-in" value={design.leadIn} onChange={(v) => patchDesign({ leadIn: v })} onFocus={() => setSelectedId("leadIn")} />
            <Field
              id="w-body" label="Body line" value={design.bodyLine} onChange={(v) => patchDesign({ bodyLine: v })} onFocus={() => setSelectedId("bodyLine")}
              hint="The conference name and dates are added underneath automatically."
            />
            <div>
              <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-1.5">
                ADD A FIELD TO {selectedId === "leadIn" ? "THE LEAD-IN" : "THE BODY LINE"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MERGE_FIELDS.flatMap((g) => g.fields).map((f) => (
                  <button
                    key={f.token}
                    onClick={() => insertToken(f.token)}
                    style={{ border: "1px solid var(--border)", background: "var(--canvas)", color: "var(--ink-soft)" }}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-2 leading-relaxed">Each one fills in per person when the certificate is issued.</p>
            </div>
          </Section>

          <Section
            title="SIGNATURES"
            action={design.signatories.length < 3 && (
              <button
                onClick={() => setSignatories([...design.signatories, { name: "", title: "" }])}
                style={{ color: "var(--primary)" }} className="flex items-center gap-1 text-[11px] font-bold hover:underline cursor-pointer"
              >
                <Plus size={12} /> Add
              </button>
            )}
          >
            {design.signatories.map((s, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", background: "var(--canvas)" }} className="rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span style={{ color: "var(--ink-faint)" }} className="text-[11px] font-bold">Signature {i + 1}</span>
                  {design.signatories.length > 1 && (
                    <button onClick={() => setSignatories(design.signatories.filter((_, idx) => idx !== i))} aria-label={`Remove signature ${i + 1}`} style={{ color: "var(--danger)" }} className="hover:opacity-70 cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <input aria-label={`Signatory ${i + 1} name`} value={s.name} onChange={(e) => updateSignatory(i, { name: e.target.value })} onFocus={() => setSelectedId(`sig${i}`)} placeholder="Name" style={inputStyle} className={inputClass} />
                <input aria-label={`Signatory ${i + 1} title`} value={s.title} onChange={(e) => updateSignatory(i, { title: e.target.value })} onFocus={() => setSelectedId(`sig${i}`)} placeholder="Title" style={inputStyle} className={inputClass} />
              </div>
            ))}
          </Section>

          <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="rounded-xl p-3.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={design.showQr} onChange={(e) => patchDesign({ showQr: e.target.checked })} style={{ accentColor: "var(--primary)" }} className="w-4 h-4 mt-0.5 shrink-0 cursor-pointer" />
              <span>
                <span style={{ color: "var(--primary)" }} className="text-xs font-bold flex items-center gap-1.5"><QrCode size={13} /> Verifiable copy</span>
                <span style={{ color: "var(--primary)" }} className="block text-[11px] mt-1 leading-relaxed">Each PDF gets its own ID and a QR linking to a public page that confirms it against your records.</span>
              </span>
            </label>
          </div>
        </CertCard>

        {/* ---- canvas ---- */}
        <div className="space-y-4">
          <div style={{ background: "#E9EDF3", border: "1px solid var(--border)" }} className="rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="self-stretch flex items-center gap-2 flex-wrap">
              <Move size={14} style={{ color: "var(--ink-muted)" }} />
              <span style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold">Drag anything on the certificate to move it.</span>
              {sel && <Pill tone="primary">{ELEMENT_LABELS[selKey] || selKey} selected</Pill>}
              <div className="flex-1" />
              <span style={{ color: "var(--ink-muted)" }} className="text-[11px]">Previewing with sample data</span>
            </div>

            <CertificateArtwork
              design={design}
              recipient={sampleRecipient(conference, cert.typeKey)}
              conference={conference}
              width={design.orientation === "portrait" ? 440 : 660}
              editable
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={moveElement}
            />
          </div>

          {sel ? (
            <CertCard title={ELEMENT_LABELS[selKey] || "Selected block"} subtitle="Drag it on the certificate, or fine-tune it here.">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="el-x" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Across</label>
                  <input id="el-x" type="number" value={Math.round(sel.x)} onChange={(e) => moveElement(selKey, Number(e.target.value), sel.y)} style={inputStyle} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="el-y" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Down</label>
                  <input id="el-y" type="number" value={Math.round(sel.y)} onChange={(e) => moveElement(selKey, sel.x, Number(e.target.value))} style={inputStyle} className={inputClass} />
                </div>
                {sel.size !== undefined && (
                  <div>
                    <label htmlFor="el-size" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">{selKey === "rule" ? "Thickness" : "Text size"}</label>
                    <input id="el-size" type="number" min={selKey === "rule" ? 1 : 8} max={selKey === "rule" ? 20 : 120} value={sel.size} onChange={(e) => sizeElement(selKey, Number(e.target.value))} style={inputStyle} className={inputClass} />
                  </div>
                )}
                <div>
                  <label htmlFor="el-w" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Block width</label>
                  <input id="el-w" type="number" min={40} max={baseW} value={Math.round(sel.w)} onChange={(e) => widenElement(selKey, Number(e.target.value))} style={inputStyle} className={inputClass} />
                </div>
              </div>
              <button
                onClick={() => { const d = defaultElements(design.orientation, design.signatories.length)[selKey]; if (d) patchDesign({ elements: { ...design.elements, [selKey]: d } }); }}
                style={{ color: "var(--primary)" }} className="text-xs font-bold mt-3 hover:underline cursor-pointer"
              >
                Put this block back where it started
              </button>
            </CertCard>
          ) : (
            <Notice tone="muted" icon={Move}>
              Click any part of the certificate — the headline, the name, the QR block, your logo — to select it, then drag it or set its exact position here.
            </Notice>
          )}
        </div>
      </div>
    </div>
  );
}
