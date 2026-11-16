# Shared Next.js components (inventory)

Located in `src/components/`. **Reuse these; never re-implement.** "Prototype counterpart" is where the design is defined; whether each matches pixel-for-pixel is **not yet audited** unless stated.

| Component | File | Prototype counterpart | Audit |
|---|---|---|---|
| Button | ui/button.tsx | inline `<button>` styles in author-journey.jsx (`.btn` on marketing site only) | pending |
| Field (label/input/helper/error) | ui/field.tsx | login/register/profile forms | pending |
| PasswordField | ui/password-field.tsx | login | pending |
| SearchField | ui/search-field.tsx | e.g. MyPreprints search box (`bg canvas`, border, `Search` icon 15px) | pending |
| Combobox | ui/combobox.tsx | searchable selectors | pending |
| Dialog | ui/dialog.tsx | `ui-modal-head` header gradient (`#f7f5ff→#fbfaff`) | pending |
| FilterPopover, SegmentedControl, Switch | ui/*.tsx | table filters, view switches | pending |
| FlowToast | ui/flow-toast.tsx | toasts | pending |
| EmptyState, AuthMessage, AnimatedNumber, CountryFlag | ui/*.tsx | – | pending |
| AppHeader, MobileNav, NavDropdown, PageHeader, AuthBackdrop | layout/*.tsx | TopBar, auth backdrop | login backdrop compared: layout differs (see audit) |
| `.ui-table` zebra rows | app/globals.css | prototype `.ui-table` | same rules copied |
| ConferenceShell, menus | features/workspace | prototype sidebar/shell | pending |

Next step for this file: for each component, extract computed styles (height, padding, radius, font, border, hover/focus) from both apps via the style probe and record them here. Unknown until then.
