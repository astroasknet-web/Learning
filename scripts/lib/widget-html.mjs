/**
 * Turns the `widgets` an author lists on a lesson into placeholder HTML for the lesson player. Each placeholder carries the spec as base64 JSON
 * (components/learn/widgets/WidgetHost.tsx mounts the live widget over it) and a readable static fallback, so the lesson still works with
 * scripts off and for search engines. Pure functions, no I/O.
 */
import { esc, fmt } from "./course-html.mjs";

const rs = (n) => "₹" + fmt(n);
const safeId = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 54);
const b64 =(o) => Buffer.from(JSON.stringify(o), "utf8").toString("base64");

const fallbacks = {
  quiz: (s) => `<h3>${esc(s.title ?? "Quick check")}</h3>` + s.questions.map((q, i) => `<details class="cw-qa"><summary>${i + 1}. ${esc(q.q)}</summary><ul>${q.options.map((o, j) => `<li>${j === q.answer ? "<b>" : ""}${esc(o)}${j === q.answer ? " (correct)</b>" : ""}</li>`).join("")}</ul><p>${esc(q.explain)}</p></details>`).join(""),
  journal: (s) => `<h3>${esc(s.title)}</h3>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}<ol>${s.txns.map((t) => `<li>${esc(t.text)}<br>${t.dr.map(([a, v]) => `Dr ${esc(a)} ${rs(v)}`).join("; ")}; ${t.cr.map(([a, v]) => `Cr ${esc(a)} ${rs(v)}`).join("; ")}. ${esc(t.why)}</li>`).join("")}</ol>`,
  equation: (s) => `<h3>${esc(s.title)}</h3><ol>${s.moves.map((m) => `<li>${esc(m.text)} ${esc(m.why)}</li>`).join("")}</ol>`,
  explorer: (s) => `<h3>${esc(s.title)}</h3>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}<p>Adjust ${s.inputs.map((i) => esc(i.label)).join(", ")} and see ${s.outputs.map((o) => esc(o.label)).join(", ")} change.</p>`,
  flashcards: (s) => `<h3>${esc(s.title)}</h3><dl>${s.cards.map((c) => `<dt>${esc(c.front)}</dt><dd>${esc(c.back)}</dd>`).join("")}</dl>`,
  hashlab: (s) => `<h3>${esc(s.title)}</h3>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}<p>Type any text and see its SHA-256 fingerprint change completely when one letter changes.</p>`,
  chainlab: (s) => `<h3>${esc(s.title)}</h3>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}<p>A chain of ${s.blocks.length} linked blocks. Change the data in one block and see every later block break until it is mined again.</p>`,
  merkle: (s) => `<h3>${esc(s.title)}</h3>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}<p>${s.txs.length} transactions are hashed in pairs up to one Merkle root. Change one transaction and the root changes.</p>`,
  sqlplay: (s) => `<h3>${esc(s.title)}</h3>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}<p>Tables: ${s.tables.map((t) => esc(t.name)).join(", ")}. Starting query:</p><pre><code>${esc(s.query)}</code></pre>`,
  daxplay: (s) => `<h3>${esc(s.title)}</h3>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}<p>Tables: ${s.model.tables.map((t) => esc(t.name)).join(", ")}. Starting formula:</p><pre><code>${esc(s.code)}</code></pre>`,
  vizplay: (s) => `<h3>${esc(s.title)}</h3>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}<p>A live chart builder on a table with the fields: ${s.data.fields.map((f) => esc(f.name)).join(", ")}.</p>`,
  complete: () => "",
};

/** One placeholder element for a widget spec. */
export function widgetHtml(spec) {
  const fb = (fallbacks[spec.type] ?? (() => ""))(spec);
  return `<div class="cw-widget-slot" data-cw-widget="${esc(spec.type)}" data-spec="${b64(spec)}">${fb ? `<div class="cw-fallback">${fb}</div>` : ""}</div>`;
}

/** Inline "check what you just learned" quiz built from the lesson's own MCQs (first n), so every lesson has instant feedback with no extra authoring. */
export function autoQuiz(lesson, n = 3) {
  const mcq = lesson.practice?.mcq ?? [];
  if (!mcq.length) return null;
  const picks = mcq.slice(0, n);
  return {
    type: "quiz", id: `${safeId(lesson.slug ?? lesson.id)}-check`.slice(0, 60), title: "Check what you just learned",
    questions: picks.map((q) => ({ q: q.q, options: q.options, answer: "ABCD".indexOf(q.answer), explain: q.explain })),
  };
}

/** Widgets to place in a lesson: author-listed ones, then an auto quick check (unless the author supplied a quiz), then the complete button. */
export function lessonWidgets(lesson) {
  const list = [...(lesson.widgets ?? [])];
  if (!list.some((w) => w.type === "quiz")) { const q = autoQuiz(lesson); if (q) list.push(q); }
  list.push({ type: "complete", id: safeId(lesson.slug ?? lesson.id) });
  return list;
}
