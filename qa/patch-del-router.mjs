import fs from "node:fs";
const f = "../src/features/settings/components/account-modals.tsx"; let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("missing " + a.slice(0, 60)); s = s.replace(a, () => b); };
rep(`import { useEffect, useState } from "react";`, `import { useRouter } from "next/navigation";\nimport { useEffect, useState } from "react";`);
rep(`  const [text, setText] = useState("");\n  const [busy`, `  const router = useRouter();\n  const [text, setText] = useState("");\n  const [busy`);
rep(`      window.location.assign("/login");`, `      router.replace("/login");\n      router.refresh();`);
fs.writeFileSync(f, s); console.log("ok");
