import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 80)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const S = "../src/";
edit(S + "types/profile.ts", [[`  publicProfileEnabled: boolean;`, `  publicProfileEnabled: boolean;\n  /** Privacy: show the reviewer level and badges ("Peer review recognition") on the profile. Only the setting is kept so far. */\n  showReviewerAchievements: boolean;`]]);
edit(S + "services/supabase/profile.ts", [[`    publicProfileEnabled: bool(d.publicProfileEnabled),`, `    publicProfileEnabled: bool(d.publicProfileEnabled),\n    showReviewerAchievements: bool(d.showReviewerAchievements),`]]);
edit(S + "features/settings/components/account-modals.tsx", [
  [`import { AccountBlockedError,`, `import { PasswordField } from "@/components/ui/password-field";\nimport { AccountBlockedError,`],
  [`/** Delete Account:`, `const MERGE_INPUT = "w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary";
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

/** Delete Account:`],
]);
edit(S + "features/settings/components/settings-modal.tsx", [
  [`import { Bell, ChevronRight, KeyRound,`, `import { Bell, ChevronRight, GitMerge, KeyRound,`],
  [`import { DeleteAccountModal, LinkedSignInModal } from "./account-modals";`, `import { DeleteAccountModal, LinkedSignInModal, MergeAccountsModal } from "./account-modals";`],
  [`useState<"password" | "linked" | "delete" | null>(null)`, `useState<"password" | "linked" | "merge" | "delete" | null>(null)`],
  [`              <ActionItem icon={Trash2}`, `              <ActionItem icon={GitMerge} title="Merge accounts" subtitle="Combine two accounts into one" onClick={() => setDialog("merge")} danger />\n              <ActionItem icon={Trash2}`],
  [`      {dialog === "delete" &&`, `      {dialog === "merge" && <MergeAccountsModal onClose={() => setDialog(null)} />}\n      {dialog === "delete" &&`],
  [`              <Switch labelledBy="pub-title" checked={profile.publicProfileEnabled} onChange={(v) => void write({ publicProfileEnabled: v })} />
            </div>`, `              <Switch labelledBy="pub-title" checked={profile.publicProfileEnabled} onChange={(v) => void write({ publicProfileEnabled: v })} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-muted pt-4">
              <div className="min-w-0">
                <div id="rev-title" className="text-sm font-semibold text-ink">Show my reviewer level and badges</div>
                <div className="mt-0.5 text-xs text-ink-faint">Adds &quot;Peer review recognition&quot; to your profile — never which papers or conferences you reviewed, or your scores.</div>
              </div>
              <Switch labelledBy="rev-title" checked={profile.showReviewerAchievements} onChange={(v) => void write({ showReviewerAchievements: v })} />
            </div>`],
]);
console.log("applied", n);
