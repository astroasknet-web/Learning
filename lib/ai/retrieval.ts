/**
 * Grounding sources for the AI answer layer.
 *
 * Both corpora are RETRIEVED, top-k (revised 2026-08-02 — see
 * retrieveKbArticles()'s own doc comment for why the KB moved off
 * whole-corpus embedding):
 *
 *   1. ANSWER HUB (lib/bot/kb-snapshot.json) — 30 articles, ~4k tokens total.
 *      retrieveKbArticles() returns the top 3-5 by relevance instead.
 *   2. ZOHO DOCS (lib/ai/zoho-docs-snapshot.json) — ~4.7k tokens today and
 *      growing with each page added. Always was top-k, excerpted.
 *
 * IMPORTANT: this module reads lib/bot/kb-snapshot.json but imports NOTHING
 * from lib/bot. The scorer below is a small independent implementation, not a
 * reuse or a modification of lib/bot/answers.ts's scoreArticle(). That file is
 * frozen and its golden suite must keep passing untouched — a change tuned
 * for THIS retriever must never silently re-rank the deterministic matcher,
 * and vice versa.
 */
import kbSnapshot from "@/lib/bot/kb-snapshot.json";
import zohoSnapshot from "@/lib/ai/zoho-docs-snapshot.json";

export interface KbArticle {
  id: string;
  title: string;
  category: string | null;
  text: string;
  wordCount: number;
}

export interface ZohoDoc {
  id: string;
  url: string;
  title: string;
  text: string;
  wordCount: number;
}

const KB_ARTICLES = kbSnapshot.articles as KbArticle[];
const ZOHO_DOCS = (zohoSnapshot.docs ?? []) as ZohoDoc[];

/** Whole Answer Hub corpus. Only used by scripts/tests that need the full set. */
export function allKbArticles(): KbArticle[] {
  return KB_ARTICLES;
}

export function kbCount(): number {
  return KB_ARTICLES.length;
}

/** Solution slug → the category that speaks to it, for the light retrieval boost below. */
const CATEGORY_SOLUTIONS: Record<string, string[]> = {
  institutes: ["Universities"],
  recruiters: ["Recruiters"],
  enterprises: ["Enterprise"],
  startups: ["Enterprise"],
};

export function zohoDocCount(): number {
  return ZOHO_DOCS.length;
}

/**
 * Minimal stopword set. Intentionally NOT imported from lib/bot/answers.ts —
 * that list is tuned for a 30-article product KB (it keeps "my"/"our" as
 * disambiguators), and coupling the two would mean a change tuned for one
 * corpus silently re-ranking the other.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "do", "does", "did",
  "i", "me", "we", "us", "you", "your", "it", "its", "this", "that", "these", "those",
  "to", "of", "in", "on", "for", "with", "and", "or", "but", "if", "at", "by", "from",
  "can", "could", "will", "would", "should", "how", "what", "when", "where", "who", "why",
  "tell", "about", "know", "want", "need", "get", "have", "has", "there", "any", "please",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export interface KbMatch {
  id: string;
  title: string;
  text: string;
  score: number;
}

/**
 * Top 3-5 Answer Hub articles for a query (revised 2026-08-02, replacing
 * whole-corpus embedding). The KB used to be passed WHOLE on the reasoning
 * that a keyword re-retrieval would just reproduce the deterministic
 * scorer's own miss — true, but it also meant every fallback call sent
 * ~4-5k tokens regardless of relevance, and latency was the recurring
 * production problem this session (multiple real timeouts). This retriever
 * is deliberately looser than that scorer: no minimum-score gate, always
 * returns k articles when the corpus has any topical signal at all, because
 * the model's own answered=false instruction is the real correctness gate —
 * this only decides what it gets to LOOK at, not what it's allowed to claim.
 *
 * Solution/audience context gets a flat boost toward the category that owns
 * it, mirroring (not reusing) lib/bot/answers.ts's CONTEXT_TERMS idea at
 * much lower resolution — good enough to break a tie toward the visitor's
 * page, not a replacement for that file's tuned scoring.
 */
export function retrieveKbArticles(
  query: string,
  context: { solution?: string | null; audience?: string | null } = {},
  k = 5,
): KbMatch[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const unique = new Set(tokens);
  const wantedCategories = context.solution ? CATEGORY_SOLUTIONS[context.solution] : undefined;

  const scored = KB_ARTICLES.map((article) => {
    const titleTokens = new Set(tokenize(article.title));
    const body = article.text.toLowerCase();

    let score = 0;
    for (const token of unique) {
      if (titleTokens.has(token)) score += 2.5;
      else if (body.includes(token)) score += 0.5;
    }
    score = score / Math.sqrt(unique.size);

    if (wantedCategories && article.category && wantedCategories.includes(article.category)) {
      score += 0.5;
    }

    return { id: article.id, title: article.title, text: article.text, score: Number(score.toFixed(3)) };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

export interface ZohoDocMatch {
  id: string;
  url: string;
  title: string;
  /** The most relevant window of the page, not the whole thing. */
  excerpt: string;
  score: number;
}

/** Characters of context returned per matched page. */
const EXCERPT_CHARS = 900;

/**
 * The densest EXCERPT_CHARS-wide window of `text` for these query tokens.
 * A whole help page is mostly boilerplate; passing the whole thing wastes the
 * budget and dilutes the signal the model has to work with.
 */
function bestExcerpt(text: string, queryTokens: Set<string>): string {
  if (text.length <= EXCERPT_CHARS) return text;

  const stride = Math.floor(EXCERPT_CHARS / 3);
  let bestStart = 0;
  let bestHits = -1;

  for (let start = 0; start < text.length; start += stride) {
    const window = text.slice(start, start + EXCERPT_CHARS).toLowerCase();
    let hits = 0;
    for (const token of queryTokens) {
      if (window.includes(token)) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestStart = start;
    }
  }

  const slice = text.slice(bestStart, bestStart + EXCERPT_CHARS);
  return (bestStart > 0 ? "… " : "") + slice.trim() + (bestStart + EXCERPT_CHARS < text.length ? " …" : "");
}

/**
 * Minimum score for a Zoho page to be offered as grounding at all.
 *
 * Set high on purpose. This corpus documents ZOHO SALESIQ, not GrowQR, so for
 * the overwhelming majority of visitor questions the correct result is NO
 * MATCH. Offering a weakly-related page would invite the model to answer a
 * GrowQR question out of Zoho's docs — the specific failure this threshold
 * exists to prevent.
 */
const ZOHO_MIN_SCORE = 2.0;

/**
 * Top-k Zoho documentation pages for a query, or [] when nothing is relevant —
 * which is the expected outcome for ordinary visitor questions.
 */
export function retrieveZohoDocs(query: string, k = 2): ZohoDocMatch[] {
  const tokens = tokenize(query);
  if (!tokens.length || !ZOHO_DOCS.length) return [];

  const unique = new Set(tokens);
  const scored: ZohoDocMatch[] = [];

  for (const doc of ZOHO_DOCS) {
    const titleTokens = new Set(tokenize(doc.title));
    const body = doc.text.toLowerCase();

    let score = 0;
    for (const token of unique) {
      // Title hits dominate: these pages are narrowly titled ("Message
      // Handler", "Webhook Authentication"), so a title match is a strong
      // statement that the page is on-topic.
      if (titleTokens.has(token)) score += 2.5;
      else if (body.includes(token)) score += 0.5;
    }

    // Normalise by query length so a long question cannot out-score a short
    // one purely by having more tokens to match.
    score = score / Math.sqrt(unique.size);

    if (score >= ZOHO_MIN_SCORE) {
      scored.push({
        id: doc.id,
        url: doc.url,
        title: doc.title,
        excerpt: bestExcerpt(doc.text, unique),
        score: Number(score.toFixed(3)),
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}
