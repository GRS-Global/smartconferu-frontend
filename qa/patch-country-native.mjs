import fs from "node:fs";
const f = "../src/features/chair/components/conference-details-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = `<select id="cd-country" value={f.country} onChange={(ev) => set("country", ev.target.value)} style={CHEVRON} className={selectCls(f.country)}>`;
const b = `<select id="cd-country" value={f.country} onChange={(ev) => set("country", ev.target.value)} className={cn(INPUT_CLASS, "cursor-pointer bg-white", !f.country && "text-ink-faint")}>`;
if (!s.includes(a)) throw new Error("missing"); fs.writeFileSync(f, s.replace(a, () => b)); console.log("ok");
