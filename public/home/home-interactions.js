// Marketing homepage behavior: header scroll state, hero banner slider, mobile menu, roles tabs,
// FAQ accordion, pricing period toggle, scroll-reveal animations, animated
// stat counters, workflow step highlighting, and the back-to-top button.
// Plain DOM/IntersectionObserver — no framework, matching this page's stack.

function initHeaderScroll() {
  const header = document.getElementById("siteHeader");
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle("scrolled", window.scrollY > 20);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const openBtn = document.getElementById("mobileMenuOpen");
  const closeBtn = document.getElementById("mobileMenuClose");
  const backdrop = document.getElementById("mobileMenuBackdrop");
  if (!menu || !openBtn) return;
  const open = () => menu.classList.add("open");
  const close = () => menu.classList.remove("open");
  openBtn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
}

function initRolesTabs() {
  const tabs = document.querySelectorAll(".role-tab");
  const panels = document.querySelectorAll(".role-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const role = tab.dataset.role;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === role));
    });
  });
}

function initFaqAccordion() {
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-q");
    q?.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      item.parentElement?.querySelectorAll(".faq-item.open").forEach((other) => {
        if (other !== item) other.classList.remove("open");
      });
      item.classList.toggle("open", !wasOpen);
    });
  });
}

function initPricingToggle() {
  const toggle = document.getElementById("pricingToggle");
  const monthlyLabel = document.getElementById("labelMonthly");
  const yearlyLabel = document.getElementById("labelYearly");
  if (!toggle) return;
  let yearly = false;
  toggle.addEventListener("click", () => {
    yearly = !yearly;
    toggle.classList.toggle("yearly", yearly);
    monthlyLabel?.classList.toggle("on", !yearly);
    yearlyLabel?.classList.toggle("on", yearly);
    document.querySelectorAll(".price-val").forEach((el) => {
      el.textContent = yearly ? el.dataset.yearly : el.dataset.monthly;
    });
  });
}

function initRevealAnimations() {
  const targets = document.querySelectorAll(".reveal-up, .reveal-scale");
  if (!targets.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  targets.forEach((t) => observer.observe(t));
}

function initStatCounters() {
  const stats = document.querySelectorAll(".stat-num[data-count]");
  if (!stats.length) return;
  const animate = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = el.dataset.decimal ? Number(el.dataset.decimal) : 0;
    const suffix = el.dataset.suffix || "";
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      el.textContent = value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  stats.forEach((s) => observer.observe(s));
}

function initWorkflowHighlight() {
  const container = document.getElementById("workflowSteps");
  const railFill = document.getElementById("workflowRailFill");
  if (!container) return;
  const steps = Array.from(container.querySelectorAll(".wf-step"));
  if (!steps.length) return;

  const setActive = (index) => {
    steps.forEach((step, i) => step.classList.toggle("active", i === index));
    if (railFill) {
      const activeEl = steps[index];
      const pct = ((activeEl.offsetTop + activeEl.offsetHeight / 2) / container.offsetHeight) * 100;
      railFill.style.height = `${Math.min(100, Math.max(0, pct))}%`;
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = steps.indexOf(entry.target);
          if (index !== -1) setActive(index);
        }
      });
    },
    { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" }
  );
  steps.forEach((s) => observer.observe(s));
  setActive(0);
}

function initChatMock() {
  const body = document.getElementById("chatBody");
  const resolved = document.getElementById("chatResolved");
  if (!body) return;
  const messages = Array.from(body.querySelectorAll(".chat-msg"));
  if (!messages.length) return;

  let played = false;
  const play = () => {
    if (played) return;
    played = true;
    messages.forEach((msg, i) => {
      setTimeout(() => {
        msg.classList.add("show");
        body.scrollTop = body.scrollHeight;
      }, i * 650);
    });
    setTimeout(() => resolved?.classList.add("show"), messages.length * 650 + 300);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          play();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );
  observer.observe(body);
}

function initBackToTop() {
  const btn = document.getElementById("backToTop");
  if (!btn) return;
  const onScroll = () => btn.classList.toggle("show", window.scrollY > 600);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

// Hero banner: fades between slides every INTERVAL ms, pauses while hovered or
// focused (and when the tab is hidden), with arrows, dots and left/right keys.
function initHeroBanner() {
  const banner = document.getElementById("heroBanner");
  if (!banner) return;
  const slides = [...banner.querySelectorAll(".banner-slide")];
  const dots = [...banner.querySelectorAll(".banner-dot")];
  if (slides.length < 2) return;
  const INTERVAL = 5000;
  banner.style.setProperty("--banner-interval", `${INTERVAL}ms`);
  let current = 0;
  let timer = null;
  let paused = false;

  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle("active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
      slide.querySelectorAll("a, button").forEach((el) => (el.tabIndex = active ? 0 : -1));
    });
    dots.forEach((dot, i) => {
      // Re-add the class so the progress bar animation restarts from zero.
      dot.classList.remove("active");
      dot.removeAttribute("aria-current");
      if (i === current) {
        void dot.offsetWidth;
        dot.classList.add("active");
        dot.setAttribute("aria-current", "true");
      }
    });
    restart();
  };
  const restart = () => {
    clearTimeout(timer);
    if (!paused) timer = setTimeout(() => show(current + 1), INTERVAL);
  };
  const setPaused = (value) => {
    paused = value;
    banner.classList.toggle("paused", value);
    if (value) clearTimeout(timer);
    else show(current);
  };

  banner.querySelector(".banner-arrow.prev")?.addEventListener("click", () => show(current - 1));
  banner.querySelector(".banner-arrow.next")?.addEventListener("click", () => show(current + 1));
  dots.forEach((dot, i) => dot.addEventListener("click", () => show(i)));
  banner.addEventListener("mouseenter", () => setPaused(true));
  banner.addEventListener("mouseleave", () => setPaused(false));
  banner.addEventListener("focusin", () => setPaused(true));
  banner.addEventListener("focusout", (e) => {
    if (!banner.contains(e.relatedTarget)) setPaused(false);
  });
  banner.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  document.addEventListener("visibilitychange", () => setPaused(document.hidden));
  restart();
}

function init() {
  initHeaderScroll();
  initHeroBanner();
  initMobileMenu();
  initRolesTabs();
  initFaqAccordion();
  initPricingToggle();
  initRevealAnimations();
  initStatCounters();
  initWorkflowHighlight();
  initChatMock();
  initBackToTop();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
