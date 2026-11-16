"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PasswordField } from "@/components/ui/password-field";
import { AccountBlockedError, deleteMyAccount, linkedProviders } from "@/services/account";

/* Security & Settings › Account & Security: the prototype's two account popups, made real. */

// What the account's sign-in methods are called; "azure" is Microsoft, and ORCID may arrive under either name.
const PROVIDER_OF: Record<string, string> = { google: "Google", azure: "Microsoft", orcid: "ORCID", "custom:orcid": "ORCID" };

/** Linked Sign-in Methods: the email sign-in and the four providers, with what is actually linked to this account. Linking a provider needs
 *  provider sign-in to be switched on for the site (it is not yet: the sign-in page says "coming soon"), so "Connect" says so, as that page does. */
export function LinkedSignInModal({ onClose }: { onClose: () => void }) {
  const [linked, setLinked] = useState<string[] | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => { let alive = true; void linkedProviders().then((p) => { if (alive) setLinked(p); }); return () => { alive = false; }; }, []);
  const names = new Set((linked ?? []).map((p) => PROVIDER_OF[p]).filter(Boolean));
  const rows = [
    { name: "Email and password", on: (linked ?? []).includes("email") },
    ...["Google", "ORCID", "Microsoft", "GR Connect"].map((name) => ({ name, on: names.has(name) })),
  ];
  return (
    <Modal title="Linked Sign-in Methods" onClose={onClose}>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5">
            <span className="text-sm font-medium text-ink-soft">{r.name}</span>
            {linked === null ? <span className="text-xs text-ink-faint">…</span>
              : r.on ? <span className="flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} aria-hidden="true" /> Connected</span>
                : r.name === "Email and password" ? null
                  : <button type="button" onClick={() => setNote(`${r.name} sign-in is coming soon — it can't be linked to your account yet.`)} className="cursor-pointer text-xs font-semibold text-primary hover:underline">Connect</button>}
          </div>
        ))}
      </div>
      {note && <p role="status" className="mt-3 text-xs text-ink-muted">{note}</p>}
    </Modal>
  );
}

const MERGE_INPUT = "w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary";
const MERGE_LABEL = "mb-1 block text-xs font-semibold text-ink-soft";

/** Account Merge, the prototype's popup (design only): the explanation, the irreversible warning and the three boxes. Merging itself is not switched
 *  on yet, so pressing the button checks the boxes and says so — nothing is read or changed. */
export function MergeAccountsModal({ onClose }: { onClose: () => void }) {
  const [mine, setMine] = useState("");
  const [email, setEmail] = useState("");
  const [theirs, setTheirs] = useState("");
  const [note, setNote] = useState("");
  const submit = () => {
    if (!mine || !email.trim() || !theirs) { setNote("Fill in all three boxes."); return; }
    setNote("Merging accounts isn't switched on yet — nothing was changed.");
  };
  return (
    <Modal title="Account Merge" onClose={onClose}>
      <p className="mb-3 text-sm leading-relaxed text-ink-muted">If you have more than one account, you can merge them into one. The email addresses on both accounts will be associated with the new merged account. As a result of a merge, the second account will disappear and all its data will be added to this account.</p>
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-[var(--danger-border-soft,#FECACA)] bg-danger-soft p-3">
        <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
        <p className="text-xs font-medium text-danger">Merging is irreversible: you will not be able to split the account back into two after the merge.</p>
      </div>
      <div className="space-y-3">
        <div><label htmlFor="mg-mine" className={MERGE_LABEL}>Password for this account *</label><PasswordField id="mg-mine" label="password" autoComplete="current-password" value={mine} onChange={(e) => { setMine(e.target.value); setNote(""); }} className={MERGE_INPUT} /></div>
        <div><label htmlFor="mg-email" className={MERGE_LABEL}>Email address of the second account *</label><input id="mg-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setNote(""); }} className={MERGE_INPUT} /></div>
        <div><label htmlFor="mg-theirs" className={MERGE_LABEL}>Password for the second account *</label><PasswordField id="mg-theirs" label="password" autoComplete="current-password" value={theirs} onChange={(e) => { setTheirs(e.target.value); setNote(""); }} className={MERGE_INPUT} /></div>
      </div>
      {note && <p role="status" className="mt-4 text-xs font-semibold text-ink-muted">{note}</p>}
      <button type="button" onClick={submit} className="mt-5 w-full cursor-pointer rounded-lg bg-danger py-2.5 text-sm font-semibold text-white">Merge Accounts</button>
    </Modal>
  );
}

/** Delete Account: type DELETE, and the account is deleted by the server unless it still owns records that belong to conferences (then the
 *  person is told which). On success the person is sent to the sign-in page. */
export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blockers, setBlockers] = useState<string[]>([]);
  const can = text.trim().toUpperCase() === "DELETE" && !busy;
  const run = async () => {
    if (!can) return;
    setBusy(true); setError(""); setBlockers([]);
    try {
      await deleteMyAccount(text.trim());
      router.replace("/login");
      router.refresh();
    } catch (e) {
      if (e instanceof AccountBlockedError) setBlockers(e.blockers);
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      setBusy(false);
    }
  };
  return (
    <Modal title="Delete Account" onClose={() => { if (!busy) onClose(); }}>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--danger-border-soft,#FECACA)] bg-danger-soft p-3">
        <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
        <p className="text-xs font-medium leading-relaxed text-danger">This permanently deletes your account and profile. This can&apos;t be undone.</p>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-ink-muted">Type <span className="font-bold">DELETE</span> below to confirm.</p>
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void run(); } }} placeholder="DELETE" aria-label="Type DELETE to confirm" className="mb-5 w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-danger" />
      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-canvas p-3 text-xs text-ink-soft">
          <p className="font-semibold text-danger">{error}</p>
          {blockers.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
          {blockers.length > 0 && <p className="mt-1.5 text-ink-muted">These belong to the conferences&apos; own records, so deleting the account would not remove them. Ask the conference chair or Smartconferu to deal with them first.</p>}
        </div>
      )}
      <button type="button" onClick={() => void run()} disabled={!can} className={`w-full cursor-pointer rounded-lg py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed ${can ? "bg-danger text-white" : "bg-muted text-ink-faint"}`}>{busy ? "Deleting…" : "Delete My Account"}</button>
    </Modal>
  );
}
