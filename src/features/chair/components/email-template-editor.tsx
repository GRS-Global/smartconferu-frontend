"use client";

import { EMAIL_SUMMARIES } from "../email-summaries";
import { Bold, ChevronLeft, Italic, Link2, List, ListOrdered, Lock, Mail, Tag, Trash2, Underline, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { PlatformTemplate } from "@/types/chair";
import { emailPreviewDoc } from "../email-preview";

/* Email Templates › editing one email, as a page of its own (the prototype's template editor): "Back to <where you came from>" and "All email templates",
   the email's name and category with its on / off switch, Edit / Preview of the subject and message (a small rich-text editor: bold, italic, underline,
   lists, link), and on the right "Email information", "Header & footer" and the merge fields to click into the message. Saved with Save. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const ROLE_TONE: Record<string, { color: string; bg: string; label: string }> = {
  author: { color: "var(--primary)", bg: "var(--primary-soft)", label: "Author" },
  reviewer: { color: "var(--success-ink)", bg: "var(--success-soft)", label: "Reviewer" },
  chair: { color: "var(--secondary)", bg: "var(--secondary-soft)", label: "Program Chair" },
  roles: { color: "var(--cat-virtual)", bg: "var(--cat-virtual-soft)", label: "Team & Roles" },
  registration: { color: "var(--warning-ink)", bg: "var(--warning-soft)", label: "Registration" },
  account: { color: "var(--navy)", bg: "var(--muted)", label: "Any user" },
  custom: { color: "var(--ink-muted)", bg: "var(--muted)", label: "Custom" },
};
// The merge fields a chair can put in any email, by what they are about. The fields this email already uses come first, under "This email".
const GROUPS: Array<[string, string[]]> = [
  ["Recipient", ["first_name", "last_name"]],
  ["Paper", ["paper_title", "submission_id", "paper_number", "track", "presentation_type", "submission_link"]],
  ["Conference & dates", ["conference_name", "conference_acronym", "deadline", "registration_deadline", "camera_ready_deadline"]],
  ["Decision & registration", ["decision", "chair_note", "reviews_for_author", "registration_type"]],
];
const TOKEN = /{{\s*(\w+)\s*}}/g;

/** The message is edited as HTML (the chair's own, but never trusted): scripts, frames, event handlers and javascript: links are removed. */
function clean(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form,base").forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const a of [...el.attributes]) {
      const v = a.value.trim().toLowerCase();
      if (a.name.startsWith("on") || ((a.name === "href" || a.name === "src" || a.name === "xlink:href") && /^(javascript|data|vbscript):/.test(v))) el.removeAttribute(a.name);
    }
  });
  return doc.body.innerHTML;
}

export interface EditingEmail { /** Bumped by "Reset to default" so the (uncontrolled) editor reopens with the default text. */ rev?: number; key: string; label: string; custom: boolean; isNew: boolean; subject: string; body: string; enabled: boolean; hasCopy: boolean; fields: string[]; def: PlatformTemplate | null }

function Tool({ label, onRun, children }: { label: string; onRun: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onRun} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-white hover:text-primary">{children}</button>;
}

export function EmailTemplateEditor({ edit, setEdit, moduleLabel, sendLabel, conferenceName, acronym, back, busy, error, onSave, onReset, onDelete, onClose }: {
  edit: EditingEmail; setEdit: (e: EditingEmail) => void; moduleLabel: string; sendLabel: string; conferenceName: string; acronym: string;
  back: { href: string; label: string } | null; busy: boolean; error: string; onSave: () => void; onReset: () => void; onDelete: () => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const snap = (e: EditingEmail) => JSON.stringify([e.label, e.subject, e.body.trim(), e.enabled]);
  const openedAs = `${edit.key}#${edit.rev ?? 0}`;
  const [start, setStart] = useState({ at: openedAs, value: snap(edit) });
  // Another email opened, or "Reset to default" put the default text back: that is the new starting point.
  if (start.at !== openedAs) setStart({ at: openedAs, value: snap(edit) });
  const changed = edit.isNew || snap(edit) !== start.value;
  const box = useRef<HTMLDivElement>(null);
  // The editor is not a controlled input: its content is set once when this email opens and read back on every change.
  const editing = mode === "edit";
  useEffect(() => {
    if (box.current) box.current.innerHTML = clean(edit.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit.key, edit.rev, editing]);
  const run = (cmd: string, value?: string) => { box.current?.focus(); document.execCommand(cmd, false, value); setEdit({ ...edit, body: clean(box.current?.innerHTML ?? edit.body) }); };
  const link = () => { const url = window.prompt("Link address (https://…)"); if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) run("createLink", url.trim()); };
  const insert = (f: string) => {
    const el = box.current; if (!el) return;
    el.focus();
    const token = `{{${f}}}`;
    // At the caret when it is inside the message, else at the end.
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel?.removeAllRanges(); sel?.addRange(r); }
    document.execCommand("insertText", false, token);
    setEdit({ ...edit, body: clean(el.innerHTML) });
  };
  const used = useMemo(() => [...new Set([...edit.subject.matchAll(TOKEN), ...edit.body.matchAll(TOKEN)].map((m) => m[1]))], [edit.subject, edit.body]);
  const inEmail = useMemo(() => [...new Set([...edit.fields, ...used])], [edit.fields, used]);
  const preview = useMemo(() => (mode === "preview" ? emailPreviewDoc(edit.subject, edit.body, conferenceName, acronym) : ""), [mode, edit.subject, edit.body, conferenceName, acronym]);
  // "Reset to default" is only for an email whose text differs from the platform's (the prototype's isEdited).
  const edited = Boolean(edit.def && (edit.subject !== edit.def.subject || edit.body.trim() !== edit.def.body.trim()));
  const tone = ROLE_TONE[edit.custom ? "custom" : edit.def?.role ?? "chair"] ?? ROLE_TONE.chair;
  const field = (f: string) => <button key={f} type="button" onClick={() => insert(f)} disabled={mode !== "edit"} className="cursor-pointer rounded-full border border-[var(--primary-soft-border)] bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{`{{${f}}}`}</button>;
  const info = (label: string, value: string) => value ? <div className="border-t border-muted pt-3"><div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">{label}</div><div className="mt-1 text-xs leading-relaxed text-ink-muted">{value}</div></div> : null;
  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-4 text-xs font-bold">
        {back && <Link href={back.href} className="inline-flex items-center gap-1 text-primary hover:underline"><ChevronLeft size={14} aria-hidden="true" /> Back to {back.label}</Link>}
        <button type="button" onClick={onClose} disabled={busy} className="flex cursor-pointer items-center gap-1.5 text-ink-muted transition-colors hover:text-primary">{back ? "All email templates" : <><ChevronLeft size={14} aria-hidden="true" /> Email Templates</>}</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span style={{ background: tone.bg, color: tone.color }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><Mail size={18} aria-hidden="true" /></span>
          <div className="min-w-0">
            {edit.custom
              ? <input aria-label="Name" value={edit.label} maxLength={120} placeholder="Name this email" onChange={(e) => setEdit({ ...edit, label: e.target.value })} className={`${INPUT_CLASS} h-9 min-w-[260px] text-base font-bold`} />
              : <h2 className="truncate text-base font-bold text-navy">{edit.label}</h2>}
            <span style={{ background: tone.bg, color: tone.color }} className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold">{tone.label}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">{edit.enabled ? "Enabled" : "Disabled"}<Switch label="This email is sent" checked={edit.enabled} onChange={(v) => setEdit({ ...edit, enabled: v })} /></label>
          {/* Only an email that was changed has something to go back to (the prototype's isEdited). */}
          {!edit.custom && edited && <button type="button" disabled={busy} onClick={onReset} title="Put back the platform's subject and message for this email" className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-primary hover:underline disabled:opacity-50"><Undo2 size={13} aria-hidden="true" /> Reset to default</button>}
          {edit.custom && !edit.isNew && <button type="button" disabled={busy} onClick={onDelete} className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-danger-ink hover:underline disabled:opacity-50"><Trash2 size={13} aria-hidden="true" /> Delete</button>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <section style={CARD} className="min-w-0 rounded-2xl bg-white p-5">
          <div role="tablist" aria-label="Message" className="mb-4 inline-flex gap-1 rounded-xl border border-line p-1">
            {(["edit", "preview"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`h-7 cursor-pointer rounded-lg px-4 text-xs font-bold ${mode === k ? "bg-muted text-navy" : "text-ink-muted hover:text-navy"}`}>{k === "edit" ? "Edit" : "Preview"}</button>)}
          </div>
          {mode === "edit" ? (
            <>
              <label htmlFor="et-subject" className="mb-1.5 block text-xs font-semibold text-ink-muted">Subject</label>
              <input id="et-subject" value={edit.subject} maxLength={300} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} className={INPUT_CLASS} />
              <div className="mb-1.5 mt-4 text-xs font-semibold text-ink-muted">Body</div>
              <div className="overflow-hidden rounded-xl border border-line bg-white">
                <div className="flex flex-wrap items-center gap-1 border-b border-line bg-canvas px-2 py-1.5">
                  <Tool label="Bold" onRun={() => run("bold")}><Bold size={17} aria-hidden="true" /></Tool>
                  <Tool label="Italic" onRun={() => run("italic")}><Italic size={17} aria-hidden="true" /></Tool>
                  <Tool label="Underline" onRun={() => run("underline")}><Underline size={17} aria-hidden="true" /></Tool>
                  <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
                  <Tool label="Bulleted List" onRun={() => run("insertUnorderedList")}><List size={17} aria-hidden="true" /></Tool>
                  <Tool label="Numbered List" onRun={() => run("insertOrderedList")}><ListOrdered size={17} aria-hidden="true" /></Tool>
                  <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
                  <Tool label="Link" onRun={link}><Link2 size={17} aria-hidden="true" /></Tool>
                </div>
                <div ref={box} role="textbox" aria-multiline="true" aria-label="Body" contentEditable suppressContentEditableWarning onInput={() => setEdit({ ...edit, body: clean(box.current?.innerHTML ?? "") })} className="min-h-[168px] space-y-3 px-4 py-3.5 text-sm leading-[1.5] text-ink outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" />
              </div>
            </>
          ) : <iframe title="Email preview" sandbox="" srcDoc={preview} className="block h-[460px] w-full rounded-xl border border-line bg-canvas" />}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={onSave} disabled={busy || !changed} title={changed ? undefined : "No changes to save"}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </section>

        <aside className="space-y-4" aria-label="About this email">
          <div style={CARD} className="rounded-2xl bg-white p-4">
            <div className="text-xs font-bold text-navy">Email information</div>
            <div className="mt-3 flex items-center justify-between text-[11.5px]"><span className="text-ink-faint">Category</span><span style={{ background: tone.bg, color: tone.color }} className="rounded-full px-2 py-0.5 text-[10.5px] font-bold">{tone.label}</span></div>
            <div className="mt-2.5 flex items-center justify-between border-t border-muted pt-2.5 text-[11.5px]"><span className="text-ink-faint">Status</span><b className="text-xs" style={{ color: edit.enabled ? "var(--success-ink)" : "var(--ink-muted)" }}>{edit.enabled ? "Enabled" : "Turned off"}</b></div>
            <div className="mt-3 space-y-3">
              {!edit.custom && info("Module", moduleLabel)}
              {!edit.custom && info("Send type", sendLabel)}
              {!edit.custom && info("Sent when", edit.def?.trigger ?? "")}
              {!edit.custom && info("Main recipient", (edit.def?.recipients ?? "").split(" · ")[0])}
              {!edit.custom && info("Also sent to", (edit.def?.recipients ?? "").split(" · ").slice(1).join(" · "))}
              {!edit.custom && info("Contains", EMAIL_SUMMARIES[edit.key] ?? "")}
              {edit.custom && info("Sent when", "The chair sends it from Send Email")}
            </div>
          </div>
          <div style={CARD} className="rounded-2xl bg-white p-4">
            <div className="text-xs font-bold text-navy">Header &amp; footer</div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">Every email is sent with a default header and footer, shown in the Preview tab.</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
              <div><div className="text-[13px] font-semibold text-ink">Remove Smartconferu branding</div><span className="mt-1 inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-ink"><Lock size={9} aria-hidden="true" /> Paid option · coming soon</span></div>
              <Switch label="Remove Smartconferu branding" checked={false} onChange={() => undefined} disabled />
            </div>
          </div>
          <div style={CARD} className="rounded-2xl bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-navy"><Tag size={13} aria-hidden="true" className="text-primary" /> Merge fields</div>
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">Click one to insert it — each gets swapped for the real value when the email actually goes out.</p>
            {inEmail.length > 0 && <div className="mt-3"><div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">This email</div><div className="flex flex-wrap gap-1.5">{inEmail.map(field)}</div></div>}
            {GROUPS.map(([name, list]) => { const rest = list.filter((f) => !inEmail.includes(f)); return rest.length ? <div key={name} className="mt-3"><div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">{name}</div><div className="flex flex-wrap gap-1.5">{rest.map(field)}</div></div> : null; })}
          </div>
        </aside>
      </div>
    </div>
  );
}
