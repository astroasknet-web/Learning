/* eslint-disable */
// @ts-nocheck
// Ported from Vidaara (lib/ielts-feedback.js): a rule-based, offline IELTS Writing band estimator. No AI, no network.

/**
 * lib/ielts-feedback.js — deterministic, rule-based IELTS Writing band estimator.
 *
 * NO external AI / API. This is a self-assessment aid, not an official examiner —
 * it estimates a band from measurable proxies for the four official criteria:
 *   • Task Achievement/Response  → length vs the task minimum, paragraphing
 *   • Coherence & Cohesion       → paragraph count, linking-word range
 *   • Lexical Resource           → type/token ratio, repetition, over-simple words
 *   • Grammatical Range/Accuracy → sentence-length variety, complex-clause signals
 *
 * Returns { band, criteria:{ta,cc,lr,gra}, wordCount, paragraphs, sentences,
 *           strengths[], improvements[], note }.
 * It deliberately CANNOT reward ideas or penalise off-topic answers — it says so.
 */

// A generous but real set of cohesive devices across the usual categories.
const LINKERS = [
  'however', 'moreover', 'furthermore', 'in addition', 'additionally', 'therefore',
  'consequently', 'as a result', 'for instance', 'for example', 'such as', 'in contrast',
  'on the other hand', 'nevertheless', 'nonetheless', 'whereas', 'while', 'although',
  'despite', 'in spite of', 'because', 'since', 'thus', 'hence', 'firstly', 'secondly',
  'finally', 'in conclusion', 'to conclude', 'overall', 'in summary', 'by comparison',
  'similarly', 'likewise', 'meanwhile', 'on balance', 'in other words', 'that is to say',
];
// Words IELTS candidates lean on when their lexical resource is thin.
const OVERSIMPLE = ['good', 'bad', 'big', 'small', 'nice', 'thing', 'things', 'a lot', 'lots', 'very', 'really', 'get', 'got'];
// Signals of complex/subordinate structures (a rough proxy for grammatical range).
const COMPLEX_SIGNALS = ['which', 'who', 'whom', 'whose', 'that', 'because', 'although', 'though', 'while', 'whereas', 'if', 'unless', 'since', 'when', 'where', 'so that', 'in order to', 'despite', 'having'];

function words(s) { return (String(s || '').toLowerCase().match(/[a-z']+/g) || []); }
function sentences(s) {
  return String(s || '').split(/[.!?]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 0; });
}
function paragraphs(s) {
  return String(s || '').split(/\n\s*\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
}
function countPhrases(text, list) {
  var t = ' ' + String(text || '').toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  var found = [];
  list.forEach(function (p) { if (t.indexOf(' ' + p + ' ') !== -1 && found.indexOf(p) === -1) found.push(p); });
  return found;
}
function clampBand(b) { return Math.max(3, Math.min(9, b)); }
function roundHalf(n) { return Math.round(n * 2) / 2; }

/**
 * @param {object} o { text, task: 'task1'|'task2' }
 */
function evaluate(o) {
  o = o || {};
  var text = String(o.text || '').trim();
  var task = o.task === 'task1' ? 'task1' : 'task2';
  var minWords = task === 'task1' ? 150 : 250;

  if (!text) {
    return { band: 0, criteria: { ta: 0, cc: 0, lr: 0, gra: 0 }, wordCount: 0, paragraphs: 0,
      sentences: 0, strengths: [], improvements: ['Write your response, then check it for an estimated band.'],
      note: 'This is an automated estimate based on structure and vocabulary — not an official examiner score.' };
  }

  var toks = words(text);
  var wc = toks.length;
  var sents = sentences(text);
  var paras = paragraphs(text);
  var avgSentLen = sents.length ? wc / sents.length : wc;
  var uniq = {};
  toks.forEach(function (w) { uniq[w] = (uniq[w] || 0) + 1; });
  var uniqueCount = Object.keys(uniq).length;
  var ttr = wc ? uniqueCount / wc : 0; // type/token ratio (lexical variety)
  var linkers = countPhrases(text, LINKERS);
  var oversimple = countPhrases(text, OVERSIMPLE);
  var complexSignals = countPhrases(text, COMPLEX_SIGNALS);

  var strengths = [];
  var improvements = [];

  // ── Task Achievement / Response (length + development) ──────────────────────
  var ta = 6;
  if (wc >= minWords) { ta += 1; strengths.push('You met the minimum length (' + wc + ' words; the task needs ' + minWords + '+).'); }
  else {
    var deficit = minWords - wc;
    ta -= deficit > 60 ? 2 : 1;
    improvements.push('You are ' + deficit + ' words under the ' + minWords + '-word minimum — under-length answers are penalised on Task ' + (task === 'task1' ? '1' : '2') + '.');
  }
  if (paras.length >= (task === 'task1' ? 3 : 4)) { ta += 0.5; }
  else { improvements.push('Use clear paragraphs — an intro, ' + (task === 'task1' ? 'an overview and body paragraph(s)' : 'two developed body paragraphs and a conclusion') + '.'); }
  ta = clampBand(ta);

  // ── Coherence & Cohesion (paragraphing + linking range) ────────────────────
  var cc = 5.5;
  if (paras.length >= 4) { cc += 1; strengths.push('Good paragraphing (' + paras.length + ' paragraphs).'); }
  else if (paras.length <= 1 && wc > 80) { cc -= 1; improvements.push('Your answer looks like one block — separate ideas into paragraphs with a blank line between them.'); }
  if (linkers.length >= 6) { cc += 1.5; strengths.push('A wide range of linking words (e.g. ' + linkers.slice(0, 3).join(', ') + ').'); }
  else if (linkers.length >= 3) { cc += 0.5; }
  else { improvements.push('Add cohesive devices to connect ideas — e.g. however, moreover, as a result, in contrast.'); }
  cc = clampBand(cc);

  // ── Lexical Resource (variety + repetition + over-simple words) ─────────────
  var lr = 5.5;
  if (ttr >= 0.55) { lr += 1.5; strengths.push('Strong vocabulary variety — you rarely repeat the same words.'); }
  else if (ttr >= 0.45) { lr += 0.5; }
  else if (wc > 120) { lr -= 0.5; improvements.push('You repeat words a lot — vary your vocabulary and use synonyms/paraphrase.'); }
  if (oversimple.length >= 4) { lr -= 1; improvements.push('Replace vague, over-used words (' + oversimple.slice(0, 3).join(', ') + ') with precise, formal alternatives.'); }
  else if (oversimple.length <= 1 && wc > 120) { lr += 0.5; }
  lr = clampBand(lr);

  // ── Grammatical Range & Accuracy (sentence variety + complex clauses) ───────
  var gra = 5.5;
  if (complexSignals.length >= 5) { gra += 1.5; strengths.push('Good grammatical range — you use complex/subordinate structures.'); }
  else if (complexSignals.length >= 3) { gra += 0.5; }
  else { improvements.push('Use more complex sentences — relative clauses (which/who/that), conditionals (if…), and concession (although…).'); }
  if (avgSentLen >= 12 && avgSentLen <= 24) { gra += 0.5; strengths.push('Sentence length is well controlled (avg ' + avgSentLen.toFixed(0) + ' words).'); }
  else if (avgSentLen > 30) { improvements.push('Some sentences may be too long — break very long sentences up to keep them accurate and clear.'); }
  else if (avgSentLen < 8 && sents.length > 4) { improvements.push('Your sentences are quite short — combine some using linking words and relative clauses.'); }
  gra = clampBand(gra);

  // Overall = mean of the four, rounded to the nearest half band (IELTS convention).
  var overall = roundHalf((ta + cc + lr + gra) / 4);

  if (!strengths.length) strengths.push('You produced a full response — keep refining it against the four criteria.');

  return {
    band: overall,
    criteria: { ta: roundHalf(ta), cc: roundHalf(cc), lr: roundHalf(lr), gra: roundHalf(gra) },
    wordCount: wc, paragraphs: paras.length, sentences: sents.length,
    strengths: strengths, improvements: improvements,
    note: 'Estimated from measurable features (length, paragraphing, linking words, vocabulary variety, sentence structure). A real examiner also judges your ideas, relevance and accuracy — use this to build habits, not as a guaranteed score.',
  };
}

export { evaluate };
