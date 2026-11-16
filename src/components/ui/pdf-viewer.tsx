"use client";

import { ChevronDown, ChevronUp, Minus, Plus, Search, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import "pdfjs-dist/web/pdf_viewer.css";

/* The paper preview on the review pages: our own light PDF reader instead of the browser's (dark toolbar, thumbnail sidebar) — the prototype's
   src/shared/PdfViewer.jsx. pdf.js draws every page (a canvas plus a transparent text layer, so text can be selected and searched); a slim toolbar gives
   the page number, zoom (fits the width by default) and search across the whole paper. A page is drawn only when it scrolls close to view. `url` is a stored
   paper's short-lived link. pdf.js is loaded on demand, so it is not in the app's main bundle. */

const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3];
const PAGE_GAP = 12;
const SIDE_PAD = 20;
const CSS = `.pv-hit{background:rgba(250,204,21,.55);border-radius:2px}.pv-hit.pv-now{background:rgba(249,115,22,.65)}.pv-text{position:absolute;inset:0;overflow:hidden;line-height:1;opacity:1}`;

type PdfJs = typeof import("pdfjs-dist");
let ready: Promise<PdfJs> | null = null;
async function getPdfjs(): Promise<PdfJs> {
  if (!ready) {
    ready = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      return lib;
    });
  }
  return ready;
}

interface Size { w: number; h: number }

function PdfPage({ pdf, n, w, h, scale, root, query, nowIndex, onNear, pageRef }: { pdf: PDFDocumentProxy; n: number; w: number; h: number; scale: number; root: HTMLElement | null; query: string; nowIndex: number; onNear?: (n: number) => void; pageRef: (n: number, el: HTMLElement | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  const [drawn, setDrawn] = useState(0);

  // Draw only pages that are close to the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !root) return undefined;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { root, rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!near) return undefined;
    let cancelled = false;
    let task: { promise: Promise<unknown>; cancel: () => void } | null = null;
    let layer: { render: () => Promise<unknown>; cancel: () => void } | null = null;
    (async () => {
      const lib = await getPdfjs();
      const page = await pdf.getPage(n);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = page.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      await task.promise;
      if (cancelled) return;
      const box = textRef.current;
      if (!box) return;
      box.replaceChildren();
      box.style.setProperty("--scale-factor", String(scale));
      layer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: box, viewport });
      await layer.render();
      if (!cancelled) setDrawn((d) => d + 1);
    })().catch((e: unknown) => {
      // A page that scrolled away or was redrawn at a new zoom cancels its own work; that is expected, not a failure.
      const name = (e as { name?: string })?.name;
      if (name !== "RenderingCancelledException" && name !== "AbortException") console.warn("PDF page failed", n, e);
    });
    return () => { cancelled = true; task?.cancel(); layer?.cancel(); };
  }, [near, pdf, n, scale]);

  // Mark the words of the search on this page; the current one gets its own colour.
  useEffect(() => {
    const box = textRef.current;
    if (!box) return;
    const q = query.toLowerCase();
    let k = 0;
    [...box.children].forEach((el) => {
      const hit = !!q && (el.textContent || "").toLowerCase().includes(q);
      el.classList.toggle("pv-hit", hit);
      el.classList.toggle("pv-now", hit && k === nowIndex);
      if (hit) k += 1;
    });
  }, [query, nowIndex, drawn]);

  useEffect(() => { if (near) onNear?.(n); }, [near, n, onNear]);

  return (
    <div ref={(el) => { wrapRef.current = el; pageRef(n, el); }} data-page={n} style={{ width: w * scale, height: h * scale, boxShadow: "0 1px 3px rgba(15,23,42,0.18), 0 6px 16px rgba(15,23,42,0.08)", marginBottom: PAGE_GAP }} className="relative mx-auto shrink-0 bg-white">
      <canvas ref={canvasRef} className="block" />
      <div ref={textRef} className="textLayer pv-text" />
    </div>
  );
}

export function PdfViewer({ url, onOpenExternal }: { url: string; onOpenExternal?: () => void }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const pageEls = useRef<Record<number, HTMLElement | null>>({});
  const [doc, setDoc] = useState<{ pdf: PDFDocumentProxy; sizes: Size[] } | null>(null);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null); // null = fit the width
  const [current, setCurrent] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<number[]>([]); // matching text runs per page
  const [hitIndex, setHitIndex] = useState(0);
  const textCache = useRef<Record<number, string[]>>({});

  useEffect(() => {
    let dead = false;
    let task: { promise: Promise<PDFDocumentProxy>; destroy?: () => void } | null = null;
    (async () => {
      try {
        const lib = await getPdfjs();
        const res = await fetch(url);
        if (!res.ok) throw new Error(`The paper couldn't be loaded (${res.status}).`);
        const buf = await res.arrayBuffer();
        task = lib.getDocument({ data: buf });
        const pdf = await task.promise;
        const sizes = await Promise.all(Array.from({ length: pdf.numPages }, async (_, i) => { const v = (await pdf.getPage(i + 1)).getViewport({ scale: 1 }); return { w: v.width, h: v.height }; }));
        if (!dead) setDoc({ pdf, sizes });
      } catch (e) {
        if (!dead) setError(e instanceof Error && e.message ? e.message : "The paper couldn't be shown.");
      }
    })();
    return () => { dead = true; task?.destroy?.(); };
  }, [url]);

  useEffect(() => {
    if (!root) return undefined;
    const ro = new ResizeObserver(() => setWidth(root.clientWidth));
    ro.observe(root);
    return () => ro.disconnect();
  }, [root]);

  const widest = doc ? Math.max(...doc.sizes.map((s) => s.w)) : 612;
  const fit = Math.min(3, Math.max(0.4, (width - SIDE_PAD * 2) / widest));
  const scale = zoom ?? fit;
  const total = doc?.sizes.length || 0;

  // The page in view: the first one whose bottom is below the top third of the scroller.
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || !total) return;
    const line = el.scrollTop + el.clientHeight / 3;
    let n = 1;
    for (let i = 1; i <= total; i += 1) { const p = pageEls.current[i]; if (p && p.offsetTop + p.offsetHeight > line) { n = i; break; } n = i; }
    setCurrent(n);
  };
  const goTo = (n: number) => {
    const target = Math.min(Math.max(1, n), total);
    const p = pageEls.current[target];
    if (p && scrollerRef.current) scrollerRef.current.scrollTo({ top: p.offsetTop - PAGE_GAP, behavior: "smooth" });
  };
  const zoomTo = (next: number) => {
    const el = scrollerRef.current;
    const ratio = next / scale;
    setZoom(next);
    if (el) requestAnimationFrame(() => { el.scrollTop *= ratio; });
  };
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > scale + 0.01) : [...ZOOM_STEPS].reverse().find((z) => z < scale - 0.01);
    if (next) zoomTo(next);
  };

  // Search: how many text runs on each page contain the words; Enter / the arrows move between them.
  const runSearch = async (text: string) => {
    const q = text.trim();
    setQuery(q); setHitIndex(0);
    if (!q || !doc) { setHits([]); return; }
    const lower = q.toLowerCase();
    const counts: number[] = [];
    for (let i = 1; i <= total; i += 1) {
      if (!textCache.current[i]) {
        const content = await (await doc.pdf.getPage(i)).getTextContent();
        textCache.current[i] = content.items.flatMap((it) => ("str" in it && typeof it.str === "string" ? [it.str.toLowerCase()] : []));
      }
      counts.push(textCache.current[i].filter((s) => s.includes(lower)).length);
    }
    setHits(counts);
    const first = counts.findIndex((c) => c > 0);
    if (first >= 0) setTimeout(() => goTo(first + 1), 0);
  };
  const totalHits = hits.reduce((a, b) => a + b, 0);
  // Which page and which match on it the current number points to.
  const where = (() => { let left = hitIndex; for (let i = 0; i < hits.length; i += 1) { if (left < hits[i]) return { page: i + 1, local: left }; left -= hits[i]; } return { page: 0, local: -1 }; })();
  const jump = (dir: 1 | -1) => {
    if (!totalHits) return;
    const next = (hitIndex + dir + totalHits) % totalHits;
    setHitIndex(next);
    let left = next; let page = 1;
    for (let i = 0; i < hits.length; i += 1) { if (left < hits[i]) { page = i + 1; break; } left -= hits[i]; }
    goTo(page);
    setTimeout(() => { document.querySelector(`[data-page="${page}"] .pv-now`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }, 350);
  };
  const closeSearch = () => { setSearchOpen(false); setDraft(""); setQuery(""); setHits([]); };

  const btn = "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40";
  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-danger">{error}</p>
        {onOpenExternal && <button type="button" onClick={onOpenExternal} className="cursor-pointer text-sm font-bold text-primary hover:underline">Open the paper in a new tab</button>}
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col">
      <style>{CSS}</style>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-white px-3 py-1.5">
        <button type="button" disabled={!doc || current <= 1} onClick={() => goTo(current - 1)} aria-label="Previous page" title="Previous page" className={btn}><ChevronUp size={16} aria-hidden="true" /></button>
        <button type="button" disabled={!doc || current >= total} onClick={() => goTo(current + 1)} aria-label="Next page" title="Next page" className={btn}><ChevronDown size={16} aria-hidden="true" /></button>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
          <input value={pageDraft ?? String(current)} onFocus={(e) => { setPageDraft(String(current)); e.target.select(); }} onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ""))} onBlur={() => setPageDraft(null)}
            onKeyDown={(e) => { if (e.key === "Enter") { goTo(Number(pageDraft) || current); e.currentTarget.blur(); } }} aria-label="Page number" className="h-7 w-10 rounded-md border-[1.5px] border-line text-center text-xs font-bold text-ink outline-none focus:border-primary" />
          of {total || "–"}
        </span>
        <span className="mx-1.5 h-5 w-px bg-line" aria-hidden="true" />
        <button type="button" disabled={!doc} onClick={() => step(-1)} aria-label="Zoom out" title="Zoom out" className={btn}><Minus size={15} aria-hidden="true" /></button>
        <button type="button" disabled={!doc} onClick={() => setZoom(null)} title="Fit to width" className={`h-8 min-w-[52px] cursor-pointer rounded-lg px-1.5 text-xs font-bold tabular-nums hover:bg-canvas disabled:opacity-40 ${zoom == null ? "text-primary" : "text-ink-soft"}`}>{Math.round(scale * 100)}%</button>
        <button type="button" disabled={!doc} onClick={() => step(1)} aria-label="Zoom in" title="Zoom in" className={btn}><Plus size={15} aria-hidden="true" /></button>
        <span className="flex-1" />
        {searchOpen ? (
          <span className="inline-flex h-8 items-center gap-1 rounded-lg border-[1.5px] border-line bg-white pl-2 pr-1 focus-within:border-primary">
            <Search size={13} aria-hidden="true" className="text-ink-faint" />
            <input autoFocus value={draft} onChange={(e) => { setDraft(e.target.value); if (!e.target.value.trim()) { setQuery(""); setHits([]); } }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { if (e.shiftKey) jump(-1); else if (e.currentTarget.value.trim() === query && totalHits) jump(1); else void runSearch(e.currentTarget.value); }
                if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
              }} placeholder="Search the paper" aria-label="Search the paper" className="w-36 bg-transparent text-xs text-ink outline-none placeholder:text-slate-400" />
            {query && <span className={`whitespace-nowrap px-1 text-[11px] font-semibold tabular-nums ${totalHits ? "text-ink-muted" : "text-danger"}`}>{totalHits ? `${hitIndex + 1} of ${totalHits}` : "No results"}</span>}
            <button type="button" disabled={!totalHits} onClick={() => jump(-1)} aria-label="Previous result" className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:bg-canvas disabled:opacity-40"><ChevronUp size={14} aria-hidden="true" /></button>
            <button type="button" disabled={!totalHits} onClick={() => jump(1)} aria-label="Next result" className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:bg-canvas disabled:opacity-40"><ChevronDown size={14} aria-hidden="true" /></button>
            <button type="button" onClick={closeSearch} aria-label="Close search" className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:bg-canvas"><X size={14} aria-hidden="true" /></button>
          </span>
        ) : <button type="button" disabled={!doc} onClick={() => setSearchOpen(true)} aria-label="Search the paper" title="Search the paper" className={btn}><Search size={15} aria-hidden="true" /></button>}
      </div>
      <div ref={(el) => { scrollerRef.current = el; if (el !== root) setRoot(el); }} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto bg-canvas">
        {!doc ? <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink-muted">Loading the paper…</div> : (
          <div style={{ padding: `${PAGE_GAP}px ${SIDE_PAD}px 0`, width: "max-content", minWidth: "100%" }}>
            {doc.sizes.map((s, i) => <PdfPage key={i} pdf={doc.pdf} n={i + 1} w={s.w} h={s.h} scale={scale} root={root} query={query} nowIndex={where.page === i + 1 ? where.local : -1} pageRef={(n, el) => { pageEls.current[n] = el; }} />)}
          </div>
        )}
      </div>
    </div>
  );
}
