"use client";
/* A Super Admin's read-only "View as" (lib/support-view.ts):
   SupportViewStart — the /support-view page: takes the token from the link, then opens the page asked
     for; or says the view has ended.
   SupportViewBanner — on every page while the view is on: who it is, read-only, a countdown, End view. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { endSupportView, readSupportView, startSupportView } from "@/lib/support-view";

const SAFE_NEXT = /^\/(?!\/)[\w\-/.]*$/;

export function SupportViewStart() {
  const [ended] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ended") === "1");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (ended) return;
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = p.get("token");
    const name = p.get("name");
    const until = p.get("until");
    const next = p.get("next") ?? "/dashboard";
    if (!token || !name || !until || Number.isNaN(Date.parse(until))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the link is read once, on arrival
      setError("This support link is incomplete. Open it again from the admin console.");
      return;
    }
    startSupportView({ token, name, until });
    // A full load, so the app starts with the view's token and never with this browser's own sign-in.
    window.location.replace(SAFE_NEXT.test(next) ? next : "/dashboard");
  }, [ended]);
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <p className="text-lg font-semibold text-ink">{ended ? "The support view has ended" : error ? "Can't open the support view" : "Opening the read-only view…"}</p>
        <p className="mt-2 text-sm text-ink-soft">{ended ? "Its 30 minutes are over, or it was closed. Start a new one from the admin console if you need it." : (error ?? "One moment.")}</p>
      </div>
    </main>
  );
}

const subscribe = (fn: () => void) => {
  const t = setInterval(fn, 1000);
  return () => clearInterval(t);
};

export function SupportViewBanner() {
  // Re-read every second: the countdown, and the end when it runs out.
  const now = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => 0);
  const view = now ? readSupportView() : null;
  useEffect(() => {
    if (!view && now && typeof window !== "undefined" && window.sessionStorage.getItem("sc.supportView")) endSupportView();
  }, [view, now]);
  if (!view) return null;
  const left = Math.max(0, Math.floor(Date.parse(view.until) / 1000) - now);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div role="status" className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] font-medium text-white" style={{ background: "#7C3AED" }}>
      <span>
        <b>Read-only support view</b> — you&apos;re seeing Smartconferu as <b>{view.name}</b>. Nothing can be saved or sent.
      </span>
      <span className="tabular-nums opacity-90">
        Ends in {mm}:{ss}
      </span>
      <button type="button" onClick={() => endSupportView()} className="rounded-md bg-white/15 px-2.5 py-1 font-semibold hover:bg-white/25 cursor-pointer">
        End view
      </button>
    </div>
  );
}
