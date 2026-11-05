import { dictionaries } from "../data";
import type { Career } from "../career-stage";
import type { Segmented } from "../segmenter";
import { containsAny, findAll, lines as textLines } from "../text";
import { asciiLower, escapeClass, ltrimBytes, mbLen, phpTrim, rtrimChars, rx, strWordCount } from "../php";
import { rate, type RawScores } from "./types";

/**
 * Section 5, Impact and Presentation (port of Score\ImpactScorer): quantified results, outcome/STAR framing, awards,
 * leadership, publications, plus resume craft (contact, summary, length, ATS-friendliness, clichés).
 */
const BULLET_TRIM = "-•*◦▪‣· ";

export function scoreImpact(seg: Segmented, fullText: string, career: Career): RawScores {
  const dict = dictionaries();
  const lines = textLines(fullText);
  const bullets = bulletLines(lines, dict.bullet_markers);
  const descLines = bullets.length ? bullets : lines;

  const quant = quantifiedRatio(descLines, dict.currency_symbols);
  const outcome = outcomeRatio(descLines);
  const star = starRatio(descLines, dict.action_verbs_strong);
  const awardsScore = awards(seg, fullText);
  const leadershipScore = leadership(fullText);
  const publications = findAll(fullText, dict.publication_markers);
  const contactScore = contact(fullText);
  const summaryScore = summary(seg);
  const length = lengthScore(fullText, career);
  const ats = atsScore(seg, fullText, bullets, lines);
  const cliches = findAll(fullText, dict.buzzwords_cliches).length;
  const T = [0.05, 0.15, 0.3, 0.5, 0.7];

  const r: RawScores = {};
  r[501] = rate(ratioScore(quant, T), { 0: "No metrics.", 1: "One vague number.", 2: "A couple of metrics.", 3: "Several quantified points.", 4: "Most achievements quantified.", 5: "Consistent, credible metrics throughout." });
  r[502] = rate(ratioScore(outcome, T), { 0: "Only duties.", 1: "Task-focused.", 2: "Occasional outcome.", 3: "Outcome-aware.", 4: "Outcome-driven.", 5: "Effort tied to outcomes throughout." });
  r[503] = rate(ratioScore(star, T), { 0: "No achievements.", 1: "Responsibilities only.", 2: "Some achievements.", 3: "Achievement-oriented.", 4: "Action-result framing.", 5: "Situation-action-result throughout." });
  r[504] = rate(awardsScore, { 0: "None.", 1: "Mentioned, no context.", 2: "Basic listing.", 3: "Named awards with dates.", 4: "Notable awards detailed.", 5: "Prestigious awards with selectivity." });
  r[505] = rate(leadershipScore, { 0: "None.", 1: "Implied.", 2: "Some ownership.", 3: "Led work/people.", 4: "Clear leadership scope.", 5: "Quantified leadership (team/budget)." });
  r[506] = rate(pubScore(publications, fullText), { 0: "None.", 1: "Mentioned.", 2: "One item.", 3: "Named publications/talks.", 4: "Peer-reviewed / patents.", 5: "Recognised published body of work." });
  r[507] = rate(contactScore, { 0: "No contact info.", 1: "One channel.", 2: "Email or phone.", 3: "Email and phone.", 4: "Email, phone, location.", 5: "Contact plus professional links." });
  r[508] = rate(summaryScore, { 0: "No summary.", 1: "Generic objective.", 2: "Vague summary.", 3: "Clear summary.", 4: "Targeted value proposition.", 5: "Sharp, tailored headline summary." });
  r[509] = rate(length, { 0: "Far too short/long.", 1: "Length off.", 2: "Somewhat off.", 3: "Acceptable length.", 4: "Well-judged length.", 5: "Ideal density for level." });
  r[510] = rate(ats, { 0: "Unparseable.", 1: "Inconsistent.", 2: "Basic formatting.", 3: "Clean, consistent.", 4: "Standard headings, consistent.", 5: "Fully ATS-safe structure." });
  r[511] = rate(clicheScore(cliches), { 0: "Cliché-ridden.", 1: "Many clichés.", 2: "Several clichés.", 3: "Few clichés.", 4: "Largely concrete.", 5: "No filler; confident language." });
  return r;
}

function bulletLines(lines: string[], markers: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    if (markers.some((b) => b !== "" && l.startsWith(b))) {
      const t = ltrimBytes(l, BULLET_TRIM);
      if (mbLen(t) > 3) out.push(t);
    }
  }
  return out;
}

/** The PHP code builds one character class from ALL currency entries joined together (including "rs.", "inr"); kept as is. */
function quantifiedRatio(lines: string[], currency: string[]): number {
  if (!lines.length) return 0;
  const cls = new RegExp("[" + escapeClass(currency.join("")) + "]\\s*\\d", "u");
  let hits = 0;
  for (const l of lines) {
    if (rx(String.raw`\d+\s*%`).test(l) || cls.test(l) || /\b\d[\d,]{2,}\b/.test(l) || rx(String.raw`\b\d+\s*(users|customers|clients|hours|days|weeks|months|team|members|countries|downloads|crore|lakh|million|k\+|x)\b`, "i").test(l)) hits++;
  }
  return hits / lines.length;
}

function outcomeRatio(lines: string[]): number {
  if (!lines.length) return 0;
  const re = /\b(increased|reduced|improved|grew|saved|boosted|accelerated|drove|delivered|generated|achieved|exceeded|cut|optimis|optimiz|streamlin|scaled)\w*/i;
  return lines.filter((l) => re.test(l)).length / lines.length;
}

function starRatio(lines: string[], verbs: string[]): number {
  if (!lines.length) return 0;
  let hits = 0;
  for (const l of lines) {
    const first = rtrimChars(asciiLower(phpTrim(phpTrim(l).split(" ")[0] ?? "")), ".,:;");
    if (verbs.includes(first) && /\d/.test(l)) hits++;
  }
  return hits / lines.length;
}

function awards(seg: Segmented, text: string): number {
  const dict = dictionaries();
  const hasSection = Object.keys(seg.sections).some((k) => k === "awards" || k.includes("honor") || k.includes("honour"));
  const hits = findAll(text, dict.award_markers);
  if (!hits.length) return 0;
  const selectivity = containsAny(text, dict.selectivity_markers);
  const dated = /(19|20)\d{2}/.test(text);
  if (selectivity) return 5;
  if (hits.length >= 2 || hasSection) return dated ? 4 : 3;
  return dated ? 3 : 2;
}

function leadership(text: string): number {
  const dict = dictionaries();
  const teamSize = rx(String.raw`\bteam of\s+\d+`, "i").test(text) || rx(String.raw`\b\d+\s*(engineers|people|members|analysts|students|staff)\b`, "i").test(text);
  const markers = findAll(text, dict.leadership_markers);
  if (!markers.length) return 0;
  if (teamSize) return 5;
  if (markers.length >= 3) return 4;
  if (markers.length >= 1) return 3;
  return 2;
}

function pubScore(pubs: string[], text: string): number {
  if (!pubs.length) return 0;
  if (containsAny(text, ["patent", "peer-reviewed", "journal", "doi"])) return 5;
  if (containsAny(text, ["published", "conference", "isbn", "book"])) return 4;
  return pubs.length >= 2 ? 3 : 2;
}

function contact(text: string): number {
  const dict = dictionaries();
  const head = textLines(text).slice(0, 15).join("\n") + "\n" + text;
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(head);
  const phone = rx(String.raw`(\+?\d[\d\s().-]{7,}\d)`).test(head);
  const location = containsAny(head, [...dict.international_country_markers, "india", "delhi", "mumbai", "bengaluru", "bangalore", "street", "road", "colony"]);
  const links = containsAny(head, dict.link_markers);
  const core = (email ? 1 : 0) + (phone ? 1 : 0);
  if (core === 0) return 0;
  if (email && phone && location && links) return 5;
  if (email && phone && location) return 4;
  if (email && phone) return 3;
  return 2;
}

function summary(seg: Segmented): number {
  const dict = dictionaries();
  const block = seg.sections["objective"] ?? "";
  if (block === "") return 0;
  const len = strWordCount(block);
  const quality = containsAny(block, dict.summary_quality_markers);
  const generic = containsAny(block, ["seeking a challenging", "looking for a job", "to work in a", "utilise my skills", "utilize my skills"]);
  if (generic) return 1;
  if (quality && len >= 25) return 5;
  if (quality) return 4;
  if (len >= 15) return 3;
  return 2;
}

function lengthScore(text: string, career: Career): number {
  const words = strWordCount(text);
  const years = career.yearsExperience ?? 0;
  const [lo, hi] = years >= 10 ? [500, 1100] : years >= 3 ? [350, 850] : [200, 650];
  if (words < lo * 0.5 || words > hi * 1.8) return 0;
  if (words < lo * 0.75 || words > hi * 1.4) return 2;
  if (words >= lo && words <= hi) return 5;
  return 3;
}

function atsScore(seg: Segmented, text: string, bullets: string[], lines: string[]): number {
  let standard = 0;
  for (const k of ["education", "experience", "skills"]) if ((seg.sections[k] ?? "") !== "") standard++;
  const weird = (text.match(/[\u{FFFD}\u{2022}\u{2219}]/gu) ?? []).length; // garbled glyphs from broken PDF extraction
  const weirdRatio = lines.length === 0 ? 0 : weird / Math.max(1, lines.length);
  const bulletRatio = lines.length === 0 ? 0 : bullets.length / lines.length;
  if (standard <= 1 || weirdRatio > 0.25) return 1;
  if (standard === 3 && bulletRatio > 0.15 && weirdRatio < 0.05) return 5;
  if (standard >= 2 && weirdRatio < 0.1) return 4;
  return 3;
}

function clicheScore(n: number): number {
  if (n === 0) return 5;
  if (n === 1) return 4;
  if (n <= 3) return 3;
  if (n <= 5) return 2;
  return 1;
}

function ratioScore(ratio: number, thresholds: number[]): number {
  let score = 0;
  thresholds.forEach((t, i) => {
    if (ratio >= t) score = i + 1;
  });
  return score;
}
