// One-off edit helper: the My Profile edit windows as the prototype's (Modal with the tinted header and the pinned footer band), and the Mobile number window.
import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const S = "../src/";

// ---- Modal: a footer slot a form can put its buttons in
edit(S + "components/ui/modal.tsx", [
  [`import { useId, useSyncExternalStore, type ReactNode } from "react";`, `import { createContext, useContext, useId, useState, useSyncExternalStore, type ReactNode } from "react";`],
  [`interface ModalProps {`, `const FootContext = createContext<HTMLElement | null>(null);
/** The footer band of the window around this component, when it asked for one (\`footerSlot\`): a form draws its Save / Cancel buttons into it (portal). */
export const useModalFoot = () => useContext(FootContext);

interface ModalProps {`],
  [`  roomy?: boolean;\n}`, `  roomy?: boolean;\n  /** Keep an empty footer band for the form inside to draw its buttons into (see \`useModalFoot\`). */\n  footerSlot?: boolean;\n}`],
  [`maxWidth = "max-w-md", roomy = false }: ModalProps)`, `maxWidth = "max-w-md", roomy = false, footerSlot = false }: ModalProps)`],
  [`  const inBrowser = useSyncExternalStore(() => () => undefined, () => true, () => false);`, `  const inBrowser = useSyncExternalStore(() => () => undefined, () => true, () => false);\n  const [foot, setFoot] = useState<HTMLElement | null>(null);`],
  [`<div className={cn("min-h-0 overflow-y-auto overscroll-contain", roomy ? "p-7" : "p-6", Boolean(actions) && "flex-1")}>{children}</div>`, `<FootContext.Provider value={foot}><div className={cn("min-h-0 overflow-y-auto overscroll-contain", roomy ? "p-7" : "p-6", (Boolean(actions) || footerSlot) && "flex-1")}>{children}</div></FootContext.Provider>`],
  [`{actions && <div className={cn("ui-modal-foot shrink-0 py-4", roomy ? "px-7" : "px-6")}><div className="flex flex-wrap items-center justify-end gap-2">{actions}</div></div>}`, `{(actions || footerSlot) && <div className={cn("ui-modal-foot shrink-0 py-4", roomy ? "px-7" : "px-6")}><div ref={footerSlot ? setFoot : undefined} className="flex flex-wrap items-center justify-end gap-2">{actions}</div></div>}`],
]);

// ---- SectionCard: inside a window the buttons go to its footer band
edit(S + "features/profile/components/section-card.tsx", [
  [`import type { ReactNode } from "react";`, `import type { ReactNode } from "react";\nimport { createPortal } from "react-dom";\nimport { useModalFoot } from "@/components/ui/modal";`],
  [`function SaveStatus({ save, canSave, onCancel, label = "Save" }: { save: SectionSave; canSave: boolean; onCancel?: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {save.saved && <span role="status" className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} strokeWidth={3} aria-hidden="true" /> Saved</span>}
      {onCancel && <button type="button" onClick={onCancel} className="h-8 rounded-lg px-3.5 text-xs font-semibold text-ink-soft hover:bg-muted hover:text-navy">Cancel</button>}`, `/** \`formId\`: the buttons are drawn in a window's footer band, outside the form, and point at it; they get the prototype's larger look. */
function SaveStatus({ save, canSave, onCancel, label = "Save", formId }: { save: SectionSave; canSave: boolean; onCancel?: () => void; label?: string; formId?: string }) {
  if (formId) {
    return (
      <>
        {save.saved && <span role="status" className="mr-auto inline-flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} strokeWidth={3} aria-hidden="true" /> Saved</span>}
        {onCancel && <button type="button" onClick={onCancel} className="h-10 cursor-pointer rounded-lg px-4 text-sm font-semibold text-ink-soft transition-colors hover:bg-muted hover:text-navy">Cancel</button>}
        <button type="submit" form={formId} disabled={!canSave || save.busy} className="h-10 cursor-pointer rounded-lg bg-primary px-[22px] text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-ink-faint disabled:hover:bg-ink-faint">{save.busy ? "Saving…" : label}</button>
      </>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      {save.saved && <span role="status" className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} strokeWidth={3} aria-hidden="true" /> Saved</span>}
      {onCancel && <button type="button" onClick={onCancel} className="h-8 rounded-lg px-3.5 text-xs font-semibold text-ink-soft hover:bg-muted hover:text-navy">Cancel</button>}`],
  [`  const submit = (e: React.FormEvent) => { e.preventDefault(); if (canSave && !save.busy) onSave(); };
  if (inDialog) {
    return (
      <form noValidate onSubmit={submit} aria-labelledby={\`\${id}-title\`}>`, `  const submit = (e: React.FormEvent) => { e.preventDefault(); if (canSave && !save.busy) onSave(); };
  const foot = useModalFoot();
  if (inDialog) {
    return (
      <>
      <form id={\`\${id}-form\`} noValidate onSubmit={submit} aria-labelledby={\`\${id}-title\`}>`],
  [`        {!noSave && <div className="mt-5 flex justify-end border-t border-muted pt-4"><SaveStatus save={save} canSave={canSave} onCancel={onCancel} label={saveLabel} /></div>}
      </form>
    );`, `        {!noSave && !foot && <div className="mt-5 flex justify-end border-t border-muted pt-4"><SaveStatus save={save} canSave={canSave} onCancel={onCancel} label={saveLabel} /></div>}
      </form>
      {!noSave && foot && createPortal(<SaveStatus save={save} canSave={canSave} onCancel={onCancel} label={saveLabel} formId={\`\${id}-form\`} />, foot)}
      </>
    );`],
]);

// ---- the profile page: Modal instead of Dialog
{
  const f = S + "features/profile/components/profile-page.tsx"; let s = fs.readFileSync(f, "utf8");
  const a = s.indexOf(`      <Dialog open={modal !== null && modal !== "photo"}`);
  const b = s.indexOf(`      </Dialog>`, a) + `      </Dialog>`.length;
  if (a < 0 || b < 20) throw new Error("dialog block");
  let block = s.slice(a, b);
  block = block.replace(/<Dialog open=\{modal !== null && modal !== "photo"\}[^>]*>/, `{modal !== null && modal !== "photo" && (\n        <Modal title={TITLES[modal]} subtitle={SUBTITLES[modal]} icon={ICONS[modal]} onClose={close} maxWidth={WIDTHS[modal]} roomy footerSlot={modal !== "links"}>`).replace(`      </Dialog>`, `        </Modal>\n      )}`);
  s = s.slice(0, a) + block + s.slice(b);
  s = s.replace(`const SIZES: Record<Modal, "md" | "lg" | "xl"> = {\n  intro: "lg", photo: "md", about: "lg", affiliation: "xl", experience: "xl", education: "xl", memberships: "xl", links: "xl", emails: "lg", phone: "md", address: "lg",\n};`, `// The prototype's window widths: S 480, M 640, L 768.\nconst S_W = "max-w-[480px]", M_W = "max-w-[640px]", L_W = "max-w-[768px]";\nconst WIDTHS: Record<Modal, string> = { intro: M_W, photo: S_W, about: M_W, affiliation: L_W, experience: L_W, education: L_W, memberships: L_W, links: L_W, emails: M_W, phone: S_W, address: M_W };`);
  s = s.replace(`import { Dialog } from "@/components/ui/dialog";`, `import { Modal as ModalWindow } from "@/components/ui/modal";`);
  s = s.replace(/<Modal title=\{TITLES\[modal\]\}/, `<ModalWindow title={TITLES[modal]}`).replace(`        </Modal>\n      )}`, `        </ModalWindow>\n      )}`);
  fs.writeFileSync(f, s); n++;
}

// ---- PhoneField: a plain look (no phone icon) for the window
edit(S + "features/profile/components/phone-field.tsx", [
  [`  /** Classes of the number box; the standard input look by default. */\n  inputClassName?: string;`, `  /** Classes of the number box; the standard input look by default. */\n  inputClassName?: string;\n  /** No phone icon inside the number box (the prototype's Mobile number window). */\n  bare?: boolean;`],
  [`channels = [], onChannelsChange, invalid, describedBy, inputClassName }: PhoneFieldProps)`, `channels = [], onChannelsChange, invalid, describedBy, inputClassName, bare }: PhoneFieldProps)`],
  [`<Phone size={14} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />`, `{!bare && <Phone size={14} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />}`],
  [`className={cn(inputClassName ?? INPUT_CLASS, "pl-9")}`, `className={cn(inputClassName ?? INPUT_CLASS, !bare && "pl-9")}`],
  [`placeholder="Mobile number (optional)"`, `placeholder={bare ? "98765 43210" : "Mobile number (optional)"}`],
]);

// ---- PhoneEditor
{
  const f = S + "features/profile/components/basic-editors.tsx"; let s = fs.readFileSync(f, "utf8");
  const a = s.indexOf(`      <Field label="Mobile number" htmlFor="phone-number"`);
  const endMark = `      </Field>\n    </SectionCard>\n  );\n}`;
  const b = s.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error("phone body");
  const neu = `      <div className="flex flex-col gap-[18px]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="phone-number" className="text-[13px] font-semibold text-ink-soft">Mobile number</label>
            {!cleared && <VerifyStatus status={changed ? "new" : profile.phoneStatus || "new"} />}
          </div>
          <div className="mt-1.5">
            <PhoneField bare id="phone-number" phone={phone} onPhoneChange={setPhone} onBlur={() => setTouched(true)} invalid={touched && Boolean(problem)} describedBy={touched && problem ? "phone-number-error" : undefined} inputClassName="h-[42px] w-full rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink outline-none transition-shadow placeholder:text-slate-400 focus:border-primary focus:ring-[3px] focus:ring-primary-soft" />
          </div>
          {touched && problem && <p id="phone-number-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">{problem}</p>}
          <p className="mt-1.5 text-xs text-ink-faint">Verifying a number by code isn&apos;t available yet, so a new number is saved as not verified.</p>
        </div>
        <div>
          <div className="text-[13px] font-semibold text-ink-soft">Alerts on this number</div>
          <div className="mt-1 text-[13px] text-ink-muted">Email alerts are always on.</div>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {NOTIFY_CHANNELS.map(({ key, label }) => {
              const checked = channels.includes(key);
              return (
                <label key={key} className={\`inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold text-ink \${checked ? "border-primary-soft-border bg-[#F5F7FF]" : "border-line bg-white"} \${cleared ? "cursor-not-allowed opacity-55" : "cursor-pointer"}\`}>
                  <input type="checkbox" checked={checked} disabled={cleared} onChange={() => setChannels((c) => (checked ? c.filter((x) => x !== key) : [...c, key]))} className="m-0 h-4 w-4 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed" />
                  {label}
                </label>
              );
            })}
          </div>
        </div>
      </div>
`;
  s = s.slice(0, a) + neu + s.slice(b + `      </Field>\n`.length);
  fs.writeFileSync(f, s); n++;
}
console.log("applied", n);
