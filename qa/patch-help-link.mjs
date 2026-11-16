import fs from "node:fs";
const f = "../src/features/auth/components/user-menu.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf("            {/* The Help page is not in this app yet"); const b = s.indexOf("</a>", a) + 4;
if (a < 0) throw new Error("x");
s = s.slice(0, a) + `            <Link href="/help" role="menuitem" onClick={close} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-canvas">
              <LifeBuoy size={17} aria-hidden="true" className="shrink-0 text-ink-muted" /> Help
            </Link>` + s.slice(b);
s = s.replace(`import { DATA_SOURCE, PROTOTYPE_URL, SUPABASE_ANON_KEY`, `import { DATA_SOURCE, SUPABASE_ANON_KEY`);
fs.writeFileSync(f, s); console.log("ok");
