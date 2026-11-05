/**
 * Post-generation validators for the AI answer layer.
 *
 * Pure functions, no I/O, no model. Every one of these can reject an answer,
 * and a rejection always means "discard and hand off" — there is no path that
 * repairs a bad answer and serves it anyway.
 *
 * See AI_FALLBACK_DESIGN.md §4.3. The design's own honest caveat still stands:
 * these catch INVENTION (a price, a URL, a capability that is not in the
 * sources). They cannot catch MISATTRIBUTION — a fluent paraphrase of a real
 * source that subtly overstates it. Only sampling catches that (§8.3).
 *
 * TWO MODES (restored 2026-08-02 — the classify-then-route split this briefly
 * replaced added a second sequential AI call, real latency-budget risk, and
 * more rigidity than value; one call that has the KB in front of it and
 * decides for itself is simpler and answers more naturally):
 *
 *   "grounded"       — the reply states a GrowQR fact. Must cite >=1 source
 *                       id, and every number/claim in it must trace back to
 *                       that source text.
 *   "conversational" — the reply is purely social/procedural (acknowledging
 *                       the visitor, offering to pass them to the team,
 *                       asking a clarifying question) and states ZERO facts
 *                       about GrowQR. No citation is possible because there
 *                       is nothing to cite, so this mode instead refuses
 *                       outright anything that WOULD need grounding: any
 *                       number, any risky-claim keyword, any citation at
 *                       all. That asymmetry — grounded checks "is this
 *                       traceable", conversational checks "is this even
 *                       claiming anything" — is what lets a friendly reply
 *                       through without opening a hallucination path.
 */

export interface AiCandidate {
  answered: boolean;
  mode: "grounded" | "conversational";
  confidence: "high" | "medium" | "low";
  answer: string;
  sourceIds: string[];
}

export interface GuardContext {
  /** Concatenated text of every source the model was shown. */
  sourceText: string;
  /** Valid source ids — anything cited outside this set is a fabrication. */
  validIds: Set<string>;
  /** The visitor's message, for the echo guard. */
  question: string;
}

export type GuardVerdict = { ok: true } | { ok: false; reason: string };

/** House limit for a chat reply. §4.3. */
const MAX_WORDS = 50;

/**
 * Claims the bot must never make unless the wording is already in a source.
 * "integrat" covers integrate/integration/integrations — the exact category
 * that produced a live wrong answer ("does it work with greenhouse ats" was
 * answered from an unrelated article).
 */
const RISKY_CLAIMS = [
  "guarantee", "guaranteed", "we will", "we'll ensure", "unlimited",
  "integrat", "partner", "certified", "compliant", "roadmap", "coming soon",
  "free trial", "money back", "refund",
];

/** Only these hosts may appear in a generated answer. */
const ALLOWED_HOSTS = ["growqr.ai", "www.growqr.ai"];

/** Anything price-shaped: currency symbols, or a number next to a money word. */
const PRICING_SHAPE =
  /[₹$€£]\s?\d|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:rupees?|inr|usd|dollars?|eur|per\s+(?:month|year|seat|user))\b|\bprice|pricing|cost|charge|fee\b/i;

/** Numbers, percentages and currency amounts that must be traceable to a source. */
const NUMERIC_TOKEN = /[₹$€£]\s?[\d,]+(?:\.\d+)?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*%?/g;

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Runs every guard, returning the FIRST failure. Order is cheapest-first, and
 * also most-decisive-first, so the logged rejection reason is the most
 * informative one rather than an incidental downstream symptom.
 */
export function checkAnswer(candidate: AiCandidate, ctx: GuardContext): GuardVerdict {
  // ── Declined by the model itself ────────────────────────────────────────
  if (!candidate.answered) return { ok: false, reason: "model_declined" };

  // Only HIGH is served. medium/low are generated and logged so the threshold
  // can be loosened on evidence later, but never shown to a visitor today. §5.
  if (candidate.confidence !== "high") {
    return { ok: false, reason: `confidence_${candidate.confidence}` };
  }

  const answer = candidate.answer?.trim() ?? "";
  if (!answer) return { ok: false, reason: "empty_answer" };

  const grounded = candidate.mode !== "conversational";

  // ── Citation ────────────────────────────────────────────────────────────
  if (grounded) {
    if (!candidate.sourceIds?.length) return { ok: false, reason: "no_citation" };
    for (const id of candidate.sourceIds) {
      if (!ctx.validIds.has(id)) return { ok: false, reason: `unknown_source:${id}` };
    }
  } else if (candidate.sourceIds?.length) {
    // A conversational reply states no fact, so it has nothing to cite — a
    // citation here means the model conflated the two modes, which is reason
    // enough to distrust the whole answer rather than just drop the id.
    return { ok: false, reason: "conversational_with_citation" };
  }

  // ── Length ──────────────────────────────────────────────────────────────
  if (words(answer) > MAX_WORDS) return { ok: false, reason: "too_long" };

  // ── Pricing: never AI-owned, in either mode ─────────────────────────────
  // The deterministic pricing branch already handles live vs non-live markets
  // correctly, including the "no numeric price for a non-INR visitor" rule.
  // Duplicating that logic in a prompt is how a visitor gets quoted the wrong
  // currency, so anything price-shaped is refused outright.
  if (PRICING_SHAPE.test(answer)) return { ok: false, reason: "pricing_claim" };

  // ── Numeric grounding ───────────────────────────────────────────────────
  if (grounded) {
    // Every number in a grounded answer must appear in the source text.
    // Catches invented counts, timelines and percentages.
    const sourceHaystack = ctx.sourceText.replace(/[,\s]/g, "");
    for (const match of answer.match(NUMERIC_TOKEN) ?? []) {
      const bare = match.replace(/[₹$€£,\s%]/g, "");
      if (!bare || bare.length < 1) continue;
      if (!sourceHaystack.includes(bare)) {
        return { ok: false, reason: `ungrounded_number:${match.trim()}` };
      }
    }
  } else {
    // Conversational mode has no source text to check a number against, so
    // any number at all is refused outright rather than trusted to "common
    // reasoning" — a conversational reply should never need one anyway.
    const [firstNumber] = answer.match(NUMERIC_TOKEN) ?? [];
    if (firstNumber) return { ok: false, reason: `conversational_number:${firstNumber.trim()}` };
  }

  // ── URLs ────────────────────────────────────────────────────────────────
  for (const url of answer.match(/https?:\/\/[^\s)]+|\b[\w.-]+\.(?:com|ai|io|org|net)\b/gi) ?? []) {
    const host = url.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
    if (!ALLOWED_HOSTS.includes(host)) return { ok: false, reason: `disallowed_url:${host}` };
  }

  // ── Risky claims ────────────────────────────────────────────────────────
  const lowerAnswer = answer.toLowerCase();
  if (grounded) {
    const lowerSource = ctx.sourceText.toLowerCase();
    for (const claim of RISKY_CLAIMS) {
      if (lowerAnswer.includes(claim) && !lowerSource.includes(claim)) {
        return { ok: false, reason: `ungrounded_claim:${claim}` };
      }
    }
  } else {
    // No source to check against in conversational mode, so any risky-claim
    // keyword at all is refused — these words describe exactly the kind of
    // specific product claim conversational mode must never make.
    for (const claim of RISKY_CLAIMS) {
      if (lowerAnswer.includes(claim)) return { ok: false, reason: `ungrounded_claim:${claim}` };
    }
  }

  // ── Echo / injection reflection ─────────────────────────────────────────
  // Blocks "repeat after me" and similar reflection attacks.
  const q = normalize(ctx.question);
  if (q.length > 20 && normalize(answer).includes(q)) {
    return { ok: false, reason: "echoes_question" };
  }

  // ── Prompt leakage ──────────────────────────────────────────────────────
  if (/system prompt|instructions above|KNOWLEDGE BASE:|ZOHO DOCS:/i.test(answer)) {
    return { ok: false, reason: "prompt_leak" };
  }

  // ── House style ─────────────────────────────────────────────────────────
  // No em dashes in visitor-facing copy (standing rule); no markup.
  if (answer.includes("—")) return { ok: false, reason: "em_dash" };
  if (/<[^>]+>|\*\*|\[.+\]\(.+\)/.test(answer)) return { ok: false, reason: "markup" };

  return { ok: true };
}
