// Scripted UI states, applied identically to both apps. Safe by construction: no credentials are typed, so
// "submit-empty" can only trigger client-side validation (never sign-in, sign-up, email or a database write).
// Each state returns optional extra data (e.g. what the keyboard focus landed on).

const describeActive = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  return {
    tag: el.tagName.toLowerCase(), type: el.type || "",
    text: (el.getAttribute("aria-label") || el.placeholder || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
    outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow, borderColor: cs.borderTopColor,
  };
});

export const STATES = {
  "default": async () => ({}),
  "focus-first-input": async (page) => {
    const el = page.locator("input:visible:not([type=checkbox]):not([type=radio]):not([type=hidden])").first();
    if (!(await el.count())) return { skipped: "no input" };
    await el.focus();
    return { active: await describeActive(page) };
  },
  "hover-submit": async (page) => {
    const el = page.locator("button[type=submit]:visible").first();
    if (!(await el.count())) return { skipped: "no submit button" };
    const disabled = await el.isDisabled();
    await el.hover({ timeout: 3000 }).catch(() => {});
    const cs = await el.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, color: c.color, cursor: c.cursor, opacity: c.opacity }; });
    return { disabled, computed: cs };
  },
  "submit-empty": async (page) => {
    const el = page.locator("button[type=submit]:visible").first();
    if (!(await el.count())) return { skipped: "no submit button" };
    if (await el.isDisabled()) return { skipped: "submit button is disabled (state = disabled)" };
    await el.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    const errors = await page.evaluate(() => [...document.querySelectorAll("[role=alert],[aria-invalid=true],.error,[class*=error],[class*=danger]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 80)).filter(Boolean).slice(0, 6));
    return { errors, active: await describeActive(page) };
  },
  "keyboard-tab": async (page) => {
    const path = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press("Tab"); path.push(await describeActive(page)); }
    return { tabPath: path.map((p) => p && `${p.tag}:${p.type}:${p.text}`), active: path.at(-1) };
  },
  "click-first-combobox": async (page) => {
    const el = page.locator("[role=combobox]:visible,[aria-haspopup=listbox]:visible").first();
    if (!(await el.count())) return { skipped: "no custom combobox on page (native <select> options are compared in the field report)" };
    await el.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    const opts = await page.evaluate(() => [...document.querySelectorAll("[role=option]")].map((o) => o.textContent.trim()).slice(0, 30));
    return { options: opts };
  },
  "toggle-password": async (page) => {
    const el = page.locator("button[aria-label*=assword i]:visible").first();
    if (!(await el.count())) return { skipped: "no password toggle" };
    await el.click({ timeout: 3000 }).catch(() => {});
    return { pressed: await el.getAttribute("aria-pressed"), label: await el.getAttribute("aria-label") };
  },
};

export const FORM_STATES = ["default", "focus-first-input", "hover-submit", "submit-empty", "keyboard-tab", "click-first-combobox", "toggle-password"];
export const VIEW_STATES = ["default", "keyboard-tab"];
