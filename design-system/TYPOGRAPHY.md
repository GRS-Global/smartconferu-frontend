# Typography

- Family: **Plus Jakarta Sans** (400/500/600/700/800), fallback `sans-serif`. Prototype loads it from Google Fonts (`FONT_IMPORT` in theme.js); Next.js via `next/font/google` in `src/app/layout.tsx` (`--font-jakarta`).
- Display serif **Cormorant Garamond** is for printed certificate artwork only (`SERIF_FAMILY`). Not used in app chrome.
- Body text colour `--text`/`ink` #1E293B; background `canvas` #F8FAFC; antialiased.
- Corner radius everywhere: `0.7rem` (Tailwind `rounded-lg/xl/2xl/3xl`); `rounded-full` for pills/avatars.
- Sizes/weights are set per element with Tailwind classes in the prototype (`text-sm`, `text-xs font-semibold`, `text-base font-bold` …). A per-element table (page titles, section titles, labels, helper text, table headers) **has not been extracted yet**: run `node qa/extract-styles.mjs` (planned, see `qa/README.md`) and fill it in. Do not guess.
- Examples read from the prototype source: table header cells `text-xs font-semibold` in `--text-muted`; card titles `text-sm font-semibold`; section headings `text-base font-bold` in `--navy`.
