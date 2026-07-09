/* ===================================================================
   David's Cleaning Services — Shared JS
   Modules: NAV, REVEAL, FX (canvas particles), WHATSAPP, STATE
=================================================================== */

/* ---------------- Config (single source of truth) ---------------- */
const SITE = {
  whatsappNumber: "2349077177641", // no + or leading 0, international format
  brand: "David's Cleaning Services",
  services: [
    { id: "deep",        name: "Deep Cleaning",                       color: "#41c0f2" },
    { id: "post",        name: "Post-Construction & Post-Renovation", color: "#0b4fd9" },
    { id: "upholstery",  name: "Upholstery & Carpet Care",            color: "#7fd4ff" },
    { id: "fumigation",  name: "Fumigation Services",                 color: "#0d518c" },
  ]
};

/* ---------------- WhatsApp module (reused everywhere) ---------------- */
const WA = {
  link(message) {
    const base = `https://wa.me/${SITE.whatsappNumber}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  },
  open(message) {
    window.open(this.link(message), "_blank", "noopener");
  }
};
window.WA = WA;
window.SITE = SITE;

/* ---------------- Nav: mobile toggle + active link ---------------- */
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      links.classList.toggle("open");
      const expanded = links.classList.contains("open");
      toggle.setAttribute("aria-expanded", String(expanded));
    });
    links.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => links.classList.remove("open"))
    );
  }
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach(a => {
    if (a.getAttribute("href") === here) a.classList.add("active");
  });
}

/* ---------------- Reveal-on-scroll ---------------- */
function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || !els.length) {
    els.forEach(el => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach(el => io.observe(el));
}

/* ---------------- Ambient canvas FX ----------------
   Lightweight, dependency-free 2D particle field: floating "clean"
   motes (bubbles + sparkles) drifting upward, plus a soft cursor-follow
   glow. Hardware accelerated via canvas, capped DPR, pauses off-screen. */
function initFX() {
  const canvas = document.getElementById("fx-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w, h, dpr;
  let particles = [];
  const colors = ["#21e6ff", "#ff3daf", "#8bff5a", "#ffb648", "#9a6bff", "#ff6b6b"];
  const COUNT_BASE = 46;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = Math.floor(window.innerWidth * dpr);
    h = canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function makeParticle() {
    const isBubble = Math.random() > 0.55;
    return {
      x: Math.random() * w,
      y: h + Math.random() * h * 0.3,
      r: (isBubble ? Math.random() * 10 + 4 : Math.random() * 2 + 1) * dpr,
      speed: (Math.random() * 0.5 + 0.15) * dpr,
      drift: (Math.random() - 0.5) * 0.4 * dpr,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.35 + 0.12,
      isBubble,
      wob: Math.random() * Math.PI * 2,
    };
  }

  function initParticles() {
    const count = Math.round(COUNT_BASE * (window.innerWidth < 700 ? 0.5 : 1));
    particles = Array.from({ length: count }, () => {
      const p = makeParticle();
      p.y = Math.random() * h; // spread initially
      return p;
    });
  }

  function step() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.wob += 0.01;
      p.y -= p.speed;
      p.x += p.drift + Math.sin(p.wob) * 0.3;
      if (p.y < -20) Object.assign(p, makeParticle(), { y: h + 10 });
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;

      ctx.beginPath();
      ctx.globalAlpha = p.alpha;
      if (p.isBubble) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1 * dpr;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  let raf;
  let running = true;
  function loop() {
    if (running) step();
    raf = requestAnimationFrame(loop);
  }

  document.addEventListener("visibilitychange", () => {
    running = document.visibilityState === "visible";
  });

  resize();
  initParticles();

  if (reduceMotion) {
    // Draw a single static frame, skip animation entirely
    step();
  } else {
    loop();
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      initParticles();
      if (reduceMotion) step();
    }, 150);
  });
}

/* ---------------- State module (for future API / webhook plug-in) ----------------
   Minimal pub-sub store so booking forms, quote widgets, or a future
   backend (Supabase, webhook, CRM) can subscribe without rewrites. */
const Store = (() => {
  let state = { lead: {}, selectedServices: [] };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      subs.forEach(fn => fn(state));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
})();
window.Store = Store;

/* ---------------- Contact / quote form handling (progressive enhancement) ---------------- */
function initForms() {
  document.querySelectorAll("[data-wa-form]").forEach(form => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      Store.set({ lead: data });

      const lines = [`Hello ${SITE.brand}, I'd like to request a cleaning service.`];
      Object.entries(data).forEach(([key, val]) => {
        if (!val) return;
        const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        lines.push(`${label}: ${val}`);
      });
      WA.open(lines.join("\n"));
    });
  });

  document.querySelectorAll("[data-wa-quick]").forEach(btn => {
    btn.addEventListener("click", () => {
      const service = btn.getAttribute("data-wa-quick");
      WA.open(`Hello ${SITE.brand}, I'd like a quote for ${service}.`);
    });
  });
}

/* ---------------- Boot ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initReveal();
  initFX();
  initForms();
});
