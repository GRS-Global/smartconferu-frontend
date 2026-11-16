// One-off edit helper: the data-tour anchors the guided tour points at (the prototype's data-tour names) on the Conference Settings pages.
import fs from "node:fs";
let n = 0;
const d = "../src/features/chair/components/";
const edit = (f, pairs) => { let s = fs.readFileSync(d + f, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", f, a.slice(0, 80)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(d + f, s); };

edit("conference-details-page.tsx", [
  ['<div id="cd-identity" className="scroll-mt-24 space-y-4">', '<div id="cd-identity" data-tour="cd-identity" className="scroll-mt-24 space-y-4">'],
  ['<div><label htmlFor="cd-abs"', '<div data-tour="cd-abstract-deadline"><label htmlFor="cd-abs"'],
  ['<div><label htmlFor="cd-sub"', '<div data-tour="cd-submission-deadline"><label htmlFor="cd-sub"'],
  ['<div id="cd-about" className="scroll-mt-24 space-y-4">', '<div id="cd-about" data-tour="cd-about" className="scroll-mt-24 space-y-4">'],
  ['<div id="cd-topics" className="scroll-mt-24 border-t border-muted pt-4">', '<div id="cd-topics" data-tour="cd-topics" className="scroll-mt-24 border-t border-muted pt-4">'],
  ['<div><label htmlFor="cd-lang"', '<div data-tour="cd-language"><label htmlFor="cd-lang"'],
  ['<Button disabled={!ok || busy} onClick={() => onSave(f)}>{busy ? "Saving…" : "Update Conference"}</Button>', '<span data-tour="cd-save" className="inline-flex"><Button disabled={!ok || busy} onClick={() => onSave(f)}>{busy ? "Saving…" : "Update Conference"}</Button></span>'],
]);
// the two area selects share a row: the tour points at the row
let c = fs.readFileSync(d + "conference-details-page.tsx", "utf8");
const lines = c.split("\n");
const i = lines.findIndex((l) => l.includes('htmlFor="cd-a1"'));
if (i > 0 && lines[i - 1].includes('<div className="grid gap-4 sm:grid-cols-2">')) { lines[i - 1] = lines[i - 1].replace('<div className="grid gap-4 sm:grid-cols-2">', '<div data-tour="cd-classification" className="grid gap-4 sm:grid-cols-2">'); n++; } else console.log("MISSING classification row");
fs.writeFileSync(d + "conference-details-page.tsx", lines.join("\n"));

edit("submission-settings-panel.tsx", [['<section id={`ss-${id}`} style={CARD}', '<section id={`ss-${id}`} data-tour={`ss-${id}`} style={CARD}']]);
edit("submission-settings-page.tsx", [['<div id="ss-screening" className="mb-6 scroll-mt-24">', '<div id="ss-screening" data-tour="ss-screening" className="mb-6 scroll-mt-24">']]);
// Review settings: the prototype's rv-* names for the cards
edit("review-settings-page.tsx", [
  ['<section id={id} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">', '<section id={id} data-tour={id?.replace("rs-period", "rv-window").replace(/^rs-/, "rv-")} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">'],
  ['<div id="rs-instructions" className="scroll-mt-24 space-y-3">', '<div id="rs-instructions" data-tour="rv-instructions" className="scroll-mt-24 space-y-3">'],
]);
edit("policy-cards.tsx", [['<section id={id} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">', '<section id={id} data-tour={id?.replace(/^rs-/, "rv-")} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">']]);
edit("decision-settings-page.tsx", [
  ['<section id="dc-types" style={CARD}', '<section id="dc-types" data-tour="dc-types" style={CARD}'],
  ['<Button size="sm" onClick={openAdd} disabled={busy}>', '<Button size="sm" data-tour="dc-add" onClick={openAdd} disabled={busy}>'],
]);
edit("email-templates-page.tsx", [
  ['<div role="tablist" aria-label="Filter email templates by module"', '<div data-tour="et-tabs" role="tablist" aria-label="Filter email templates by module"'],
  ['<button type="button" onClick={openNew} disabled={busy}', '<button type="button" data-tour="et-create" onClick={openNew} disabled={busy}'],
]);
console.log("applied", n);
