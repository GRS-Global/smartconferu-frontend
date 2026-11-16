import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.split(a).join(b); n++; } fs.writeFileSync(file, s); };
const S = "../src/features/profile/";
edit(S + "components/profile-page.tsx", [
  [`export function ProfilePage() {`, `export function ProfilePage({ openSettings = false }: { openSettings?: boolean }) {`],
  [`  const [sharing, setSharing] = useState(false);\n`, `  const [sharing, setSharing] = useState(false);\n  // Security & Settings is a popup over the profile; "/settings" opens the profile with it showing.\n  const [settingsOpen, setSettingsOpen] = useState(openSettings);\n  const closeSettings = () => { setSettingsOpen(false); if (typeof window !== "undefined" && window.location.search) window.history.replaceState(null, "", "/profile"); };\n`],
  [`    share: () => setSharing(true),\n`, `    share: () => setSharing(true),\n    settings: () => setSettingsOpen(true),\n`],
  [`      {sharing && <ShareDialog`, `      {settingsOpen && <SecuritySettingsModal profile={profile} save={save} onClose={closeSettings} onAddPhone={open("phone")} />}\n      {sharing && <ShareDialog`],
  [`import { ShareDialog } from "./share-dialog";`, `import { SecuritySettingsModal } from "@/features/settings/components/settings-modal";\nimport { ShareDialog } from "./share-dialog";`],
]);
edit(S + "showcase/profile-showcase.tsx", [
  [`hint="Password, notifications and display." href="/settings" primary />`, `hint="Password, notifications and display." onClick={edit.settings} primary />`],
  [`hint="Password, notifications and display." href="/settings" primary size={32} />`, `hint="Password, notifications and display." onClick={edit.settings} primary size={32} />`],
]);
console.log("applied", n);
