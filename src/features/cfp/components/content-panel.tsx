"use client";

import { Check, Eye, FileText, Info, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RichTextEditor, richTextToHtml } from "@/components/ui/rich-text";
import { getCfpService } from "@/services/cfps";
import { AuthRequiredError } from "@/services/errors";
import { CfpPublicPreview, type CfpPreviewProps } from "./cfp-public-preview";

/* Edit content (the prototype's EditCFPContentPage): the CFP's text as a document, with an Edit / Preview switch. The text is HTML in `cfps.content.doc`,
   written with the app's rich-text editor (bold, italic, underline, lists, links and section headings) in place of the prototype's Editor.js. A CFP
   nobody has written yet opens on a first draft made from the conference's details. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;

export function ContentPanel({ slug, acronym, initialHtml, preview, onDone, onSaved, onSessionEnded }: { slug: string; acronym: string; /** What the editor opens with: the saved text, or the first draft. */ initialHtml: string; preview: Omit<CfpPreviewProps, "html" | "heading">; onDone: () => void; onSaved: () => void; onSessionEnded: () => void }) {
  const [html, setHtml] = useState(initialHtml);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    try { await (await getCfpService()).saveContent(slug, richTextToHtml(html)); setSaved(true); onSaved(); } catch (e) {
      if (e instanceof AuthRequiredError) onSessionEnded(); else setError(e instanceof Error ? e.message : "Couldn't save the content.");
    } finally { setBusy(false); }
  };

  if (saved) {
    return (
      <div className="flex items-center justify-center p-8" style={{ minHeight: "60vh" }}>
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft"><Check size={28} strokeWidth={2.5} aria-hidden="true" className="text-success" /></div>
          <h2 className="mb-2 text-lg font-bold text-navy">Content saved</h2>
          <p className="mb-6 text-sm text-ink-muted">Your changes to the {acronym} CFP content have been saved.</p>
          <Button onClick={onDone}>Back to Overview</Button>
        </div>
      </div>
    );
  }
  const tab = (key: "edit" | "preview", icon: React.ReactNode, text: string) => (
    <button type="button" onClick={() => setMode(key)} aria-pressed={mode === key} className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${mode === key ? "bg-navy text-white" : "text-ink-muted"}`}>{icon} {text}</button>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div style={CARD} className="flex w-fit items-center gap-1 rounded-2xl bg-white p-1.5">
        {tab("edit", <Pencil size={14} aria-hidden="true" />, "Edit")}
        {tab("preview", <Eye size={14} aria-hidden="true" />, "Preview")}
      </div>
      <div style={{ border: "1px solid var(--primary-soft-border)" }} className="flex items-start gap-2.5 rounded-xl bg-primary-soft px-4 py-3">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-[#1E4E8C]">
          {mode === "preview"
            ? "This is what authors will see, including any changes you haven't saved yet. Click \"Edit\" to keep making changes."
            : `This is what authors will see once ${acronym} is published. Edit it like a document — use the toolbar for headings, bold, italic, lists and links. Press "Save Changes" when you're done.`}
        </p>
      </div>
      {/* The editor stays mounted under "Preview": it only reads its text when it first appears, so unmounting it would lose the unsaved edits. */}
      <div style={{ ...CARD, display: mode === "edit" ? undefined : "none" }} className="rounded-xl bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><FileText size={16} aria-hidden="true" className="text-primary" /> CFP Content</h2>
        <RichTextEditor value={initialHtml} onChange={setHtml} label="CFP content" placeholder="Write the CFP content here…" headings maxHeight={480} />
      </div>
      {mode === "preview" && <CfpPublicPreview {...preview} html={richTextToHtml(html)} heading="Preview — how authors will see this CFP" />}
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex items-center justify-between pb-4 pt-1">
        <Button variant="outline" onClick={onDone} disabled={busy}>Cancel</Button>
        <Button onClick={() => void save()} disabled={busy || html === initialHtml} title={html === initialHtml ? "No changes to save" : undefined}>{busy ? "Saving…" : "Save Changes"}</Button>
      </div>
    </div>
  );
}
