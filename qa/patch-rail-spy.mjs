// One-off edit helper: the Sections rail follows the page as it scrolls (the prototype's scroll-spy) and pulses the section it jumps to.
import fs from "node:fs";
const f = "../src/features/chair/components/sections-rail.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, () => b); n += 1; };
rep('import { useState, type ReactNode } from "react";', 'import { useEffect, useState, type ReactNode } from "react";');
rep('const jump = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };', `/** Scrolls so the section sits just under the header, and pulses it (the prototype's jump). */
const jump = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: "smooth" });
  el.animate?.([{ boxShadow: "0 0 0 4px rgba(124, 58, 237, 0.22)" }, { boxShadow: "0 0 0 4px rgba(124, 58, 237, 0)" }], { duration: 1400, delay: 350, easing: "ease-out" });
};`);
rep('  const [active, setActive] = useState(sections[0]?.id ?? "");', `  const [active, setActive] = useState(sections[0]?.id ?? "");
  const ids = sections.map((x) => x.id).join("|");
  // The active section is the last one whose top has passed the header; at the very bottom of the page it is the last one.
  useEffect(() => {
    const list = ids.split("|").filter(Boolean);
    const onScroll = () => {
      let cur = list[0];
      list.forEach((id) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 140) cur = id; });
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = list[list.length - 1];
      setActive(cur);
    };
    // Capture: the page may scroll inside a container, whose scroll events do not bubble.
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    onScroll();
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [ids]);`);
fs.writeFileSync(f, s); console.log("applied", n);
