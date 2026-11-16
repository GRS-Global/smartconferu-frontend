import fs from "node:fs";
const f = "../src/features/chair/components/sections-rail.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf(`        <ul className="p-2">`); const b = s.indexOf(`        </ul>\n      </nav>`);
if (a < 0 || b < 0) throw new Error("block");
const block = `        <ul className="space-y-0.5 p-2">
          {sections.map((s) => {
            const on = active === s.id;
            const expandable = Boolean(s.children?.length);
            const isOpen = open.has(s.id);
            const toggle = () => setOpen((cur) => { const next = new Set(cur); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; });
            return (
              <li key={s.id} className={expandable ? "relative" : undefined}>
                {/* The expand arrow sits over the row's right edge, outside the jump button (no nested buttons). */}
                {expandable && <button type="button" onClick={toggle} aria-expanded={isOpen} aria-controls={\`\${s.id}-rail-items\`} aria-label={\`\${isOpen ? "Hide" : "Show"} \${s.label} list\`} title={isOpen ? "Hide list" : \`Show all \${s.children!.length}\`} className={\`absolute right-1.5 top-1.5 z-[1] flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary \${on || isOpen ? "text-primary" : "text-ink-muted"}\`}><ChevronDown size={15} aria-hidden="true" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} className="transition-transform duration-200" /></button>}
                <button type="button" aria-expanded={expandable ? isOpen : undefined} aria-current={on ? "location" : undefined} onClick={() => { setActive(s.id); jump(s.id); if (expandable) toggle(); }} style={{ boxShadow: on ? "inset 2px 0 0 var(--primary)" : "none" }} className={\`flex w-full cursor-pointer items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors \${on ? "bg-primary-soft" : "bg-transparent hover:bg-canvas"}\`}>
                  <span className="min-w-0"><span className={\`block text-[12.5px] font-semibold leading-snug \${on ? "text-primary" : "text-navy"}\`}>{s.label}</span>{s.meta && <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{s.meta}</span>}</span>
                  {s.count !== undefined && <span className="mt-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-ink-muted">{s.count}</span>}
                  {expandable ? <span className="w-7 shrink-0" aria-hidden="true" /> : s.tone ? <span style={{ background: s.tone.bg, color: s.tone.color }} className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">{s.tone.label}</span> : <ChevronRight size={14} aria-hidden="true" className={\`mt-0.5 shrink-0 \${on ? "text-primary" : "text-line-strong"}\`} />}
                </button>
                {expandable && isOpen && (
                  <ul id={\`\${s.id}-rail-items\`} style={{ borderLeft: "1px solid var(--border)" }} className="mb-1.5 ml-4 mt-1 space-y-0.5 pl-2">
                    {s.children!.map((c) => <li key={c.id}><button type="button" onClick={() => { setActive(s.id); const el = document.getElementById(c.id); if (!el) return; el.scrollIntoView({ behavior: "smooth", block: "center" }); el.animate?.([{ boxShadow: "0 0 0 3px rgba(124, 58, 237, 0.35)" }, { boxShadow: "0 0 0 3px rgba(124, 58, 237, 0)" }], { duration: 1600, delay: 350, easing: "ease-out" }); }} title={\`Go to “\${c.label}”\`} className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-canvas"><Mail size={12} aria-hidden="true" className={\`shrink-0 \${c.off ? "text-line-strong" : "text-ink-faint"}\`} /><span className={\`min-w-0 flex-1 truncate text-[11.5px] font-medium leading-snug group-hover:text-primary \${c.off ? "text-ink-faint" : "text-ink-soft"}\`}>{c.label}</span>{c.off && <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[9.5px] font-bold text-ink-muted">Off</span>}<ArrowRight size={11} aria-hidden="true" className="shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" /></button></li>)}
                  </ul>
                )}
              </li>
            );
          })}
`;
s = s.slice(0, a) + block + s.slice(b);
s = s.replace(`import { ChevronDown, ChevronRight, Check } from "lucide-react";`, `import { ArrowRight, ChevronDown, ChevronRight, Check, Mail } from "lucide-react";`);
s = s.replace(`children?: Array<{ id: string; label: string }>`, `children?: Array<{ id: string; label: string; /** Shown with an "Off" pill (the email is switched off). */ off?: boolean }>`);
s = s.replace(`useState<string | null>(null)`, `useState<Set<string>>(() => new Set())`);
s = s.replace(`<div className="text-[11px] text-ink-muted">{sub}</div>`, `<div className="mt-0.5 text-[11px] text-ink-muted">{sub}</div>`);
fs.writeFileSync(f, s); console.log("ok");
