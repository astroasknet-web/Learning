/**
 * House style for every visitor-facing reply.
 *
 * The bot must read like a live support chat, not like a documentation engine.
 * Two hard limits, applied to the SERVED TEXT only:
 *
 *   - at most 2 sentences
 *   - at most 50 words
 *
 * This is presentation, not retrieval. It trims text that has already been
 * chosen; it never influences WHICH article or FAQ is chosen. lib/bot/answers.ts's
 * scoreArticle() and findAnswer() selection logic are untouched, and the golden
 * suite asserts article ids rather than article text.
 */

export const MAX_REPLY_WORDS = 50;
export const MAX_REPLY_SENTENCES = 2;

/** Split on sentence enders, keeping the punctuation attached. */
function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Trim to the house limits.
 *
 * Sentences first, then words. Cutting by sentence keeps the reply readable —
 * a hard word cut mid-clause is exactly the truncated-KB-paste feel we are
 * removing. The word cap is the backstop for a single very long sentence, and
 * only then do we fall back to an ellipsis.
 *
 * Bullet lines ("• ") are flattened: a bulleted list in a chat bubble is the
 * documentation-engine tell, and the KB is heavily bulleted.
 */
export function toChatReply(
  text: string,
  maxWords = MAX_REPLY_WORDS,
  maxSentences = MAX_REPLY_SENTENCES,
): string {
  const flat = text
    .replace(/\n?•\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return flat;

  let out = sentences(flat).slice(0, maxSentences).join(" ");

  if (wordCount(out) > maxWords) {
    const words = out.split(/\s+/).slice(0, maxWords);
    const truncated = words.join(" ");
    // Prefer the last sentence boundary so the reply never ends mid-thought.
    const lastStop = Math.max(
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("!"),
      truncated.lastIndexOf("?"),
    );
    out =
      lastStop > truncated.length * 0.5
        ? truncated.slice(0, lastStop + 1)
        : `${truncated.replace(/[,;:]$/, "")}…`;
  }

  return out;
}
