"use client";

import { Mail } from "lucide-react";
import { useMemo, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { frameEmailHtml } from "@/lib/email-frame";
import type { AppNotification } from "@/types/notification";

/* The full email behind an "Emails" item — what was sent, read-only (the prototype's EmailViewer). The stored HTML is
   framed exactly as it was when it went out (lib/email-frame.ts) and shown inside a sandboxed iframe: no scripts can run
   in it (no `allow-scripts`), a Content-Security-Policy allows no script, form, frame or connection either, and links open
   in a new tab. `allow-same-origin` is only there so the page can read the frame's height; without scripts nothing in the
   email can use it. */

const sentAt = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const CSP = "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'";

export function EmailViewer({ item, onClose }: { item: AppNotification | null; onClose: () => void }) {
  const e = item?.email;
  const frame = useRef<HTMLIFrameElement>(null);
  const doc = useMemo(() => {
    if (!item || !e) return "";
    const logoUrl = typeof window === "undefined" ? "" : new URL("/smartconferu-lockup.png", window.location.origin).href;
    const framed = frameEmailHtml(e.bodyHtml, { conferenceName: item.conference?.acronym, conferenceAcronym: item.conference?.acronym, title: e.subject.replace(/^\[[^\]]*\]\s*/, ""), logoUrl });
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank"><style>body{margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif}img{max-width:100%}</style></head><body>${framed}</body></html>`;
  }, [item, e]);

  const fit = () => {
    const f = frame.current;
    const h = f?.contentDocument?.documentElement?.scrollHeight;
    if (f && h) f.style.height = `${h + 2}px`;
  };

  return (
    <Dialog open={!!item} onClose={onClose} title={e?.subject || item?.title || "Email"} size="lg" icon={Mail}>
      {item && e && (
        <div className="-mx-5 -mb-5 overflow-hidden rounded-b-2xl border-t border-line">
          {e.template && <p className="px-5 pt-3"><span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-ink-muted">{e.template}</span></p>}
          <dl className="mt-3 grid grid-cols-[56px_1fr] gap-x-3 gap-y-1 border-b border-line bg-canvas px-5 py-3 text-[13px] text-ink-soft">
            <dt className="font-semibold text-ink-muted">From</dt><dd className="min-w-0 break-words">{e.from}</dd>
            <dt className="font-semibold text-ink-muted">To</dt><dd className="min-w-0 break-words">{e.to}</dd>
            <dt className="font-semibold text-ink-muted">Sent</dt><dd>{sentAt(item.createdAt)}</dd>
          </dl>
          <div className="bg-canvas px-4 py-4">
            <iframe
              ref={frame}
              title={`Email: ${e.subject}`}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              srcDoc={doc}
              onLoad={fit}
              className="block min-h-[240px] w-full border-0"
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}
