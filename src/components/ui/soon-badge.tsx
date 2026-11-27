import { Sparkles } from "lucide-react";

/** The animated "Coming soon" pill of a menu item that is not open yet: a gradient with a light that sweeps across it (globals.css
 *  .soon-badge; still for people who ask for reduced motion). Used by the conference sidebar and the top menu. */
export function SoonBadge() {
  return (
    <span className="soon-badge inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-extrabold uppercase leading-none tracking-[0.06em]">
      <Sparkles size={10} strokeWidth={2.6} aria-hidden="true" className="relative z-[2]" />
      <span className="relative z-[2]">Soon</span>
    </span>
  );
}

/** The same on an icon-only menu: a small pulsing dot on the icon's corner (the parent is `relative`). */
export function SoonDot() {
  return <span aria-hidden="true" className="soon-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white" />;
}
