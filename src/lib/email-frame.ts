/* The frame around every email the platform sends ("Brand stripe"): a navy stripe, the Smartconferu logo with the
   conference opposite, the email's title, the message, a "Best regards, The Smartconferu Team" sign-off and a grey
   do-not-reply note. A port of the prototype's src/shared/emailFrameCore.js (kept free of imports there on purpose, so the
   browser and the server build the very same frame), used here to show a stored email as it was sent. Inline styles and
   literal hex on purpose: this is email HTML, which cannot use the app's CSS variables. */

const SUPPORT_EMAIL = "support@smartconferu.com";
const NAVY = "#17233F";
const BLUE = "#0B4FF2";
const FONT = "Arial,Helvetica,sans-serif";
const RULE = "1px solid #E5E7EB";
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ESCAPES[c]);

/* Templates end with their own "Best regards, The … Team" (or just "The Smartconferu Team"). The frame adds the sign-off
   itself, so that last paragraph is dropped to keep it from appearing twice. */
function stripSignOff(bodyHtml: string): string {
  const html = String(bodyHtml || "");
  const end = html.lastIndexOf("</p>");
  const start = end < 0 ? -1 : html.lastIndexOf("<p", end);
  if (start < 0) return html;
  const text = html.slice(start, end).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return /^(best regards,?\s*)?the\s.{1,80}\steam$/i.test(text) ? html.slice(0, start) + html.slice(end + 4) : html;
}

interface FrameOptions { conferenceName?: string; conferenceAcronym?: string; title?: string; logoUrl?: string }

function headerHtml({ conferenceName, conferenceAcronym, logoUrl = "" }: FrameOptions): string {
  const conf = conferenceAcronym || conferenceName || "";
  const left = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="Smartconferu" height="40" style="display:block;height:40px;width:auto;border:0;" />`
    : `<div style="font-size:20px;font-weight:700;color:${NAVY};">Smartconferu</div>`;
  const right = conf ? `<span style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${BLUE};">${esc(conf)}</span>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>`
    + `<td style="padding:22px 36px 0;font-family:${FONT};">${left}</td>`
    + `<td align="right" style="padding:22px 36px 0;font-family:${FONT};">${right}</td>`
    + `</tr></table>`;
}

const signOffHtml = () => `<div style="margin-top:26px;padding-top:20px;border-top:${RULE};font-family:${FONT};font-size:14px;line-height:1.6;color:#111827;">`
  + `<div style="font-weight:700;">Best regards,</div><div>The Smartconferu Team</div></div>`;

const footerHtml = () => `<div style="padding:18px 36px 24px;background:#F8F9FB;border-top:${RULE};font-family:${FONT};font-size:12.5px;line-height:1.7;color:#9CA3AF;text-align:center;">`
  + `<div>Please be aware that this is an unmonitored email alias, so please do not reply to this email.</div>`
  + `<div>To contact Smartconferu use our <a href="mailto:${SUPPORT_EMAIL}" style="color:#6B7280;font-weight:700;">contact page</a>.</div>`
  + `<div style="margin-top:6px;font-size:11px;">Sent with <b style="color:#6B7280;">Smartconferu</b></div>`
  + `</div>`;

/** The frame around `bodyHtml` — the email's own HTML, as stored when it was sent. */
export function frameEmailHtml(bodyHtml: string, opts: FrameOptions = {}): string {
  return `<div style="border:1px solid #E5E7EB;border-top:5px solid ${NAVY};border-radius:10px;overflow:hidden;background:#FFFFFF;">`
    + headerHtml(opts)
    + `<div style="padding:18px 36px 34px;font-family:${FONT};font-size:14px;line-height:1.6;color:#111827;">`
    + (opts.title ? `<h2 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${NAVY};">${esc(opts.title)}</h2>` : "")
    + stripSignOff(bodyHtml)
    + signOffHtml()
    + `</div>`
    + footerHtml()
    + `</div>`;
}
