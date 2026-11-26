"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import {
  ChevronLeft, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Minimize, Eye, Pencil, Download, Printer, FileText, Send, Check, Loader2, CloudOff, Scan, Ruler as RulerIcon, AlertTriangle,
} from "lucide-react";
import type { Conference } from "@/types/conference";
import { sampleRecipient, mergeValues, type CertificateDesign, type Design } from "../data";
import { buildTemplateDoc, getStudioTemplate } from "./templates";
import { extrasOf } from "../merge-extras";
import type { CertificateActions } from "../use-certificates";
import type { Go } from "../routes";
import { PrintCertificate } from "../print-certificate";
import { renderCertificate } from "../bulk/render-image";
import { buildFile, saveBlob } from "../bulk/export-files";
import { CUSTOM_KEY, labelOf } from "../paper";
import { inputStyle } from "../form-styles";
import {
  alignElements, boundsOf, clone, distributeElements, expandSelection, newId, newImage, docPage, docPaper, unitPerPx, reorder, snapBox, studioFromDesign, tokensIn, marginOf, signatoriesOf, isPlaceholderName, newSignatureBlock, spaceSignatureBlocks, FONTS,
  type AlignKind, type Guide, type StudioDoc, type StudioElement, type ZMove,
} from "./model";
import { StudioPage } from "./render";
import { useHistory } from "./use-history";
import { IconBtn, LeftPanel, Properties, TABS, type StudioCtx, type Tab } from "./panels";
import { Ruler, RULER } from "./rulers";
import { getSignatureService, type SignatureService } from "@/services/signatures";
import { checkAssetFile, getAssetService, type AssetService } from "@/services/assets";
import { resolveImageSrc } from "./images";
import { migrateDataImages } from "./migrate-images";
import { LayoutMenu, loadView, saveView, type ViewSettings } from "./layout-menu";

/* The Certificate Studio. The document is `StudioDoc` (model.ts); this file owns the interaction: selection, move / resize / rotate with snapping,
   marquee, keyboard shortcuts, inline text editing, undo / redo, autosave and the toolbar. Handles, guides and badges live in an overlay that is
   never part of what is rendered for export or for the recipient. */

const HANDLES: Array<{ k: string; hx: -1 | 0 | 1; hy: -1 | 0 | 1; cursor: string }> = [
  { k: "nw", hx: -1, hy: -1, cursor: "nwse-resize" }, { k: "n", hx: 0, hy: -1, cursor: "ns-resize" }, { k: "ne", hx: 1, hy: -1, cursor: "nesw-resize" },
  { k: "e", hx: 1, hy: 0, cursor: "ew-resize" }, { k: "se", hx: 1, hy: 1, cursor: "nwse-resize" }, { k: "s", hx: 0, hy: 1, cursor: "ns-resize" },
  { k: "sw", hx: -1, hy: 1, cursor: "nesw-resize" }, { k: "w", hx: -1, hy: 0, cursor: "ew-resize" },
];
const ZOOMS = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2];

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export function StudioEditor({ conference, cert, actions, go, error }: { conference: Conference; cert: CertificateDesign; actions: CertificateActions; go: Go; error: string }) {
  const initial = useMemo<StudioDoc>(() => cert.design.studio ?? studioFromDesign(cert.design), []); // eslint-disable-line react-hooks/exhaustive-deps -- read once; the editor owns the document afterwards
  const h = useHistory<StudioDoc>(initial);
  const { doc } = h;
  const page = docPage(doc);

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("text");
  const [zoom, setZoom] = useState(0.8);
  const [fit, setFit] = useState(true);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [full, setFull] = useState(false);
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const [printing, setPrinting] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const [name, setName] = useState(cert.name);
  const [view, setViewState] = useState<ViewSettings>(loadView); // the editor only mounts after the data has loaded in the browser
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [geo, setGeo] = useState({ ox: 0, oy: 0, vw: 0, vh: 0 }); // where the page's 0,0 sits inside the scroll area, and that area's size
  const viewRef = useRef(view);
  const setView = useCallback((v: ViewSettings) => { setViewState(v); saveView(v); }, []);
  useEffect(() => { viewRef.current = view; });
  const [sigService, setSigService] = useState<SignatureService | null>(null);
  const [assetService, setAssetService] = useState<AssetService | null>(null);
  const [note, setNote] = useState("");
  /** Bumped whenever something outside the Uploads tab adds a picture to the library, so its list reloads. */
  const [assetsVersion, setAssetsVersion] = useState(0);
  useEffect(() => { let on = true; getAssetService().then((svc) => { if (on) setAssetService(svc); }).catch(() => undefined); return () => { on = false; }; }, []);
  useEffect(() => { let on = true; getSignatureService().then((svc) => { if (on) setSigService(svc); }).catch(() => undefined); return () => { on = false; }; }, []);
  const work = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const clip = useRef<StudioElement[]>([]);
  const docRef = useRef(doc); const selRef = useRef(sel); const zoomRef = useRef(zoom);
  useEffect(() => { docRef.current = doc; selRef.current = sel; zoomRef.current = zoom; });

  const recipient = useMemo(() => sampleRecipient(conference, cert.typeKey), [conference, cert.typeKey]);
  const values = useMemo(() => mergeValues(recipient, conference, extrasOf({ ...cert.design, studio: doc, typeKey: cert.typeKey })), [recipient, conference, cert.design, cert.typeKey, doc]);

  /* ---- autosave: the document goes to the existing debounced save (use-certificates) a moment after the last change ---- */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setStatus("saving");
    const t = setTimeout(() => actions.updateDesign(cert.id, { design: (d: Design) => { const sig = signatoriesOf(doc); return { ...d, studio: doc, orientation: doc.orientation, typeKey: cert.typeKey, logoSrc: d.logoSrc?.startsWith("data:") ? null : d.logoSrc, ...(sig.length ? { signatories: sig } : {}) }; } }), 300);
    const done = setTimeout(() => setStatus("saved"), 1500);
    return () => { clearTimeout(t); clearTimeout(done); };
  }, [doc, actions, cert.id, cert.typeKey]);
  useEffect(() => {
    if (status !== "saving") return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  /* ---- fit to screen ---- */
  const fitNow = useCallback(() => {
    const el = work.current;
    if (!el) return;
    const z = Math.max(0.2, Math.min(2, Math.min((el.clientWidth - 64) / page.w, (el.clientHeight - 64) / page.h)));
    setZoom(Math.round(z * 100) / 100);
  }, [page.w, page.h]);
  useEffect(() => {
    if (!fit) return undefined;
    fitNow();
    const el = work.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(fitNow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, fitNow, full]);
  const zoomBy = (dir: 1 | -1) => {
    setFit(false);
    const cur = zoomRef.current;
    const next = dir > 0 ? ZOOMS.find((z) => z > cur + 0.001) ?? ZOOMS[ZOOMS.length - 1] : [...ZOOMS].reverse().find((z) => z < cur - 0.001) ?? ZOOMS[0];
    setZoom(next);
  };

  /* ---- rulers: where the page sits inside the scroll area (changes with scroll, zoom, window size) ---- */
  const measure = useCallback(() => {
    const w = work.current, p = pageRef.current;
    if (!w || !p) return;
    const a = w.getBoundingClientRect(), b = p.getBoundingClientRect();
    setGeo((g) => {
      const n = { ox: Math.round(b.left - a.left), oy: Math.round(b.top - a.top), vw: w.clientWidth, vh: w.clientHeight };
      return g.ox === n.ox && g.oy === n.oy && g.vw === n.vw && g.vh === n.vh ? g : n;
    });
  }, []);
  useEffect(() => {
    measure();
    const el = work.current;
    if (!el) return undefined;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); ro?.disconnect(); };
  }, [measure, zoom, doc.orientation, view.rulers, preview, full, tab]);

  const hCommit = h.commit;
  const setDocGuides = useCallback((g: { x: number[]; y: number[] }) => hCommit((d) => ({ ...d, guides: g })), [hCommit]);
  const setMargin = useCallback((px: number) => hCommit((d) => ({ ...d, margin: px }), "margin"), [hCommit]);

  /* ---- helpers ---- */
  const toPage = (e: { clientX: number; clientY: number }) => {
    const r = pageRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoomRef.current, y: (e.clientY - r.top) / zoomRef.current };
  };
  const selEls = useMemo(() => doc.elements.filter((e) => sel.has(e.id)), [doc.elements, sel]);

  const select = useCallback((ids: string[], additive = false) => {
    setSel((cur) => {
      const all = docRef.current.elements;
      if (!additive) return expandSelection(all, ids);
      const next = new Set(cur);
      const add = expandSelection(all, ids);
      const allIn = [...add].every((i) => next.has(i));
      add.forEach((i) => (allIn ? next.delete(i) : next.add(i)));
      return next;
    });
  }, []);
  const commit = h.commit;
  const patch = useCallback((ids: Iterable<string>, p: Partial<StudioElement>, key?: string) => {
    const set = new Set(ids);
    commit((d) => ({ ...d, elements: d.elements.map((e) => (set.has(e.id) ? { ...e, ...p } : e)) }), key ? `${key}:${[...set].join(",")}` : undefined);
  }, [commit]);
  const add = useCallback((el: StudioElement) => { commit((d) => ({ ...d, elements: [...d.elements, el] })); setSel(new Set([el.id])); setEditingId(null); }, [commit]);

  const addMany = useCallback((els: StudioElement[]) => { commit((d) => ({ ...d, elements: [...d.elements, ...els] })); setSel(new Set(els.map((e) => e.id))); setEditingId(null); }, [commit]);

  /** A signatory from the library goes where the certificate is waiting for one: it takes the place of the template's unfilled signature block (which is removed), else the next free slot. */
  const addSignature = useCallback((sig: { id: string; name: string; designation: string; institution: string }) => {
    const d = docRef.current;
    const waiting = d.elements.find((e) => e.name === "Signatory name" && !e.hidden && isPlaceholderName(e.text));
    const blocks = new Set(d.elements.filter((e) => e.name === "Signature image").map((e) => e.groupId)).size;
    let at: { cx?: number; y?: number } | undefined;
    const replaced = new Set<string>();
    if (waiting) {
      const members = waiting.groupId ? d.elements.filter((e) => e.groupId === waiting.groupId) : [waiting];
      const box = boundsOf(members);
      const line = members.find((e) => e.name === "Signature line");
      at = { cx: Math.round(box.x + box.w / 2), y: Math.round((line?.y ?? box.y) - 76) }; // the picture sits 76 px above the line
      members.forEach((m) => replaced.add(m.id));
    }
    if (!at && blocks > 0) { // no unfilled block: line the new one up with the signing line of the blocks already there
      const withPicture = new Set(d.elements.filter((x) => x.name === "Signature image").map((x) => x.groupId));
      const line = d.elements.find((x) => x.name === "Signature line" && x.groupId && withPicture.has(x.groupId));
      if (line) at = { y: line.y - 76 };
    }
    const els = newSignatureBlock(docPage(d), sig, blocks, at);
    commit((dd) => ({ ...dd, elements: spaceSignatureBlocks([...dd.elements.filter((e) => !replaced.has(e.id)), ...els], docPage(dd)) }));
    setSel(new Set(els.map((e) => e.id)));
    setEditingId(null);
  }, [commit]);

  const duplicate = useCallback((src?: StudioElement[]) => {
    const items = src ?? docRef.current.elements.filter((e) => selRef.current.has(e.id));
    if (!items.length) return;
    const groupMap = new Map<string, string>();
    const copies = items.map((e) => {
      const g = e.groupId ? (groupMap.get(e.groupId) ?? groupMap.set(e.groupId, newId("g")).get(e.groupId)) : undefined;
      return { ...clone(e), id: newId(e.type[0]), x: e.x + 20, y: e.y + 20, groupId: g, locked: false };
    });
    commit((d) => ({ ...d, elements: [...d.elements, ...copies] }));
    setSel(new Set(copies.map((c) => c.id)));
  }, [commit]);
  const remove = useCallback(() => {
    const ids = selRef.current;
    if (!ids.size) return;
    commit((d) => ({ ...d, elements: d.elements.filter((e) => !ids.has(e.id) || e.locked) }));
    setSel(new Set()); setEditingId(null);
  }, [commit]);
  const group = useCallback(() => {
    const ids = selRef.current;
    if (ids.size < 2) return;
    const g = newId("g");
    commit((d) => ({ ...d, elements: d.elements.map((e) => (ids.has(e.id) ? { ...e, groupId: g } : e)) }));
  }, [commit]);
  const ungroup = useCallback(() => {
    const ids = selRef.current;
    commit((d) => ({ ...d, elements: d.elements.map((e) => (ids.has(e.id) && e.groupId ? { ...e, groupId: undefined } : e)) }));
  }, [commit]);
  const align = useCallback((k: AlignKind) => commit((d) => ({ ...d, elements: alignElements(d.elements, selRef.current, k, docPage(d)) })), [commit]);
  const distribute = useCallback((axis: "h" | "v") => commit((d) => ({ ...d, elements: distributeElements(d.elements, selRef.current, axis) })), [commit]);
  const order = useCallback((m: ZMove) => commit((d) => ({ ...d, elements: reorder(d.elements, selRef.current, m) })), [commit]);

  /** The natural size of a picture, to place it at a sensible size (0 when it is not a picture the browser can read). */
  const naturalSize = (src: string) => new Promise<{ w: number; h: number }>((resolve) => { const im = new window.Image(); im.onload = () => resolve({ w: im.naturalWidth || 200, h: im.naturalHeight || 100 }); im.onerror = () => resolve({ w: 0, h: 0 }); im.src = src; });

  /** A picture from the library (`asset:<id>`) or an address, placed on the page at its natural size. */
  const addPicture = useCallback(async (src: string, name: string) => {
    const url = resolveImageSrc(src) ?? src;
    const natural = await naturalSize(url);
    add(newImage(docPage(docRef.current), src, name, natural.w ? natural : { w: 320, h: 240 }));
  }, [add]);

  /** An uploaded file goes into the picture library; the design keeps only a reference to it, never the picture itself. */
  const upload = useCallback(async (file: File, replaceId?: string): Promise<string> => {
    if (!assetService) return "The picture library is not ready yet.";
    const bad = checkAssetFile(file);
    if (bad) return bad;
    const local = URL.createObjectURL(file);
    const natural = await naturalSize(local);
    URL.revokeObjectURL(local);
    if (!natural.w) return "That picture looks damaged or is not a supported picture.";
    let rec;
    try { rec = await assetService.create(cert.conferenceId, { file }); } catch (err) { return err instanceof Error ? err.message : "The picture could not be uploaded."; }
    setAssetsVersion((v) => v + 1);
    if (replaceId) patch([replaceId], { src: `asset:${rec.id}` });
    else add(newImage(docPage(docRef.current), `asset:${rec.id}`, rec.name, natural));
    return "";
  }, [add, patch, assetService, cert.conferenceId]);

  /* Designs saved before the library existed hold their pictures inside the design (data URLs): move them into the library once, silently
     (it is not an undo step), so the design stops carrying the pictures. A picture that cannot be moved (e.g. an old SVG) stays as it is. */
  const migrated = useRef(false);
  useEffect(() => {
    if (!assetService || migrated.current) return;
    migrated.current = true;
    const old = docRef.current.elements.filter((x) => x.type === "image" && x.src?.startsWith("data:"));
    if (old.length === 0) return;
    void (async () => {
      const moved = await migrateDataImages(old, { check: checkAssetFile, create: async (file, name) => `asset:${(await assetService.create(cert.conferenceId, { file, name })).id}` });
      if (moved.size === 0) return;
      setAssetsVersion((v) => v + 1);
      h.set((d) => ({ ...d, elements: d.elements.map((x) => (moved.has(x.id) ? { ...x, src: moved.get(x.id) } : x)) }));
      setNote(`Moved ${moved.size} picture${moved.size === 1 ? "" : "s"} into the picture library.`);
      setTimeout(() => setNote(""), 6000);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the library is ready
  }, [assetService]);

  const [templateKey, setTemplateKey] = useState(cert.design.templateKey);
  const restart = useCallback((o: Parameters<StudioCtx["restart"]>[0]) => {
    const key = o.templateKey ?? templateKey;
    const orientation = o.orientation ?? docRef.current.orientation;
    const sig = signatoriesOf(docRef.current)[0] ?? cert.design.signatories[0];
    commit(buildTemplateDoc(key, cert.typeKey, orientation, sig, docPaper(docRef.current)));
    if (o.templateKey) {
      setTemplateKey(o.templateKey);
      const t = getStudioTemplate(o.templateKey);
      actions.updateDesign(cert.id, { design: (d: Design) => ({ ...d, templateKey: o.templateKey!, ...(t ? { palette: { ...t.palette } } : {}) }) });
    }
    setSel(new Set());
  }, [cert.design.signatories, cert.id, cert.typeKey, templateKey, actions, commit]);

  /* ---- pointer: move ---- */
  const track = (move: (e: PointerEvent) => void, up: () => void) => {
    const mv = (e: PointerEvent) => move(e);
    const end = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); up(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  };

  const startMove = (e: RPointerEvent, el: StudioElement) => {
    if (preview || editingId === el.id || e.button !== 0) return;
    e.stopPropagation();
    let ids = selRef.current;
    if (e.shiftKey) { select([el.id], true); return; }
    if (!ids.has(el.id)) { ids = expandSelection(docRef.current.elements, [el.id]); setSel(ids); }
    const movable = docRef.current.elements.filter((x) => ids.has(x.id) && !x.locked);
    if (!movable.length) return;
    const start = toPage(e);
    const orig = new Map(movable.map((m) => [m.id, { x: m.x, y: m.y }]));
    const box = boundsOf(movable);
    const others = docRef.current.elements.filter((x) => !ids.has(x.id) && !x.hidden).map((x) => ({ x: x.x, y: x.y, w: x.w, h: x.h }));
    let moved = false;
    h.begin();
    track((ev) => {
      const p = toPage(ev);
      let dx = p.x - start.x, dy = p.y - start.y;
      if (!moved && Math.hypot(dx, dy) * zoomRef.current < 3) return;
      moved = true;
      const v = viewRef.current, d0 = docRef.current, pg = docPage(d0), m = marginOf(d0);
      const extra = {
        x: [...(v.guides ? d0.guides?.x ?? [] : []), ...(v.margins ? [m, pg.w - m] : [])],
        y: [...(v.guides ? d0.guides?.y ?? [] : []), ...(v.margins ? [m, pg.h - m] : [])],
      };
      const snap = snapBox({ ...box, x: box.x + dx, y: box.y + dy }, others, pg, 6 / zoomRef.current, extra);
      dx += snap.dx; dy += snap.dy;
      const lines = [...snap.guides];
      if (v.snapGrid) { // the grid only decides an axis that no guide or edge already snapped
        if (!snap.guides.some((g) => g.axis === "x")) dx += Math.round((box.x + dx) / v.gridSize) * v.gridSize - (box.x + dx);
        if (!snap.guides.some((g) => g.axis === "y")) dy += Math.round((box.y + dy) / v.gridSize) * v.gridSize - (box.y + dy);
      }
      setGuides(lines);
      h.set((d) => ({ ...d, elements: d.elements.map((x) => { const o = orig.get(x.id); return o ? { ...x, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } : x; }) }));
    }, () => { setGuides([]); h.end(); });
  };

  /* ---- pointer: resize ---- */
  const startResize = (e: RPointerEvent, el: StudioElement, hx: number, hy: number) => {
    e.stopPropagation(); e.preventDefault();
    const start = toPage(e);
    const rad = (el.rotation * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const c0 = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
    h.begin();
    track((ev) => {
      const p = toPage(ev);
      const dx = p.x - start.x, dy = p.y - start.y;
      const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos; // pointer movement in the element's own axes
      const keep = (el.type === "image" || el.type === "qr" || ev.shiftKey) && !ev.altKey && hx !== 0 && hy !== 0;
      const w = Math.max(8, el.w + hx * lx);
      let hh = Math.max(el.type === "text" ? 8 : 1, el.h + hy * ly);
      if (keep) hh = Math.max(1, (el.h * w) / el.w);
      const dw = w - el.w, dh = hh - el.h;
      const sx = (hx * dw) / 2, sy = (hy * dh) / 2;
      const c = { x: c0.x + sx * cos - sy * sin, y: c0.y + sx * sin + sy * cos };
      let size = el.size;
      if (el.type === "text" && el.size && keep) size = Math.max(6, Math.round(el.size * (w / el.w)));
      h.set((d) => ({ ...d, elements: d.elements.map((x) => (x.id === el.id ? { ...x, w: Math.round(w), h: Math.round(hh), x: Math.round(c.x - w / 2), y: Math.round(c.y - hh / 2), ...(size ? { size } : {}) } : x)) }));
    }, () => h.end());
  };

  /* ---- pointer: rotate ---- */
  const startRotate = (e: RPointerEvent, el: StudioElement) => {
    e.stopPropagation(); e.preventDefault();
    const c = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
    h.begin();
    track((ev) => {
      const p = toPage(ev);
      let deg = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      deg = Math.round(((deg + 540) % 360) - 180);
      h.set((d) => ({ ...d, elements: d.elements.map((x) => (x.id === el.id ? { ...x, rotation: deg } : x)) }));
    }, () => h.end());
  };

  /* ---- pointer: guides. Pressing a ruler makes a new one; pressing an existing one moves it; dropping it off the page removes it ---- */
  const dragGuide = (axis: "x" | "y", index: number | null, e: RPointerEvent) => {
    if (preview || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    if (viewRef.current.lockGuides) return;
    const d0 = docRef.current;
    const limit = docPage(d0)[axis === "x" ? "w" : "h"];
    const at = index ?? (d0.guides?.[axis].length ?? 0);
    let outside = index === null;
    h.begin();
    if (index === null) {
      setView({ ...viewRef.current, guides: true });
      const pos = Math.round(toPage(e)[axis]);
      h.set((d) => ({ ...d, guides: { x: [...(d.guides?.x ?? [])], y: [...(d.guides?.y ?? [])], [axis]: [...(d.guides?.[axis] ?? []), pos] } as { x: number[]; y: number[] } }));
      outside = pos < 0 || pos > limit;
    }
    track((ev) => {
      const pos = Math.round(toPage(ev)[axis]);
      outside = pos < 0 || pos > limit;
      h.set((d) => ({ ...d, guides: { x: [...(d.guides?.x ?? [])], y: [...(d.guides?.y ?? [])], [axis]: (d.guides?.[axis] ?? []).map((g, i) => (i === at ? pos : g)) } as { x: number[]; y: number[] } }));
    }, () => {
      if (outside) h.set((d) => ({ ...d, guides: { x: [...(d.guides?.x ?? [])], y: [...(d.guides?.y ?? [])], [axis]: (d.guides?.[axis] ?? []).filter((_, i) => i !== at) } as { x: number[]; y: number[] } }));
      h.end();
    });
  };
  const removeGuide = (axis: "x" | "y", index: number) => {
    if (viewRef.current.lockGuides) return;
    h.commit((d) => ({ ...d, guides: { x: [...(d.guides?.x ?? [])], y: [...(d.guides?.y ?? [])], [axis]: (d.guides?.[axis] ?? []).filter((_, i) => i !== index) } as { x: number[]; y: number[] } }));
  };

  /* ---- pointer: marquee on the empty page / workspace ---- */
  const startMarquee = (e: RPointerEvent) => {
    if (preview || e.button !== 0) return;
    const base = e.shiftKey ? new Set(selRef.current) : new Set<string>();
    if (!e.shiftKey) { setSel(new Set()); setEditingId(null); }
    const start = toPage(e);
    track((ev) => {
      const p = toPage(ev);
      const r = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      setMarquee(r);
      if (r.w < 3 && r.h < 3) return;
      const hit = docRef.current.elements.filter((x) => !x.hidden && !x.locked && x.x < r.x + r.w && x.x + x.w > r.x && x.y < r.y + r.h && x.y + x.h > r.y).map((x) => x.id);
      setSel(expandSelection(docRef.current.elements, [...base, ...hit]));
    }, () => setMarquee(null));
  };

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const ids = selRef.current;
      const nudge = (dx: number, dy: number) => { e.preventDefault(); const step = e.shiftKey ? 10 : 1; commit((d) => ({ ...d, elements: d.elements.map((x) => (ids.has(x.id) && !x.locked ? { ...x, x: x.x + dx * step, y: x.y + dy * step } : x)) }), `nudge:${[...ids].join(",")}`); };
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); }
      else if (mod && k === "y") { e.preventDefault(); h.redo(); }
      else if (mod && k === "c") { clip.current = docRef.current.elements.filter((x) => ids.has(x.id)).map(clone); }
      else if (mod && k === "v") { e.preventDefault(); if (clip.current.length) duplicate(clip.current); }
      else if (mod && k === "d") { e.preventDefault(); duplicate(); }
      else if (mod && k === "g") { e.preventDefault(); if (e.shiftKey) ungroup(); else group(); }
      else if (mod && k === "a") { e.preventDefault(); setSel(new Set(docRef.current.elements.filter((x) => !x.hidden && !x.locked).map((x) => x.id))); }
      else if (e.key === "Delete" || e.key === "Backspace") { if (ids.size) { e.preventDefault(); remove(); } }
      else if (e.key === "Escape") { setSel(new Set()); setPreview(false); setFull(false); }
      else if (ids.size && e.key === "ArrowLeft") nudge(-1, 0);
      else if (ids.size && e.key === "ArrowRight") nudge(1, 0);
      else if (ids.size && e.key === "ArrowUp") nudge(0, -1);
      else if (ids.size && e.key === "ArrowDown") nudge(0, 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, duplicate, group, ungroup, remove, h]);

  /** PNG, JPG or a PDF made of the picture, drawn by the same code as the bulk download (so it is what the page shows). Uses the sample person. */
  const exportAs = async (kind: "pdf" | "png" | "jpg") => {
    setDlOpen(false); setExporting(kind); setExportError("");
    try {
      const person = { name: recipient.name, affiliation: recipient.affiliation, roleLabel: recipient.roleLabel, paperId: recipient.paperId, paperTitle: recipient.paperTitle, serial: recipient.serial };
      const r = await renderCertificate({ design: { ...cert.design, studio: doc, orientation: doc.orientation }, recipient: person, conference }, { scale: 3, format: kind === "png" ? "png" : "jpeg", quality: 0.95 });
      const base = name.trim() || "certificate";
      if (kind === "pdf") {
        const file = await buildFile("pdf-multi", [{ key: "one", recipient: person }], new Map([["one", r]]), "{serial}", base);
        saveBlob(file.blob, file.filename);
      } else saveBlob(new Blob([r.bytes as BlobPart], { type: r.mime }), `${base.replace(/[\\/:*?"<>|]/g, "_")}.${kind}`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "The file could not be made.");
    } finally { setExporting(null); }
  };

  const ctx: StudioCtx = { doc, page, margin: marginOf(doc), sel, selEls, values, select, commit, patch, add, duplicate: () => duplicate(), remove, group, ungroup, align, distribute, order, upload, restart, addSignature, typeKey: cert.typeKey, templateKey, startEdit: setEditingId, addMany, library: sigService ? { service: sigService, conferenceId: cert.conferenceId } : null, assets: assetService ? { service: assetService, conferenceId: cert.conferenceId } : null, addPicture, assetsVersion, conferenceLogoUrl: conference.logoUrl };

  /* ---- render ---- */
  const px = 1 / zoom;
  const unsigned = doc.elements.find((e) => e.name === "Signatory name" && !e.hidden && isPlaceholderName(e.text));
  const showRulers = view.rulers && !preview;
  const margin = marginOf(doc);
  const single = selEls.length === 1 && !selEls[0].locked && !selEls[0].groupId ? selEls[0] : null;
  const bounds = selEls.length ? boundsOf(selEls) : null;
  const statusView = error ? { icon: CloudOff, text: "Couldn't save — retrying on your next change", color: "var(--danger)" }
    : status === "saving" ? { icon: Loader2, text: "Saving…", color: "var(--ink-muted)" } : { icon: Check, text: "All changes saved", color: "var(--success, #047857)" };
  const StatusIcon = statusView.icon;

  const tbtn = "h-8 px-2.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40";
  return (
    <div style={{ background: "var(--canvas)", ...(full ? { position: "fixed", inset: 0, zIndex: 60 } : { height: "calc(100vh - 64px)", minHeight: 560 }) }} className="flex flex-col">
      {/* top bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)" }} className="relative flex items-center gap-2 px-3 py-2 flex-wrap">
        <button type="button" onClick={() => go("chair-certificates")} style={{ color: "var(--ink-muted)" }} className={tbtn}><ChevronLeft size={15} /> All designs</button>
        <input aria-label="Design name" value={name} onChange={(e) => { setName(e.target.value); actions.updateDesign(cert.id, { name: e.target.value }); }} style={{ ...inputStyle, maxWidth: 180 }} className="px-2.5 py-1.5 rounded-md text-sm font-bold" />
        {unsigned && <button type="button" onClick={() => { setSel(new Set([unsigned.id])); setEditingId(unsigned.id); }} title="A signature still has no name: click to type it" style={{ color: "var(--warning)", border: "1px solid var(--warning-border)", background: "var(--warning-soft)" }} className="text-[11.5px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer"><AlertTriangle size={12} /> Name missing</button>}
        {note && <span role="status" style={{ color: "var(--ink-muted)" }} className="text-[11.5px] font-semibold">{note}</span>}
        {exportError && <span role="alert" style={{ color: "var(--danger)" }} className="text-[11.5px] font-semibold">{exportError}</span>}
        <span role="status" style={{ color: statusView.color }} className="text-[11.5px] font-semibold flex items-center gap-1"><StatusIcon size={13} className={status === "saving" && !error ? "animate-spin" : ""} /> {statusView.text}</span>
        <div className="flex-1" />
        <IconBtn icon={Undo2} title="Undo (Ctrl+Z)" onClick={h.undo} disabled={!h.canUndo} />
        <IconBtn icon={Redo2} title="Redo (Ctrl+Shift+Z)" onClick={h.redo} disabled={!h.canRedo} />
        <span style={{ background: "var(--border)" }} className="w-px h-6 mx-1" />
        <IconBtn icon={ZoomOut} title="Zoom out" onClick={() => zoomBy(-1)} />
        <span style={{ color: "var(--ink-soft)" }} className="text-xs font-bold w-11 text-center tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <IconBtn icon={ZoomIn} title="Zoom in" onClick={() => zoomBy(1)} />
        <IconBtn icon={Scan} title="Fit to screen" active={fit} onClick={() => setFit(true)} />
        <IconBtn icon={RulerIcon} title="Rulers, guides and margins" active={layoutOpen} onClick={() => setLayoutOpen((v) => !v)} />
        <IconBtn icon={full ? Minimize : Maximize} title={full ? "Exit full screen (Esc)" : "Full-screen editing"} onClick={() => setFull((v) => !v)} />
        {layoutOpen && <LayoutMenu view={view} setView={setView} doc={doc} page={page} setGuides={setDocGuides} setMargin={setMargin} onClose={() => setLayoutOpen(false)} />}
        <span style={{ background: "var(--border)" }} className="w-px h-6 mx-1" />
        <button type="button" onClick={() => { setPreview((v) => !v); setSel(new Set()); }} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className={tbtn}>{preview ? <><Pencil size={14} /> Edit</> : <><Eye size={14} /> Preview</>}</button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPrinting(true)} disabled={printing} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className={tbtn} title="Print: opens your browser's print dialog (it shows the sample name; to print one per person use Distribute)"><Printer size={14} /> {printing ? "Preparing…" : "Print"}</button>
          <button type="button" onClick={() => { setTab("design"); setPreview(false); }} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)", background: "#fff" }} className="h-8 px-2 rounded-md text-xs font-bold cursor-pointer max-w-[150px] flex items-center gap-1" aria-label={`Page size: ${labelOf(docPaper(doc))}. Change it in the Design tab`} title={`Page size: ${labelOf(docPaper(doc))}, ${doc.orientation === "landscape" ? `${docPaper(doc).h} × ${docPaper(doc).w}` : `${docPaper(doc).w} × ${docPaper(doc).h}`} mm. Click to change it in the Design tab`}><FileText size={14} className="shrink-0" /><span className="truncate">{docPaper(doc).key === CUSTOM_KEY ? "Custom" : labelOf(docPaper(doc))}</span></button>
        </div>
        <div className="relative">
          <button type="button" onClick={() => setDlOpen((v) => !v)} aria-haspopup="menu" aria-expanded={dlOpen} disabled={exporting !== null} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className={tbtn} title="Download this design (with the sample name)"><Download size={14} /> {exporting ? "Making…" : "Download"}</button>
          {dlOpen && (
            <>
              <div className="fixed inset-0 z-40" onPointerDown={() => setDlOpen(false)} aria-hidden="true" />
              <div role="menu" aria-label="Download" style={{ background: "#fff", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(11,16,32,0.16)" }} className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl p-1.5">
                {([
                  ["PDF", "Sharp picture on the chosen paper, 255 dpi", () => void exportAs("pdf")],
                  ["PNG picture", "Lossless, 3000 px wide", () => void exportAs("png")],
                  ["JPG picture", "Smaller file", () => void exportAs("jpg")],
                ] as const).map(([label, note, run]) => (
                  <button key={label} role="menuitem" type="button" onClick={run} disabled={printing} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--canvas)] cursor-pointer disabled:opacity-50">
                    <span style={{ color: "var(--navy)" }} className="block text-[13px] font-bold">{label}</span>
                    <span style={{ color: "var(--ink-muted)" }} className="block text-[11px]">{note}</span>
                  </button>
                ))}
                <p style={{ color: "var(--ink-faint)" }} className="text-[10.5px] px-3 pt-1 pb-1.5">Shows the sample name. To make one per person, use Distribute.</p>
              </div>
            </>
          )}
        </div>
        <button type="button" onClick={() => go("chair-certificates-distribute", { certId: cert.id })} style={{ background: "var(--gradient-primary)" }} className={`${tbtn} text-white`}><Send size={14} /> Send</button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* left */}
        {!preview && (
          <div style={{ background: "#fff", borderRight: "1px solid var(--border)" }} className="flex shrink-0">
            <nav aria-label="Studio tools" className="w-[68px] py-2 flex flex-col items-stretch" style={{ borderRight: "1px solid var(--border)" }}>
              {TABS.filter((t) => t.key !== "signatures" || sigService).map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key} style={{ color: tab === key ? "var(--primary)" : "var(--ink-muted)", background: tab === key ? "var(--primary-soft)" : "transparent" }} className="py-2.5 flex flex-col items-center gap-1 text-[10.5px] font-bold cursor-pointer">
                  <Icon size={18} /> {label}
                </button>
              ))}
            </nav>
            <div className="w-[250px]"><LeftPanel tab={tab} ctx={ctx} /></div>
          </div>
        )}

        {/* canvas, with rulers */}
        <div className="flex-1 min-w-0 flex flex-col">
          {showRulers && (
            <div className="flex shrink-0">
              <div style={{ width: RULER, height: RULER, background: "#fff", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }} className="shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0 overflow-hidden">
                <Ruler axis="x" origin={geo.ox} length={geo.vw} zoom={zoom} unit={view.unit} unitPx={unitPerPx(doc, view.unit)} extent={bounds ? { from: bounds.x, to: bounds.x + bounds.w } : null} onGuideStart={(_, e) => dragGuide("y", null, e)} />
              </div>
            </div>
          )}
          <div className="flex flex-1 min-h-0">
            {showRulers && (
              <div className="shrink-0 overflow-hidden" style={{ width: RULER }}>
                <Ruler axis="y" origin={geo.oy} length={geo.vh} zoom={zoom} unit={view.unit} unitPx={unitPerPx(doc, view.unit)} extent={bounds ? { from: bounds.y, to: bounds.y + bounds.h } : null} onGuideStart={(_, e) => dragGuide("x", null, e)} />
              </div>
            )}
        <div ref={work} onPointerDown={startMarquee} className="flex-1 min-w-0 overflow-auto" style={{ background: "#E9EDF3" }}>
          <div className="min-w-full min-h-full flex items-center justify-center" style={{ padding: 32, width: "max-content", height: "max-content" }}>
            <div ref={pageRef} style={{ width: page.w * zoom, height: page.h * zoom, position: "relative", flexShrink: 0, boxShadow: "0 10px 30px rgba(11,16,32,0.18)" }} onPointerDown={startMarquee}>
              <div style={{ width: page.w, height: page.h, transform: `scale(${zoom})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
                <StudioPage
                  doc={doc} values={values} serial={recipient.serial} w={page.w} h={page.h} editingId={editingId}
                  elementProps={(el) => preview ? {} : {
                    onPointerDown: (e) => startMove(e, el),
                    onPointerEnter: () => setHoverId(el.id),
                    onPointerLeave: () => setHoverId((cur) => (cur === el.id ? null : cur)),
                    onDoubleClick: () => { if (el.type === "text" && !el.locked) { setSel(new Set([el.id])); setEditingId(el.id); } },
                    style: { cursor: el.locked ? "default" : "move", touchAction: "none", userSelect: "none" },
                  }}
                  editor={(el) => (
                    <span
                      contentEditable={"plaintext-only" as unknown as boolean} suppressContentEditableWarning aria-label="Edit text"
                      ref={(n) => { if (n && document.activeElement !== n) { n.focus(); const r = document.createRange(); r.selectNodeContents(n); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); } }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onBlur={(e) => { const t = e.currentTarget.innerText.replace(/\n$/, ""); if (t !== el.text) patch([el.id], { text: t }); setEditingId(null); }}
                      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); e.currentTarget.blur(); } }}
                      style={{ display: "block", outline: "2px solid #7C3AED", fontFamily: FONTS[el.font ?? "serif"].css, fontSize: el.size, fontWeight: el.weight, fontStyle: el.italic ? "italic" : "normal", color: el.color, textAlign: el.align ?? "center", letterSpacing: el.letterSpacing, lineHeight: el.lineHeight, whiteSpace: "pre-wrap", userSelect: "text" }}
                    >{el.text}</span>
                  )}
                />

                {/* editor-only overlay: never exported */}
                {!preview && (
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden="true">
                    {view.grid && <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(to right, rgba(100,116,139,0.28) ${px}px, transparent ${px}px), linear-gradient(to bottom, rgba(100,116,139,0.28) ${px}px, transparent ${px}px)`, backgroundSize: `${view.gridSize}px ${view.gridSize}px` }} />}
                    {view.margins && <div style={{ position: "absolute", left: margin, top: margin, right: margin, bottom: margin, outline: `${px}px dashed rgba(245,158,11,0.55)`, outlineOffset: 0 }} />}
                    {view.centre && (<>
                      <div style={{ position: "absolute", left: page.w / 2 - px / 2, top: 0, width: px, height: "100%", background: "#06B6D4", opacity: 0.7 }} />
                      <div style={{ position: "absolute", top: page.h / 2 - px / 2, left: 0, height: px, width: "100%", background: "#06B6D4", opacity: 0.7 }} />
                    </>)}
                    {view.guides && (["x", "y"] as const).flatMap((axis) => (doc.guides?.[axis] ?? []).map((pos, i) => {
                      const v = axis === "x";
                      return (
                        <div key={`${axis}${i}`} style={{ position: "absolute", ...(v ? { left: pos - px / 2, top: 0, width: px, height: "100%" } : { top: pos - px / 2, left: 0, height: px, width: "100%" }), background: "#06B6D4" }}>
                          {!view.lockGuides && <div role="presentation" title="Drag to move, drag off the page or double-click to remove" onPointerDown={(e) => dragGuide(axis, i, e)} onDoubleClick={() => removeGuide(axis, i)}
                            style={{ position: "absolute", pointerEvents: "auto", cursor: v ? "col-resize" : "row-resize", touchAction: "none", ...(v ? { left: -4 * px, width: 9 * px, top: 0, height: "100%" } : { top: -4 * px, height: 9 * px, left: 0, width: "100%" }) }} />}
                        </div>
                      );
                    }))}
                    {doc.elements.filter((el) => !el.hidden && el.type === "text" && tokensIn(el.text ?? "").length > 0).map((el) => {
                      // A field is marked by a small dot; its box and a "field" label appear only when the pointer is on it or it is selected.
                      const on = hoverId === el.id || sel.has(el.id);
                      return (
                        <div key={`d${el.id}`} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, transform: `rotate(${el.rotation}deg)`, outline: on ? `${px}px dashed #A78BFA` : "none" }}>
                          <span style={{ position: "absolute", top: on ? -14 * px : -3 * px, right: on ? 0 : -3 * px, fontSize: (on ? 9 : 7) * px * 1.2, fontWeight: 700, background: "#7C3AED", color: "#fff", padding: on ? `${px}px ${4 * px}px` : `0 ${3 * px}px`, borderRadius: 3 * px, fontFamily: "system-ui, sans-serif", lineHeight: 1.3, opacity: on ? 1 : 0.55 }}>{on ? "{ } field" : "{ }"}</span>
                        </div>
                      );
                    })}
                    {selEls.filter((el) => !el.hidden).map((el) => (
                      <div key={`s${el.id}`} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, transform: `rotate(${el.rotation}deg)`, outline: `${1.5 * px}px solid #7C3AED`, opacity: selEls.length > 1 || el.groupId ? 0.6 : 1 }} />
                    ))}
                    {bounds && selEls.length > 1 && <div style={{ position: "absolute", left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h, outline: `${1.5 * px}px dashed #7C3AED` }} />}
                    {single && !editingId && (
                      <div style={{ position: "absolute", left: single.x, top: single.y, width: single.w, height: single.h, transform: `rotate(${single.rotation}deg)` }}>
                        {HANDLES.map((hd) => (
                          <div key={hd.k} role="presentation" onPointerDown={(e) => startResize(e, single, hd.hx, hd.hy)}
                            style={{ position: "absolute", left: `${(hd.hx + 1) * 50}%`, top: `${(hd.hy + 1) * 50}%`, width: 10 * px, height: 10 * px, marginLeft: -5 * px, marginTop: -5 * px, background: "#fff", border: `${1.5 * px}px solid #7C3AED`, borderRadius: 2 * px, cursor: hd.cursor, pointerEvents: "auto", touchAction: "none" }} />
                        ))}
                        <div style={{ position: "absolute", left: "50%", top: -26 * px, width: 1.5 * px, height: 18 * px, background: "#7C3AED", marginLeft: -0.75 * px }} />
                        <div role="presentation" title="Rotate (hold Shift for 15° steps)" onPointerDown={(e) => startRotate(e, single)}
                          style={{ position: "absolute", left: "50%", top: -36 * px, width: 14 * px, height: 14 * px, marginLeft: -7 * px, background: "#fff", border: `${1.5 * px}px solid #7C3AED`, borderRadius: "50%", cursor: "grab", pointerEvents: "auto", touchAction: "none" }} />
                      </div>
                    )}
                    {guides.map((g, i) => g.axis === "x"
                      ? <div key={i} style={{ position: "absolute", left: g.pos - px / 2, top: 0, width: px, height: "100%", background: "#EC4899" }} />
                      : <div key={i} style={{ position: "absolute", top: g.pos - px / 2, left: 0, height: px, width: "100%", background: "#EC4899" }} />)}
                    {marquee && <div style={{ position: "absolute", left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, background: "rgba(124,58,237,0.08)", border: `${px}px solid #7C3AED` }} />}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>

        {/* right */}
        {!preview && (
          <aside aria-label="Properties" style={{ background: "#fff", borderLeft: "1px solid var(--border)" }} className="w-[270px] shrink-0 hidden lg:block"><Properties ctx={ctx} /></aside>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{sel.size ? `${sel.size} selected` : "Nothing selected"}</p>
      {printing && (
        <PrintCertificate
          item={{ cert: { typeKey: cert.typeKey, design: { ...cert.design, studio: doc, orientation: doc.orientation } }, recipient: { name: recipient.name, affiliation: recipient.affiliation, roleLabel: recipient.roleLabel, paperId: recipient.paperId ?? "", paperTitle: recipient.paperTitle ?? "", serial: recipient.serial }, conference }}
          onDone={() => setPrinting(false)}
        />
      )}
    </div>
  );
}
