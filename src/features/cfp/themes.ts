/** Public CFP page themes (the prototype's CFP_THEMES): the accent colours the banner and the section headings of the page authors see. */
export const CFP_THEMES = [
  { id: "classic", label: "Classic", accent: "#0F3460", tint: "#EAF1F8", desc: "Clean and professional — Smartconferu's default look" },
  { id: "easy", label: "Easy", accent: "#334155", tint: "#F1F5F9", desc: "Minimal, text-focused layout" },
  { id: "blue", label: "Blue", accent: "#2E86DE", tint: "#EAF3FE", desc: "Bright and modern" },
  { id: "sandy", label: "Sandy", accent: "#D97706", tint: "#FEF3E2", desc: "Warm, editorial tone" },
  { id: "red", label: "Red", accent: "#DC2626", tint: "#FDECEC", desc: "Bold, high-contrast" },
] as const;

export type CfpThemeId = (typeof CFP_THEMES)[number]["id"];
export const themeOf = (id: string) => CFP_THEMES.find((t) => t.id === id) ?? CFP_THEMES[0];
