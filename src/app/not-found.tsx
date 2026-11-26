import { Home, House, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GoBackButton } from "@/components/go-back-button";

export const metadata: Metadata = { title: "Page not found" };

const SUPPORT_EMAIL = "support@smartconferu.com";

/** The page for an address that doesn't exist: the brand colours and a way back. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      {/* Soft brand glow behind the card. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute rounded-full" style={{ left: -120, top: -120, width: 420, height: 420, background: "var(--primary-soft-border)", opacity: 0.7, filter: "blur(64px)" }} />
        <div className="absolute rounded-full" style={{ right: -100, bottom: -150, width: 460, height: 460, background: "var(--accent)", opacity: 0.25, filter: "blur(80px)" }} />
      </div>

      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Link href="/" aria-label="Smartconferu home" className="inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small static logo */}
          <img src="/smartconferu-lockup.png" alt="Smartconferu" height={36} className="h-9 w-auto" />
        </Link>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="w-full max-w-[560px] rounded-3xl bg-white/90 p-8 text-center backdrop-blur sm:p-12">
          <p aria-hidden="true" style={{ backgroundImage: "linear-gradient(135deg, var(--primary), var(--secondary) 55%, var(--accent))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontSize: "clamp(88px, 18vw, 128px)", lineHeight: 1, letterSpacing: "-0.04em" }} className="select-none font-extrabold">404</p>
          <h1 className="mt-4 text-2xl font-extrabold text-navy sm:text-[28px]">We can&apos;t find that page</h1>
          <p className="mx-auto mt-3 max-w-[420px] text-sm leading-relaxed text-ink-muted">
            The address may be mistyped, or the page was moved or removed. If someone sent you this link, ask them to check it.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 32 }}>
            <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover">
              <Home size={16} aria-hidden="true" /> Go to My Conferences
            </Link>
            <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-navy transition-colors hover:bg-canvas">
              <House size={16} aria-hidden="true" /> Home
            </Link>
            <GoBackButton />
          </div>
        </div>
      </div>

      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-ink-muted">
        Still stuck? <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"><Mail size={12} aria-hidden="true" /> {SUPPORT_EMAIL}</a>
      </footer>
    </main>
  );
}
