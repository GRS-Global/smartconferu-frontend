# Colours

Source: prototype `src/shared/theme.js` `TOKENS`; Next.js `src/styles/tokens.css`. Used in the prototype as `var(--name)`; in Next.js as Tailwind utilities (`bg-primary`, `text-ink-muted`, `border-line` …) or `var(--name)`.

| Token | Value | Next.js utility |
|---|---|---|
| primary / hover / soft / soft-hover / soft-border | #7C3AED / #6D28D9 / #F5F3FF / #EDE9FE / #DDD6FE | `primary`, `primary-hover`, `primary-soft*` |
| secondary / soft | #A21CAF / #FAE8FF | `secondary*` |
| accent | #06B6D4 | `accent` |
| navy | #0B1020 | `navy` |
| canvas / card / muted | #F8FAFC / #FFFFFF / #F1F5F9 | `canvas`, `card`, `muted` |
| row-hover / table-row-alt / table-row-hover | #F9FBFD / #F3F6FB / #E8EEF7 | `row-hover`, `table-alt`, `table-hover` |
| border / border-strong | #E2E8F0 / #CBD5E1 | `line`, `line-strong` |
| text / soft / muted / faint | #1E293B / #475569 / #64748B / #94A3B8 | `ink`, `ink-soft`, `ink-muted`, `ink-faint` |
| success / soft | #16A34A / #EAF7EE | `success*` |
| warning / soft | #D97706 / #FEF3E2 | `warning*` |
| danger / soft | #DC2626 / #FDEDED | `danger*` |
| cat-virtual / soft | #0E7490 / #ECFEFF | `cat-virtual*` |
| shadow-card | 0 1px 2px rgba(11,16,32,.04), 0 4px 20px rgba(11,16,32,.05) | `shadow-card` |
| shadow-pop | 0 16px 40px rgba(11,16,32,.12) | `shadow-pop` |

## In the prototype but NOT yet in `tokens.css` (add when a ported page needs them; do not invent values)
on-dark / on-dark-soft / on-dark-faint (rgba white .85/.6/.45), warning-soft-2 #FEF3C7, warning-border #FDE68A, danger-hover #B91C1C, danger-border #EB9898, danger-300 #FCA5A5, danger-border-soft #F8CFCF, cat-physical* (#B45309 / #FEF3E7 / #F3D9AE), cat-virtual-border #A8E6F0, gradient-primary, gradient-dark (135deg #0B1020 → #2E1065 → #4C1D95 → #6D28D9). Rest of `TOKENS` beyond line 90 of theme.js: **not yet reviewed**.

Colour-blind mode swaps success/warning/danger (`:root[data-colorblind]`); matches the prototype's `COLORBLIND_TOKENS`.
Hover/active/focus colours per component: **unknown, to be extracted** (see `COMPONENTS.md`).
