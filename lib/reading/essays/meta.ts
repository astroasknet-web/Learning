import type { Difficulty, QType, SkillId } from "../taxonomy";

/**
 * The 30 essay reading tests for competitive examinations. The text and questions are in essays.json (normalised from the supplied files; see the
 * audit in the tests repository). This file adds what the pages need: a theme, the examinations each essay suits, a difficulty and the free samples.
 *
 * "Suits" means the essay's theme and style are good practice for that examination. It is NOT a claim that the examination has asked about it.
 * Exam names appear only on the Reading Tests pages, never as learning categories inside the Reading Studio.
 */
export type Exam = "SSC" | "CDS" | "CAT" | "UPSC" | "CTET";
export const EXAMS: Array<{ id: Exam; name: string; focus: string }> = [
  { id: "SSC", name: "SSC", focus: "General awareness passages, precise reading and quick answers" },
  { id: "CDS", name: "CDS", focus: "Defence, geopolitics and English comprehension" },
  { id: "CAT", name: "CAT", focus: "Dense argument, inference and abstract reading" },
  { id: "UPSC", name: "UPSC", focus: "Governance, economy, environment and ethics essays" },
  { id: "CTET", name: "CTET", focus: "Education, pedagogy and language comprehension" },
];

export interface Theme { id: string; name: string; blurb: string; hue: string; icon: string }
export const THEMES: Theme[] = [
  { id: "defence", name: "Defence and Security", blurb: "Armed forces, geopolitics, cyber threats and recruitment", hue: "#1F4E79", icon: "shield" },
  { id: "economy", name: "Economy and Jobs", blurb: "Growth, employment, the gig economy and digital money", hue: "#B4530F", icon: "chart" },
  { id: "education", name: "Education and Talent", blurb: "NEP 2020, teachers, schools and brain drain", hue: "#6B3FA0", icon: "book" },
  { id: "technology", name: "Technology and Society", blurb: "AI, EVs, screens, e-learning and information overload", hue: "#0F766E", icon: "chip" },
  { id: "environment", name: "Environment and Climate", blurb: "Water, floods, plastic, carbon and climate justice", hue: "#2F7D32", icon: "leaf" },
  { id: "polity", name: "Polity, Ethics and Media", blurb: "Justice, power, the UCC, openness and social media", hue: "#9C2F4A", icon: "scale" },
];

const t = (n: number, theme: string, exams: Exam[], difficulty: 3 | 4 | 5, minutes: number) => ({ n, theme, exams, difficulty, minutes });
/** Difficulty 3 for factual, policy-led essays; 4 for argument-led ones; 5 for the abstract quotation essays. */
export const ESSAY_META = [
  t(1, "defence", ["CDS", "UPSC", "SSC"], 3, 25), t(2, "defence", ["CDS", "UPSC", "SSC"], 3, 22), t(3, "defence", ["CDS", "UPSC", "CAT"], 3, 22),
  t(4, "defence", ["UPSC", "CDS", "CAT"], 4, 25), t(5, "defence", ["CDS", "SSC", "UPSC"], 3, 22),
  t(6, "economy", ["UPSC", "SSC", "CAT"], 3, 25), t(7, "economy", ["CAT", "UPSC"], 5, 25), t(8, "economy", ["UPSC", "CAT", "SSC"], 3, 22),
  t(9, "economy", ["UPSC", "SSC", "CAT"], 3, 22), t(10, "economy", ["UPSC", "SSC", "CAT"], 4, 22),
  t(11, "education", ["CTET", "UPSC", "SSC"], 3, 22), t(12, "education", ["CTET", "UPSC", "CAT"], 4, 22), t(13, "education", ["CAT", "UPSC", "CTET"], 5, 25),
  t(14, "education", ["CTET", "SSC", "UPSC"], 3, 22), t(15, "education", ["UPSC", "CAT", "SSC"], 4, 22),
  t(16, "technology", ["CAT", "UPSC", "CDS"], 4, 25), t(17, "technology", ["CAT", "CTET", "SSC"], 5, 22), t(18, "technology", ["UPSC", "SSC", "CAT"], 3, 22),
  t(19, "technology", ["CTET", "CAT", "UPSC"], 4, 22), t(20, "technology", ["CAT", "UPSC", "CTET"], 5, 22),
  t(21, "environment", ["UPSC", "SSC", "CTET"], 3, 25), t(22, "environment", ["CAT", "UPSC"], 5, 22), t(23, "environment", ["UPSC", "SSC", "CDS"], 3, 22),
  t(24, "environment", ["UPSC", "SSC", "CTET"], 3, 22), t(25, "environment", ["CAT", "UPSC", "CDS"], 5, 22),
  t(26, "polity", ["UPSC", "CAT", "CDS"], 5, 22), t(27, "polity", ["CAT", "UPSC", "CDS"], 5, 22), t(28, "polity", ["UPSC", "CDS", "SSC"], 4, 30),
  t(29, "polity", ["UPSC", "CAT", "CTET"], 5, 22), t(30, "polity", ["CAT", "UPSC", "CTET", "SSC"], 4, 22),
] as const satisfies ReadonlyArray<{ n: number; theme: string; exams: readonly Exam[]; difficulty: 3 | 4 | 5; minutes: number }>;

/** Free for every signed-in student (configurable in the console: `freeEssays`). */
export const DEFAULT_FREE_ESSAYS = [6, 11, 20];

export const essaySlug = (n: number, title: string): string => `essay-${String(n).padStart(2, "0")}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, "")}`;

export interface Classified { skill: SkillId; qtype: QType; difficulty: Difficulty; expectedSecs: number }

/**
 * Tags a question with a reading skill and type from its wording. This is a rule-based first pass (the supplied files carry no skill tags), so it is
 * deliberately conservative: anything it cannot place is "important facts and details". An administrator can retag any question in the console.
 */
export function classifyQuestion(question: string, options: string[]): Classified {
  const q = question.toLowerCase();
  const has = (re: RegExp) => re.test(q);
  const multi = /consider the following statements|which of the (above )?statements|statement[s]? (is|are) (correct|incorrect)|assertion|reason \(r\)/.test(q);
  const negation = /\b(not|except|incorrect|false)\b[^?]*\?|which of the following is not|is not (a|an|true)|\bexcept\b/.test(q);
  let skill: SkillId = "details", qtype: QType = "locate";
  if (has(/main idea|central (theme|idea|message|argument|thesis)|best (summari[sz]es|describes|captures|expresses)|primary (purpose|focus|message)|essay (primarily|mainly)|title/)) { skill = "main_idea"; qtype = "interpret"; }
  else if (has(/tone|attitude|author'?s (purpose|intent|view|stance)|intended to|purpose of the (author|essay|passage)|the author (would|most likely)/)) { skill = "purpose_tone"; qtype = "interpret"; }
  else if (has(/\binfer|\bimplies|\bimplied|\bsuggests?\b|can be concluded|may be concluded|logically|most likely/)) { skill = "inference"; qtype = "infer"; }
  else if (has(/assum(e|ption)/)) { skill = "assumptions"; qtype = "supported"; }
  else if (has(/weaken|strengthen|undermine|criticism|critic|flaw|counter-?argument|valid argument|supports? the (view|claim)/)) { skill = "arguments"; qtype = "supported"; }
  else if (has(/contradict|inconsistent|conflict with/)) { skill = "contradiction"; qtype = "supported"; }
  else if (has(/conclusion|concludes|best conclusion/)) { skill = "conclusion"; qtype = "conclude"; }
  else if (has(/\bfact\b.*\bopinion\b|opinion rather than|\bopinion\b|\bsubjective\b/)) { skill = "fact_opinion"; qtype = "interpret"; }
  else if (has(/meaning of|means\b|synonym|antonym|closest in meaning|as used in the (essay|passage)|the (word|phrase|term|expression)\b|\bidiom\b/)) { skill = "vocab_context"; qtype = "interpret"; }
  else if (has(/\bwhy\b|\bcause|\breason|because|\bleads? to|\bresult(s|ed)? in|\bconsequence|\bimpact\b|\beffect/)) { skill = "relationships"; qtype = "interpret"; }
  else if (has(/recommended|way forward|should be (done|adopted|prioriti)|best (approach|way|solution)|solution to|most effective (step|measure)/)) { skill = "conclusion"; qtype = "conclude"; }
  else if (has(/\baims? (to|at)|\bobjective|purpose of|designed to|primarily (intended|meant)|what is the (role|significance|importance)/)) { skill = "relationships"; qtype = "interpret"; }
  else if (has(/\d+\s?(%|percent|crore|lakh|trillion|billion)|how many|what percentage|what share/)) { skill = "data"; qtype = "locate"; }
  if (multi) qtype = "multi_evidence";
  if (negation && !multi) qtype = "negation";
  const difficulty: Difficulty = multi || skill === "inference" || skill === "arguments" || skill === "assumptions" ? 3 : 2;
  const longestOption = Math.max(...options.map((o) => o.length), 0);
  const expectedSecs = Math.max(35, Math.min(120, 30 + Math.round(question.length / 7) + Math.round(longestOption / 10) + (multi ? 20 : 0)));
  return { skill, qtype, difficulty, expectedSecs };
}
