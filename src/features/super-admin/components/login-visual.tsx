/* Super Admin sign-in: the "Global Conference Operations" illustration on the brand panel (ported
   from the prototype's LoginVisual.jsx). A convention centre stands in for the platform; sample
   conferences hang off it on network lines, with a platform-overview card in front. Laid out once
   on a fixed design canvas and scaled to the space it gets; below ~500px wide it switches to a
   compact layout. Fixed sample content only (it renders before sign-in), never live data. */
"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Activity, Bot, BrainCircuit, CalendarRange, Cpu, FileText, HeartPulse, KeyRound, ShieldCheck, type LucideIcon } from "lucide-react";

const ART = {
  navy: "#0B1020",
  deep: "#2E1065",
  indigo: "#4C1D95",
  glass: "#6D28D9",
  light: "#F5F3FF",
  lilac: "#DDD6FE",
  line: "rgba(165,180,252,0.38)",
  cyan: "#06B6D4",
};

interface Conference {
  key: string;
  name: string;
  status: string;
  tone: string;
  papers: string;
  icon: LucideIcon;
  tile: string;
}

const CONFERENCES: Conference[] = [
  { key: "icds", name: "ICDS 2027", status: "Active", tone: "#16A34A", papers: "1,284", icon: BrainCircuit, tile: "linear-gradient(135deg,#7C3AED,#06B6D4)" },
  { key: "medtech", name: "MEDTECH 2026", status: "Published", tone: "#16A34A", papers: "846", icon: HeartPulse, tile: "linear-gradient(135deg,#0D9488,#06B6D4)" },
  { key: "robosys", name: "ROBOSYS 2026", status: "In review", tone: "#D97706", papers: "412", icon: Bot, tile: "linear-gradient(135deg,#7C3AED,#7C3AED)" },
  { key: "smartcom", name: "SMARTCOM 2026", status: "Draft", tone: "#94A3B8", papers: "0", icon: Cpu, tile: "linear-gradient(135deg,#8B5CF6,#8B5CF6)" },
];

const CARD_W = 164;
const CARD_H = 82;
const OVERVIEW_W = 240;
const ART_W = 360; // ConventionCentre viewBox
const ART_H = 240;

type Point = [number, number];
interface Layout {
  w: number;
  h: number;
  building: { x: number; y: number; w: number };
  cards: Record<string, Point>;
  overview: Point;
}

const LAYOUTS: Record<"full" | "compact", Layout> = {
  full: {
    w: 640,
    h: 368,
    building: { x: 130, y: 110, w: 380 },
    cards: { icds: [0, 96], medtech: [154, 6], robosys: [330, 6], smartcom: [476, 96] },
    overview: [400, 272],
  },
  compact: {
    w: 440,
    h: 368,
    building: { x: 30, y: 110, w: 380 },
    cards: { medtech: [36, 6], robosys: [240, 6] },
    overview: [196, 272],
  },
};

const hubOf = (b: Layout["building"]): Point => {
  const k = b.w / ART_W;
  return [b.x + 180 * k, b.y + 80 * k];
};

function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const L = LAYOUTS[box.w && box.w < 500 ? "compact" : "full"];
  const scale = box.w ? Math.max(0.5, Math.min(box.w / L.w, box.h / L.h, 1.25)) : 0;
  return { ref, L, scale };
}

export function PlatformScene() {
  const { ref, L, scale } = useFit();
  const [hx, hy] = hubOf(L.building);
  const bh = (L.building.w / ART_W) * ART_H;
  const cards = CONFERENCES.filter((c) => L.cards[c.key]);

  return (
    <div ref={ref} className="relative flex-1 min-h-0 w-full" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2" style={{ width: L.w, height: L.h, transform: `translate(-50%,-50%) scale(${scale})`, opacity: scale ? 1 : 0 }}>
        {/* soft light pooled under the building */}
        <div
          className="absolute rounded-[50%]"
          style={{ left: L.building.x + 20, top: L.building.y + bh * 0.45, width: L.building.w - 40, height: bh * 0.6, background: "radial-gradient(ellipse,rgba(99,102,241,0.45),rgba(99,102,241,0) 70%)", filter: "blur(6px)" }}
        />

        {/* network lines: hub on the roof → bottom-centre of each card */}
        <svg className="absolute inset-0" width={L.w} height={L.h} viewBox={`0 0 ${L.w} ${L.h}`}>
          {cards.map((c) => {
            const [x, y] = L.cards[c.key];
            const ax = x + CARD_W / 2;
            const ay = y + CARD_H;
            const midY = (ay + hy) / 2;
            return (
              <g key={c.key}>
                <path d={`M${ax} ${ay} C ${ax} ${midY}, ${hx} ${midY}, ${hx} ${hy}`} fill="none" stroke={ART.line} strokeWidth="1" strokeDasharray="3 4" />
                <circle cx={ax} cy={ay + 1} r="2.5" fill={ART.lilac} />
              </g>
            );
          })}
        </svg>

        <ConventionCentre style={{ position: "absolute", left: L.building.x, top: L.building.y, width: L.building.w }} />

        {/* hub node on the roof */}
        <span className="absolute w-3 h-3 rounded-full" style={{ left: hx - 6, top: hy - 6, background: ART.cyan, boxShadow: `0 0 0 5px rgba(6,182,212,0.18), 0 0 18px ${ART.cyan}` }} />

        {cards.map((c) => (
          <ConferenceCard key={c.key} conf={c} at={L.cards[c.key]} />
        ))}
        <OverviewCard at={L.overview} />
      </div>
    </div>
  );
}

function ConferenceCard({ conf, at }: { conf: Conference; at: Point }) {
  const Icon = conf.icon;
  return (
    <div
      className="absolute rounded-xl bg-white px-3 py-2.5 flex flex-col justify-between"
      style={{ left: at[0], top: at[1], width: CARD_W, height: CARD_H, boxShadow: "0 14px 32px rgba(3,6,23,0.45), 0 0 0 1px rgba(255,255,255,0.6)" }}
    >
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-white shrink-0" style={{ background: conf.tile }}>
          <Icon size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: "var(--text)" }}>
            {conf.name}
          </p>
          <p className="flex items-center gap-1 text-[10.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: conf.tone }} />
            {conf.status}
          </p>
        </div>
      </div>
      <p className="text-[10.5px] pt-1.5 border-t" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
        <span className="font-semibold" style={{ color: "var(--text)" }}>
          {conf.papers}
        </span>{" "}
        papers
      </p>
    </div>
  );
}

function OverviewCard({ at }: { at: Point }) {
  return (
    <div
      className="absolute rounded-xl px-4 py-3 text-white"
      style={{
        left: at[0],
        top: at[1],
        width: OVERVIEW_W,
        background: "rgba(11,16,32,0.82)",
        border: "1px solid rgba(129,140,248,0.45)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 18px 40px rgba(3,6,23,0.55), 0 0 24px rgba(99,102,241,0.25)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold">Platform overview</p>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(22,163,74,0.18)", color: "#4ADE80" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ADE80" }} />
          Live
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-3 mt-2.5">
        {[
          ["340+", "Conferences"],
          ["08", "Pending"],
          ["99.9%", "Uptime"],
        ].map(([n, label]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-[10.5px] leading-tight" style={{ color: "rgba(255,255,255,0.58)" }}>
              {label}
            </dt>
            <dd className="order-first text-[16px] font-semibold tracking-tight">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* Isometric convention centre (2:1): glass hall with a lit facade grid, overhanging roof, a lower
   annex, a plaza slab with trees, and the Smartconferu banner. */
function ConventionCentre({ style }: { style: CSSProperties }) {
  const mullionsL = Array.from({ length: 10 }, (_, i) => 70 + i * 11);
  const mullionsR = Array.from({ length: 10 }, (_, i) => 191 + i * 11);
  const trees: Point[] = [
    [28, 146],
    [46, 156],
    [64, 166],
    [100, 184],
    [118, 193],
    [300, 166],
    [318, 156],
    [336, 146],
    [262, 186],
  ];
  return (
    <svg viewBox="0 0 360 240" style={style}>
      <defs>
        <linearGradient id="sa-wall-l" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ART.indigo} />
          <stop offset="1" stopColor={ART.deep} />
        </linearGradient>
        <linearGradient id="sa-wall-r" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ART.glass} />
          <stop offset="1" stopColor={ART.indigo} />
        </linearGradient>
        <linearGradient id="sa-roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor={ART.lilac} />
        </linearGradient>
        <linearGradient id="sa-plaza" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(99,102,241,0.30)" />
          <stop offset="1" stopColor="rgba(49,46,129,0.55)" />
        </linearGradient>
      </defs>

      {/* plaza slab */}
      <polygon points="180,62 352,148 180,234 8,148" fill="url(#sa-plaza)" stroke="rgba(165,180,252,0.45)" strokeWidth="0.8" />
      <polygon points="8,148 180,234 180,240 8,154" fill={ART.deep} />
      <polygon points="180,234 352,148 352,154 180,240" fill={ART.navy} />
      <polygon points="214,170 262,194 250,200 202,176" fill="rgba(224,231,255,0.25)" />

      {/* main hall walls */}
      <polygon points="70,80 180,135 180,185 70,130" fill="url(#sa-wall-l)" />
      <polygon points="180,135 290,80 290,130 180,185" fill="url(#sa-wall-r)" />
      {mullionsL.map((x) => (
        <line key={`l${x}`} x1={x} y1={80 + (x - 70) * 0.5} x2={x} y2={130 + (x - 70) * 0.5} stroke="rgba(165,180,252,0.35)" strokeWidth="0.6" />
      ))}
      {mullionsR.map((x) => (
        <line key={`r${x}`} x1={x} y1={135 - (x - 180) * 0.5} x2={x} y2={185 - (x - 180) * 0.5} stroke="rgba(199,210,254,0.45)" strokeWidth="0.6" />
      ))}
      {[16, 32].map((k) => (
        <g key={k}>
          <line x1="70" y1={80 + k} x2="180" y2={135 + k} stroke="rgba(165,180,252,0.35)" strokeWidth="0.6" />
          <line x1="180" y1={135 + k} x2="290" y2={80 + k} stroke="rgba(199,210,254,0.5)" strokeWidth="0.6" />
        </g>
      ))}
      <polygon points="180,170 290,115 290,130 180,185" fill="rgba(253,230,138,0.22)" />
      <polygon points="70,115 180,170 180,185 70,130" fill="rgba(253,230,138,0.12)" />

      {/* roof with overhang */}
      <polygon points="180,22 302,79 180,140 58,79" fill="url(#sa-roof)" />
      <polygon points="58,79 180,140 180,146 58,85" fill={ART.lilac} />
      <polygon points="180,140 302,79 302,85 180,146" fill="#C4B5FD" />
      <polygon points="180,40 266,80 180,122 94,80" fill="none" stroke="rgba(124, 58, 237,0.18)" strokeWidth="0.8" />
      <polygon points="150,62 210,90 196,97 136,69" fill="rgba(124, 58, 237,0.12)" />

      {/* banner on the right facade */}
      <g transform="translate(206,140) skewY(-26.565)">
        <rect x="0" y="0" width="70" height="11" rx="1.5" fill={ART.navy} stroke="rgba(165,180,252,0.6)" strokeWidth="0.5" />
        <text x="35" y="7.6" textAnchor="middle" fontSize="5.6" fontWeight="700" letterSpacing="0.6" fill="#FFFFFF">
          SMARTCONFERU
        </text>
      </g>

      {/* lower annex, front-right */}
      <polygon points="232,150 292,180 292,196 232,166" fill="url(#sa-wall-l)" />
      <polygon points="292,180 332,160 332,176 292,196" fill="url(#sa-wall-r)" />
      <polygon points="272,130 332,160 292,180 232,150" fill="url(#sa-roof)" />

      {trees.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y + 4} rx="5" ry="2.2" fill="rgba(3,6,23,0.35)" />
          <circle cx={x} cy={y} r="4.6" fill="#1E3A5F" />
          <circle cx={x - 1.2} cy={y - 1.2} r="2.4" fill="#2C5282" />
        </g>
      ))}
    </svg>
  );
}

const MODULES: [LucideIcon, string][] = [
  [CalendarRange, "Conferences"],
  [KeyRound, "Licenses"],
  [FileText, "CFP pages"],
  [ShieldCheck, "Approvals"],
  [Activity, "Platform activity"],
];

/* What the Super Admin controls: an illustration strip, not navigation. */
export function ModuleStrip() {
  return (
    <div className="relative flex justify-between" aria-hidden="true">
      <span className="absolute left-[10%] right-[10%] top-[17px] border-t border-dashed" style={{ borderColor: "rgba(165,180,252,0.28)" }} />
      {MODULES.map(([Icon, label]) => (
        <div key={label} className="relative flex flex-col items-center gap-1.5 w-[20%]">
          <span className="w-9 h-9 rounded-full inline-flex items-center justify-center" style={{ background: ART.deep, border: "1px solid rgba(165,180,252,0.35)", color: ART.light }}>
            <Icon size={16} strokeWidth={1.8} />
          </span>
          <span className="text-[11.5px] text-center leading-tight" style={{ color: "rgba(255,255,255,0.72)" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
