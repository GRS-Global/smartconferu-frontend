import fs from "node:fs";
const f = "../src/components/ui/modal.tsx"; let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("missing " + a.slice(0, 50)); s = s.replace(a, () => b); };
rep(`import { useId, type ReactNode } from "react";`, `import { useId, useSyncExternalStore, type ReactNode } from "react";`);
rep(`  const uid = useId();\n  return createPortal(`, `  const uid = useId();\n  // The window is drawn into <body>, which exists only in the browser: nothing is drawn while the page is rendered on the server.\n  const inBrowser = useSyncExternalStore(() => () => undefined, () => true, () => false);\n  if (!inBrowser) return null;\n  return createPortal(`);
fs.writeFileSync(f, s); console.log("ok");
