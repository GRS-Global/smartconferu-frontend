/* Recharts consumes literal colour values in SVG props (fill / stroke), so the chart colours are written out here, with the same values as the
   tokens in styles/tokens.css (the prototype's TOKENS in src/shared/theme.js). Only chart SVG props use these; card chrome and text use var(--*). */
const T = {
  primary: "#7C3AED", primaryHover: "#6D28D9", secondary: "#A21CAF", accent: "#06B6D4", success: "#16A34A", warning: "#D97706", danger: "#DC2626",
  navy: "#0B1020", border: "#E2E8F0", textFaint: "#94A3B8",
} as const;

export const CHART_COLORS = {
  primary: T.primary,
  primaryHover: T.primaryHover,
  secondary: T.secondary,
  accent: T.accent,
  success: T.success,
  warning: T.warning,
  danger: T.danger,
  navy: T.navy,
  grid: T.border,
  axisText: T.textFaint,
  tooltipBg: "#FFFFFF",
  tooltipBorder: T.border,
};

// Categorical series palette, used in order for multi-series bar / line / pie charts.
export const CHART_CATEGORICAL = [T.primary, T.accent, T.secondary, T.success, T.warning, T.primaryHover, "#EC4899", "#0EA5E9"];

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: CHART_COLORS.tooltipBg,
    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
    borderRadius: "0.7rem",
    fontSize: 12,
    boxShadow: "0 4px 20px rgba(11,16,32,0.08)",
  },
  labelStyle: { color: T.navy, fontWeight: 700, marginBottom: 2 },
  itemStyle: { fontSize: 12 },
};

export const AXIS_STYLE = {
  tick: { fill: CHART_COLORS.axisText, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHART_COLORS.grid },
};

// var(--*) form (dot colour / soft badge background / badge text) for rows keyed to a decision state.
export const STATUS_TONE = {
  success: { dot: "var(--success)", bg: "var(--success-soft)", fg: "var(--success)" },
  warning: { dot: "var(--warning)", bg: "var(--warning-soft)", fg: "var(--warning)" },
  danger: { dot: "var(--danger)", bg: "var(--danger-soft)", fg: "var(--danger)" },
  neutral: { dot: "var(--ink-faint)", bg: "var(--muted)", fg: "var(--ink-muted)" },
};
export type Tone = keyof typeof STATUS_TONE;
