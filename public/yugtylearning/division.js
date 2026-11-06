/* YugtyLearning home page: hero animations and small interactions. Plain JS, no dependencies.
   Every animation pauses off screen and in hidden tabs, and draws one still frame for reduced motion.
   The pages are fully readable without this file. */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var css = function (el, v) { return getComputedStyle(el).getPropertyValue(v).trim() || "#8ec0ff"; };
  var rgba = function (h, a) {
    h = h.trim();
    if (h.charAt(0) !== "#" || h.length < 7) return h;
    return "rgba(" + parseInt(h.slice(1, 3), 16) + "," + parseInt(h.slice(3, 5), 16) + "," + parseInt(h.slice(5, 7), 16) + "," + a + ")";
  };
  document.documentElement.classList.add("js-dv");

  /* ---- reveal on scroll ---- */
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.setAttribute("data-rv", "in"); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    $$(".dv-rv").forEach(function (el) {
      if (el.getBoundingClientRect().top > innerHeight * 0.95) { el.setAttribute("data-rv", "armed"); io.observe(el); }
    });
  }

  /* ---- HIRE: illustrative score from a file name (nothing is uploaded) ---- */
  var inp = document.querySelector("[data-score-input]");
  if (inp) inp.addEventListener("change", function () {
    var f = inp.files && inp.files[0]; if (!f || !document.querySelector("[data-score-num]")) return;
    var h = 0; for (var i = 0; i < f.name.length; i++) h = (h * 31 + f.name.charCodeAt(i)) >>> 0;
    var v = 68 + h % 22, fg = document.querySelector(".dv-ring-fg");
    document.querySelector("[data-score-num]").textContent = v;
    document.querySelector("[data-score-cap]").textContent = "ILLUSTRATIVE SCORE";
    if (fg) fg.style.strokeDashoffset = 100 - v;
  });

  /* ---- shared canvas runner ---- */
  function run(cv, setup) {
    var ctx = cv.getContext("2d"), box = cv.parentElement, W = 0, H = 0, dpr = 1, raf = 0, on = false, vis = true;
    var a = css(cv, "--a"), a2 = css(cv, "--a2"), state = {};
    function size() { dpr = Math.min(2, devicePixelRatio || 1); W = box.clientWidth; H = box.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (state.resize) state.resize(W, H); }
    var api = { ctx: ctx, a: a, a2: a2, rgba: rgba, W: function () { return W; }, H: function () { return H; }, cv: cv, reduce: reduce };
    var base = setup(api, state), bursts = [], trail = [], curT = 0, lastTrail = 0, pal = [k0(a), k0(a2), "#ffffff"];
    function k0(c) { return c; }
    function addBurst(x, y) { var sp = []; for (var z = 0; z < 22; z++) sp.push({ a: z / 22 * 6.2832 + Math.random(), v: 40 + Math.random() * 100, c: pal[z % 3] }); bursts.push({ x: x, y: y, t: curT, sp: sp }); }
    function overlay(t) {
      curT = t;
      for (var b = bursts.length - 1; b >= 0; b--) {
        var bu = bursts[b], age = t - bu.t; if (age > 1.2) { bursts.splice(b, 1); continue; }
        var kk = age / 1.2, ee = 1 - Math.pow(1 - kk, 3);
        ctx.strokeStyle = rgba(a2, (1 - kk) * 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bu.x, bu.y, 6 + ee * 110, 0, 6.2832); ctx.stroke();
        bu.sp.forEach(function (p) { ctx.fillStyle = rgba(p.c, (1 - kk) * 0.9); ctx.beginPath(); ctx.arc(bu.x + Math.cos(p.a) * p.v * ee, bu.y + Math.sin(p.a) * p.v * ee, 2.4 * (1 - kk) + 0.4, 0, 6.2832); ctx.fill(); });
      }
      for (var q = trail.length - 1; q >= 0; q--) {
        var tr = trail[q], ag = t - tr.t; if (ag > 0.8) { trail.splice(q, 1); continue; }
        ctx.fillStyle = rgba(a2, (1 - ag / 0.8) * 0.7); ctx.beginPath(); ctx.arc(tr.x + tr.vx * ag * 30, tr.y + tr.vy * ag * 30 - ag * 14, 2.2 * (1 - ag / 0.8) + 0.5, 0, 6.2832); ctx.fill();
      }
    }
    var draw = reduce ? base : function (t) { base(t); overlay(t); };
    if (!reduce) {
      box.addEventListener("pointerdown", function (e) { if (e.target.closest("a,button,label,input")) return; var r = cv.getBoundingClientRect(); addBurst(e.clientX - r.left, e.clientY - r.top); });
      box.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse" || curT - lastTrail < 0.05) return; lastTrail = curT; var r = cv.getBoundingClientRect();
        trail.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: curT, vx: Math.random() - 0.5, vy: Math.random() - 0.5 });
      });
    }
    var t0 = performance.now();
    function frame(now) { raf = 0; if (!on) return; draw((now - t0) / 1000); raf = requestAnimationFrame(frame); }
    function start() { if (reduce || on || !vis || document.hidden) return; on = true; raf = requestAnimationFrame(frame); }
    function stop() { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    size();
    if (reduce) draw(3); else start();
    new ResizeObserver(function () { size(); if (reduce) draw(3); }).observe(box);
    new IntersectionObserver(function (es) { vis = es.some(function (e) { return e.isIntersecting; }); vis ? start() : stop(); }).observe(box);
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
    state.redraw = function () { if (reduce) draw(3); };
  }

  var HERO = {};

  /* HIRE: a talent radar. The sweep lights candidates; every few, a match is drawn to the role at the centre. */
  HERO.hire = function (k) {
    var ctx = k.ctx, pts = [], seed = 11, rnd = function () { return (seed = (seed * 16807) % 2147483647) / 2147483647; };
    for (var i = 0; i < 46; i++) pts.push({ ang: rnd() * 6.2832, r: 0.2 + rnd() * 0.78, m: i % 6 === 0, s: 1.4 + rnd() * 1.8 });
    return function (t) {
      var W = k.W(), H = k.H(), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (var r = 1; r <= 4; r++) { ctx.strokeStyle = k.rgba(k.a2, 0.14 + (r === 4 ? 0.1 : 0)); ctx.beginPath(); ctx.arc(cx, cy, R * r / 4, 0, 6.2832); ctx.stroke(); }
      ctx.strokeStyle = k.rgba(k.a2, 0.12);
      for (var s = 0; s < 8; s++) { var an = s * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R); ctx.stroke(); }
      for (var tk = 0; tk < 90; tk++) { var ta = tk / 90 * 6.2832, long = tk % 5 === 0; ctx.strokeStyle = k.rgba(k.a2, long ? 0.5 : 0.2); ctx.beginPath(); ctx.moveTo(cx + Math.cos(ta) * R * 1.04, cy + Math.sin(ta) * R * 1.04); ctx.lineTo(cx + Math.cos(ta) * R * (long ? 1.1 : 1.07), cy + Math.sin(ta) * R * (long ? 1.1 : 1.07)); ctx.stroke(); }
      var pu = (t / 3) % 1; ctx.strokeStyle = k.rgba(k.a, (1 - pu) * 0.35); ctx.beginPath(); ctx.arc(cx, cy, R * (0.2 + pu * 0.8), 0, 6.2832); ctx.stroke();
      var sw = (t * 0.8) % 6.2832;
      for (var w = 0; w < 36; w++) { var aa = sw - w * 0.035; ctx.strokeStyle = k.rgba(k.a, 0.34 * (1 - w / 36)); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R); ctx.stroke(); }
      ctx.lineWidth = 1;
      pts.forEach(function (p) {
        var d = ((sw - p.ang) % 6.2832 + 6.2832) % 6.2832, glow = reduceGlow(d), x = cx + Math.cos(p.ang) * R * p.r, y = cy + Math.sin(p.ang) * R * p.r;
        if (p.m && glow > 0.05) { ctx.strokeStyle = k.rgba(k.a, glow * 0.8); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 9 + glow * 5, 0, 6.2832); ctx.stroke(); var bs = 13 + (1 - glow) * 10; ctx.strokeStyle = k.rgba('#ffffff', glow); ctx.lineWidth = 1.6; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { ctx.beginPath(); ctx.moveTo(x + c[0] * bs, y + c[1] * (bs - 6)); ctx.lineTo(x + c[0] * bs, y + c[1] * bs); ctx.lineTo(x + c[0] * (bs - 6), y + c[1] * bs); ctx.stroke(); }); ctx.lineWidth = 1; }
        ctx.fillStyle = p.m ? k.rgba("#ffffff", 0.45 + glow * 0.55) : k.rgba(k.a2, 0.25 + glow * 0.75);
        ctx.beginPath(); ctx.arc(x, y, p.s + glow * 2, 0, 6.2832); ctx.fill();
      });
      function reduceGlow(d) { return d < 1.4 ? 1 - d / 1.4 : 0; }
    };
  };

  /* TECH: blueprint wireframes (browser, phone, cards) draw themselves, hold, then redraw. Code glyphs drift behind. */
  HERO.tech = function (k) {
    var ctx = k.ctx, glyphs = ["{ }", "</>", "=>", "01", "fn", "[]", "&&", "::", "()", "//"], cols = [], seed = 5, rnd = function () { return (seed = (seed * 16807) % 2147483647) / 2147483647; };
    for (var i = 0; i < 26; i++) cols.push({ x: rnd(), y: rnd(), v: 0.012 + rnd() * 0.03, g: glyphs[i % glyphs.length], o: 0.1 + rnd() * 0.22 });
    function rectP(x, y, w, h, p, rad) {
      if (p <= 0) return; p = Math.min(1, p); var per = 2 * (w + h), len = per * p, segs = [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]];
      ctx.beginPath();
      for (var s = 0; s < 4 && len > 0; s++) { var sg = segs[s], L = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]), f = Math.min(1, len / L); ctx.moveTo(sg[0], sg[1]); ctx.lineTo(sg[0] + (sg[2] - sg[0]) * f, sg[1] + (sg[3] - sg[1]) * f); len -= L; }
      ctx.stroke();
    }
    return function (t) {
      var W = k.W(), H = k.H(); ctx.clearRect(0, 0, W, H);
      ctx.font = Math.max(11, W * 0.022) + "px ui-monospace, Consolas, monospace"; ctx.textAlign = "left";
      cols.forEach(function (c) { var y = ((c.y + t * c.v) % 1) * H; ctx.fillStyle = k.rgba(k.a2, c.o); ctx.fillText(c.g, c.x * W, y); });
      var cyc = (t % 9) / 9, ph = k.reduce ? 1 : Math.min(1, cyc / 0.6), hold = cyc > 0.6 ? 1 : 0, fade = cyc > 0.9 ? 1 - (cyc - 0.9) / 0.1 : 1, ease = function (v) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3); };
      ctx.globalAlpha = k.reduce ? 1 : fade; ctx.lineWidth = 1.6; ctx.strokeStyle = k.rgba(k.a2, 0.9);
      var bx = W * 0.08, by = H * 0.14, bw = W * 0.62, bh = H * 0.5;
      rectP(bx, by, bw, bh, ease(ph * 1.6), 8);
      rectP(bx, by, bw, H * 0.06, ease(ph * 1.6 - 0.3));
      ctx.strokeStyle = k.rgba(k.a, 0.9);
      rectP(bx + bw * 0.06, by + bh * 0.2, bw * 0.5, bh * 0.3, ease(ph * 1.8 - 0.5));
      for (var i = 0; i < 3; i++) rectP(bx + bw * (0.06 + i * 0.31), by + bh * 0.62, bw * 0.27, bh * 0.26, ease(ph * 1.8 - 0.7 - i * 0.1));
      ctx.strokeStyle = k.rgba(k.a2, 0.9);
      var px = W * 0.66, py = H * 0.3, pw = W * 0.24, phh = H * 0.5;
      rectP(px, py, pw, phh, ease(ph * 1.6 - 0.4)); rectP(px + pw * 0.12, py + phh * 0.1, pw * 0.76, phh * 0.55, ease(ph * 1.8 - 0.8));
      if (hold || k.reduce) { ctx.fillStyle = k.rgba(k.a, 0.1 + 0.06 * Math.sin(t * 2)); ctx.fillRect(bx + bw * 0.06, by + bh * 0.2, bw * 0.5, bh * 0.3); ctx.fillStyle = k.rgba(k.a2, 0.08); ctx.fillRect(px + pw * 0.12, py + phh * 0.1, pw * 0.76, phh * 0.55); }
      ctx.globalAlpha = 1;
    };
  };

  /* GLOBAL: an orthographic globe, drag to turn. Great-circle arcs run from India to the seven destinations. */
  /* GLOBAL: the living globe (globe.js) loads separately, so pick it up as soon as it is there; use the simple globe below if it never arrives. */
  HERO.global = function (k) {
    var impl = null, born = performance.now(), poll = 0;
    function draw(t) {
      if (!impl) {
        if (window.VeloraGlobe) impl = window.VeloraGlobe.create(k);
        else if (performance.now() - born > 6000) impl = HERO.globalSimple(k);
        else return;
      }
      impl(t);
    }
    if (k.reduce) poll = setInterval(function () { if (window.VeloraGlobe || performance.now() - born > 6000) { clearInterval(poll); draw(3); } }, 150);
    return draw;
  };
  HERO.globalSimple = function (k) {
    var ctx = k.ctx, cv = k.cv, dest = []; try { dest = JSON.parse(cv.getAttribute("data-dest") || "[]"); } catch (e) {}
    var origin = { name: "India", lat: 28.6, lon: 77.2 }, rot = { y: 0.95, x: 0.42 }, drag = null, auto = 0.12, d2r = Math.PI / 180;
    function vec(lat, lon) { var la = lat * d2r, lo = lon * d2r; return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; }
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    function rotv(v) {
      var cy = Math.cos(rot.y), sy = Math.sin(rot.y), x1 = v[0] * cy - v[2] * sy, z1 = v[0] * sy + v[2] * cy, cx = Math.cos(rot.x), sx = Math.sin(rot.x);
      return [x1, v[1] * cx - z1 * sx, v[1] * sx + z1 * cx];
    }
    cv.addEventListener("pointerdown", function (e) { userAt = performance.now(); drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
    cv.addEventListener("pointermove", function (e) { if (!drag) return; rot.y += (e.clientX - drag.x) * 0.006; rot.x = Math.max(-1.1, Math.min(1.1, rot.x + (e.clientY - drag.y) * 0.004)); drag = { x: e.clientX, y: e.clientY }; if (k.reduce) draw(3); });
    ["pointerup", "pointercancel"].forEach(function (n) { cv.addEventListener(n, function () { drag = null; cv.style.cursor = ""; }); });
    var focus = null, userFocus = null, userAt = -1e9, tourName = null, last = 0, st = [], sd = 3, srnd = function () { return (sd = (sd * 16807) % 2147483647) / 2147483647; };
    for (var si = 0; si < 120; si++) st.push({ x: srnd(), y: srnd(), z: srnd() < 0.15 ? 2 : 1, p: 0.5 + srnd() * 2 });
    function draw(t) {
      var W = k.W(), H = k.H(), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.4; ctx.clearRect(0, 0, W, H);
      st.forEach(function (q, i) { ctx.fillStyle = "rgba(210,230,255," + (0.1 + 0.3 * (0.5 + 0.5 * Math.sin(t * q.p + i))) + ")"; ctx.fillRect(q.x * W, q.y * H, q.z, q.z); });
      var atm = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.22); atm.addColorStop(0, k.rgba(k.a2, 0.38)); atm.addColorStop(0.35, k.rgba(k.a, 0.12)); atm.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, 6.2832); ctx.fill();
      var idle = !userFocus && !drag && performance.now() - userAt > 5500;
      if (idle && dest.length && !k.reduce) { tourName = dest[Math.floor(Math.max(0, t) / 3.6) % dest.length].name; } else tourName = null;
      focus = userFocus || tourName;
      $$("[data-dest-chip]").forEach(function (b) { b.classList.toggle("tour", !!tourName && b.getAttribute("data-name") === tourName); });
      var fd = focus ? dest.filter(function (d) { return d.name === focus; })[0] : null;
      if (fd && !drag) { var tY = fd.lon * d2r, dY = Math.atan2(Math.sin(tY - rot.y), Math.cos(tY - rot.y)); rot.y += dY * (k.reduce ? 1 : 0.07); rot.x += (Math.max(-1.1, Math.min(1.1, fd.lat * d2r * 0.9)) - rot.x) * (k.reduce ? 1 : 0.07); }
      else if (!drag && !k.reduce) rot.y += (t - last) * auto;
      last = t;
      var g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.5); g.addColorStop(0, k.rgba(k.a, 0.16)); g.addColorStop(0.6, k.rgba(k.a, 0.05)); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "rgba(6,12,28,0.9)"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = k.rgba(k.a2, 0.5); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1;
      for (var la = -60; la <= 60; la += 30) { ctx.strokeStyle = k.rgba(k.a2, 0.18); ctx.beginPath(); var pen = false; for (var lo = 0; lo <= 360; lo += 6) { var v = rotv(vec(la, lo)); if (v[2] > 0) { var x = cx + v[0] * R, y = cy - v[1] * R; pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false; } ctx.stroke(); }
      for (var lo2 = 0; lo2 < 360; lo2 += 30) { ctx.strokeStyle = k.rgba(k.a2, 0.18); ctx.beginPath(); var pen2 = false; for (var la2 = -90; la2 <= 90; la2 += 6) { var v2 = rotv(vec(la2, lo2)); if (v2[2] > 0) { var x2 = cx + v2[0] * R, y2 = cy - v2[1] * R; pen2 ? ctx.lineTo(x2, y2) : ctx.moveTo(x2, y2); pen2 = true; } else pen2 = false; } ctx.stroke(); }
      var o = vec(origin.lat, origin.lon);
      dest.forEach(function (d, i) {
        var dv = vec(d.lat, d.lon), dot = Math.max(-1, Math.min(1, o[0] * dv[0] + o[1] * dv[1] + o[2] * dv[2])), om = Math.acos(dot), N = 48, path = [];
        for (var s = 0; s <= N; s++) {
          var f = s / N, A = Math.sin((1 - f) * om) / Math.sin(om || 1), B = Math.sin(f * om) / Math.sin(om || 1), p = norm([A * o[0] + B * dv[0], A * o[1] + B * dv[1], A * o[2] + B * dv[2]]), lift = 1 + Math.sin(Math.PI * f) * 0.22 * (om / 1.6);
          path.push(rotv([p[0] * lift, p[1] * lift, p[2] * lift]));
        }
        var hl = focus === d.name; ctx.strokeStyle = k.rgba(k.a, hl ? 1 : focus ? 0.22 : 0.75); ctx.lineWidth = hl ? 3.4 : 1.6; ctx.shadowColor = k.a; ctx.shadowBlur = hl ? 18 : 0; ctx.beginPath(); var pn = false;
        path.forEach(function (q) { if (q[2] > -0.05) { var x = cx + q[0] * R, y = cy - q[1] * R; pn ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pn = true; } else pn = false; }); ctx.stroke(); ctx.shadowBlur = 0;
        var u = k.reduce ? 0.5 : (t * 0.22 + i * 0.14) % 1, q2 = path[Math.floor(u * N)];
        for (var tj = 0; tj < 8; tj++) { var qt = path[Math.max(0, Math.floor(u * N) - tj)]; if (qt && qt[2] > 0) { ctx.fillStyle = k.rgba("#ffffff", (1 - tj / 8) * 0.9); ctx.beginPath(); ctx.arc(cx + qt[0] * R, cy - qt[1] * R, 2.8 * (1 - tj / 11), 0, 6.2832); ctx.fill(); } }
        var pv = rotv(dv); if (pv[2] > 0.05) {
          var px = cx + pv[0] * R, py = cy - pv[1] * R; var pr = k.reduce ? 0.4 : (t * 0.6 + i * 0.17) % 1; ctx.strokeStyle = k.rgba(k.a2, (1 - pr) * 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 4 + pr * 14, 0, 6.2832); ctx.stroke(); ctx.lineWidth = 1;
          ctx.fillStyle = k.a2; ctx.beginPath(); ctx.arc(px, py, 4, 0, 6.2832); ctx.fill();
          ctx.font = (hl ? "700 " : "600 ") + Math.max(11, R * (hl ? 0.085 : 0.06)) + "px system-ui, sans-serif"; ctx.fillStyle = hl ? "#fff" : focus ? "rgba(234,240,255,0.45)" : "#eaf0ff"; ctx.textAlign = px > cx ? "left" : "right"; ctx.fillText(d.name, px + (px > cx ? 9 : -9), py + 4 + (d.name === "UK" ? -13 : d.name === "France" ? 13 : 0));
        }
      });
      var ov = rotv(o); if (ov[2] > 0) { var ox = cx + ov[0] * R, oy = cy - ov[1] * R; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, oy, 7 + Math.sin(t * 3) * 1.5, 0, 6.2832); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ox, oy, 3.5, 0, 6.2832); ctx.fill(); ctx.font = "700 " + Math.max(11, R * 0.06) + "px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText("India", ox + 12, oy - 8); }
    }
    $$("[data-dest-chip]").forEach(function (b) {
      var on = function () { userFocus = b.getAttribute("data-name"); userAt = performance.now(); focus = userFocus; if (k.reduce) draw(3); }, off = function () { userAt = performance.now(); if (b.getAttribute("aria-pressed") !== "true") { userFocus = null; focus = null; if (k.reduce) draw(3); } };
      b.addEventListener("pointerenter", on); b.addEventListener("focus", on); b.addEventListener("pointerleave", off); b.addEventListener("blur", off);
      b.addEventListener("click", function () { var was = b.getAttribute("aria-pressed") === "true"; $$("[data-dest-chip]").forEach(function (o) { o.setAttribute("aria-pressed", "false"); }); if (!was) { b.setAttribute("aria-pressed", "true"); on(); } else { userFocus = null; focus = null; userAt = performance.now(); } });
    });
    return draw;
  };

  /* LEARN: a double helix of maths and language glyphs rising upward. */
  HERO.learn = function (k) {
    var spd = 1, tspd = 1, ph = 0, lastT = 0;
    k.cv.parentElement.addEventListener("pointermove", function (e) { var r = k.cv.getBoundingClientRect(); tspd = 1 + ((e.clientX - r.left) / r.width - 0.5) * 6; });
    k.cv.parentElement.addEventListener("pointerleave", function () { tspd = 1; });
    var ctx = k.ctx, G = ["∑", "π", "√", "∫", "A", "B", "Ω", "%", "x²", "≠", "∞", "Aa"], N = 54;
    return function (t) {
      var W = k.W(), H = k.H(), cx = W / 2, top = H * 0.04, hh = H * 0.62; ctx.clearRect(0, 0, W, H);
      spd += (tspd - spd) * 0.05; ph += (t - lastT) * spd; lastT = t;
      var gl = ctx.createRadialGradient(cx, H * 0.35, 0, cx, H * 0.35, W * 0.6); gl.addColorStop(0, k.rgba(k.a, 0.14)); gl.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var items = [];
      for (var strand = 0; strand < 2; strand++) for (var i = 0; i < N; i++) {
        var f = (((i / N) + ph * 0.035) % 1 + 1) % 1, y = top + hh * (1 - f), ang = f * 14 + strand * Math.PI + ph * 0.5, x = cx + Math.cos(ang) * W * 0.22, z = Math.sin(ang);
        items.push({ x: x, y: y, z: z, g: G[(i + strand * 5) % G.length], f: f });
      }
      for (var sp = 0; sp < 40; sp++) { var sf = ((sp * 0.137 + t * (0.03 + (sp % 5) * 0.01)) % 1), sx = cx + Math.sin(sp * 12.9898) * W * 0.42, sy = top + hh * (1.05 - sf); ctx.fillStyle = k.rgba(k.a2, 0.5 * Math.sin(Math.PI * sf)); ctx.fillRect(sx, sy, 2, 2); }
      items.sort(function (a, b) { return a.z - b.z; });
      items.forEach(function (it) {
        var s = 0.7 + (it.z + 1) * 0.35, al = (0.25 + (it.z + 1) * 0.35) * Math.min(1, it.f * 6) * Math.min(1, (1 - it.f) * 6);
        ctx.font = "600 " + Math.round(Math.max(13, W * 0.034) * s) + "px Georgia, serif"; ctx.fillStyle = k.rgba(it.z > 0 ? k.a2 : k.a, al); ctx.fillText(it.g, it.x, it.y);
      });
    };
  };

  /* TECH: the terminal types itself, then holds, then starts over */
  var NL = String.fromCharCode(10), term = document.querySelector("pre[data-term]");
  if (term && !reduce) {
    var full = term.textContent, lines = full.split(NL), timer = 0;
    var typeAll = function () {
      term.classList.add("typing"); term.textContent = ""; var li = 0, ci = 0;
      (function tick() {
        if (li >= lines.length) { term.classList.remove("typing"); timer = setTimeout(typeAll, 7000); return; }
        var ln = lines[li];
        if (ci <= ln.length) { term.textContent = lines.slice(0, li).join(NL) + (li ? NL : "") + ln.slice(0, ci); ci++; timer = setTimeout(tick, ln.charAt(ci - 2) === " " ? 8 : 26); }
        else { li++; ci = 0; timer = setTimeout(tick, 260); }
      })();
    };
    typeAll();
  }

  $$("canvas[data-hero]").forEach(function (cv) { var f = HERO[cv.getAttribute("data-hero")]; if (f) run(cv, f); });
})();
