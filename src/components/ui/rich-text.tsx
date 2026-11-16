"use client";

import { Bold, Heading2, Italic, Link2, List, ListOrdered, Pilcrow, Underline } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* The prototype's rich text field (a CKEditor with Bold, Italic, Underline, bulleted / numbered list and Link) for text a chair writes and others read
   (Submission Guidelines). The text is stored as HTML. Text saved before this editor existed is plain text; it is shown as paragraphs and becomes HTML
   the next time it is saved. HTML is never trusted: scripts, frames, event handlers and javascript: links are removed on the way in and out. */

export function cleanHtml(html: string): string {
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

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Stored text → HTML: HTML stays, plain text becomes one paragraph per blank-line-separated chunk. */
export function richTextToHtml(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (/<\/?(p|ul|ol|li|strong|em|b|i|u|a|br|h[1-6])[\s>/]/i.test(v)) return cleanHtml(v);
  return v.split(/\n{2,}/).map((c) => `<p>${escapeHtml(c).replace(/\n/g, "<br>")}</p>`).join("");
}
/** True when there is any text (an empty editor still holds "<p><br></p>"). */
export const hasRichText = (value: string) => richTextToHtml(value).replace(/<[^>]*>|&nbsp;/g, "").trim() !== "";

/** Read-only render of the stored text (same look as the prototype's `.rich-text-content`). */
export function RichTextContent({ value, className = "" }: { value: string; className?: string }) {
  return <div className={`rich-text-content ${className}`} dangerouslySetInnerHTML={{ __html: richTextToHtml(value) }} />;
}

function Tool({ label, onRun, children }: { label: string; onRun: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onRun} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-primary-soft hover:text-primary">{children}</button>;
}

/** `onChange(html)` is called as the text is typed ("" when it is empty). The field keeps its own content: `value` only seeds it. */
export function RichTextEditor({ value, onChange, placeholder, label, headings = false }: { value: string; onChange: (html: string) => void; placeholder?: string; label: string; /** Adds "Section heading" and "Normal text" (the CFP's text has headed sections). */ headings?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!hasRichText(value));
  useEffect(() => {
    if (box.current) box.current.innerHTML = richTextToHtml(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const read = () => { const html = cleanHtml(box.current?.innerHTML ?? ""); const none = !hasRichText(html); setEmpty(none); onChange(none ? "" : html); };
  const run = (cmd: string, arg?: string) => { box.current?.focus(); document.execCommand(cmd, false, arg); read(); };
  const link = () => { const url = window.prompt("Link address (https://…)"); if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) run("createLink", url.trim()); };
  return (
    <div>
      <div style={{ border: "1.5px solid var(--border)", borderBottom: "none" }} className="flex flex-wrap items-center gap-0.5 rounded-t-[0.7rem] bg-canvas px-2 py-[7px]">
        {headings && <><Tool label="Section heading" onRun={() => run("formatBlock", "h2")}><Heading2 size={17} aria-hidden="true" /></Tool><Tool label="Normal text" onRun={() => run("formatBlock", "p")}><Pilcrow size={17} aria-hidden="true" /></Tool><span className="mx-1 h-5 w-px bg-line" aria-hidden="true" /></>}
        <Tool label="Bold" onRun={() => run("bold")}><Bold size={17} aria-hidden="true" /></Tool>
        <Tool label="Italic" onRun={() => run("italic")}><Italic size={17} aria-hidden="true" /></Tool>
        <Tool label="Underline" onRun={() => run("underline")}><Underline size={17} aria-hidden="true" /></Tool>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <Tool label="Bulleted List" onRun={() => run("insertUnorderedList")}><List size={17} aria-hidden="true" /></Tool>
        <Tool label="Numbered List" onRun={() => run("insertOrderedList")}><ListOrdered size={17} aria-hidden="true" /></Tool>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <Tool label="Link" onRun={link}><Link2 size={17} aria-hidden="true" /></Tool>
      </div>
      <div className="relative">
        {empty && placeholder && <div aria-hidden="true" className="pointer-events-none absolute left-[15.5px] top-3 text-sm text-ink-faint">{placeholder}</div>}
        <div ref={box} role="textbox" aria-multiline="true" aria-label={label} contentEditable suppressContentEditableWarning onInput={read} style={{ border: "1.5px solid var(--border)" }} className="rich-text-content min-h-[160px] rounded-b-[0.7rem] bg-white px-[14px] py-3 !text-sm !leading-[1.6] !text-ink outline-none [&_li]:!m-0 [&_li]:!leading-[1.5] focus:!border-primary-soft-border" />
      </div>
    </div>
  );
}
