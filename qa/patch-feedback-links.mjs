import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 80)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const S = "../src/features/";
edit(S + "workspace/menus.ts", [[`{ key: "feedback", label: "Feedback", icon: MessageSquare, ...p((s) => \`/author/\${e(s)}/feedback\`) },`, `{ key: "feedback", label: "Feedback", icon: MessageSquare, app: (s) => \`/author/\${e(s)}/feedback\` },`]]);
edit(S + "author/links.ts", [[`  feedback: (slug: string): Dest | null => (slugOk(slug) ? toProto(\`/prototype/author/\${encodeURIComponent(slug)}/feedback\`) : null),`, `  /** Feedback: a page of this app. */\n  feedback: (slug: string): Dest | null => (slugOk(slug) ? { href: \`/author/\${encodeURIComponent(slug)}/feedback\`, external: false } : null),`]]);
console.log("applied", n);
