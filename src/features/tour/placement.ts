// Where the spotlight popover goes (the prototype's setup-tour/placement.js). `prefer: "side"` (sidebar items): beside the target, right then left, else
// under / over it. `prefer: "vertical"` (form fields, often as wide as the page): under it, then over it, so the popover never sits on the label or the
// input, else beside, else centred. `inset` is the height of any sticky bar stuck to the top of the screen; the popover never goes under it.
export const PAD = 6; // spotlight breathing room around the target
const GAP = 16; // popover distance from the target
const POP_W = 360;
const EDGE = 12; // keep this far from the viewport edge
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n, hi));

export interface Box { left: number; top: number; right: number; bottom: number; width: number; height: number }
export interface Placement { left: number; top: number; width: number; side: "right" | "left" | "below" | "above" | "center" }

export function placePopover(rect: Box | null, vw: number, vh: number, popH: number, { prefer = "side", inset = 0 }: { prefer?: "side" | "vertical"; inset?: number } = {}): Placement {
  const w = Math.min(POP_W, vw - EDGE * 2);
  const top0 = inset + EDGE; // highest the popover may start
  const centred: Placement = { left: Math.round((vw - w) / 2), top: Math.round(clamp((vh - popH) / 2, top0, Math.max(top0, vh - popH - EDGE))), width: w, side: "center" };
  if (!rect) return centred;
  const midY = clamp(rect.top + rect.height / 2 - popH / 2, top0, Math.max(top0, vh - popH - EDGE));
  const midX = clamp(rect.left + rect.width / 2 - w / 2, EDGE, vw - w - EDGE);
  const spots: Record<string, () => { left: number; top: number; side: Placement["side"] } | false> = {
    right: () => rect.right + PAD + GAP + w <= vw - EDGE && { left: rect.right + PAD + GAP, top: midY, side: "right" },
    left: () => rect.left - PAD - GAP - w >= EDGE && { left: rect.left - PAD - GAP - w, top: midY, side: "left" },
    below: () => rect.bottom + PAD + GAP + popH <= vh - EDGE && { left: midX, top: rect.bottom + PAD + GAP, side: "below" },
    above: () => rect.top - PAD - GAP - popH >= top0 && { left: midX, top: rect.top - PAD - GAP - popH, side: "above" },
  };
  const order = prefer === "vertical" ? ["below", "above", "right", "left"] : ["right", "left", "below", "above"];
  for (const k of order) {
    const p = spots[k]();
    if (p) return { left: Math.round(p.left), top: Math.round(p.top), width: w, side: p.side };
  }
  return centred;
}
