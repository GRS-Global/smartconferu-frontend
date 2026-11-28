/* The right-hand panel of a two-column page (a checklist, a summary, actions): it stays in view while the page scrolls and, when it is taller than the
   screen, scrolls on its own. It sticks just under the app's top bar (64 px, sticky) with a 16 px gap, so it never slides beneath the bar, and it keeps
   16 px clear at the bottom. The 4 px padding (taken back by the negative margin) keeps the cards' shadows and focus rings from being cut off by its
   own scroll box. Use the variant whose breakpoint matches the one where the page's grid becomes two columns. Tailwind reads these strings from here. */

export const STICKY_SIDE_LG =
  "lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:-m-1 lg:p-1 side-scroll";

export const STICKY_SIDE_XL =
  "xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:-m-1 xl:p-1 side-scroll";
