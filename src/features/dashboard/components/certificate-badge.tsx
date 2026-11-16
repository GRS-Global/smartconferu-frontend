import { Award } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CertificateState } from "../derive";

/* The certificate column: one badge, always the same size so the column stays aligned.
   Ready: a filled purple medal (a stacked card and count bubble when several). Not yet: a dashed
   outline. The hover/focus note says what it is, or why there isn't one yet. */
function CertificateMark({ issued, count }: { issued: boolean; count: number }) {
  const many = issued && count > 1;
  return (
    <span className="relative inline-flex h-[34px] w-[34px]">
      {many && <span aria-hidden="true" className="absolute inset-0 -translate-y-[4px] translate-x-[4px] rounded-[0.7rem] border border-[#C4B5FD] bg-[#DDD6FE]" />}
      <span
        style={issued ? { background: "linear-gradient(140deg,#8B5CF6 0%,#6D28D9 100%)", boxShadow: "0 4px 12px rgba(124,58,237,0.30), inset 0 1px 0 rgba(255,255,255,0.25)" } : undefined}
        className={cn("cert-face relative flex h-[34px] w-[34px] items-center justify-center rounded-[0.7rem]", issued ? "text-white" : "border-[1.5px] border-dashed border-line bg-white text-line-strong")}
      >
        <Award size={16} strokeWidth={issued ? 2.2 : 1.8} aria-hidden="true" />
      </span>
      {many && (
        <span className="absolute -right-[10px] -top-[9px] inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-white px-1 text-[10.5px] font-extrabold leading-none tabular-nums text-[#6D28D9] shadow-[0_0_0_1.5px_#8B5CF6,0_2px_6px_rgba(124,58,237,0.25)]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );
}

export function CertificateBadge({ certificate, onOpen }: { certificate: CertificateState; onOpen: () => void }) {
  const { issued, count } = certificate;
  const n = issued ? Math.max(1, count) : 0;
  return (
    <span className="group/cert relative inline-flex">
      <button
        type="button"
        aria-label={issued && n > 1 ? `${certificate.title} (${n})` : certificate.title}
        onClick={(e) => { e.stopPropagation(); if (issued) onOpen(); }}
        style={{ cursor: issued ? "pointer" : "default" }}
        className={cn("inline-flex rounded-[0.7rem]", issued && "cert-badge")}
      >
        <CertificateMark issued={issued} count={n} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-30 mb-2.5 hidden w-64 rounded-xl bg-navy p-3 text-left text-[12.5px] font-medium normal-case leading-snug tracking-normal text-slate-50 shadow-[0_12px_30px_rgba(11,16,32,0.25)] group-focus-within/cert:block group-hover/cert:block"
      >
        <span className="mb-1.5 flex items-center gap-2">
          <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md", issued ? "bg-[rgba(167,139,250,0.22)] text-[#C4B5FD]" : "bg-[rgba(148,163,184,0.18)] text-[#94A3B8]")}><Award size={13} aria-hidden="true" /></span>
          <span className="font-extrabold">{certificate.title}</span>
        </span>
        <span className="block text-[#CBD5E1]">{certificate.reason}</span>
        {issued && <span className="mt-2 block font-bold text-[#DDD6FE]">{n > 1 ? `View all ${n} →` : "View certificate →"}</span>}
      </span>
    </span>
  );
}
