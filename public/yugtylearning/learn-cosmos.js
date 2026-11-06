/* Veloralearnupdate02: "choose your mission". A learner picks a goal (IELTS, GRE, GMAT, CAT, school, career); a rocket flies through the
   four sections of that goal, powered by online courses, live classes, e-books and mock tests, to a goal star that opens doors.
   Plain JS; pausable; the finished state for reduced motion. All scores are illustrative samples. */
(function () {
  var root = document.querySelector("[data-lx]");
  if (!root) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s) { return root.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var GOALS = JSON.parse(root.getAttribute("data-goals")), FUEL = JSON.parse(root.getAttribute("data-fuel")), LEGS = JSON.parse(root.getAttribute("data-legs")), POS = JSON.parse(root.getAttribute("data-pos"));
  var goalBtns = $$("[data-lx-goal]"), planets = $$("[data-lx-planet]"), secs = $$("[data-lx-sec]"), doors = $$("[data-lx-door]"), fuels = $$(".lx-fuel li"), steps = $$("[data-lx-step]"), labels = $$("[data-lx-steplabel]");
  var rocket = $("[data-lx-rocket]"), score = $("[data-lx-score]"), bar = $("[data-lx-bar]"), metric = $("[data-lx-metric]"), range = $("[data-lx-range]"), now = $("[data-lx-now]"), trail = $("[data-lx-trail]"), burst = $("[data-lx-burst]"), pauseBtn = $("[data-lx-pause]");
  var FR = [0, 0.24, 0.5, 0.72, 0.88, 1], DUR = [3600, 3400, 3400, 3400, 3400, 4600], HOLD = 3500;
  var g = GOALS[0], cur = -1, timer = 0, paused = false, visible = true, tween = 0, fly = 0, shown = null;

  /* the flight path is drawn in pixels so its dashes and line width stay true at any size */
  var NODES = JSON.parse(root.getAttribute("data-nodes")), pathSvg = $(".lx-path"), scene = $(".lx-scene");
  function layoutPath() {
    var w = scene.clientWidth, h = scene.clientHeight; if (!w || !h) return;
    var d = NODES.map(function (n, i) { return (i ? "L" : "M") + (n.x * w / 100).toFixed(1) + " " + (n.y * h / 100).toFixed(1); }).join(" ");
    pathSvg.setAttribute("viewBox", "0 0 " + w + " " + h); pathSvg.setAttribute("preserveAspectRatio", "none");
    Array.prototype.slice.call(pathSvg.querySelectorAll("path")).forEach(function (p) { p.setAttribute("d", d); });
  }
  layoutPath(); new ResizeObserver(layoutPath).observe(scene);

  function value(f) { var v = g.start + (g.end - g.start) * f; if (g.decimals === 1) v = Math.round(v * 2) / 2; else v = Math.round(v); return v; }
  function fmt(v) { return v.toFixed(g.decimals) + g.suffix; }
  function countTo(to) {
    var from = shown === null ? to : shown, t0 = performance.now(); cancelAnimationFrame(tween);
    if (reduce || from === to) { score.textContent = fmt(to); shown = to; return; }
    (function step(t) { var p = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - p, 3), v = from + (to - from) * e; score.textContent = fmt(g.decimals === 1 ? Math.round(v * 10) / 10 : Math.round(v)); shown = v; if (p < 1) tween = requestAnimationFrame(step); else shown = to; })(t0);
  }
  function clearStages() { for (var k = 0; k < 6; k++) root.classList.remove("s" + k); }
  function applyGoal() {
    metric.textContent = g.label.toUpperCase() + " " + g.metric; range.textContent = "from " + fmt(g.start) + " (sample)";
    secs.forEach(function (s, k) { s.textContent = g.sections[k]; }); doors.forEach(function (d, k) { d.lastChild.nodeValue = g.doors[k]; });
    var names = ["Launch"].concat(g.sections, ["Goal"]); labels.forEach(function (l, i) { l.textContent = names[i]; });
    goalBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-lx-goal") === g.id ? "true" : "false"); });
  }
  function text(i) {
    if (i === 0) return "Mission set: " + g.label + ". YugtyLearning builds the flight around the sections that matter.";
    if (i === 5) return g.label + " " + g.metric.toLowerCase() + " " + fmt(g.end) + ". " + g.doors[0] + ", " + g.doors[1] + " and " + g.doors[2] + " come into reach.";
    var l = LEGS[i - 1]; return g.sections[i - 1] + ": " + FUEL[l[0]] + " and " + FUEL[l[1]] + " lift the score.";
  }
  function go(i, instant) {
    if (instant) root.classList.add("instant");
    cur = i; clearStages(); void root.offsetWidth; for (var k = 0; k <= i; k++) root.classList.add("s" + k);
    var p = POS[i], q = POS[Math.min(5, i + 1)], ang = i === 5 ? 0 : Math.atan2(q.x - p.x, -(q.y - p.y)) * 180 / Math.PI;
    rocket.style.left = p.x + "%"; rocket.style.top = p.y + "%"; rocket.style.setProperty("--ang", ang + "deg");
    root.classList.add("flying"); clearTimeout(fly); fly = setTimeout(function () { root.classList.remove("flying"); if (!instant && i >= 1 && i <= 4) { var pl = planets[i - 1]; burst.style.left = pl.style.left; burst.style.top = pl.style.top; burst.style.setProperty("--pc", pl.style.getPropertyValue("--pc")); burst.classList.remove("go"); void burst.offsetWidth; burst.classList.add("go"); } }, instant ? 0 : 1900);
    planets.forEach(function (pl, k) { pl.classList.toggle("on", k < i); pl.classList.toggle("here", k === i - 1); });
    doors.forEach(function (d) { d.classList.toggle("on", i === 5); });
    root.querySelector(".lx-goalstar").classList.toggle("on", i === 5);
    fuels.forEach(function (f, k) { var on = i >= 1 && i <= 4 && LEGS[i - 1].indexOf(k) >= 0; f.classList.toggle("on", i === 5 || on); });
    trail.style.strokeDashoffset = String(100 - [0, 24, 49, 74, 93, 100][i]);
    var v = value(FR[i]); countTo(v); bar.style.width = (FR[i] === 0 ? 4 : 4 + FR[i] * 96) + "%";
    now.textContent = text(i);
    steps.forEach(function (s, k) { s.classList.toggle("on", k === i); s.classList.toggle("past", k < i); if (k === i) s.setAttribute("aria-current", "step"); else s.removeAttribute("aria-current"); });
    if (instant) setTimeout(function () { root.classList.remove("instant"); }, 80);
  }
  function schedule() { clearTimeout(timer); if (paused || !visible || reduce) return; timer = setTimeout(function () { go(cur >= 5 ? 0 : cur + 1, false); schedule(); }, cur === 5 ? DUR[5] + HOLD : DUR[Math.max(cur, 0)]); }
  function syncPause() { if (pauseBtn) { pauseBtn.textContent = paused ? "Play" : "Pause"; pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false"); } }
  function choose(id) { g = GOALS.filter(function (x) { return x.id === id; })[0] || g; shown = null; applyGoal(); paused = false; syncPause(); go(0, true); void root.offsetWidth; go(0, false); schedule(); }

  goalBtns.forEach(function (b) { b.addEventListener("click", function () { choose(b.getAttribute("data-lx-goal")); }); });
  steps.forEach(function (el, i) { el.addEventListener("click", function () { paused = true; syncPause(); clearTimeout(timer); go(i, i !== cur + 1); }); });
  if (pauseBtn) pauseBtn.addEventListener("click", function () { paused = !paused; syncPause(); if (paused) clearTimeout(timer); else schedule(); });
  new IntersectionObserver(function (es) { visible = es.some(function (e) { return e.isIntersecting; }); if (visible) schedule(); else clearTimeout(timer); }).observe(root);

  var deep = location.hash.match(/lx-([a-z]+)-?([0-5])?/);
  if (deep && GOALS.some(function (x) { return x.id === deep[1]; })) { g = GOALS.filter(function (x) { return x.id === deep[1]; })[0]; applyGoal(); root.classList.add("live"); paused = true; syncPause(); shown = null; go(deep[2] ? parseInt(deep[2], 10) : 5, true); }
  else if (reduce) { if (pauseBtn) pauseBtn.hidden = true; }
  else { root.classList.add("live"); applyGoal(); shown = null; go(0, false); schedule(); }
})();
