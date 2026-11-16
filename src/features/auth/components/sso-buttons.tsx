"use client";

import Image from "next/image";
import { useState } from "react";
import { PRIVACY_URL, TERMS_URL } from "../legal-links";
import { GoogleIcon, MicrosoftIcon, OrcidIcon } from "./brand-icons";

const SSO_BUTTONS = [
  { name: "Google", Icon: GoogleIcon },
  { name: "ORCID", Icon: OrcidIcon },
  { name: "Microsoft", Icon: MicrosoftIcon },
  { name: "GR Connect", Icon: () => <Image src="/gr-connect.png" alt="" width={18} height={18} aria-hidden="true" className="h-[18px] w-[18px] object-contain" /> },
];

/** The prototype's SsoButtons, shared by Sign in and Register: four round provider buttons with a hover label, then the one-line
 *  consent text. Provider sign-in is not available in this app yet, so a click says so (the prototype does the same for a provider
 *  that is not configured); the buttons and wording are otherwise the prototype's. */
export function SsoButtons({ disabled = false }: { disabled?: boolean }) {
  const [note, setNote] = useState("");
  return (
    <>
      <div className="mb-3 flex items-center justify-center gap-3">
        {SSO_BUTTONS.map(({ name, Icon }) => (
          <div key={name} className="group relative">
            <button
              type="button" disabled={disabled} aria-label={`Continue with ${name}`}
              onClick={() => setNote(`${name} sign-in is coming soon — please use another option or your email for now.`)}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-line transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
            >
              <Icon />
            </button>
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">{name}</span>
          </div>
        ))}
      </div>
      {note && <p role="status" className="mb-2 text-center text-xs text-ink-muted">{note}</p>}
      <p className="text-center text-[11px] leading-relaxed text-ink-faint">
        By continuing with Google, Microsoft, ORCID or GR Connect, you agree to the Smartconferu{" "}
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Terms of Service</a> and{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Privacy Policy</a>.
      </p>
    </>
  );
}
