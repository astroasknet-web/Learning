/**
 * Answer Hub lookup for the webhook bot — deterministic keyword search over a
 * bundled snapshot of the live SalesIQ articles (kb-snapshot.json, regenerate
 * with `npm run kb:export`).
 *
 * No LLM, by the standing v1 rule (docs/salesiq-bot/BOT_ARCHITECTURE.md §3:
 * "GPT may help us decide where to look, never what is true"). Scoring is
 * pure token overlap plus page-context boosts, so a given question always
 * produces the same answer and the 5-second webhook budget is never at risk.
 *
 * The KB is the source of truth for informational answers: every string
 * returned here was authored and verified against the website under the
 * Answer Hub content rules. This module never generates prose, it only picks
 * an article and trims it.
 */

import snapshot from "@/lib/bot/kb-snapshot.json";
import aliasMap from "@/lib/bot/kb-aliases.json";
import { toChatReply } from "@/lib/bot/reply-style";
import {
  normalizeQuery,
  normalizeDocument,
  singularize,
  splitHyphenated,
} from "@/lib/bot/normalize";

export interface KbArticle {
  id: string;
  title: string;
  category: string | null;
  text: string;
  wordCount: number;
}

const ARTICLES = snapshot.articles as KbArticle[];

/**
 * House style caps answers at 60 words (was 150).
 *
 * Replies must read like SalesIQ chat, not ChatGPT: short, scannable, with a
 * quick-reply chip doing the work an extra paragraph used to. A 150-word wall
 * of text in a chat bubble is the single loudest "this is an LLM" signal.
 *
 * This is a PRESENTATION limit only. It trims the text of an article that has
 * already been chosen; it does not participate in choosing one. scoreArticle()
 * and findAnswer()'s selection logic are untouched, and the golden suite
 * asserts article ids, not article text.
 */
const MAX_WORDS = 50;

/**
 * Dropped before scoring: these appear in nearly every question, so counting
 * them rewards long articles instead of relevant ones.
 */
// NOTE: "my" and "our" are deliberately NOT stopwords. They are the only
// signal separating the two Data Privacy articles ("How is my personal data
// protected?" vs "How is our organisation's data secured?") — dropping them
// made "is my data secure" answer with the enterprise article.
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "do", "does", "did",
  "i", "me", "we", "us", "you", "your", "it", "its", "this", "that", "these",
  "to", "of", "in", "on", "for", "with", "and", "or", "but", "if", "at", "by", "from",
  "can", "could", "will", "would", "should", "how", "what", "when", "where", "who", "why",
  "tell", "about", "know", "want", "need", "get", "got", "have", "has", "there", "any",
  "please", "hi", "hello", "hey", "thanks", "thank", "more", "much", "some", "so", "just",
  // Acknowledgements. These carry no topical signal, and treating them as
  // signal let "ok" on a solution page open a qualification form.
  "ok", "okay", "yes", "yeah", "yep", "no", "nope", "sure", "cool", "great",
  "nice", "hmm", "hm", "alright", "fine",
]);

/**
 * Shared tokenisation. `normalized` is already lowercased and contraction-
 * expanded by lib/bot/normalize.ts; this adds the morphological folding that
 * must be applied SYMMETRICALLY to queries and articles or the two stop
 * lining up: hyphen compounds emit their parts as well as the whole, and a
 * known plural folds to its singular.
 */
function tokenizeNormalized(normalized: string): string[] {
  const raw = normalized
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const out: string[] = [];
  for (const token of raw) {
    for (const part of splitHyphenated(token)) {
      const folded = singularize(part);
      if (folded.length > 1 && !STOPWORDS.has(folded)) out.push(folded);
    }
  }
  return out;
}

/** Article titles and bodies. Never applies query-only deixis resolution. */
function tokenize(text: string): string[] {
  return tokenizeNormalized(normalizeDocument(text));
}

/** The visitor's message: adds "you"/"this platform" → "growqr" bridging. */
function tokenizeQuery(text: string): string[] {
  return tokenizeNormalized(normalizeQuery(text));
}

/**
 * Page-context → the topic vocabulary that should win ties. Implements the
 * "prioritise by where the visitor is standing" requirement: on
 * /solutions/institutes a bare "tell me about growqr" should surface the
 * universities article, not the generic one.
 *
 * Keyed by the solution slug (lib/bot/clientContext.ts) with the CRM audience
 * value as a secondary key, since social channels send audience without a page.
 */
const CONTEXT_TERMS: Record<string, string[]> = {
  institutes: ["university", "universities", "institute", "institutes", "campus", "placement", "cohort", "student", "students", "curriculum"],
  recruiters: ["recruiter", "recruiters", "hiring", "hire", "candidate", "candidates", "screening", "shortlist", "talent"],
  enterprises: ["enterprise", "enterprises", "company", "companies", "hr", "team", "teams", "workforce", "employee", "employees"],
  startups: ["enterprise", "enterprises", "company", "companies", "hr", "team", "teams", "workforce", "employee", "employees"],
  professionals: ["career", "careers", "job", "jobs", "resume", "interview", "switch", "upskill", "professional"],
  students: ["student", "students", "campus", "internship", "graduate", "career", "job"],
  freelancers: ["freelance", "freelancer", "gig", "client", "portfolio", "career"],
  coaches: ["coach", "coaching", "client", "practice", "brand"],
  consultants: ["consultant", "consulting", "client", "practice", "brand"],
};

/** CRM audience value → the same vocabulary, for context without a page path. */
const AUDIENCE_TERMS: Record<string, string[]> = {
  Institute: CONTEXT_TERMS.institutes,
  Recruiter: CONTEXT_TERMS.recruiters,
  Enterprise: CONTEXT_TERMS.enterprises,
  Student: CONTEXT_TERMS.students,
  Professional: CONTEXT_TERMS.professionals,
};

/** Article category → the solution slugs it is the natural home for. */
const CATEGORY_SOLUTIONS: Record<string, string[]> = {
  Universities: ["institutes"],
  Recruiters: ["recruiters"],
  Enterprise: ["enterprises", "startups"],
};

export interface AnswerContext {
  solution?: string | null;
  audience?: string | null;
}

/**
 * Below this, we do not answer. Deliberately conservative: a wrong confident
 * answer is far worse than a handoff, and the fallback path already logs the
 * miss to bot_unanswered for KB backlog review.
 */
const MIN_SCORE = 1.4;

interface Scored {
  article: KbArticle;
  score: number;
}

/** "what is X" / "what are X" / "define X" — asking for a definition. */
const DEFINITION_QUERY = /^\s*(what|whats|what's)\s+(is|are|s)\b|^\s*define\b/i;
/** KB titles that ARE definitions. */
const DEFINITION_TITLE = /^what\s+(is|are)\b/i;

function scoreArticle(
  article: KbArticle,
  queryTokens: string[],
  contextTerms: Set<string>,
  solution: string | null,
  rawQuery: string,
): number {
  if (!queryTokens.length) return 0;

  const titleTokens = new Set(tokenize(article.title));
  const bodyTokens = new Set(tokenize(article.text));

  let titleHits = 0;
  let bodyHits = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) titleHits += 1;
    else if (bodyTokens.has(token)) bodyHits += 1;
  }

  // Hard gate: an article with ZERO textual overlap can never be the answer,
  // whatever the page context is. Without this, the context and category
  // boosts alone total 3.6 — well past MIN_SCORE — so on /solutions/institutes
  // literal gibberish returned the universities article. Context re-ranks
  // relevant articles; it must never manufacture relevance.
  if (titleHits === 0 && bodyHits === 0) return 0;

  // Title matches are the strongest signal — KB titles are written as the
  // question a visitor actually asks ("What is RQ (Readiness Quotient)?").
  let score = (titleHits / queryTokens.length) * 3 + (bodyHits / queryTokens.length) * 0.8;

  // How much of the TITLE the query accounted for. Without this, "what is
  // growqr" ties every article with "growqr" in the title and the winner is
  // arbitrary — it answered with "Can GrowQR help me get a job?" instead of
  // "What is GrowQR?". Rewarding tight titles breaks that tie correctly.
  if (titleTokens.size) score += (titleHits / titleTokens.size) * 1.5;

  // Whole-question containment, e.g. "what is growqr" → "What is GrowQR?".
  const normalizedTitle = article.title.toLowerCase();
  if (queryTokens.length >= 2 && queryTokens.every((t) => normalizedTitle.includes(t))) {
    score += 1.5;
  }

  // Definition intent: "what is X" should prefer the article that DEFINES X
  // over one that merely mentions it — "what is rq score" was answering with
  // "How do I improve my RQ Score?" instead of the RQ definition. Gated on an
  // existing title hit so it can never lift an unrelated article (otherwise
  // "what is the pricing" would drag in "What is the refund policy?").
  if (titleHits > 0 && DEFINITION_QUERY.test(rawQuery) && DEFINITION_TITLE.test(article.title)) {
    score += 3.5;
  }

  // Page context: boost articles that speak the visitor's vocabulary, and the
  // category that owns their solution outright. Only ever a tiebreak among
  // articles that already cleared the zero-overlap gate above.
  // Weighted to actually decide vague queries: "tell me about growqr" on
  // /solutions/institutes must return the universities article, not the
  // generic one. A weak boost (the first cut used 0.12/hit) lost every tie it
  // was supposed to win.
  if (contextTerms.size) {
    let contextHits = 0;
    for (const term of contextTerms) {
      if (titleTokens.has(term)) contextHits += 2;
      else if (bodyTokens.has(term)) contextHits += 1;
    }
    score += Math.min(contextHits, 8) * 0.3;
  }
  if (solution && article.category && CATEGORY_SOLUTIONS[article.category]?.includes(solution)) {
    score += 1.2;
  }

  return score;
}

/**
 * Trim to house style. Delegates to lib/bot/reply-style.ts so articles, FAQs
 * and AI answers are all held to the SAME limits from one definition.
 * Presentation only — never affects which article is selected.
 */
export function trimToWordLimit(text: string, maxWords = MAX_WORDS): string {
  return toChatReply(text, maxWords);
}

export interface KbAnswer {
  articleId: string;
  title: string;
  text: string;
  score: number;
}

// ── Alias layer ─────────────────────────────────────────────────────────────

const ARTICLES_BY_ID = new Map(ARTICLES.map((a) => [a.id, a]));

/** Confidence assigned to an alias hit. Well clear of any token-overlap score. */
const ALIAS_EXACT_SCORE = 10;
const ALIAS_CONTAINED_SCORE = 8;

/** id → aliases, with the `_readme` key and unknown ids dropped. */
export const ALIASES: ReadonlyArray<{ id: string; phrase: string }> = Object.entries(
  aliasMap as Record<string, string[]>,
)
  .filter(([id]) => !id.startsWith("_"))
  .flatMap(([id, phrases]) => phrases.map((phrase) => ({ id, phrase: phrase.toLowerCase() })));

/**
 * Longest phrase first, so "what is rq score" wins over the bare "rq" when
 * both are present. Without this the shortest alias would win by position and
 * a specific question would get a general answer.
 */
const SORTED_ALIASES = [...ALIASES].sort((a, b) => b.phrase.length - a.phrase.length);

/** Punctuation-insensitive comparison form. */
function aliasKey(text: string): string {
  return normalizeQuery(text)
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * An authored phrase for this question, or null.
 *
 * Two strengths. An exact whole-message match is unambiguous. A CONTAINED
 * match ("thanks, what is growqr") is nearly as good but is restricted to
 * multi-word aliases: allowing a single word to match anywhere would let the
 * alias "rq" hijack every sentence that happens to mention it.
 */
function matchAlias(question: string): KbAnswer | null {
  const key = aliasKey(question);
  if (!key) return null;

  // Padded so containment is WORD-boundary aware. Plain substring matching
  // made "who are your customers" match the alias "who are you" and answer a
  // customer-proof question with the product definition — caught by the golden
  // set the moment aliases were switched on.
  const padded = ` ${key} `;

  for (const { id, phrase } of SORTED_ALIASES) {
    const isExact = key === phrase;
    const isContained = phrase.includes(" ") && padded.includes(` ${phrase} `);
    if (!isExact && !isContained) continue;

    const article = ARTICLES_BY_ID.get(id);
    // A stale id (article deleted in SalesIQ, alias not yet pruned) must not
    // take the answer down with it — fall through to scoring instead.
    if (!article) continue;

    return {
      articleId: article.id,
      title: article.title,
      text: trimToWordLimit(article.text),
      score: isExact ? ALIAS_EXACT_SCORE : ALIAS_CONTAINED_SCORE,
    };
  }
  return null;
}

/**
 * Best Answer Hub match for a visitor question, or null when nothing clears
 * MIN_SCORE (caller must then fall back / hand off rather than invent).
 */
export function findAnswer(question: string, context?: AnswerContext): KbAnswer | null {
  // Aliases first, and they short-circuit: an authored phrase is a stronger
  // statement of intent than any amount of token overlap, and resolving it
  // here means the scorer is never asked to adjudicate something a human
  // already decided. This is what turns "what do you do" and "who are you"
  // into the same answer as "what is growqr" without a model.
  const alias = matchAlias(question);
  if (alias) return alias;

  const queryTokens = tokenizeQuery(question);
  if (!queryTokens.length) return null;

  const solution = context?.solution ?? null;
  const terms = [
    ...(solution ? (CONTEXT_TERMS[solution] ?? []) : []),
    ...(context?.audience ? (AUDIENCE_TERMS[context.audience] ?? []) : []),
  ];
  const contextTerms = new Set(terms);

  let best: Scored | null = null;
  for (const article of ARTICLES) {
    const score = scoreArticle(article, queryTokens, contextTerms, solution, question);
    if (!best || score > best.score) best = { article, score };
  }

  if (!best || best.score < MIN_SCORE) return null;
  return {
    articleId: best.article.id,
    title: best.article.title,
    text: trimToWordLimit(best.article.text),
    score: Number(best.score.toFixed(3)),
  };
}

/** Exposed for tests/diagnostics — the snapshot the bot is answering from. */
export function kbSize(): number {
  return ARTICLES.length;
}

/**
 * Does the message carry any topical signal at all, once greetings, filler and
 * pronouns are stripped? Used by the router to decide whether a message is
 * substantive enough to justify opening a qualification form off page context.
 * "hi" and "ok thanks" must never do that.
 */
export function hasSubstance(text: string): boolean {
  return tokenize(text).length > 0;
}
