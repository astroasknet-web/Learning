/* YugtyLearning shared effects: scroll progress, cursor light, hero parallax, scroll-driven journeys, pointer spotlight, card tilt,
   magnetic buttons, count-up and scroll-lit words. Plain JS. Everything is optional polish: pages are complete without it,
   and reduced motion turns the motion off. */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* scroll progress, in the four division colours */
  var bar = document.createElement("div");
  bar.className = "fx-progress"; bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  /* a soft light that follows the pointer and takes the colour of whatever it is over */
  var glow = null, gx = 0, gy = 0, tx = 0, ty = 0, glowOn = false;
  if (!reduce && fine) {
    glow = document.createElement("div"); glow.className = "fx-cursor"; glow.setAttribute("aria-hidden", "true"); document.body.appendChild(glow);
    var lastPick = 0;
    addEventListener("pointermove", function (e) {
      tx = e.clientX; ty = e.clientY; if (!glowOn) { glowOn = true; gx = tx; gy = ty; glow.style.opacity = "1"; requestAnimationFrame(follow); }
      var now = performance.now();
      if (now - lastPick > 120) {
        lastPick = now; var el = document.elementFromPoint(e.clientX, e.clientY);
        if (el) { var c = getComputedStyle(el).getPropertyValue("--a").trim(); if (c) glow.style.setProperty("--fxc", c); }
      }
    }, { passive: true });
    document.addEventListener("pointerleave", function () { if (glow) glow.style.opacity = "0"; glowOn = false; });
  }
  function follow() {
    if (!glowOn) return;
    gx += (tx - gx) * 0.14; gy += (ty - gy) * 0.14;
    glow.style.transform = "translate3d(" + (gx - 260) + "px," + (gy - 260) + "px,0)";
    requestAnimationFrame(follow);
  }

  /* pointer spotlight inside cards */
  var SPOT = ".vl-quad,.vl-goal,.vl-mega-item,.dv-pipe-card,.dv-wide,.dv-plan,.dv-bp,.dv-agent,.dv-lvl,.dv-tool,.dv-tile,.dv-path li,.vl-col";
  if (!reduce && fine) {
    $$(SPOT).forEach(function (el) {
      var s = document.createElement("i"); s.className = "fx-spot"; s.setAttribute("aria-hidden", "true"); el.appendChild(s); el.setAttribute("data-spot", "");
      el.addEventListener("pointermove", function (e) { var r = el.getBoundingClientRect(); el.style.setProperty("--mx", e.clientX - r.left + "px"); el.style.setProperty("--my", e.clientY - r.top + "px"); });
    });
    $$(".dv-pipe-card,.dv-lvl,.dv-tile,.dv-plan,.dv-wide").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = "perspective(900px) rotateX(" + (-y * 6).toFixed(2) + "deg) rotateY(" + (x * 7).toFixed(2) + "deg) translateY(-4px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
    /* magnetic primary buttons */
    $$(".vl-btn-primary").forEach(function (b) {
      b.addEventListener("pointermove", function (e) { var r = b.getBoundingClientRect(); b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + "px," + ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + "px)"; });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  /* count-up for numeric stats */
  var counters = $$("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; cio.unobserve(e.target);
        var el = e.target, to = parseInt(el.getAttribute("data-count"), 10), t0 = performance.now();
        if (reduce) { el.textContent = to; return; }
        (function step(t) { var p = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { if (!reduce) el.textContent = "0"; cio.observe(el); });
  }

  /* words that light up as you scroll */
  var wordBoxes = $$(".fx-words-src");
  if (!reduce) wordBoxes.forEach(function (b) { b.classList.add("fx-words"); });
  function words() {
    if (reduce) return;
    wordBoxes.forEach(function (b) {
      var r = b.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return;
      var p = (innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.25);
      var ws = b.querySelectorAll(".w"), n = Math.round(clamp(p, 0, 1) * ws.length);
      for (var i = 0; i < ws.length; i++) ws[i].classList.toggle("on", i < n);
    });
  }

  /* scroll-driven journeys: --p runs 0..1 as the block crosses the screen, and its [data-j] items light in turn */
  var journeys = $$("[data-journey]");
  if (!reduce) journeys.forEach(function (j) { j.classList.add("fx-j"); });
  function journey() {
    if (reduce) return;
    journeys.forEach(function (j) {
      var r = j.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return;
      var p = clamp((innerHeight * 0.78 - r.top) / (r.height + innerHeight * 0.05), 0, 1);
      j.style.setProperty("--p", p.toFixed(3));
      var items = j.querySelectorAll("[data-j]"), n = items.length;
      for (var i = 0; i < n; i++) items[i].classList.toggle("lit", p >= (i + 0.2) / (n + 0.4));
    });
  }

  /* hero parallax: --sy is how far the hero has scrolled away */
  var heroes = $$(".vl-hero,.dv-hero");
  function hero() {
    if (reduce) return;
    heroes.forEach(function (h) { var r = h.getBoundingClientRect(); if (r.bottom < -50) return; h.style.setProperty("--sy", clamp(-r.top / Math.max(1, r.height), 0, 1).toFixed(3)); });
  }

  /* ---- Update04: rise-in cascade. Elements marked data-rise tumble in, staggered by their position among siblings ---- */
  var rises = $$("[data-rise]");
  if (!reduce && rises.length && "IntersectionObserver" in window) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.setAttribute("data-rise-s", "in"); rio.unobserve(e.target); } });
    }, { threshold: 0.12 });
    rises.forEach(function (el) {
      var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty("--ri", sibs);
      if (el.getBoundingClientRect().top > innerHeight * 0.95) { el.setAttribute("data-rise-s", "pre"); rio.observe(el); }
    });
  }

  /* ---- ripple on every button press ---- */
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest && e.target.closest(".vl-btn,.dv-exams a,.dv-dest button");
    if (!b || reduce) return;
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, i = document.createElement("i");
    i.className = "fx-ripple"; i.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    b.style.overflow = "hidden"; b.appendChild(i); setTimeout(function () { i.remove(); }, 700);
  });

  /* ---- scroll-driven drift: tickers and bands speed up with your scrolling ---- */
  var tracks = $$(".vl-band-track,.vl-ticker-track");
  var vel = 0, lastY = scrollY, lastT = performance.now();
  if (!reduce && tracks.length) {
    var st = tracks.map(function (t) { var band = !!t.closest(".vl-band"); return { el: t, x: 0, base: band ? 46 : 38, dir: t.closest("[data-reverse]") ? 1 : -1, half: 0 }; });
    st.forEach(function (o) { o.el.style.animation = "none"; });
    if ("IntersectionObserver" in window) { var tio = new IntersectionObserver(function (es) { es.forEach(function (e) { st.forEach(function (o) { if ((o.el.parentElement || o.el) === e.target) o.on = e.isIntersecting; }); }); }); st.forEach(function (o) { o.on = true; tio.observe(o.el.parentElement || o.el); }); }
    (function loop(now) {
      if (document.hidden) { lastT = now; lastY = scrollY; requestAnimationFrame(loop); return; }
      var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      var dy = scrollY - lastY; lastY = scrollY;
      vel += ((Math.abs(dy) / Math.max(dt, 0.008)) / 2600 - vel) * 0.08; vel = Math.min(vel, 6);
      st.forEach(function (o) {
        if (o.on === false) return;
        if (!o.half) o.half = o.el.scrollWidth / 2;
        o.x += o.dir * (o.base + vel * 260) * dt;
        if (o.dir < 0 && o.x <= -o.half) o.x += o.half; if (o.dir > 0 && o.x >= 0) o.x -= o.half;
        o.el.style.transform = "translate3d(" + o.x.toFixed(1) + "px,0,0)";
      });
      document.documentElement.style.setProperty("--vel", Math.min(1, vel / 3).toFixed(3));
      requestAnimationFrame(loop);
    })(lastT);
  }

  /* ---- hero: pointer position as variables, and a wave through the wordmark letters ---- */
  var heroBoxes = $$(".vl-hero,.dv-hero");
  if (!reduce && fine && heroBoxes.length) {
    var letters = $$(".vl-wordmark span");
    var pmE = null, pmRaf = 0;
    addEventListener("pointermove", function (ev) { pmE = ev; if (!pmRaf) pmRaf = requestAnimationFrame(function () { pmRaf = 0; wave(pmE); }); }, { passive: true });
    function wave(e) {
      heroBoxes.forEach(function (h) {
        var r = h.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        h.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        h.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
      letters.forEach(function (l) {
        var b = l.getBoundingClientRect(), d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)), k = Math.max(0, 1 - d / 260);
        l.style.translate = "0 " + (-k * 18).toFixed(1) + "px"; l.style.scale = (1 + k * 0.14).toFixed(3);
      });
    }
  }

  /* ---- HomepageUpdate01: colour moods. The page's light changes with the section in view ---- */
  var moodRoot = document.querySelector(".vl"), moodEls = $$("[data-mood]"), moodCur = null;
  function applyMood(el) { if (!moodRoot || !el) return; var m = el.getAttribute("data-mood").split(","); moodRoot.style.setProperty("--m1", m[0]); moodRoot.style.setProperty("--m2", m[1] || m[0]); moodRoot.style.setProperty("--m3", m[2] || m[0]); }
  if (moodEls.length && "IntersectionObserver" in window) {
    var mio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { moodCur = e.target; applyMood(moodCur); } }); }, { rootMargin: "-45% 0px -45% 0px" });
    moodEls.forEach(function (el) { mio.observe(el); });
    addEventListener("vl-mood", function (e) { var p = document.getElementById("divisions"); if (!p) return; p.setAttribute("data-mood", e.detail); if (moodCur === p) applyMood(p); });
  }


  /* ---- smoothness: sections off screen pause their animations, so only what you can see is painted ---- */
  if ("IntersectionObserver" in window) {
    var offIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) e.target.removeAttribute("data-off"); else e.target.setAttribute("data-off", "1"); });
    }, { rootMargin: "120px 0px" });
    $$(".vl-hero,.vl-sec,.vl-close,.vl-band,.vl-ticker,.dv-hero,.dv-sec,footer").forEach(function (el) { offIo.observe(el); });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")";
      words(); journey(); hero(); ticking = false;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
})();
