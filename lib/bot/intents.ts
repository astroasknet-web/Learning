/**
 * Deterministic intent routing for the SalesIQ webhook bot.
 *
 * REVISED (2026-08-03): deterministic keyword matching is now scoped to the
 * handful of intents that must always behave the same way regardless of
 * phrasing — change_email, human_request (escalation), demo_request, and
 * pricing. No LLM, no fuzzy matching for these — keyword rules only, so
 * behaviour is fully predictable and the 5-second webhook budget is never at
 * risk from this step.
 *
 * recruiter_inquiry/university_inquiry/enterprise_inquiry are NOT
 * keyword-detected here anymore (see routeMessage in router.ts) — audience
 * classification for an arbitrary sentence is exactly the kind of language
 * understanding that grows into an unbounded alias list one live defect at a
 * time. Real content questions now go to the AI-first layer, which has the
 * whole Answer Hub as grounding; the KB/FAQ scorer is the deterministic
 * safety net under it. These three intent values still exist in BotIntent —
 * they're produced explicitly by the audience self-identify dropdown
 * (router.ts) and consumed by the B2B qualification-form machinery, just
 * never inferred from free text anymore.
 */

export type BotIntent =
  | "pricing"
  | "human_request"
  | "change_email"
  | "demo_request"
  | "recruiter_inquiry"
  | "university_inquiry"
  | "enterprise_inquiry"
  // Label only — NEVER returned by detectIntent() below, never added to
  // B2B_INTENTS. Used exclusively by captureB2cLead() in router.ts to record
  // an organic B2C chat (one with no qualification form) as a bot_leads row.
  // Kept in this union rather than a separate type so it can travel through
  // the same QualifiedLead.intent field the B2B path already uses.
  | "general_inquiry"
  | "fallback";

/** B2B intents produce a CRM lead; pricing does not. */
export const B2B_INTENTS: readonly BotIntent[] = [
  "demo_request",
  "recruiter_inquiry",
  "university_inquiry",
  "enterprise_inquiry",
];

export function isB2bIntent(intent: BotIntent): boolean {
  return (B2B_INTENTS as readonly string[]).includes(intent);
}

/**
 * Human-readable label per intent — the ONE place this mapping lives.
 * Previously duplicated by hand in three places (notify.ts, payload.ts,
 * crm.ts's Task subject), which is exactly the kind of drift risk that turns
 * a terminology change into an easy-to-miss find-and-replace. Internal
 * intent VALUES (demo_request etc.) deliberately keep their existing names —
 * they're a closed-set DB CHECK constraint, a TypeScript union, and the
 * SalesIQ context_id prefix, all with zero external visibility. Only what a
 * human sees (chat copy, CRM Task/email labels) needed to change for the
 * "Book a Call" reposition (2026-08-03): a demo_request is now labeled and
 * talked about as a callback/enquiry-call request, not a demo.
 */
export const BOT_INTENT_LABELS: Record<BotIntent, string> = {
  demo_request: "Enquiry Request",
  recruiter_inquiry: "Recruiter Inquiry",
  university_inquiry: "University Inquiry",
  enterprise_inquiry: "Enterprise Inquiry",
  general_inquiry: "General Inquiry",
  pricing: "Pricing",
  human_request: "Human Request",
  change_email: "Change Email",
  fallback: "Fallback",
};

// An explicit, unambiguous ask for a person — safe to forward immediately,
// no confirmation needed, because there is no other plausible reading.
const STRONG_HUMAN_REQUEST = [
  "talk to a human",
  "talk to human",
  "speak to a human",
  "talk to someone",
  "speak to someone",
  "talk to our team",
  "talk to your team",
  "connect me with support",
  "connect me to support",
  "connect me with someone",
  "customer support",
  "customer service",
  "real person",
  "live agent",
  "human agent",
  "support agent",
  "talk to an agent",
  "speak to an agent",
  "chat with an agent",
  "connect me with an agent",
  "connect me to an agent",
  "representative",
  // The chip the bot itself offers — clicking it sends this text back, so it
  // must route to a person or the offer is a dead end.
  "connect with human",
  "connect with a human",
];

// Ambiguous signals: dissatisfaction or a bare "I need help"/"support"/"human"
// often accompany an actual topic ("need help about the pricing") rather than
// a genuine ask for a person. Real defect (2026-08-02): "need help about the
// pricing" auto-forwarded to a human instead of answering pricing, with no
// chip and no chance to decline. These still classify as human_request (nothing
// else claims them), but the router must offer the handoff rather than force
// it — see the weak-signal branch in routeMessage.
const WEAK_HUMAN_REQUEST = [
  "not helpful",
  "didn't help",
  "didnt help",
  "did not help",
  // Bare "wrong" is safe here only because change_email is checked FIRST and
  // owns "wrong email"; without that ordering this would hijack it.
  "wrong",
  "confused",
  "i need help",
  "need help",
  "support",
  "human",
];

/** True only for an explicit, unambiguous ask for a person — safe to auto-forward. */
export function isStrongHumanRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return STRONG_HUMAN_REQUEST.some((kw) => lower.includes(kw));
}

/**
 * Only the intents deterministic matching still owns. recruiter_inquiry,
 * university_inquiry, enterprise_inquiry, general_inquiry and fallback are
 * excluded — the first three are never inferred from free text (see the
 * module doc above), and the last two are never matched by a keyword.
 */
type DeterministicIntent = "change_email" | "human_request" | "demo_request" | "pricing";

const KEYWORDS: Record<DeterministicIntent, readonly string[]> = {
  // Checked before anything else. The qualification form now SKIPS the email
  // question when SalesIQ already captured a work address, so this is the
  // visitor's only way to correct it — it must never be swallowed by another
  // intent. ("wrong email" would otherwise hit nothing; "use another email"
  // contains no competing keyword either, but ordering makes that guaranteed
  // rather than incidental.)
  change_email: [
    "change email",
    "change my email",
    "different email",
    "another email",
    "wrong email",
    "update email",
    "use a different email",
    "edit email",
  ],

  // Checked before everything else: an explicit request for a person is never
  // something to answer from the KB or turn into a qualification form. This
  // replaces SalesIQ's persistent "Connect with a human?" label — the bot now
  // decides when escalation is offered, so it must reliably catch the ask.
  //
  // NOTE the absence of a bare "agent"/"agents" (removed again 2026-08-02,
  // live-confirmed regression: a visitor typed just "agents" — asking about
  // GrowQR's core AI-agents feature — and got immediate escalation instead of
  // an answer). It had been re-added on the theory that PRODUCT_AGENT below
  // would veto product questions about the agents, but that veto only fires
  // when a qualifier word precedes "agent(s)" ("what agents", "list your
  // agents", ...) — a bare, standalone "agents" isn't covered by either the
  // veto OR any legitimate need for the keyword: every real "I want a human"
  // phrasing ("talk to an agent", "live agent", "human agent", "support
  // agent", "connect me with/to an agent") is already its own explicit entry
  // below, so the bare word was pure risk for zero coverage gain. Left
  // deliberately OUT this time — do not re-add it without a phrase this list
  // is missing, not "seemed safer."
  human_request: [...STRONG_HUMAN_REQUEST, ...WEAK_HUMAN_REQUEST],

  // Checked first among the rest: explicit action intent beats everything AI
  // might otherwise infer from the same sentence.
  //
  // "enquire now" is the chip the bot itself offers on B2B pages (router.ts
  // B2B_SUGGESTIONS) — clicking it sends this exact text back, so it must be
  // here or the chip is a dead end. Deliberately NOT a bare "enquire"/
  // "enquiry": that word is common in ordinary British-English phrasing
  // ("I have an enquiry about pricing") and would over-trigger the
  // qualification form on plain content questions the AI-first layer should
  // just answer.
  demo_request: [
    "demo",
    "book a call",
    "enquire now",
    "walkthrough",
    "schedule a call",
    "see it in action",
  ],

  pricing: ["price", "pricing", "cost", "how much", "plans", "plan", "subscription"],
};

/**
 * Names of the AI agents that ARE the product, plus the phrasings that can
 * only be about them. When any of these appear, the message is a product
 * question and must never be read as a request for a human operator, however
 * the word "agent" is used around them.
 *
 * Belt and braces alongside the removal of bare "agent" from human_request:
 * "connect me with an agent like vera" would otherwise still escalate.
 */
const PRODUCT_AGENT =
  /\b(ai\s+agents?|rq-\w+|vera|nova|mira|scout|sage|kai|lyra|rita|rohan|eva|finn|maya|theo)\b|\b(what|which|list|all|how\s+many|your)\s+agents?\b/i;

export function mentionsProductAgent(text: string): boolean {
  return PRODUCT_AGENT.test(text);
}

/**
 * Order matters only among these four: an explicit keyword match always wins,
 * and demo_request is checked before pricing so "book a demo" never gets read
 * as a cost question. Anything that matches none of them is "fallback" — the
 * caller (routeMessage) sends fallback to the AI-first layer, not to a second
 * round of keyword guessing against page context.
 */
export function detectIntent(text: string): BotIntent {
  const lower = text.toLowerCase();

  const order: DeterministicIntent[] = ["change_email", "human_request", "demo_request", "pricing"];

  const productAgent = mentionsProductAgent(text);

  for (const intent of order) {
    // A product question about the AI agents can never be an ask for a person,
    // even when it happens to contain an escalation phrase.
    if (intent === "human_request" && productAgent) continue;
    if (KEYWORDS[intent].some((kw) => lower.includes(kw))) {
      return intent;
    }
  }

  return "fallback";
}
