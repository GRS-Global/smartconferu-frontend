"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/** "Go back": the page before this one, or the dashboard when this tab has no earlier page. */
export function GoBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => { if (window.history.length > 1) router.back(); else router.push("/dashboard"); }}
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-canvas"
    >
      <ArrowLeft size={16} aria-hidden="true" /> Go back
    </button>
  );
}
