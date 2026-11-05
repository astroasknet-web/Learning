import { analyzeDoc } from "./doc";
import { analyse, Calculator, chartData, expandRange, formatValue, isErr, parseFormula, parseRef, refName, type SheetState, type Value } from "./sheet/engine";
import { bullets, deckText, sanitizeDeck, themeOf, type Deck } from "./slides";
import { runSqlFull, type SqlValue } from "./sql/engine";
import { Dax, DaxError, parseDefinitions, type DaxMatrix, type DaxValue } from "./dax/engine";
import { computeViz, type Cell, type Pill } from "./viz/engine";
import type { Activity, ActivityState, Check, CheckResult, CheckSpec, RunResult } from "./types";

/**
 * Judges a student's work against an activity's checks. The same function runs in the browser (instant feedback) and on the server
 * (the result that is recorded), so a student cannot mark an activity as passed by sending a made-up result.
 * A failed check says what is wrong in beginner-friendly words and never gives the answer; the activity's `hint` and `explain` are
 * shown separately, and `explain` only when the student asks.
 */
type Out = { ok: boolean; msg: string };
const yes = (): Out => ({ ok: true, msg: "" });
const no = (msg: string): Out => ({ ok: false, msg });
const near = (a: Value, b: string | number, tol = 0.0001): boolean => (typeof b === "number" ? typeof a === "number" && Math.abs(a - b) <= tol : typeof a === "string" ? a.trim().toLowerCase() === String(b).trim().toLowerCase() : false);
const shown = (v: Value): string => (v === null ? "empty" : isErr(v) ? v.err : formatValue(v));

function wordCheck(spec: CheckSpec, html: string): Out {
  const d = analyzeDoc(html);
  switch (spec.k) {
    case "doc.heading": {
      const hs = d.headings.filter((h) => !spec.level || h.level === spec.level);
      return hs.length >= spec.min ? yes() : no(hs.length === 0 ? "There is no heading yet. Choose a line, then pick a Heading style from the toolbar." : `You have ${hs.length} heading${hs.length === 1 ? "" : "s"}, and this task needs ${spec.min}.`);
    }
    case "doc.paragraphs": {
      const ps = d.paragraphs.filter((p) => p.words >= (spec.minWords ?? 1));
      return ps.length >= spec.min ? yes() : no(`I can see ${ps.length} paragraph${ps.length === 1 ? "" : "s"}${spec.minWords ? ` with at least ${spec.minWords} words` : ""}, and this task needs ${spec.min}.`);
    }
    case "doc.list": {
      const ls = d.lists.filter((l) => !spec.type || l.type === spec.type);
      const best = Math.max(0, ...ls.map((l) => l.items));
      return best >= spec.minItems ? yes() : no(ls.length === 0 ? `There is no ${spec.type === "ol" ? "numbered" : spec.type === "ul" ? "bulleted" : ""} list yet. Use the list buttons in the toolbar.`.replace("  ", " ") : `Your list has ${best} item${best === 1 ? "" : "s"}, and this task needs at least ${spec.minItems}.`);
    }
    case "doc.table": {
      const t = d.tables.find((x) => x.rows >= spec.rows && x.cols >= spec.cols);
      return t ? yes() : no(d.tables.length === 0 ? "There is no table yet. Use the Table button to add one." : `Your table is ${d.tables[0].rows} rows by ${d.tables[0].cols} columns, and this task needs at least ${spec.rows} by ${spec.cols}.`);
    }
    case "doc.format": {
      const m = { bold: d.bold, italic: d.italic, underline: d.underline, center: d.aligned.center, right: d.aligned.right, justify: d.aligned.justify, size: d.sizes.length > 0 };
      const what = { bold: "bold", italic: "italic", underline: "underlined", center: "centre-aligned", right: "right-aligned", justify: "justified", size: "resized (a different font size)" }[spec.what];
      return m[spec.what] ? yes() : no(`I cannot find any ${what} text. Select some text first, then use the toolbar.`);
    }
    case "doc.contains": return d.text.toLowerCase().includes(spec.text.toLowerCase()) ? yes() : no(`The document does not include "${spec.text}" yet.`);
    case "doc.words": {
      if (spec.min !== undefined && d.words < spec.min) return no(`The document has ${d.words} words. It needs at least ${spec.min}.`);
      if (spec.max !== undefined && d.words > spec.max) return no(`The document has ${d.words} words. Keep it to ${spec.max} or fewer.`);
      return yes();
    }
    case "doc.pattern": { try { return new RegExp(spec.re, spec.flags ?? "i").test(d.text) ? yes() : no(`I cannot find ${spec.what}.`); } catch { return no(`I cannot find ${spec.what}.`); } }
    case "doc.order": {
      let at = -1;
      const low = d.text.toLowerCase();
      for (const t of spec.texts) { const i = low.indexOf(t.toLowerCase(), at + 1); if (i < 0) return no(`"${t}" is missing or in the wrong place.`); at = i; }
      return yes();
    }
    default: return no("Unknown check.");
  }
}

function formulaFeedback(state: SheetState, ref: string, spec: Extract<CheckSpec, { k: "sheet.formula" }>): Out {
  const raw = state.cells[ref];
  if (raw === undefined || raw === "") return no(`${ref} is empty. This is where the formula goes.`);
  if (!raw.startsWith("=")) return no(`${ref} holds a typed value. A formula starts with an equals sign (=), so the sheet can recalculate it.`);
  let tree;
  try { tree = parseFormula(raw); } catch (e) { return no(`The formula in ${ref} has a problem: ${(e as Error).message}`); }
  const info = analyse(tree);
  const missing = (spec.fns ?? []).filter((f) => !info.fns.has(f.toUpperCase()));
  if (missing.length) return no(`The formula in ${ref} should use ${missing.join(" and ")}. Right now it does not.`);
  if (spec.pattern && !new RegExp(spec.pattern, "i").test(raw)) return no(spec.patternMsg ?? `The formula in ${ref} is not written the way this step asks.`);
  if (spec.cover) {
    const want = expandRange(spec.cover);
    const lack = want.filter((c) => !info.refs.has(c));
    const extra = [...info.refs].filter((c) => !want.includes(c));
    if (lack.length) {
      const first = want[0];
      const usedInRange = want.filter((c) => info.refs.has(c));
      return no(usedInRange.length ? `Your formula covers ${usedInRange[0]} to ${usedInRange[usedInRange.length - 1]}, but the data runs from ${first} to ${want[want.length - 1]}. ${lack.length === 1 ? `It is missing ${lack[0]}.` : `It is missing ${lack.length} cells.`}` : `The formula in ${ref} does not use the cells ${spec.cover}. Point it at the data.`);
    }
    if (extra.length) return no(`The formula in ${ref} also includes ${extra[0]}${extra.length > 1 ? " and more" : ""}, which is not part of ${spec.cover}. Check where the range starts and ends.`);
  }
  const v = new Calculator(state.cells).value(ref);
  if (isErr(v)) return no(`The formula in ${ref} shows ${v.err}. ${v.msg}`);
  if (spec.equals !== undefined && !near(v, spec.equals)) return no(`The formula in ${ref} gives ${shown(v)}, which is not the expected answer. Check which cells it uses and the order of the steps.`);
  return yes();
}

function sheetCheck(spec: CheckSpec, s: SheetState): Out {
  const calc = new Calculator(s.cells);
  switch (spec.k) {
    case "sheet.value": {
      const v = calc.value(spec.ref.toUpperCase());
      if (v === null) return no(`${spec.ref} is empty.`);
      return near(v, spec.equals) ? yes() : no(`${spec.ref} contains ${shown(v)}, which is not what this step asks for.`);
    }
    case "sheet.result": {
      const v = calc.value(spec.ref.toUpperCase());
      if (v === null) return no(`${spec.ref} is empty.`);
      if (isErr(v)) return no(`${spec.ref} shows ${v.err}. ${v.msg}`);
      return near(v, spec.equals, spec.tolerance ?? 0.0001) ? yes() : no(`${spec.ref} shows ${shown(v)}, which is not the expected answer yet.`);
    }
    case "sheet.formula": return formulaFeedback(s, spec.ref.toUpperCase(), spec);
    case "sheet.filled": {
      const cells = expandRange(spec.range);
      const filled = cells.filter((c) => (s.cells[c] ?? "") !== "").length;
      const need = spec.min ?? cells.length;
      return filled >= need ? yes() : no(`${filled} of the ${need} cells in ${spec.range} are filled in.`);
    }
    case "sheet.chart": {
      if (!s.charts.length) return no("There is no chart yet. Select your data and use the Chart button.");
      const c = s.charts.find((x) => (!spec.type || x.type === spec.type) && chartData(s, x).ok);
      if (!c) return no(spec.type && !s.charts.some((x) => x.type === spec.type) ? `Your chart is not a ${spec.type} chart. Pick the chart type that suits this data.` : "Your chart does not have usable data yet. Check the label and value ranges.");
      if (spec.labels && c.labels.replace(/\$/g, "").toUpperCase() !== spec.labels.toUpperCase()) return no(`The chart's labels should come from ${spec.labels}.`);
      if (spec.values && c.values.replace(/\$/g, "").toUpperCase() !== spec.values.toUpperCase()) return no(`The chart's values should come from ${spec.values}.`);
      return yes();
    }
    case "sheet.sorted": {
      const cells = expandRange(spec.range);
      const vals = cells.map((c) => calc.value(c)).filter((v): v is number => typeof v === "number");
      if (vals.length < 2) return no("There is not enough data in that column to be sorted.");
      for (let i = 1; i < vals.length; i++) if (spec.dir === "asc" ? vals[i] < vals[i - 1] : vals[i] > vals[i - 1]) return no(`The values in ${spec.range} are not in ${spec.dir === "asc" ? "smallest-to-largest" : "largest-to-smallest"} order yet.`);
      return yes();
    }
    case "sheet.format": {
      const f = s.formats[spec.ref.toUpperCase()] ?? {};
      const ok = spec.what === "bold" ? f.bold : spec.what === "currency" ? f.num === "currency" : spec.what === "percent" ? f.num === "percent" : spec.what === "date" ? f.num === "date" : f.align === "center";
      return ok ? yes() : no(`${spec.ref} is not ${spec.what === "bold" ? "bold" : spec.what === "center" ? "centred" : `formatted as ${spec.what}`} yet.`);
    }
    case "sheet.noerrors": {
      for (const k of Object.keys(s.cells)) { const v = calc.value(k); if (isErr(v)) return no(`${k} shows ${v.err}. ${v.msg}`); }
      return yes();
    }
    default: return no("Unknown check.");
  }
}

function slidesCheck(spec: CheckSpec, deck: Deck): Out {
  const real = deck.slides.filter((s) => s.layout !== "blank");
  switch (spec.k) {
    case "slides.count": {
      const n = deck.slides.length;
      if (n < spec.min) return no(`You have ${n} slide${n === 1 ? "" : "s"}, and this task needs at least ${spec.min}.`);
      if (spec.max !== undefined && n > spec.max) return no(`You have ${n} slides. Keep it to ${spec.max} or fewer: short presentations are easier to follow.`);
      return yes();
    }
    case "slides.titles": {
      const i = real.findIndex((s) => s.title.trim() === "");
      return i < 0 ? yes() : no(`Slide ${deck.slides.indexOf(real[i]) + 1} has no title. Every slide should say what it is about.`);
    }
    case "slides.contains": return deckText(deck).includes(spec.text.toLowerCase()) ? yes() : no(`I cannot find "${spec.text}" on any slide.`);
    case "slides.readable": {
      for (const [i, s] of deck.slides.entries()) {
        for (const body of [s.body, s.body2]) {
          const b = bullets(body);
          if (b.length > spec.maxBullets) return no(`Slide ${i + 1} has ${b.length} bullet points. Aim for ${spec.maxBullets} or fewer so people can read it while you speak.`);
          const w = b.join(" ").split(/\s+/).filter(Boolean).length;
          if (w > spec.maxWords) return no(`Slide ${i + 1} has about ${w} words of body text. Try to stay under ${spec.maxWords} and say the rest out loud.`);
        }
      }
      return yes();
    }
    case "slides.layouts": { const n = new Set(deck.slides.map((s) => s.layout)).size; return n >= spec.min ? yes() : no(`The deck uses ${n} layout${n === 1 ? "" : "s"}. Use at least ${spec.min} different ones (for example a title slide and a bullet slide).`); }
    case "slides.shapes": { const n = deck.slides.reduce((a, s) => a + s.shapes.length, 0); return n >= spec.min ? yes() : no(`The deck has ${n} shape${n === 1 ? "" : "s"}. Add ${spec.min - n} more using the Shape button.`); }
    case "slides.theme": return !spec.notDefault || themeOf(deck.theme).id !== "clean" ? yes() : no("Try choosing a theme other than the default.");
    case "slides.title-first": {
      const f = deck.slides[0];
      if (!f || f.layout !== "title") return no("The first slide should use the Title slide layout.");
      if (spec.text && !(f.title + " " + f.body).toLowerCase().includes(spec.text.toLowerCase())) return no(`The first slide should include "${spec.text}".`);
      return f.title.trim() ? yes() : no("The first slide needs a title.");
    }
    default: return no("Unknown check.");
  }
}

const canon = (v: SqlValue): string => (typeof v === "number" ? String(Math.round(v * 1e6) / 1e6) : v === null ? "\u0000null" : typeof v === "boolean" ? (v ? "1" : "0") : String(v));
const rowKey = (r: SqlValue[]): string => r.map(canon).join("\u0001");

function sqlCheck(spec: CheckSpec, query: string, a: Activity): Out {
  const db = { tables: a.sql?.tables ?? [] };
  if (spec.k === "sql.uses") {
    let re: RegExp;
    try { re = new RegExp(spec.re, "i"); } catch { return no("This check is misconfigured."); }
    return re.test(query) ? yes() : no(`Your query should use ${spec.what}.`);
  }
  const mine = runSqlFull(db, query);
  if (!mine.ok) return no(`Your query did not run: ${mine.error}${mine.hint ? " " + mine.hint : ""}`);
  if (spec.k === "sql.runs") return yes();
  if (spec.k !== "sql.result") return no("Unknown check.");
  const want = runSqlFull(db, spec.solution);
  if (!want.ok) return no("This check could not be prepared. Please report it.");
  if (mine.columns.length !== want.columns.length) return no(`Your result has ${mine.columns.length} column${mine.columns.length === 1 ? "" : "s"}; this task needs ${want.columns.length}.`);
  if (mine.rows.length !== want.rows.length) return no(`Your query returned ${mine.rows.length} row${mine.rows.length === 1 ? "" : "s"}; this task needs ${want.rows.length}.`);
  const a1 = mine.rows.map(rowKey), b1 = want.rows.map(rowKey);
  const same = (x: string[], y: string[]) => x.every((v, i) => v === y[i]);
  if (spec.ordered) {
    if (same(a1, b1)) return yes();
    return same([...a1].sort(), [...b1].sort()) ? no("The right rows, but in the wrong order. Check your ORDER BY.") : no("The right number of rows, but some values are not what the task asks for. Re-read the task and compare your first row.");
  }
  return same([...a1].sort(), [...b1].sort()) ? yes() : no("The right number of rows, but some values are not what the task asks for. Re-read the task and compare your first row.");
}

const same = (x: DaxValue, y: DaxValue): boolean => (x === null || y === null ? x === y : typeof x === "number" && typeof y === "number" ? Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y)) : x === y);
const showV = (v: DaxValue): string => (v === null ? "blank" : String(v));

function daxCheck(spec: CheckSpec, code: string, a: Activity): Out {
  const d = a.dax;
  if (!d) return no("This exercise has no model.");
  if (spec.k === "dax.uses") {
    let re: RegExp;
    try { re = new RegExp(spec.re, "i"); } catch { return no("This check is misconfigured."); }
    return re.test(code) ? yes() : no(`Your measure should use ${spec.what}.`);
  }
  if (spec.k !== "dax.runs" && spec.k !== "dax.measure") return no("Unknown check.");
  let mine: Dax;
  try {
    const defs = parseDefinitions(code);
    if (!defs.length) return no("Write your measure in the editor, starting with its name and an equals sign, like Total Sales = SUM(Sales[Amount]).");
    mine = new Dax(d.model, defs);
    for (const def of defs) for (const v of d.visuals) mine.matrix(v, def.name);
    if (spec.k === "dax.runs") return yes();
  } catch (e) {
    if (e instanceof DaxError) return no(`Your formula did not run: ${e.message}${e.hint ? " " + e.hint : ""}`);
    return no("Your formula could not be calculated.");
  }
  if (spec.k !== "dax.measure") return no("Unknown check.");
  if (!mine.measureNames().some((n) => n.toLowerCase() === spec.name.toLowerCase())) return no(`Define a measure called ${spec.name}. Start the line with its name, then an equals sign.`);
  let got: DaxMatrix[], want: DaxMatrix[];
  try {
    const ref = new Dax(d.model, parseDefinitions(!/^\s*(VAR|RETURN)\b/i.test(spec.solution) && /^\s*[A-Za-z_][\w %.]*\s*:?=/.test(spec.solution) ? spec.solution : `${spec.name} = ${spec.solution}`));
    got = d.visuals.map((v) => mine.matrix(v, spec.name));
    want = d.visuals.map((v) => ref.matrix(v, spec.name));
  } catch (e) {
    return no(e instanceof DaxError ? `Your measure did not run: ${e.message}${e.hint ? " " + e.hint : ""}` : "This check could not be prepared. Please report it.");
  }
  for (let i = 0; i < want.length; i++) {
    const g = got[i], w = want[i];
    if (g.rows.length !== w.rows.length) return no(`In the visual "${w.label}" your measure shows ${g.rows.length} row${g.rows.length === 1 ? "" : "s"} with a value, but ${w.rows.length} ${w.rows.length === 1 ? "is" : "are"} expected. Look at which rows are blank.`);
    for (let r = 0; r < w.rows.length; r++) {
      if (w.rows[r].header.join("|") !== g.rows[r].header.join("|")) return no(`In the visual "${w.label}" the rows that have a value are not the expected ones (see ${showV(g.rows[r].header[0])}).`);
      for (let c = 0; c < w.rows[r].cells.length; c++) {
        if (!same(g.rows[r].cells[c], w.rows[r].cells[c])) return no(`In the visual "${w.label}" the value for ${w.rows[r].header.map(showV).join(" / ")}${w.headers.length > 1 ? ` in the ${w.headers[c]} column` : ""} is ${showV(g.rows[r].cells[c])}, which is not the expected value. Think about what filters apply in that cell.`);
      }
    }
    for (let c = 0; c < w.total.length; c++) if (!same(g.total[c], w.total[c])) return no(`In the visual "${w.label}" the total row differs (it shows ${showV(g.total[c])}). Check how your measure behaves when no row is selected.`);
  }
  return yes();
}

const DEFAULT_AGG = "sum";
function vizCheck(spec: CheckSpec, state: Extract<ActivityState, { kind: "viz" }>, a: Activity): Out {
  const z = a.viz;
  if (!z) return no("This exercise has no data.");
  const data = { ...z.data, calcs: { ...(z.data.calcs ?? {}), ...state.calcs } };
  const mine = computeViz(data, state.spec);
  switch (spec.k) {
    case "viz.runs": return mine.ok ? yes() : no(`Your view cannot be drawn: ${mine.error}${mine.hint ? " " + mine.hint : ""}`);
    case "viz.shelf": {
      const s = state.spec;
      const pills: Pill[] = spec.shelf === "columns" || spec.shelf === "rows" ? s[spec.shelf] : spec.shelf === "detail" ? s.detail ?? [] : s[spec.shelf] ? [s[spec.shelf] as Pill] : [];
      const on = pills.filter((p) => p.field.toLowerCase() === spec.field.toLowerCase());
      const name = spec.shelf === "columns" ? "Columns" : spec.shelf === "rows" ? "Rows" : spec.shelf[0].toUpperCase() + spec.shelf.slice(1);
      if (!on.length) return no(`Put ${spec.field} on ${name}.`);
      const field = z.data.fields.find((f) => f.name.toLowerCase() === spec.field.toLowerCase());
      const ok = on.some((p) => (!spec.agg || (p.agg ?? (field?.role === "measure" ? DEFAULT_AGG : "")) === spec.agg) && (!spec.date || (p.date ?? "year") === spec.date) && (!spec.quick || p.quick === spec.quick));
      if (ok) return yes();
      if (spec.agg) return no(`${spec.field} is on ${name}, but it should be aggregated as ${spec.agg === "avg" ? "an average" : spec.agg === "countd" ? "a distinct count" : spec.agg}. Change the aggregation in its menu.`);
      if (spec.date) return no(`${spec.field} is on ${name}, but it should be shown by ${spec.date}. Change the date level in its menu.`);
      return no(`${spec.field} is on ${name}, but it needs the table calculation ${spec.quick}. Choose it in its menu.`);
    }
    case "viz.kind": return !mine.ok ? no(`Your view cannot be drawn yet: ${mine.error}`) : spec.kinds.includes(mine.kind) ? yes() : no(`Your view is not ${spec.what} yet. Think about which fields go on Columns and which on Rows.`);
    case "viz.sorted": {
      if (!mine.ok) return no("Your view cannot be drawn yet.");
      const axis = mine.axisDim;
      if (axis === null || !mine.points.length) return no("Sorting needs a chart with a category along one axis.");
      const order: string[] = [], tot = new Map<string, number>();
      for (const p of mine.points) { const k = String(p.dims[axis]); if (!tot.has(k)) order.push(k); tot.set(k, (tot.get(k) ?? 0) + (typeof p.meas[0] === "number" ? p.meas[0] : 0)); }
      const vals = order.map((k) => tot.get(k) ?? 0);
      const ok = vals.every((v, i) => i === 0 || (spec.dir === "desc" ? vals[i - 1] >= v : vals[i - 1] <= v));
      return ok && order.length > 1 ? yes() : no(spec.dir === "desc" ? "Sort the marks from high to low (use Sort: High to low)." : "Sort the marks from low to high (use Sort: Low to high).");
    }
    case "viz.filter": {
      const f = (state.spec.filters ?? []).find((x) => x.field.toLowerCase() === spec.field.toLowerCase());
      if (!f) return no(`Add a filter on ${spec.field}.`);
      if (spec.values) {
        const want = new Set(spec.values.map((v) => v.toLowerCase())), got = new Set((f.values ?? []).map((v) => v.toLowerCase()));
        if (want.size !== got.size || [...want].some((v) => !got.has(v))) return no(`The filter on ${spec.field} should keep exactly: ${spec.values.join(", ")}.`);
      }
      if (spec.min !== undefined && !(typeof f.min === "number" && f.min >= spec.min)) return no(`The filter on ${spec.field} should start at ${spec.min} or more.`);
      if (spec.max !== undefined && !(typeof f.max === "number" && f.max <= spec.max)) return no(`The filter on ${spec.field} should stop at ${spec.max} or less.`);
      return yes();
    }
    case "viz.top": return state.spec.top === spec.n ? yes() : no(`Show only the top ${spec.n}.`);
    case "viz.hasCalc": return Object.keys(state.calcs).some((n) => n.toLowerCase() === spec.name.toLowerCase()) ? yes() : no(`Create a calculated field called ${spec.name}.`);
    case "viz.uses": {
      let re: RegExp;
      try { re = new RegExp(spec.re, "i"); } catch { return no("This check is misconfigured."); }
      return re.test(Object.values(state.calcs).join("\n")) ? yes() : no(`Your calculated field should use ${spec.what}.`);
    }
    case "viz.data": {
      if (!mine.ok) return no(`Your view cannot be drawn yet: ${mine.error}${mine.hint ? " " + mine.hint : ""}`);
      const want = computeViz({ ...z.data, calcs: { ...(z.data.calcs ?? {}), ...(spec.calcs ?? {}) } }, spec.solution);
      if (!want.ok) return no("This check could not be prepared. Please report it.");
      if (mine.points.length !== want.points.length) return no(`Your view has ${mine.points.length} mark${mine.points.length === 1 ? "" : "s"}; this task needs ${want.points.length}. Check which fields split the marks, and the filters.`);
      if (mine.measLabels.length < want.measLabels.length) return no("Your view is missing a measure the task asks for.");
      const key = (p: { dims: Cell[]; meas: Cell[] }): string => JSON.stringify(p.dims);
      const wm = new Map(want.points.map((p) => [key(p), p]));
      const near = (x: Cell, y: Cell): boolean => (x === null || y === null ? x === y : typeof x === "number" && typeof y === "number" ? Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y)) : x === y);
      for (const p of mine.points) {
        const w = wm.get(key(p));
        if (!w) return no(`Your view has a mark (${p.dims.join(" / ")}) that the task does not expect. Check the fields that split the marks.`);
        // the measures the task asks for must appear among yours, in any order
        for (let j = 0; j < w.meas.length; j++) if (!p.meas.some((m) => near(m, w.meas[j]))) return no(`The value of ${want.measLabels[j]} for ${p.dims.join(" / ") || "the mark"} is not what the task expects. Check the aggregation and the calculation.`);
      }
      if (spec.ordered) {
        const mk = mine.points.map(key), wk = want.points.map(key);
        if (mk.some((k, i) => k !== wk[i])) return no("The right marks, but not in the order the task asks for. Check the sort.");
      }
      return yes();
    }
    default: return no("Unknown check.");
  }
}

function runOne(c: Check, state: ActivityState, a: Activity): CheckResult {
  let o: Out;
  const k = c.spec.k;
  if (k.startsWith("doc.")) o = state.kind === "word" ? wordCheck(c.spec, state.html) : no("Wrong kind of work.");
  else if (k.startsWith("sheet.")) o = state.kind === "sheet" ? sheetCheck(c.spec, state.sheet) : no("Wrong kind of work.");
  else if (k.startsWith("viz.")) o = state.kind === "viz" ? vizCheck(c.spec, state, a) : no("Wrong kind of work.");
  else if (k.startsWith("dax.")) o = state.kind === "dax" ? daxCheck(c.spec, state.code, a) : no("Wrong kind of work.");
  else if (k.startsWith("sql.")) o = state.kind === "sql" ? sqlCheck(c.spec, state.query, a) : no("Wrong kind of work.");
  else if (k.startsWith("slides.")) o = state.kind === "slides" ? slidesCheck(c.spec, sanitizeDeck(state.deck)) : no("Wrong kind of work.");
  else if (c.spec.k === "classify.item") {
    const spec = c.spec;
    const item = a.classify?.items.find((i) => i.id === spec.item);
    const picked = state.kind === "classify" ? state.answers[spec.item] : undefined;
    o = !item ? no("Unknown item.") : !picked ? no("Choose a group for this one.") : picked === item.answer ? yes() : no(`That one does not belong in "${a.classify?.categories.find((x) => x.id === picked)?.label ?? picked}". Look at it again and think about why.`);
  } else o = no("Unknown check.");
  return { id: c.id, label: c.label, passed: o.ok, message: o.ok ? "Done" : o.msg, hint: c.hint, explain: c.explain };
}

export function runChecks(a: Activity, state: ActivityState): RunResult {
  const results = a.checks.map((c) => runOne(c, state, a));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  return { results, passed, total, score: total ? Math.round((passed / total) * 100) : 0, allPassed: total > 0 && passed === total };
}

export { parseRef, refName };
