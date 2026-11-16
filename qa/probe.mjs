// In-page collectors + comparers shared by run-audit.mjs. No app-specific selectors: elements are matched
// across the two apps by role + visible text (or placeholder / accessible name), never by DOM position or class.

/** Runs inside the page. Returns { controls, elements }. */
export function collectInPage() {
  // Keep a trailing "*" in labels (it is the visible required marker); name matching strips it later in the comparer.
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const labelOf = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria) return norm(aria);
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return norm(l.textContent); }
    const wrap = el.closest("label");
    if (wrap) return norm(wrap.textContent);
    // a label-looking text node just above in the same field wrapper
    const box = el.parentElement?.closest("div,fieldset,section");
    const t = box && [...box.querySelectorAll("label,span,p,div")].find((n) => n !== el && !n.querySelector("input,select,textarea,button") && n.textContent.trim() && n.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    return t ? norm(t.textContent).slice(0, 60) : "";
  };
  const inChrome = (el) => !!el.closest("header, nav, aside, [role=navigation]") || (el.getBoundingClientRect().bottom + window.scrollY <= 64);
  const controls = [...document.querySelectorAll("input,select,textarea,button")].filter((el) => visible(el) && !inChrome(el)).map((el) => {
    const tag = el.tagName.toLowerCase();
    const label = tag === "button" ? norm(el.textContent) : labelOf(el);
    return {
      tag, type: tag === "input" ? el.type : tag === "button" ? (el.getAttribute("type") || "button") : tag, label,
      placeholder: el.getAttribute("placeholder") || "",
      required: el.required || el.getAttribute("aria-required") === "true" || /\*\s*$/.test(label) || /\*\s*$/.test(el.closest("label")?.textContent || "") || /\*/.test(el.placeholder || ""),
      disabled: el.disabled || el.getAttribute("aria-disabled") === "true",
      value: tag === "input" && (el.type === "checkbox" || el.type === "radio") ? String(el.checked) : (el.value || "").slice(0, 40),
      options: tag === "select" ? [...el.options].map((o) => norm(o.textContent)) : undefined,
    };
  });

  const PROPS = ["width", "height", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginBottom",
    "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "color", "backgroundColor",
    "backgroundImage", "borderTopWidth", "borderTopStyle", "borderTopColor", "borderBottomWidth", "borderBottomColor", "borderRadius", "boxShadow",
    "display", "justifyContent", "alignItems", "gap", "position", "overflowX", "overflowY", "visibility", "opacity"];
  const roleOf = (el) => {
    const t = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(t)) return "heading";
    if (t === "button" || el.getAttribute("role") === "button") return "button";
    if (t === "a") return "link";
    if (t === "input" || t === "select" || t === "textarea") return t === "input" ? `input:${el.type}` : t;
    if (t === "label") return "label";
    if (t === "th") return "th";
    return null;
  };
  // Normalise every colour function (rgb/rgba/oklab/oklch/color-mix/...) to rgba() via a canvas, so the same colour
  // written two ways (prototype: rgba(), Tailwind v4: oklab()) never shows up as a difference.
  const g = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const toRgba = (v) => { g.clearRect(0, 0, 1, 1); g.fillStyle = "#000"; g.fillStyle = v; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return "rgba(" + d[0] + ", " + d[1] + ", " + d[2] + ", " + (Math.round(d[3] / 255 * 100) / 100) + ")"; };
  const COLORISH = /(?:rgba?|oklab|oklch|lab|lch|hsla?|color-mix|color)\((?:[^()]|\([^()]*\))*\)/g;
  const COLOR_PROPS = new Set(["color", "backgroundColor", "borderTopColor", "borderBottomColor", "boxShadow", "backgroundImage"]);
  const seen = new Map();
  const elements = [];
  for (const el of document.querySelectorAll("h1,h2,h3,h4,button,[role=button],a,input,select,textarea,label,th")) {
    if (!visible(el)) continue;
    const role = roleOf(el);
    const text = norm(el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || labelOf(el)).replace(/\s*\*/g, "").slice(0, 48).toLowerCase();
    if (!role || !text) continue;
    const base = `${role}|${text}`;
    const n = (seen.get(base) || 0) + 1; seen.set(base, n);
    const cs = getComputedStyle(el);
    const style = {};
    for (const p of PROPS) style[p] = COLOR_PROPS.has(p) && cs[p] ? cs[p].replace(COLORISH, (m) => { try { return toRgba(m); } catch { return m; } }) : cs[p];
    elements.push({ key: n > 1 ? `${base}#${n}` : base, role, text, style, textless: !(el.textContent || '').trim() });
  }
  return { controls, elements };
}

const normFont = (v) => (/jakarta/i.test(v) ? "Plus Jakarta Sans" : v.split(",")[0].replace(/["']/g, "").trim());
const px = (v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : null);
// Severity per property group (matches the project's Critical/High/Medium/Low scale; Critical is reserved for missing elements/behaviour).
const HIGH = new Set(["fontSize", "fontWeight", "fontFamily", "height", "borderRadius", "color", "backgroundColor", "backgroundImage", "lineHeight", "display"]);
const MED = new Set(["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginBottom", "gap", "boxShadow", "borderTopWidth", "borderTopColor", "borderTopStyle", "borderBottomWidth", "borderBottomColor", "width"]);

export function compareStyles(proto, next) {
  const pm = new Map(proto.elements.map((e) => [e.key, e]));
  const nm = new Map(next.elements.map((e) => [e.key, e]));
  const diffs = [], onlyProto = [], onlyNext = [];
  for (const [k, p] of pm) {
    const n = nm.get(k);
    if (!n) { onlyProto.push(k); continue; }
    const flat = (g, other) => { const toks = (g.backgroundImage || "").match(/rgba\([^)]*\)/g); return g.backgroundImage.startsWith("linear-gradient") && toks && toks.every((t) => t === toks[0]) && other.backgroundImage === "none" && (closeEnough(toks[0], other.backgroundColor)); };
    const sameFlat = flat(p.style, n.style) || flat(n.style, p.style);
    for (const prop of Object.keys(p.style)) {
      if (sameFlat && (prop === "backgroundImage" || prop === "backgroundColor")) continue; // identical-stop gradient renders as the solid colour
      let a = p.style[prop], b = n.style[prop];
      if (prop === "fontFamily") { a = normFont(a); b = normFont(b); }
      if (a === b || closeEnough(String(a), String(b))) continue;
      const pa = px(a), pb = px(b);
      if (pa !== null && pb !== null && Math.abs(pa - pb) <= 0.6) continue; // sub-pixel rounding
      diffs.push({ element: k, property: prop, prototype: a, next: b, severity: p.textless && n.textless && prop === "color" ? "low" : HIGH.has(prop) ? "high" : MED.has(prop) ? "medium" : "low" });
    }
  }
  for (const k of nm.keys()) if (!pm.has(k)) onlyNext.push(k);
  return { matched: [...pm.keys()].filter((k) => nm.has(k)).length, diffs, onlyProto, onlyNext };
}

// Two style strings are "the same" if they differ only by rounding: same skeleton, numbers within tolerance.
function closeEnough(a, b) {
  if (a === b) return true;
  const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
  const na = a.match(NUM), nb = b.match(NUM);
  if (!na || !nb || na.length !== nb.length) return false;
  if (a.replace(NUM, "#") !== b.replace(NUM, "#")) return false;
  return na.every((x, k) => { const d = Math.abs(parseFloat(x) - parseFloat(nb[k])); return d <= (Math.max(Math.abs(parseFloat(x)), Math.abs(parseFloat(nb[k]))) > 1 ? 2.5 : 0.03); });
}

const keyOf = (c) => `${c.tag === "button" ? "button" : c.type}|${(c.label || c.placeholder || "").toLowerCase()}`;

/** Align controls by (type, visible name) with an LCS so one missing control does not shift everything after it.
 *  opts.ignore: field names to skip (e.g. ["disabled"] where Next.js mock mode disables a whole form on purpose). */
export function compareControls(proto, next, opts = {}) {
  const ignore = new Set(opts.ignore || []);
  const a = proto.controls, b = next.controls, out = [];
  // match on (type|name) first; fall back to name only so a type difference is reported as such, not as missing+extra
  const nameOf = (c) => (c.label || c.placeholder || "").toLowerCase().replace(/\*/g, "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = nameOf(a[i]) && nameOf(a[i]) === nameOf(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = []; const missing = [], extra = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (nameOf(a[i]) && nameOf(a[i]) === nameOf(b[j])) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) missing.push(i++); else extra.push(j++);
  }
  while (i < n) missing.push(i++); while (j < m) extra.push(j++);
  if (n !== m) out.push({ kind: "count", prototype: n, next: m, severity: "critical" });
  for (const k of missing) out.push({ kind: "missing-in-next", index: k, control: `${a[k].type} "${nameOf(a[k])}"`, prototype: "present", next: "absent", severity: "critical" });
  for (const k of extra) out.push({ kind: "extra-in-next", index: k, control: `${b[k].type} "${nameOf(b[k])}"`, prototype: "absent", next: "present", severity: "high" });
  // order: pairs must be monotonic by construction; report if matched controls changed relative order is impossible with LCS, so check missing-vs-extra pairs instead
  for (const [x, y] of pairs) {
    const p = a[x], q = b[y], who = nameOf(p) || p.type;
    for (const f of ["type", "required", "disabled", "value"]) {
      if (ignore.has(f)) continue;
      if (JSON.stringify(p[f]) !== JSON.stringify(q[f])) out.push({ kind: f, index: x, control: who, prototype: p[f], next: q[f], severity: f === "type" || f === "required" ? "high" : "medium" });
    }
    // Visible wording: label and placeholder compared as written (asterisks/optional hints included), because that is what users read.
    const vis = (c) => `${c.label || ""} | ${c.placeholder || ""}`.toLowerCase().replace(/\s+/g, " ");
    if (!ignore.has("label") && vis(p) !== vis(q)) {
      out.push({ kind: "wording", index: x, control: who, prototype: `label "${p.label}" placeholder "${p.placeholder}"`, next: `label "${q.label}" placeholder "${q.placeholder}"`, severity: p.placeholder !== q.placeholder ? "high" : "low" });
    }
    if (p.options || q.options) {
      if (JSON.stringify(p.options) !== JSON.stringify(q.options)) out.push({ kind: "options", index: x, control: who, prototype: `${p.options?.length} options`, next: `${q.options?.length} options`, severity: "high", detail: { onlyPrototype: (p.options || []).filter((o) => !(q.options || []).includes(o)).slice(0, 8), onlyNext: (q.options || []).filter((o) => !(p.options || []).includes(o)).slice(0, 8) } });
    }
  }
  return out;
}
