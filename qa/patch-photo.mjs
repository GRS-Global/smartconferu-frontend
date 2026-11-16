// One-off edit helper: the profile photo window as the prototype's (Modal, cropper above the default avatars, Done, saved as it is done).
import fs from "node:fs";
const f = "../src/features/profile/components/photo-editor.tsx"; let s = fs.readFileSync(f, "utf8");
const cut = s.indexOf("const startValue = ");
if (cut < 0) throw new Error("tail not found");
s = s.slice(0, cut) + fs.readFileSync("new-photo-tail.txt", "utf8");
s = s.replace(`import { useSectionSave } from "../use-section-save";\n`, "").replace(`import type { PhotoValue } from "./photo-field";\nimport { SectionCard } from "./section-card";\n`, "").replace(`import type { Profile } from "@/types/profile";\n`, `import { Modal } from "@/components/ui/modal";\n`);
fs.writeFileSync(f, s);
const p = "../src/features/profile/components/profile-page.tsx"; let t = fs.readFileSync(p, "utf8");
const rep = (a, b) => { if (!t.includes(a)) throw new Error("missing " + a.slice(0, 60)); t = t.replace(a, () => b); };
rep(`<Dialog open={modal !== null} onClose={close}`, `<Dialog open={modal !== null && modal !== "photo"} onClose={close}`);
rep(`        {modal === "photo" && <PhotoEditor {...base} uploadPhoto={uploadPhoto} onDone={done("photo")} />}\n`, ``);
rep(`      {settingsOpen &&`, `      {modal === "photo" && <PhotoEditor {...base} uploadPhoto={uploadPhoto} onDone={done("photo")} />}\n      {settingsOpen &&`);
fs.writeFileSync(p, t); console.log("ok");
