/**
 * FAQ lookup — the tier between the Answer Hub and the AI fallback.
 *
 *   acts → intents → aliases → answer hub → FAQs → AI → human
 *
 * These are the 11 published SalesIQ FAQs (lib/bot/faq-snapshot.json,
 * regenerate with `npm run faq:export`). They were invisible to the bot until
 * now because export-kb-snapshot.ts only ever tried API v2; the FAQs live on
 * v3. One of them, "Is GrowQR available in my country?", is the correct answer
 * to a question the matcher was answering wrongly with "What is GrowQR?".
 *
 * SEPARATE FILE, SEPARATE SCORER, ON PURPOSE. This does not import from, reuse,
 * or modify lib/bot/answers.ts. That module and its scoreArticle() are frozen
 * and pinned by the 189-case golden suite. FAQs are also a different shape from
 * articles: each is a single question with alternate phrasings, so matching is
 * question-to-question rather than query-to-document, and a title-overlap
 * scorer tuned for articles is the wrong tool.
 */
import snapshot from "@/lib/bot/faq-snapshot.json";
import { normalizeQuery } from "@/lib/bot/normalize";
import { toChatReply } from "@/lib/bot/reply-style";

export interface KbFaq {
  id: string;
  question: string;
  variants: string[];
  answer: string;
  wordCount: number;
}

const FAQS = (snapshot.faqs ?? []) as KbFaq[];

export interface FaqAnswer {
  id: string;
  question: string;
  text: string;
  score: number;
}

/**
 * Words that appear in nearly every question and carry no topical signal.
 * Kept deliberately small: FAQ questions are short, so over-stripping leaves
 * nothing to match on.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "do", "does", "did",
  "i", "me", "my", "we", "us", "you", "your", "it", "its", "this", "that",
  "to", "of", "in", "on", "for", "with", "and", "or", "at", "by", "from",
  "can", "could", "will", "would", "should", "how", "what", "when", "where",
  "who", "why", "tell", "about", "know", "want", "need", "get", "have", "has",
  "there", "any", "please", "does", "do",
]);

function tokens(text: string): Set<string> {
  return new Set(
    normalizeQuery(text)
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Punctuation-insensitive comparison form, for the exact-match shortcut. */
function key(text: string): string {
  return normalizeQuery(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Minimum overlap to answer from an FAQ.
 *
 * Scored as the share of the VISITOR'S words found in the FAQ question, so a
 * short question must match nearly all of it. Set at 0.6 because these answers
 * are served verbatim to a visitor: a near-miss here is a confidently wrong
 * answer, which is the exact defect this tier exists to reduce.
 */
const MIN_SCORE = 0.6;

/** An exact question match needs no scoring and outranks everything. */
const EXACT_SCORE = 1;

/**
 * Best FAQ for a visitor question, or null. Callers must treat null as
 * "carry on to the next tier", never as an answer.
 */
export function findFaq(question: string): FaqAnswer | null {
  const queryKey = key(question);
  if (!queryKey) return null;

  const queryTokens = tokens(question);
  if (!queryTokens.size) return null;

  let best: FaqAnswer | null = null;

  for (const faq of FAQS) {
    const phrasings = [faq.question, ...faq.variants];

    // Exact match on any phrasing: unambiguous, stop here.
    if (phrasings.some((p) => key(p) === queryKey)) {
      return { id: faq.id, question: faq.question, text: toChatReply(faq.answer), score: EXACT_SCORE };
    }

    let bestForFaq = 0;
    for (const phrasing of phrasings) {
      const faqTokens = tokens(phrasing);
      if (!faqTokens.size) continue;

      let hits = 0;
      for (const token of queryTokens) {
        if (faqTokens.has(token)) hits += 1;
      }
      if (!hits) continue;

      // Share of the visitor's words that the FAQ accounts for, lightly
      // penalised when the FAQ is much broader than the question asked.
      const coverage = hits / queryTokens.size;
      const precision = hits / faqTokens.size;
      bestForFaq = Math.max(bestForFaq, coverage * 0.75 + precision * 0.25);
    }

    if (bestForFaq >= MIN_SCORE && (!best || bestForFaq > best.score)) {
      best = {
        id: faq.id,
        question: faq.question,
        text: toChatReply(faq.answer),
        score: Number(bestForFaq.toFixed(3)),
      };
    }
  }

  return best;
}

/** Exposed for tests/diagnostics. */
export function faqCount(): number {
  return FAQS.length;
}
