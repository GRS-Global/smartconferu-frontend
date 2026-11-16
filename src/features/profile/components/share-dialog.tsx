"use client";

import { Check, Download, Info, Link2, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { Profile } from "@/types/profile";
import { PROFESSIONAL_FIELDS, SCHOLAR_FIELDS, type LinkField } from "../fields";
import { BrandIcon } from "../showcase/parts";

export const profileSlug = (p: Pick<Profile, "firstName" | "lastName">): string =>
  `${p.firstName || "your"}-${p.lastName || "name"}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

const SHARE_INTENTS: Partial<Record<string, (url: string) => string>> = {
  linkedinUrl: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  twitterUrl: (url) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
  facebookUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
};

export function buildVCard(p: Pick<Profile, "firstName" | "lastName" | "designation" | "affiliation" | "webPage" | "city" | "state" | "country">): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${p.lastName};${p.firstName};;;`, `FN:${p.firstName} ${p.lastName}`];
  if (p.designation) lines.push(`TITLE:${p.designation}`);
  if (p.affiliation) lines.push(`ORG:${p.affiliation}`);
  if (p.webPage) lines.push(`URL:${p.webPage}`);
  const addr = [p.city, p.state, p.country].filter(Boolean);
  if (addr.length > 0) lines.push(`ADR:;;${addr.join(";")};;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadVCard(p: Profile) {
  const blob = new Blob([buildVCard(p)], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.firstName}-${p.lastName}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Share your profile: copy the link, QR code, vCard, and (for connected platforms) a share dialog. The link opens for you only:
 *  profiles are private to their owner in the current database, so other people can't view it yet — the dialog says so. */
export function ShareDialog({ profile, onClose, onTogglePublic }: { profile: Profile; onClose: () => void; onTogglePublic: (on: boolean) => Promise<void> }) {
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/author/${profileSlug(profile)}`;
  const isPublic = profile.publicProfileEnabled;
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(shareUrl, { width: 160, margin: 1, color: { dark: "#0B1020", light: "#FFFFFF" } }).then((d) => { if (!cancelled) setQr(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [shareUrl]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  };
  const connected: LinkField[] = [...SCHOLAR_FIELDS, ...PROFESSIONAL_FIELDS].filter((f) => profile[f.key]);
  const shareTo = async (f: LinkField) => {
    const intent = SHARE_INTENTS[f.key];
    if (intent) { window.open(intent(shareUrl), "_blank", "noopener,noreferrer"); return; }
    try { await navigator.clipboard.writeText(shareUrl); setCopiedKey(f.key); setTimeout(() => setCopiedKey(null), 1500); } catch { /* clipboard unavailable */ }
  };
  const toggle = async (on: boolean) => {
    setBusy(true);
    setError("");
    try { await onTogglePublic(on); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that — please try again."); } finally { setBusy(false); }
  };
  const btn = "flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas";

  return (
    <Dialog open onClose={onClose} size="md" title="Share your profile" description="Copy your profile link, show a QR code or download your contact card.">
      {isPublic ? (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-canvas p-1.5">
            <span className="flex-1 truncate pl-2 text-xs text-ink-muted" data-share-url="">{shareUrl}</span>
            <button type="button" onClick={() => void copyLink()} className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-white transition-colors ${copied ? "bg-success" : "bg-primary"}`}>
              {copied ? <Check size={13} strokeWidth={2.5} aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mb-5 flex items-center gap-4">
            {qr
              // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL
              ? <img src={qr} alt="QR code linking to this profile" width={72} height={72} className="shrink-0 rounded-lg border border-line" />
              : <div style={{ width: 72, height: 72 }} className="shrink-0 rounded-lg border border-line" />}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button type="button" onClick={() => downloadVCard(profile)} className={btn}><Download size={13} aria-hidden="true" /> Save contact (vCard)</button>
              <a href={qr || undefined} download={`${profile.firstName}-${profile.lastName}-qr.png`} aria-disabled={!qr} className={`${btn} ${qr ? "" : "pointer-events-none opacity-50"}`}><QrCode size={13} aria-hidden="true" /> Save QR code</a>
            </div>
          </div>
          {connected.length > 0 && (
            <div className="border-t border-muted pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Share to a connected account</span>
              <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3">
                {connected.map((f) => (
                  <button key={f.key} type="button" onClick={() => void shareTo(f)} title={f.label} className="group flex flex-col items-center gap-1.5">
                    <span className="transition-opacity group-hover:opacity-80"><BrandIcon field={f} size={32} /></span>
                    <span className={`max-w-full truncate text-[10px] font-semibold ${copiedKey === f.key ? "text-success" : "text-ink-muted"}`}>{copiedKey === f.key ? "Copied!" : f.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-muted">LinkedIn, X and Facebook open their share dialog; the others copy your link.</p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong p-[18px] text-center text-sm leading-[1.55] text-ink-soft">Your public profile is off, so there’s nothing to share. Turn it on below to get a link.</div>
      )}
      <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-canvas px-3 py-2.5 text-xs leading-normal text-ink-muted"><Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> For now this link opens for you only. Profiles are private to their owner in the current database, so other people can&apos;t view it yet.</p>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-canvas px-4 py-3.5">
        <div>
          <div className="text-sm font-semibold text-ink" id="public-profile-label">Public profile</div>
          <div className="mt-0.5 text-[13px] text-ink-muted">{isPublic ? "On — the link above is active." : "Off — only you can see your profile."}</div>
        </div>
        <Switch checked={isPublic} disabled={busy} onChange={(v) => void toggle(v)} labelledBy="public-profile-label" />
      </div>
      {error && <p role="alert" className="mt-2 text-[11.5px] text-danger">{error}</p>}
    </Dialog>
  );
}
