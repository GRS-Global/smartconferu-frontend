import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const d = "../src/features/chair/components/";
edit(d + "submission-settings-panel.tsx", [
  [`onOpenForm, before, after, leadSections`, `onOpenForm, before, after, below, leadSections`],
  [`/** Content under them (Conference Settings adds the emails). */ a`, `/** Content under the whole two-column layout, full width (Conference Settings adds the emails). */ below?: ReactNode; /** Content under the cards in the left column. */ a`],
  [`  return (\n    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">`, `  return (\n    <>\n    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">`],
  [`      />\n    </div>\n  );\n}`, `      />\n    </div>\n    {below && <div className="mt-6">{below}</div>}\n    </>\n  );\n}`],
]);
edit(d + "submission-settings-page.tsx", [
  [`          after={<>\n            <EmailsPanel`, `          below={<>\n            <EmailsPanel`],
]);
edit(d + "policy-cards.tsx", [
  [`className="scroll-mt-24 rounded-2xl bg-white p-6">\n      <div className="mb-4 flex items-start gap-3">\n        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><Clock size={16} aria-hidden="true" /></span>\n        <div><h2 className="text-base font-extrabold text-navy">{title}</h2>`, `className="scroll-mt-24 rounded-2xl bg-white p-5">\n      <div className="mb-4 flex items-start gap-3">\n        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><Clock size={16} aria-hidden="true" /></span>\n        <div><h3 className="text-sm font-bold text-navy">{title}</h3>`],
]);
console.log("applied", n);
