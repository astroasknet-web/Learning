/**
 * Query and document normalisation for the Answer Hub matcher.
 *
 * Fixes a specific, measured failure: the KB speaks in proper nouns
 * ("GrowQR", "RQ-Vera") while visitors speak in pronouns and generics ("you",
 * "this", "the platform"). Of 15 natural phrasings of "What is GrowQR?", the
 * matcher answered 5 — and every failure was a phrasing that avoided the
 * literal word "GrowQR". Nothing bridged the two vocabularies.
 *
 * Everything here is a lookup table. No inference, no model, no scoring
 * change: this only decides which TOKENS the existing scorer sees.
 *
 * Two entry points, deliberately asymmetric:
 *   - normalizeDocument() runs on article titles and bodies.
 *   - normalizeQuery() runs on the visitor's message, and additionally does
 *     deixis resolution ("you" → "growqr"), which must NEVER run on articles:
 *     KB prose uses "you" to mean the READER, so rewriting it there would
 *     corrupt every article.
 */

/** "what's" → "what is". Applied before tokenisation, on raw text. */
const CONTRACTIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bwhat's\b/gi, "what is"],
  [/\bwho's\b/gi, "who is"],
  [/\bhow's\b/gi, "how is"],
  [/\bthat's\b/gi, "that is"],
  [/\bit's\b/gi, "it is"],
  [/\bthere's\b/gi, "there is"],
  [/\bdon't\b/gi, "do not"],
  [/\bdoesn't\b/gi, "does not"],
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bi'm\b/gi, "i am"],
  [/\byou're\b/gi, "you are"],
  [/\bwe're\b/gi, "we are"],
  [/\bi've\b/gi, "i have"],
];

export function expandContractions(text: string): string {
  return CONTRACTIONS.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

/**
 * Words that stand in for "GrowQR" when a visitor is asking about the product
 * itself. Applied ONLY to queries.
 *
 * Scoped tightly on purpose: "you" is rewritten, but "your" is not, because
 * "your organisation" and "your team" are the visitor's, not ours, and
 * rewriting those would send enterprise questions to the wrong article.
 */
const PRODUCT_DEIXIS: ReadonlyArray<[RegExp, string]> = [
  [/\bwhat do you do\b/gi, "what is growqr"],
  [/\bwhat do you guys do\b/gi, "what is growqr"],
  [/\bwho are you\b/gi, "what is growqr"],
  [/\bthis platform\b/gi, "growqr"],
  [/\bthe platform\b/gi, "growqr"],
  [/\bthis product\b/gi, "growqr"],
  [/\bthe product\b/gi, "growqr"],
  [/\bthis tool\b/gi, "growqr"],
  [/\bthe tool\b/gi, "growqr"],
  [/\bthis service\b/gi, "growqr"],
  [/\bthis website\b/gi, "growqr"],
  [/\bthe website\b/gi, "growqr"],
  [/\bthis app\b/gi, "growqr"],
  [/\bthis company\b/gi, "growqr"],
  [/\byour platform\b/gi, "growqr"],
  [/\byour product\b/gi, "growqr"],
  [/\byour company\b/gi, "growqr"],
  [/\bgrow qr\b/gi, "growqr"],
  [/\bgrowqr\.ai\b/gi, "growqr"],
];

/**
 * Irregular and high-value singularisations. A general "strip trailing s"
 * stemmer would collapse real distinctions in this vocabulary (a "plan" and
 * "plans" are the same thing, but so would "campus" become "campu"), so this
 * is an explicit list of the words that actually appear in the KB and in
 * questions about it.
 */
const SINGULAR: Record<string, string> = {
  universities: "university",
  colleges: "college",
  institutes: "institute",
  companies: "company",
  agencies: "agency",
  recruiters: "recruiter",
  candidates: "candidate",
  students: "student",
  employees: "employee",
  teams: "team",
  plans: "plan",
  prices: "price",
  costs: "cost",
  agents: "agent",
  features: "feature",
  skills: "skill",
  jobs: "job",
  careers: "career",
  interviews: "interview",
  resumes: "resume",
  placements: "placement",
  cohorts: "cohort",
  countries: "country",
  problems: "problem",
  questions: "question",
  answers: "answer",
  organisations: "organisation",
  organizations: "organization",
};

/**
 * "rq-vera" → ["rq-vera", "rq", "vera"].
 *
 * The tokeniser keeps hyphens, so the agent articles tokenised to `rq-vera`
 * and the bare token `vera` existed nowhere in the KB. All eight agent
 * articles were unreachable by the agent's own name. Emitting the parts
 * alongside the whole makes both spellings match without losing the compound.
 */
export function splitHyphenated(token: string): string[] {
  if (!token.includes("-")) return [token];
  const parts = token.split("-").filter((p) => p.length > 1);
  return parts.length > 1 ? [token, ...parts] : [token];
}

export function singularize(token: string): string {
  return SINGULAR[token] ?? token;
}

/** Shared text-level normalisation, safe for both queries and articles. */
export function normalizeDocument(text: string): string {
  return expandContractions(text).toLowerCase();
}

/** Query-only: everything above, plus product deixis resolution. */
export function normalizeQuery(text: string): string {
  const expanded = expandContractions(text);
  return PRODUCT_DEIXIS.reduce((acc, [re, to]) => acc.replace(re, to), expanded).toLowerCase();
}
