import fs from "node:fs";
const f = "../src/features/settings/components/settings-modal.tsx"; let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("missing " + a.slice(0, 60)); s = s.replace(a, () => b); };
rep(`import { Bell, ChevronRight, KeyRound, Link2, MessageSquare, Settings, ShieldCheck, type LucideIcon } from "lucide-react";`, `import { Bell, ChevronRight, KeyRound, Link2, MessageSquare, Settings, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";`);
rep(`import { ChangePasswordModal } from "./change-password-card";`, `import { DeleteAccountModal, LinkedSignInModal } from "./account-modals";\nimport { ChangePasswordModal } from "./change-password-card";`);
rep(`  const [password, setPassword] = useState(false);`, `  const [dialog, setDialog] = useState<"password" | "linked" | "delete" | null>(null);`);
rep(`<ActionItem icon={KeyRound} title="Change password" subtitle="Update your login password" onClick={() => setPassword(true)} />`, `<ActionItem icon={KeyRound} title="Change password" subtitle="Update your login password" onClick={() => setDialog("password")} />
              <ActionItem icon={Link2} title="Linked sign-in methods" subtitle="Google, ORCID, Microsoft" onClick={() => setDialog("linked")} />
              <ActionItem icon={Trash2} title="Delete account" subtitle="Permanently remove your account and all its data" onClick={() => setDialog("delete")} danger />`);
rep(`{password && <ChangePasswordModal onClose={() => setPassword(false)} />}`, `{dialog === "password" && <ChangePasswordModal onClose={() => setDialog(null)} />}\n      {dialog === "linked" && <LinkedSignInModal onClose={() => setDialog(null)} />}\n      {dialog === "delete" && <DeleteAccountModal onClose={() => setDialog(null)} />}`);
rep(`   keeps the old value and an error shows if the write fails); Done closes the popup. Linked sign-in methods, Merge accounts and Delete account are
   not in this app yet: they need server-side account functions. */`, `   keeps the old value and an error shows if the write fails); Done closes the popup. Linked sign-in methods and Delete account are real (see
   account-modals.tsx). Not here: Merge accounts (moving one account's records into another across the whole database is not safe to build without a
   test database) and "Show my reviewer level and badges" (this app has no peer review recognition on the profile for it to switch). */`);
fs.writeFileSync(f, s); console.log("ok");
