/**
 * Conversational acts: the social half of a conversation, which the KB has no
 * article for and never should.
 *
 * Runs BEFORE intent detection and before the page-context tiebreak, because
 * two live defects came from letting these fall through:
 *
 *  1. "bye" is not a stopword, so it counted as substance; with B2B page
 *     context that was enough to open a five-question qualification form.
 *     Saying goodbye started a sales interrogation.
 *  2. "thanks", "ok" and "cool" reached the fallback and answered "I'm not
 *     sure I have a good answer for that" — and each wrote a bot_unanswered
 *     row, so the KB backlog filled with acknowledgements instead of real
 *     gaps.
 *
 * Every pattern is WHOLE-MESSAGE anchored. "thanks, what is growqr" carries a
 * real question and must route to the KB, so a trailing question can never be
 * swallowed by an act. That is the single most important property here.
 */

export type ConversationalAct =
  | "greeting"
  | "thanks"
  | "acknowledge"
  | "farewell"
  | "decline";

/**
 * Trailing punctuation and emoji are stripped before matching, so "thanks!!",
 * "ok 👍" and "bye." all reach the same branch as their bare forms.
 *
 * \p{Extended_Pictographic} covers emoji without enumerating them; the `u`
 * flag is required for it to mean anything.
 */
const TRIM = /[\s!.,?~]+|\p{Extended_Pictographic}|️|‍/gu;

function normalize(text: string): string {
  return text.toLowerCase().replace(TRIM, " ").replace(/\s+/g, " ").trim();
}

/** True when the message is emoji and punctuation with no words at all. */
function isEmojiOnly(text: string): boolean {
  return text.trim().length > 0 && normalize(text).length === 0;
}

/**
 * Ordered: the first match wins. `farewell` is checked before `thanks`
 * because "thanks, bye" is a closing, not a thank-you — answering it with
 * "anything else?" after someone has said goodbye is exactly the robotic beat
 * we are removing.
 */
const PATTERNS: ReadonlyArray<{ act: ConversationalAct; re: RegExp }> = [
  {
    act: "farewell",
    re: /^((ok|okay|alright|cool|thanks|thank you|thanks a lot|great) )?(bye+( bye+)*|goodbye|good bye|see you( later)?|see ya|catch you later|talk (to you )?later|ttyl|gtg|got to go|i'm done|im done|that's all|thats all|nothing else|no more questions)$/,
  },
  {
    act: "greeting",
    re: /^(hi+|hey+|hell?o+|hola|namaste|yo|greetings|howdy|good (morning|afternoon|evening|day))( there| growqr)?$|^how('s| is| are)? (it going|things|you( doing)?)$|^what'?s up$|^all good$/,
  },
  {
    act: "thanks",
    re: /^((ok|okay|alright|great|cool|perfect|awesome|nice) )?(thanks|thank you|thankyou|thanx|thx|ty|much appreciated|appreciate it|thanks a lot|thanks so much|thank you so much|many thanks)( (a lot|so much|mate|buddy|team))?$/,
  },
  {
    act: "acknowledge",
    re: /^(ok|okay|k|kk|cool|nice|great|awesome|perfect|got it|understood|i see|makes sense|sure|alright|right|fine|good|yes|yeah|yep|yup|sounds good|fair enough|noted|hmm+|ah|oh|wow)$/,
  },
  {
    act: "decline",
    // "all good" moved to greeting (2026-08-02): with no prior offer to
    // decline, "all good?" tests as a check-in equivalent to "how are you"
    // ("hi" -> greeting reply -> "all good?" -> decline reply was a live,
    // confusing sequence). "i'm good"/"im good" stay here — self-referential
    // reassurance reads as a decline far more reliably than "all good" does.
    re: /^(no|nope|nah|not really|not now|no thanks|no thank you|nothing|nothing for now|i'm good|im good)$/,
  },
];

/**
 * The conversational act this whole message performs, or null when it carries
 * real content. Null is the common case and means "carry on routing".
 */
export function detectAct(text: string): ConversationalAct | null {
  if (isEmojiOnly(text)) return "acknowledge";

  const normalized = normalize(text);
  if (!normalized) return null;
  // Guard against a long message that merely opens with an act word. Every
  // pattern is anchored, but this keeps the regex engine off large inputs and
  // makes the intent explicit.
  if (normalized.split(" ").length > 6) return null;

  for (const { act, re } of PATTERNS) {
    if (re.test(normalized)) return act;
  }
  return null;
}

/**
 * Replies, varied so a visitor who says "ok" twice does not get the same
 * sentence twice. Selection is deterministic (see pickReply) rather than
 * random: the same conversation and the same turn always produce the same
 * answer, which keeps the golden set and every other test stable.
 */
/**
 * Greetings are MINIMAL and PAGE-AGNOSTIC. A greeting is not an opportunity to
 * pitch: the old version read the visitor's solution page and answered "hi"
 * with a sentence listing pricing, plans, demos and RQ Score, which was both
 * verbose and wrong on B2C pages.
 *
 * Hard rules, enforced by lib/bot/smalltalk.test.ts:
 *   - max 12 words
 *   - never mentions pricing, plans, demos, RQ Score or platform features
 *   - identical on every page; page context must not reach this
 */
const GREETINGS: readonly string[] = ["Hi! How can I help you today?"];

const REPLIES: Record<Exclude<ConversationalAct, "greeting">, readonly string[]> = {
  thanks: [
    "Happy to help. Anything else you'd like to know?",
    "You're welcome. Is there anything else I can help with?",
    "Glad that helped. Anything else on your mind?",
  ],
  acknowledge: [
    "Anything else you'd like to know?",
    "Sure. What else can I help with?",
    "Got it. Anything else I can answer?",
  ],
  farewell: [
    "Thanks for stopping by. Open this chat any time if something else comes up.",
    "Take care. I'm here whenever you need anything else.",
    "Good talking to you. Just reopen this chat if anything else comes up.",
  ],
  decline: [
    "No problem. I'm here if anything else comes up.",
    "Sure thing. Just ask if something else comes to mind.",
    "All good. I'll be here if you need anything.",
  ],
};

/**
 * Deterministic rotation: a cheap hash of the conversation id plus the message
 * picks the line. Varies within and across conversations without a random
 * source, so tests never flake and a replayed payload always produces the same
 * reply.
 */
export function actReply(act: ConversationalAct, seed: string): string {
  const options: readonly string[] =
    act === "greeting" ? GREETINGS : REPLIES[act as Exclude<ConversationalAct, "greeting">];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return options[hash % options.length];
}

/** Exposed so the style rules above can be asserted in tests. */
export const GREETING_REPLIES = GREETINGS;

/**
 * Acts NEVER carry chips.
 *
 * A chip is only shown when it is highly relevant to both the page and the
 * message. "hi", "thanks" and "ok" carry no topic, so nothing can be relevant
 * to them — and pushing pricing/demo chips at someone who just said hello is
 * what made the bot read as an answer engine instead of a chat widget.
 * When in doubt, no chips.
 */
export function actKeepsChips(_act: ConversationalAct): boolean {
  return false;
}
