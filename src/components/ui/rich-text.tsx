"use client";

import { Bold, Heading2, Italic, Link2, List, ListOrdered, Pilcrow, Underline } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* The prototype's rich text field (a CKEditor with Bold, Italic, Underline, bulleted / numbered list and Link) for text a chair writes and others read
   (Submission Guidelines). The text is stored as HTML. Text saved before this editor existed is plain text; it is shown as paragraphs and becomes HTML
   the next time it is saved. HTML is never trusted: scripts, frames, event handlers and javascript: links are removed on the way in and out. */

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SKIP = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "form", "base", "img", "svg", "canvas", "video", "audio", "head", "title", "noscript", "button", "input", "select", "textarea"]);

/** The children of `el` as blocks: loose text and inline tags next to paragraphs / lists get a paragraph of their own. */
function kids(el: Node, heading: "h2" | "strong"): string {
  let out = "", run = "";
  const flush = () => { if (run.replace(/<br>/g, "").trim()) out += `<p>${run.trim()}</p>`; run = ""; };
  for (const c of Array.from(el.childNodes)) {
    const piece = plain(c, heading);
    if (/^<(p|ul|ol|h2)[s>]/.test(piece)) { flush(); out += piece; } else run += piece;
  }
  flush();
  return out;
}

/** Rebuilds `node` with only the formatting the editor offers (bold, italic, underline, lists, links and, if asked, headings). Everything else a page or a Word file
 *  brings along — styles, classes, fonts, columns, widths, tables, spans — is dropped, so pasted text always takes the editor's own look. */
function plain(node: Node, heading: "h2" | "strong"): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeText((node.textContent ?? "").replace(/[\s ]+/g, " "));
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (SKIP.has(tag)) return "";
  const inner = () => Array.from(el.childNodes).map((c) => plain(c, heading)).join("");
  switch (tag) {
    case "br": return "<br>";
    case "b": case "strong": { const i = inner(); return i.trim() ? `<strong>${i}</strong>` : i; }
    case "i": case "em": { const i = inner(); return i.trim() ? `<em>${i}</em>` : i; }
    case "u": { const i = inner(); return i.trim() ? `<u>${i}</u>` : i; }
    case "a": {
      const i = inner(); const href = (el.getAttribute("href") ?? "").trim();
      return /^(https?:\/\/|mailto:)/i.test(href) && i.trim() ? `<a href="${href.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${i}</a>` : i;
    }
    case "ul": case "ol": { const i = inner(); return i.includes("<li") ? `<${tag}>${i}</${tag}>` : i; }
    case "li": { const i = inner().replace(/<\/?p>/g, " ").trim(); return i ? `<li>${i}</li>` : ""; }
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
      const i = inner().replace(/<\/?(strong|p)>/g, "").trim();
      return !i ? "" : heading === "h2" ? `<h2>${i}</h2>` : `<p><strong>${i}</strong></p>`;
    }
    case "p": case "div": case "section": case "article": case "blockquote": case "pre": case "tr": case "td": case "th": case "header": case "footer": case "main": case "aside": case "figure": case "figcaption": case "dd": case "dt": {
      const i = kids(el, heading);
      return i || (tag === "p" ? "<p><br></p>" : "");
    }
    default: return inner(); // span, font, label, table, tbody … : only what is inside
  }
}

/** HTML → the editor's simple HTML (see `plain`). `heading` is how a heading is kept: as a section heading, or as a bold line. */
export function cleanHtml(html: string, heading: "h2" | "strong" = "h2"): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return kids(doc.body, heading);
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
  // Pasted text keeps only the editor's own formatting: a web page or Word file brings fonts, columns, widths and colours that would break the field.
  const paste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    const clean = html ? cleanHtml(html, headings ? "h2" : "strong") : text.split(/\n{2,}/).filter((c) => c.trim()).map((c) => `<p>${escapeHtml(c.trim()).replace(/\n/g, "<br>")}</p>`).join("");
    if (clean) document.execCommand("insertHTML", false, clean); else if (text) document.execCommand("insertText", false, text);
    read();
  };
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
        <div ref={box} role="textbox" aria-multiline="true" aria-label={label} contentEditable suppressContentEditableWarning onInput={read} onPaste={paste} style={{ border: "1.5px solid var(--border)" }} className="rich-text-content min-h-[160px] rounded-b-[0.7rem] bg-white px-[14px] py-3 !text-sm !leading-[1.6] !text-ink outline-none [&_li]:!m-0 [&_li]:!leading-[1.5] focus:!border-primary-soft-border" />
      </div>
    </div>
  );
}
