import { flyerMetrics, headlineFor, templateOf, type FlyerDesign, type FlyerFormat } from "./data";
import type { FlyerData } from "./flyer-artwork";

/* PNG export (the prototype's renderFlyerPng): draws the same layout as <FlyerArtwork> onto a canvas at full social size (1080 wide), so the
   download is a real image rather than a screenshot of the preview. Sizes come from flyerMetrics, shared with the on-screen artwork. */

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const loadImage = (src: string | null | undefined) => new Promise<HTMLImageElement | null>((resolve) => {
  if (!src) { resolve(null); return; }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

export async function renderFlyerPng({ design, data, format, qrDataUrl }: { design: FlyerDesign; data: FlyerData; format: FlyerFormat; qrDataUrl: string | null }): Promise<string> {
  const t = templateOf(design);
  const { w: W, h: H } = format;
  const s = W / 1080;
  const m = flyerMetrics(format);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the flyer.");
  const font = (weight: number, size: number, family = "'Plus Jakarta Sans', sans-serif") => `${weight} ${Math.round(size * s)}px ${family}`;
  if (document.fonts?.ready) await document.fonts.ready;

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  const bg = await loadImage(design.bgImage);
  if (bg) {
    const scale = Math.max(W / bg.width, H / bg.height);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(bg, (W - bg.width * scale) / 2, (H - bg.height * scale) / 2, bg.width * scale, bg.height * scale);
    ctx.globalAlpha = 1;
  }
  // Decorative rings + accent edge
  ctx.lineWidth = 96 * s;
  ctx.strokeStyle = t.ring;
  ctx.beginPath(); ctx.arc(W - 40 * s, 40 * s, 250 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 4 * s;
  ctx.strokeStyle = design.accent;
  ctx.beginPath(); ctx.arc(W - 20 * s, 20 * s, 160 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = design.accent;
  ctx.fillRect(0, 0, 14 * s, H);

  const pad = m.pad * s;
  let y = pad;
  ctx.textBaseline = "top";
  ctx.fillStyle = t.ink;
  ctx.font = font(800, m.acronym);
  ctx.fillText(data.acronym, pad, y);
  y += (m.acronym + 10) * s;
  ctx.fillStyle = t.tint;
  ctx.font = font(600, m.confName);
  wrapLines(ctx, data.conferenceName, W - pad * 2).slice(0, 2).forEach((l) => { ctx.fillText(l, pad, y); y += m.confLine * s; });
  y += (m.sectionGap + 14) * s;

  // Badge
  ctx.font = font(800, m.badge);
  const bw = ctx.measureText(design.badge).width + 40 * s;
  ctx.fillStyle = design.accent;
  roundRect(ctx, pad, y, bw, m.badgeH * s, 12 * s); ctx.fill();
  ctx.fillStyle = "#0B1020";
  ctx.fillText(design.badge, pad + 20 * s, y + ((m.badgeH - m.badge) / 2) * s);
  y += m.afterBadge * s;

  // Headline
  ctx.fillStyle = t.ink;
  ctx.font = font(800, m.headSize, "Georgia, 'Times New Roman', serif");
  wrapLines(ctx, headlineFor(design, data.acronym), W - pad * 2).slice(0, 3).forEach((l) => { ctx.fillText(l, pad, y); y += m.headLine * s; });
  y += m.headGap * s;

  // Presenter
  const photoSize = m.photo * s;
  let textX = pad;
  if (design.fields.photo) {
    const photo = await loadImage(data.photoUrl);
    ctx.save();
    ctx.beginPath(); ctx.arc(pad + photoSize / 2, y + photoSize / 2, photoSize / 2, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = "#312E81"; ctx.fill();
    ctx.clip();
    if (photo) ctx.drawImage(photo, pad, y, photoSize, photoSize);
    else {
      ctx.fillStyle = "#FFFFFF"; ctx.font = font(800, m.initials); ctx.textAlign = "center";
      ctx.fillText(data.initials, pad + photoSize / 2, y + photoSize / 2 - (m.initials * 0.54) * s);
      ctx.textAlign = "left";
    }
    ctx.restore();
    ctx.lineWidth = m.photoBorder * s; ctx.strokeStyle = design.accent;
    ctx.beginPath(); ctx.arc(pad + photoSize / 2, y + photoSize / 2, photoSize / 2, 0, Math.PI * 2); ctx.stroke();
    textX = pad + photoSize + 28 * s;
  }
  // Name and affiliation sit centred against the photo.
  const hasAff = design.fields.affiliation && data.affiliation;
  const nameBlock = (m.name + 6 + (hasAff ? m.aff + 8 : 0)) * s;
  const nameTop = design.fields.photo ? y + (photoSize - nameBlock) / 2 : y;
  ctx.fillStyle = t.ink; ctx.font = font(800, m.name);
  ctx.fillText(data.authorName, textX, nameTop);
  if (hasAff) {
    ctx.fillStyle = t.soft; ctx.font = font(500, m.aff);
    ctx.fillText(data.affiliation, textX, nameTop + (m.name + 14) * s);
  }
  y += (design.fields.photo ? photoSize : nameBlock) + (m.sectionGap + 10) * s;

  // Paper: a long title is cut to the shape's line limit with an ellipsis.
  if (design.fields.paper) {
    ctx.font = font(700, m.paper);
    const lines = wrapLines(ctx, data.paperTitle, W - pad * 2 - 56 * s);
    const shown = lines.slice(0, m.paperLines);
    if (lines.length > m.paperLines) shown[m.paperLines - 1] = shown[m.paperLines - 1].replace(/\s+\S*$/, "") + "…";
    const ph = (m.paperLabel + 46) * s + shown.length * m.paperLine * s;
    ctx.fillStyle = t.panel; roundRect(ctx, pad, y, W - pad * 2, ph, 22 * s); ctx.fill();
    ctx.strokeStyle = t.panelBorder; ctx.lineWidth = 2 * s; ctx.stroke();
    ctx.fillStyle = t.tint; ctx.font = font(800, m.paperLabel);
    ctx.fillText("PAPER", pad + 28 * s, y + 22 * s);
    ctx.fillStyle = t.ink; ctx.font = font(700, m.paper);
    shown.forEach((l, i) => ctx.fillText(l, pad + 28 * s, y + (m.paperLabel + 32) * s + i * m.paperLine * s));
    y += ph + m.sectionGap * s;
  }

  // Slot pills
  const pills = [design.fields.slot && data.slotText, design.fields.room && data.roomText].filter((p): p is string => Boolean(p));
  let px = pad;
  ctx.font = font(700, m.pill);
  pills.forEach((p) => {
    const pw = ctx.measureText(p).width + 48 * s;
    ctx.fillStyle = t.pillBg; roundRect(ctx, px, y, pw, m.pillH * s, (m.pillH / 2) * s); ctx.fill();
    ctx.fillStyle = t.pillInk; ctx.fillText(p, px + 24 * s, y + ((m.pillH - m.pill) / 2) * s);
    px += pw + 16 * s;
  });

  // Footer: QR + link
  const qrSize = m.qr * s;
  const fy = H - pad - qrSize;
  if (design.fields.qr && qrDataUrl) {
    const qr = await loadImage(qrDataUrl);
    ctx.fillStyle = "#FFFFFF"; roundRect(ctx, W - pad - qrSize - 16 * s, fy - 16 * s, qrSize + 32 * s, qrSize + 32 * s, 20 * s); ctx.fill();
    if (qr) ctx.drawImage(qr, W - pad - qrSize, fy, qrSize, qrSize);
    ctx.fillStyle = t.ink; ctx.font = font(800, 28);
    ctx.fillText("Scan to read my paper", pad, fy + qrSize - 104 * s);
  }
  ctx.fillStyle = t.soft; ctx.font = font(500, 24);
  ctx.fillText(data.url.replace(/^https?:\/\//, ""), pad, fy + qrSize - 64 * s);
  ctx.fillStyle = design.accent; ctx.font = font(700, 24);
  ctx.fillText(data.hashtag, pad, fy + qrSize - 30 * s);

  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
