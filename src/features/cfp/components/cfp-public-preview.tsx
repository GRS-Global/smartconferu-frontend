import type { CSSProperties } from "react";

/* The whole public CFP page (the prototype's CFPPublicPreview): a banner in the theme's accent with the acronym, name, venue and deadline, the
   conference web page and the submission link, then the CFP's text. The theme page's live preview, the manager's "View" and the page authors visit
   all draw it. The text is HTML that went through the editor's cleaner (richTextToHtml), never raw. */

export const SUBMISSION_LINK_PENDING = "Available once the Call for Papers is published";

export interface CfpPreviewProps {
  acronym: string;
  name: string;
  venue: string;
  country: string;
  /** The submission deadline as people read it ("Jan 10, 2027"), or "". */
  deadline: string;
  webPage: string;
  /** The conference's submission link; "" until the CFP is published. */
  submissionLink: string;
  /** The CFP text as safe HTML. */
  html: string;
  accent: string;
  heading?: string;
}

const CSS = ".cfp-doc{font-size:14px;line-height:1.65;color:var(--ink-soft)}.cfp-doc h2{color:var(--cfp-accent);border-bottom:2px solid var(--cfp-accent);font-size:16px;font-weight:700;padding-bottom:6px;margin:24px 0 8px}.cfp-doc h2:first-child{margin-top:0}.cfp-doc h3{color:var(--ink-muted);font-size:12px;font-weight:700;margin:12px 0 6px}.cfp-doc p{margin:0 0 12px}.cfp-doc ul,.cfp-doc ol{margin:0 0 12px;padding-left:20px}.cfp-doc ul{list-style:disc}.cfp-doc ol{list-style:decimal}.cfp-doc li{margin:3px 0}.cfp-doc a{color:var(--cfp-accent);text-decoration:underline}.cfp-doc strong,.cfp-doc b{color:var(--ink);font-weight:700}";

/** The CFP's text with the section headings in the theme's accent (also drawn on the manager's overview). */
export function CfpDoc({ html, accent }: { html: string; accent: string }) {
  return <div style={{ "--cfp-accent": accent } as CSSProperties}><style>{CSS}</style><div className="cfp-doc" dangerouslySetInnerHTML={{ __html: html }} /></div>;
}

export function CfpPublicPreview({ acronym, name, venue, country, deadline, webPage, submissionLink, html, accent, heading }: CfpPreviewProps) {
  const style = { "--cfp-accent": accent } as CSSProperties;
  return (
    <div style={style}>
      {heading && <div className="mb-2 px-1 text-xs font-semibold text-ink-faint">{heading}</div>}
      <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="overflow-hidden rounded-2xl bg-white">
        <div style={{ background: accent, transition: "background 160ms ease" }} className="p-6">
          <div className="text-lg font-bold leading-tight text-white">{acronym}: {name}</div>
          <div style={{ color: "rgba(255,255,255,0.82)" }} className="mt-1 text-sm">{[venue, country].filter(Boolean).join(", ")}{deadline ? ` · ${deadline}` : ""}</div>
        </div>
        <div className="space-y-5 p-6">
          <div style={{ border: "1px solid var(--border)", borderRadius: "0.7rem" }} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-36 shrink-0 text-xs font-semibold text-ink-faint">Conference web page</span>
              <span style={{ color: accent }} className="truncate text-sm font-medium">{webPage}</span>
            </div>
            <div style={{ borderTop: "1px solid var(--muted)" }} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-36 shrink-0 text-xs font-semibold text-ink-faint">Submission link</span>
              <span style={{ color: submissionLink ? accent : "var(--ink-faint)" }} className="truncate text-sm font-medium">{submissionLink || SUBMISSION_LINK_PENDING}</span>
            </div>
          </div>
          <CfpDoc html={html} accent={accent} />
        </div>
      </div>
    </div>
  );
}
