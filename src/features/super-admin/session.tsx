"use client";
/* The Super Admin's session: restored from the API's refresh cookie on load, required for every
   console page (otherwise → /super-admin/login?next=…). Separate from the user app's Supabase session. */
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onSessionEnded } from "./api";
import { loadMe, resumeAdminSession, signOut as apiSignOut, type Me } from "./services";
import { Loading } from "./components/ui";

interface AdminSession {
  me: Me;
  name: string;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AdminSession | null>(null);

export function useAdmin(): AdminSession {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin outside AdminSessionProvider");
  return v;
}

export const loginPath = (next?: string) => `/super-admin/login${next && next !== "/super-admin" ? `?next=${encodeURIComponent(next)}` : ""}`;

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    resumeAdminSession()
      .then(async (ok) => {
        if (!live) return;
        if (!ok) {
          router.replace(loginPath(pathname));
          return;
        }
        setMe(await loadMe());
      })
      .catch((e: unknown) => live && setFailed(e instanceof Error ? e.message : "Couldn't reach the API."));
    return () => {
      live = false;
    };
    // Only on first load; pages keep the session afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => onSessionEnded(() => router.replace(`${loginPath(pathname)}${pathname === "/super-admin" ? "?" : "&"}reason=expired`)), [router, pathname]);

  const signOut = useCallback(async () => {
    await apiSignOut().catch(() => undefined);
    router.replace("/super-admin/login");
  }, [router]);

  if (failed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="font-semibold" style={{ color: "var(--text)" }}>
            Couldn&apos;t open the admin console
          </p>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-muted)" }}>
            {failed}
          </p>
        </div>
      </div>
    );
  }
  if (!me) return <Loading label="Checking your admin session…" />;
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email || "Super Admin";
  return <Ctx.Provider value={{ me, name, signOut }}>{children}</Ctx.Provider>;
}
