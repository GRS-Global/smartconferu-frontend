// One-off edit helper: the guided tour in the conference shell: data-tour anchors on the menu, the "Take a tour" button (chair), the events the tour uses to open
// the menu, and the tour itself.
import fs from "node:fs";
const f = "../src/features/workspace/components/conference-shell.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b, all = false) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 80)); return; } s = all ? s.split(a).join(b) : s.replace(a, () => b); n++; };

// ItemLink: an optional data-tour anchor
rep("onNavigate, children, label, current }: { item: MenuLeaf;", "onNavigate, children, label, current, tour }: { item: MenuLeaf; tour?: string;");
rep("? <a href={href} aria-label={label} title={label} style={style} className={className}>{children}</a>", "? <a href={href} aria-label={label} title={label} style={style} className={className} data-tour={tour}>{children}</a>");
rep(": <Link href={href} aria-label={label} title={label} aria-current={on || current ? \"page\" : undefined} style={style} className={className} onClick={onNavigate}>{children}</Link>;", ": <Link href={href} aria-label={label} title={label} aria-current={on || current ? \"page\" : undefined} style={style} className={className} onClick={onNavigate} data-tour={tour}>{children}</Link>;");

// anchors: full menu (group buttons, children, leaves) and the rail
rep('<button type="button" onClick={() => toggle(item)} aria-expanded={open}', '<button type="button" onClick={() => toggle(item)} aria-expanded={open} data-tour={`nav-${item.key}`}');
rep('<ItemLink key={child.key} item={child} slug={slug} on={cOn}', '<ItemLink key={child.key} item={child} slug={slug} on={cOn} tour={`nav-${item.key}-${child.key}`}');
rep('<ItemLink key={item.key} item={item} slug={slug} on={on} onNavigate={() => setSideOpen(false)} style={on ? ACTIVE : undefined}', '<ItemLink key={item.key} item={item} slug={slug} on={on} tour={`nav-${item.key}`} onNavigate={() => setSideOpen(false)} style={on ? ACTIVE : undefined}');
rep('return <button key={item.key} type="button" aria-label={item.label} title={item.label} style={style} className={cls}', 'return <button key={item.key} type="button" aria-label={item.label} title={item.label} data-tour={`nav-${item.key}`} style={style} className={cls}');

// events the tour uses
rep("  useEffect(() => {\n    if (!sideOpen) return undefined;", `  // The guided tour points at menu items: it asks the shell to open a group, bring a hidden menu back, or open the drawer on a small screen.
  useEffect(() => {
    const openGroup = (e: Event) => { const key = (e as CustomEvent<string>).detail; setToggled((t) => ({ ...t, [key]: true })); };
    const expand = () => setCollapsed(false);
    const openDrawer = () => setSideOpen(true);
    window.addEventListener("conference-sidebar-open-group", openGroup);
    window.addEventListener("conference-sidebar-expand", expand);
    window.addEventListener("conference-sidebar-open", openDrawer);
    return () => { window.removeEventListener("conference-sidebar-open-group", openGroup); window.removeEventListener("conference-sidebar-expand", expand); window.removeEventListener("conference-sidebar-open", openDrawer); };
  }, []);
  useEffect(() => {
    if (!sideOpen) return undefined;`);

// Take a tour: rail icon + footer row (chair)
rep('            <Link href="/dashboard" aria-label="My Conferences" title="My Conferences" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft', '            {role === "chair" && <button type="button" onClick={() => startConferenceTour()} aria-label="Take a tour" title="Take a tour" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-primary transition-colors hover:bg-white"><HelpCircle size={18} aria-hidden="true" /></button>}\n            <Link href="/dashboard" aria-label="My Conferences" title="My Conferences" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft');
rep('          <div className="border-t border-[#E7E2F5] px-4 py-3">\n            <Link href="/dashboard" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5', '          <div className="border-t border-[#E7E2F5] px-4 py-3">\n            {role === "chair" && <button type="button" onClick={() => { setSideOpen(false); startConferenceTour(); }} data-tour="take-tour" className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold text-primary transition-colors hover:bg-white"><HelpCircle size={15} className="shrink-0" aria-hidden="true" /> Take a tour</button>}\n            <Link href="/dashboard" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5');

// the tour itself (chair only), next to the sidebar-open scrim
rep('      {sideOpen && <div aria-hidden="true" onClick={() => setSideOpen(false)}', '      {role === "chair" && <ConferenceTour slug={slug} acronym={conference.acronym} conferenceName={conference.name} />}\n      {sideOpen && <div aria-hidden="true" onClick={() => setSideOpen(false)}');
fs.writeFileSync(f, s); console.log("applied", n);
