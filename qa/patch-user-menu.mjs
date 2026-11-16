import fs from "node:fs";
const f = "../src/features/auth/components/user-menu.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 90)); return; } s = s.replace(a, () => b); n++; };
rep(`import { Check, ChevronDown, ChevronRight, LogOut, Settings, UserRound } from "lucide-react";`, `import { Check, ChevronDown, ChevronRight, LifeBuoy, Power, ShieldCheck, UserCog } from "lucide-react";`);
rep(`import { DATA_SOURCE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";`, `import { DATA_SOURCE, PROTOTYPE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";`);
// trigger
const a = s.indexOf(`      <button\n        type="button"\n        onClick={() => setOpen((o) => !o)}\n        aria-haspopup="menu"`);
const b = s.indexOf(`    </div>\n  );\n}`, a);
if (a < 0 || b < 0) throw new Error("menu block");
s = s.slice(0, a) + `      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={\`Account menu, signed in as \${fullName || email}\`}
        title={fullName || email}
        style={{ boxShadow: open || pathname.startsWith("/profile") ? "0 0 0 2px var(--primary)" : "none" }}
        className="flex cursor-pointer items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1 transition-colors hover:bg-canvas"
      >
        <ProfileAvatar photoUrl={profile?.photoUrl ?? ""} initials={initials} size={34} />
        {/* The ▾ that says this opens a menu; it turns over while the menu is open. */}
        <ChevronDown size={14} aria-hidden="true" className={cn("shrink-0 text-primary transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-line bg-white p-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <ProfileAvatar photoUrl={profile?.photoUrl ?? ""} initials={initials} size={52} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-navy">{fullName || "Your account"}</div>
              <div className="truncate text-xs text-ink-muted">{email}</div>
              {profile?.designation && <div className="truncate text-[11px] text-ink-faint">{profile.designation}</div>}
            </div>
          </div>
          <div className="border-b border-line py-2">
            <Link href="/profile" role="menuitem" onClick={close} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors hover:bg-canvas", pathname.startsWith("/profile") ? "text-primary" : "text-ink")}>
              <UserCog size={17} aria-hidden="true" className={cn("shrink-0", pathname.startsWith("/profile") ? "text-primary" : "text-ink-muted")} /> My Profile
            </Link>
            <Link href="/settings" role="menuitem" onClick={close} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-canvas">
              <ShieldCheck size={17} aria-hidden="true" className="shrink-0 text-ink-muted" /> Security &amp; Settings
            </Link>
            {/* The Help page is not in this app yet: it opens on the prototype. */}
            <a href={\`\${PROTOTYPE_URL}/prototype/help\`} role="menuitem" onClick={close} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-canvas">
              <LifeBuoy size={17} aria-hidden="true" className="shrink-0 text-ink-muted" /> Help
            </a>
          </div>
          <button type="button" role="menuitem" onClick={signOut} disabled={busy} className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60">
            <Power size={17} aria-hidden="true" className="shrink-0" /> {busy ? "Logging out…" : "Log Out"}
          </button>
        </div>
      )}
` + s.slice(b);
n++;
fs.writeFileSync(f, s); console.log("applied", n);
