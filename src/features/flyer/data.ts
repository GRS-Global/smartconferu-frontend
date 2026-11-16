/* The speaker flyer's rules and look (the prototype's src/author-module/flyerData.js): the chair designs one template per conference and every
   presenter who meets the chair's rule gets their own copy. The template is one row of the database (migration 0048, services/flyers.ts); this
   file holds no state. The PNG export the author's "My flyer" page uses is added with that page. */

export interface FlyerTemplate { key: string; label: string; bg: string; ink: string; soft: string; panel: string; panelBorder: string; ring: string; tint: string; pillBg: string; pillInk: string }
export const FLYER_TEMPLATES: FlyerTemplate[] = [
  { key: "midnight", label: "Midnight", bg: "#0B1020", ink: "#FFFFFF", soft: "#CBD5E1", panel: "#111833", panelBorder: "#334155", ring: "#1E1B4B", tint: "#A5B4FC", pillBg: "#FFFFFF", pillInk: "#0B1020" },
  { key: "ivory", label: "Clean light", bg: "#FAF9F5", ink: "#0B1020", soft: "#475569", panel: "#FFFFFF", panelBorder: "#E2E8F0", ring: "#EEF2FF", tint: "#4F46E5", pillBg: "#0B1020", pillInk: "#FFFFFF" },
  { key: "indigo", label: "Indigo", bg: "#312E81", ink: "#FFFFFF", soft: "#C7D2FE", panel: "#3730A3", panelBorder: "#4F46E5", ring: "#4338CA", tint: "#C7D2FE", pillBg: "#FFFFFF", pillInk: "#312E81" },
];
export const FLYER_ACCENTS = ["#22D3EE", "#FBBF24", "#A3E635", "#F472B6"];

export type FlyerFieldKey = "photo" | "affiliation" | "paper" | "slot" | "room" | "qr";
/** The details a chair can switch on or off on the flyer. */
export const FLYER_FIELDS: Array<{ key: FlyerFieldKey; label: string }> = [
  { key: "photo", label: "Photo" },
  { key: "affiliation", label: "Affiliation" },
  { key: "paper", label: "Paper title" },
  { key: "slot", label: "Date & time" },
  { key: "room", label: "Room / Hall" },
  { key: "qr", label: "QR to paper" },
];

export interface FlyerFormat { key: string; label: string; hint: string; w: number; h: number; preview: { w: number; h: number }; caption: string }
export const FLYER_FORMATS: FlyerFormat[] = [
  { key: "portrait", label: "Portrait", hint: "1080×1350 · feed posts", w: 1080, h: 1350, preview: { w: 432, h: 540 }, caption: "Portrait 4:5 · LinkedIn, Facebook, Instagram feed" },
  { key: "square", label: "Square", hint: "1080×1080 · Instagram, X", w: 1080, h: 1080, preview: { w: 480, h: 480 }, caption: "Square 1:1 · Instagram, X" },
  { key: "story", label: "Story", hint: "1080×1920 · Status, Stories", w: 1080, h: 1920, preview: { w: 360, h: 640 }, caption: "Story 9:16 · WhatsApp Status, Instagram Story" },
];

export interface FlyerDesign {
  template: string; accent: string; badge: string; headline: string;
  /** null = no picture; a data URL once the chair uploaded one. */
  bgImage: string | null;
  fields: Record<FlyerFieldKey, boolean>;
  audience: "registered" | "accepted";
  emailWhenReady: boolean;
  waitForSlot: boolean;
}
/** What is saved for a conference: the design, whether authors can see it, and how often it has been downloaded. */
export interface SavedFlyer { design: FlyerDesign; published: boolean; downloads: number }

export function defaultFlyerDesign(): FlyerDesign {
  return {
    template: "midnight", accent: FLYER_ACCENTS[0], badge: "SPEAKER", headline: "I'm presenting at {acronym}", bgImage: null,
    fields: { photo: true, affiliation: true, paper: true, slot: true, room: true, qr: true },
    audience: "registered", emailWhenReady: true, waitForSlot: false,
  };
}
/** A saved design with anything missing filled in from the defaults (an older or partly written row never breaks the page). */
export function normalizeFlyerDesign(raw: Partial<FlyerDesign> | null | undefined): FlyerDesign {
  const d = defaultFlyerDesign();
  return { ...d, ...(raw ?? {}), fields: { ...d.fields, ...(raw?.fields ?? {}) } };
}

export const templateOf = (design: Pick<FlyerDesign, "template">): FlyerTemplate => FLYER_TEMPLATES.find((t) => t.key === design.template) ?? FLYER_TEMPLATES[0];
export const headlineFor = (design: Pick<FlyerDesign, "headline">, acronym: string | undefined) => (design.headline || "").replaceAll("{acronym}", acronym || "");

export function paperUrlFor(conference: { webPage?: string } | null | undefined, submissionId: string): string {
  const base = (conference?.webPage || "https://example.org").replace(/\/$/, "");
  return `${base}/p/${submissionId}`;
}
export const hashtagFor = (conference: { acronym?: string } | null | undefined) => `#${String(conference?.acronym || "").replace(/\s+/g, "")}`;

/* Sizes for one flyer shape, on the 1080-wide grid. Shared by the on-screen FlyerArtwork and the PNG export so the two always agree. Portrait
   (1080×1350) and Story (1080×1920) have room for the full layout; Square (1080×1080) is about 270px shorter, so it gets a tighter one. */
export function flyerMetrics(format: Pick<FlyerFormat, "w" | "h">) {
  const square = format.h <= format.w;
  const tall = format.h > format.w * 1.5;
  if (square) {
    return { pad: 64, headSize: 70, headLine: 74, headGap: 20, badge: 22, badgeH: 44, afterBadge: 60, sectionGap: 18,
      photo: 112, photoBorder: 5, initials: 40, name: 36, aff: 24, paper: 28, paperLine: 36, paperLines: 2, paperLabel: 18,
      pill: 22, pillH: 50, qr: 160, confName: 22, confLine: 28, acronym: 34 };
  }
  return { pad: 76, headSize: tall ? 100 : 88, headLine: tall ? 104 : 92, headGap: 30, badge: 24, badgeH: 48, afterBadge: 72, sectionGap: tall ? 34 : 26,
    photo: 150, photoBorder: 6, initials: 48, name: 42, aff: 28, paper: 32, paperLine: 42, paperLines: 3, paperLabel: 20,
    pill: 26, pillH: 58, qr: 190, confName: 24, confLine: 32, acronym: 36 };
}
