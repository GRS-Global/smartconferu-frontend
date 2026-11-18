"use client";

import Image from "next/image";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { safeNext } from "@/lib/auth-redirect";
import { API_URL, AUTH_API, TERMS_VERSION } from "@/lib/config";
import { PRIVACY_URL, TERMS_URL } from "../legal-links";
import { GoogleIcon, MicrosoftIcon, OrcidIcon } from "./brand-icons";

/** `id` is the backend's provider id (GET /auth/providers); GR Connect has none yet. */
const SSO_BUTTONS = [
  { name: "Google", id: "google", Icon: GoogleIcon },
  { name: "ORCID", id: "orcid", Icon: OrcidIcon },
  { name: "Microsoft", id: "microsoft", Icon: MicrosoftIcon },
  { name: "GR Connect", id: null, Icon: () => <Image src="/gr-connect.png" alt="" width={18} height={18} aria-hidden="true" className="h-[18px] w-[18px] object-contain" /> },
];

const COMING_SOON = (name: string) => `${name} sign-in is coming soon — please use another option or your email for now.`;

/** The prototype's SsoButtons, shared by Sign in and Register: four round provider buttons with a hover label, then the one-line
 *  consent text. With the own backend (`api` mode) Google, ORCID and Microsoft start the provider's sign-in through the backend
 *  (GET /auth/oauth/<provider>/start); the provider sends the browser back to /auth/callback. A provider the backend has no keys
 *  for says so. Without the backend (or for GR Connect) a click says it is coming soon, as before. */
export function SsoButtons({ disabled = false }: { disabled?: boolean }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async (name: string, id: string | null) => {
    if (!AUTH_API || !id) { setNote(COMING_SOON(name)); return; }
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const { providers } = await api<{ providers: string[] }>("/auth/providers", { auth: false });
      if (!providers.includes(id)) { setNote(`${name} sign-in isn't set up on this server yet — please use another option.`); setBusy(false); return; }
      const next = safeNext(new URLSearchParams(window.location.search).get("next"));
      const query = new URLSearchParams({ returnTo: next, terms: TERMS_VERSION });
      // A full page load: the provider's sign-in page opens, then it returns to /auth/callback.
      window.location.assign(`${API_URL}/api/v1/auth/oauth/${id}/start?${query.toString()}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't start the sign-in — please try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-center gap-3">
        {SSO_BUTTONS.map(({ name, id, Icon }) => (
          <div key={name} className="group relative">
            <button
              type="button" disabled={disabled || busy} aria-label={`Continue with ${name}`}
              onClick={() => void start(name, id)}
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
