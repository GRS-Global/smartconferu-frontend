"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import QRCodeLib from "qrcode";
import { mergeValues, verifyUrl, type Design, type Orientation } from "../data";
import { FONTS, docPage, docPaper, studioFromDesign, type FontKey, type StudioDoc } from "../studio/model";
import type { PaperSpec } from "../paper";
import { resolveImageSrc } from "../studio/images";
import { StudioPage } from "../studio/render";
import { extrasOf } from "../merge-extras";

/* A certificate as a picture. The page is drawn by the SAME component the editor and the recipient's wallet use (StudioPage), mounted off screen,
   turned into an SVG <foreignObject> with the fonts and pictures embedded as data, and painted onto a canvas at the size asked for. So the layout,
   the fonts and the colours are the browser's own: what is downloaded is what is on screen, not a second drawing of it.

   A session keeps what is the same for every certificate of a batch (the fonts, the pictures, the QR codes) so 500 certificates do not fetch
   the logo 500 times. */

export interface RenderRecipient { name: string; affiliation?: string; roleLabel?: string; paperId?: string; paperTitle?: string; serial: string; issuedAt?: number }
export interface RenderConference { name?: string; acronym?: string; startDate?: string; endDate?: string; city?: string; country?: string }
export interface RenderTarget { design: Design; recipient: RenderRecipient; conference: RenderConference }
export interface RenderOptions { /** 1 = the page's base size (1000 px wide). 2 is about 170 dpi on A4, 3 about 255 dpi. */ scale: number; format: "png" | "jpeg"; quality?: number }
export interface Rendered { bytes: Uint8Array; mime: string; width: number; height: number; orientation: Orientation; /** The paper the design is made for (the PDF's default sheet). */ paper: PaperSpec }

export class RenderError extends Error {}

export interface RenderSession {
  fonts: Promise<{ css: Record<FontKey, string>; faces: string }> | null;
  images: Map<string, Promise<string>>;
  qr: Map<string, Promise<string>>;
}
export const createRenderSession = (): RenderSession => ({ fonts: null, images: new Map(), qr: new Map() });

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new RenderError("A picture could not be read."));
  r.readAsDataURL(blob);
});

async function fetchAsDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  let res: Response;
  try { res = await fetch(url, { mode: "cors" }); } catch { throw new RenderError("A picture on the certificate (a logo or signature) could not be loaded. Check your connection and try again."); }
  if (!res.ok) throw new RenderError(`A picture on the certificate could not be loaded (${res.status}).`);
  return toDataUrl(await res.blob());
}

function imageData(session: RenderSession, url: string): Promise<string> {
  let p = session.images.get(url);
  if (!p) {
    p = fetchAsDataUrl(url);
    session.images.set(url, p);
    // A picture that failed to load must not stay failed: a retry should ask again.
    p.catch(() => { if (session.images.get(url) === p) session.images.delete(url); });
  }
  return p;
}

/** The real family names behind `var(--font-…)` and every @font-face of them, with the font files embedded. */
function loadFonts(session: RenderSession): NonNullable<RenderSession["fonts"]> {
  session.fonts ??= (async () => {
    const root = getComputedStyle(document.documentElement);
    const css = {} as Record<FontKey, string>;
    const families = new Set<string>();
    (Object.keys(FONTS) as FontKey[]).forEach((key) => {
      css[key] = FONTS[key].css.replace(/var\((--[\w-]+)\)/g, (_m, name: string) => root.getPropertyValue(name).trim() || "serif");
      css[key].split(",").forEach((f) => families.add(f.trim().replace(/^["']|["']$/g, "")));
    });
    // next/font writes the family name as the variable's value: collect those too.
    const faces: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; } // a stylesheet from another origin can't be read
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
        if (!families.has(family)) continue;
        let text = rule.cssText;
        for (const m of text.matchAll(/url\((["']?)([^"')]+)\1\)/g)) {
          const href = new URL(m[2], sheet.href ?? location.href).href;
          try { text = text.replace(m[0], `url("${await imageData(session, href)}")`); } catch { /* keep the url: the font falls back */ }
        }
        faces.push(text);
      }
    }
    return { css, faces: faces.join("\n") };
  })();
  return session.fonts;
}

function qrFor(session: RenderSession, serial: string): Promise<string> {
  let p = session.qr.get(serial);
  if (!p) { p = QRCodeLib.toDataURL(verifyUrl(serial), { width: 200, margin: 0, color: { dark: "#0B1020", light: "#FFFFFF" } }); session.qr.set(serial, p); }
  return p;
}

const frames = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** The page's markup, serialised as XHTML (what an SVG foreignObject needs), after the pictures have been swapped for data. */
async function pageXhtml(doc: StudioDoc, target: RenderTarget, session: RenderSession, w: number, h: number): Promise<{ xhtml: string; faces: string }> {
  const fonts = await loadFonts(session);
  const values = mergeValues(target.recipient, target.conference, extrasOf(target.design));
  const hasQr = doc.elements.some((e) => e.type === "qr" && !e.hidden);
  const qrDataUrl = hasQr && target.recipient.serial ? await qrFor(session, target.recipient.serial) : "";
  const urls = doc.elements.filter((e) => e.type === "image" && !e.hidden && e.src).map((e) => resolveImageSrc(e.src)!);
  const loaded = new Map<string, string>(await Promise.all([...new Set(urls)].map(async (u) => [u, await imageData(session, u)] as const)));
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(
      <StudioPage doc={doc} values={values} serial={target.recipient.serial} w={w} h={h} out={{ qrDataUrl, fonts: fonts.css, src: (s) => { const u = resolveImageSrc(s); return u ? loaded.get(u) ?? u : u; } }} />,
    ));
    await frames();
    const node = host.firstElementChild;
    if (!node) throw new RenderError("The certificate could not be drawn.");
    return { xhtml: new XMLSerializer().serializeToString(node), faces: fonts.faces };
  } finally {
    root.unmount();
    host.remove();
  }
}

/** The certificate as PNG or JPEG bytes. */
export async function renderCertificate(target: RenderTarget, options: RenderOptions, session: RenderSession = createRenderSession()): Promise<Rendered> {
  const doc = target.design.studio ?? studioFromDesign(target.design);
  const { w, h } = docPage(doc);
  const { xhtml, faces } = await pageXhtml(doc, target, session, w, h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden"><style>${faces.replace(/</g, "\\3C ")}</style>${xhtml}</div></foreignObject></svg>`;

  const img = new Image();
  img.decoding = "sync";
  const loaded = new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new RenderError("The certificate could not be turned into a picture in this browser.")); });
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loaded;
  try { await img.decode(); } catch { /* some browsers reject for SVG: the load event was enough */ }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * options.scale);
  canvas.height = Math.round(h * options.scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new RenderError("This browser can't draw the certificate.");
  if (options.format === "jpeg") { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  // The first paint of an SVG with embedded fonts can come out with the fallback font; painting once more after the fonts were used is cheap and reliable.
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  await new Promise((r) => setTimeout(r, 30));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (options.format === "jpeg") { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const mime = options.format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, options.quality ?? 0.92));
  if (!blob) throw new RenderError("The picture of the certificate could not be saved (it may be too large for this browser).");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime, width: canvas.width, height: canvas.height, orientation: doc.orientation, paper: docPaper(doc) };
}
