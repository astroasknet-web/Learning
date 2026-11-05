/**
 * Intent → response orchestration. Every branch returns within the 5-second
 * webhook budget: no LLM calls, no synchronous CRM writes. A successful
 * qualification queues the lead to the database (fast) and schedules the real
 * CRM/notification work via next/server after() — post-response, off the
 * visitor-facing latency budget, with the existing cron sync sweep as the
 * reconciliation layer if after() doesn't run to completion. Same pattern
 * lib/forms/handler.ts already uses for every other lead-capture form.
 *
 * ⚠ UNCONFIRMED: the exact shape of `context` completion answers (the
 * `answers` field in the raw payload) was not enumerated in Zoho's docs this
 * session — see docs/salesiq-bot/WEBHOOK_CONTRACT.md "Unresolved". This file
 * parses it defensively (parseContextAnswers) rather than assuming a shape;
 * update that one function once a real completion payload has been captured.
 */

import { after } from "next/server";
import { createAdminClient } from "@/lib/data/server";
import { createLogger } from "@/lib/log";
import { syncLeadToZoho } from "@/lib/crm/sync";
import { detectIntent, isB2bIntent, isStrongHumanRequest, type BotIntent } from "@/lib/bot/intents";
import {
  parseSession,
  resolveCountry,
  resolvePage,
  resolveIsLive,
  question,
  parseContextAnswers,
  answerString,
  type RawSalesIqPayload,
  type BotSession,
  type BotQuestion,
  type BotResponse,
} from "@/lib/bot/context";
import { queueBotLead, logUnanswered, touchVisitor, changeLeadEmail } from "@/lib/bot/crm";
import { emailDomainHeuristic } from "@/lib/crm/derive";
import { logEvent, type BotEventType } from "@/lib/bot/events";
import { findAnswer, hasSubstance } from "@/lib/bot/answers";
import { findFaq } from "@/lib/bot/faqs";
import { detectAct, actReply } from "@/lib/bot/smalltalk";
import { marketAvailabilityFor } from "@/lib/bot/market";
import { isAiEnabled, tryAiAnswer, type AiOutcome } from "@/lib/ai/answer";

const log = createLogger("bot-router");

// ── Verified-content answer, v1 hardcoded, country-aware ────────────────────
//
// Sourced verbatim from the live Answer Hub article "What does GrowQR cost?
// Is it free?" and "Which countries is GrowQR available in?" (authored and
// verified this session). Hardcoded rather than fetched live: a live SalesIQ
// REST call inside the response path adds network latency and a second
// credential to manage in the hot path, a bad trade for a single,
// rarely-changing answer. Keep in sync by hand when the KB articles change.
//
// Branches on resolveIsLive() (which reuses lib/currency.ts's own
// isLiveCountry() — never a bot-specific reimplementation), NOT on currency:
// USD figures on Pricing.tsx are flagged in-code as unconfirmed placeholders
// even for live USD markets (UAE, Norway, ...), so no numeric price is ever
// shown for a non-INR visitor — only the India figures, or the not-live
// message. Showing India pricing to a US visitor was a real, verified defect
// in the old KB article; this is the fix carried into the bot.
export const PRICING_REPLY_LIVE =
  "GrowQR has a Free Forever plan at ₹0, no card required. In India: 7-Day " +
  "Sprint ₹699 one-time, Monthly ₹1,999/month, Career Accelerator ₹4,999/quarter. " +
  "Full details at growqr.ai";
export const PRICING_REPLY_NOT_LIVE =
  "GrowQR is not a live market in your region yet, so I can't quote a price. " +
  "You can join the waitlist at growqr.ai. Plans show as Coming soon there, " +
  "and we'll email you the moment signup opens.";

/**
 * One context_id per B2B intent (not a single shared id) so the original
 * intent survives to context completion — the completion payload only
 * reliably carries context_id and the collected answers, not the message
 * that started the conversation, so the intent has to be encoded here or
 * it's lost. This is what lets the CRM audience mapping (recruiter →
 * Recruiter, university → Institute, ...) actually work.
 */
// REMOVED: SOLUTION_GREETING, the per-page opening line. It answered "hi" with
// a sentence listing pricing, plans, demos and RQ Score, which was verbose and
// wrong on B2C pages. Greetings now come from GREETINGS in lib/bot/smalltalk.ts
// and are identical on every page.

/**
 * Solutions and audiences that buy on a custom quote, never off the B2C plan
 * table. Used to keep consumer pricing out of B2B conversations entirely —
 * both the chips we offer and the answer we give.
 */
const B2B_SOLUTIONS = new Set(["institutes", "recruiters", "enterprises", "startups"]);
const B2B_AUDIENCES = new Set(["Institute", "Recruiter", "Enterprise"]);

function isB2bContext(session: BotSession): boolean {
  const { solution, audience } = session.context ?? {};
  return Boolean((solution && B2B_SOLUTIONS.has(solution)) || (audience && B2B_AUDIENCES.has(audience)));
}

/**
 * B2C organic-chat lead capture (2026-08-01).
 *
 * Every existing lead path (this file, above) requires a 5-question
 * qualification form and only fires for the 4 B2B-shaped intents. A B2C
 * visitor — homepage, /agents, any /ai-* consumer agent page, any
 * /solutions/{students,freelancers,coaches,professionals,consultants} page —
 * had NO path into bot_leads at all unless they typed something that happened
 * to match a B2B keyword. Meanwhile SalesIQ's own native "push chat as Lead"
 * integration (Lead_Source=Chat in Zoho) WAS creating a Lead for ordinary B2C
 * chats — but with only name+email, no Region/Segment/Product_Interest/page,
 * because that integration has no access to our custom_info context.
 *
 * This closes that gap using ONLY existing machinery: same queueBotLead(),
 * same resolve_bot_lead() upsert (idempotent — see migration 0014, safe to
 * call every qualifying turn), same buildBotLeadPayload() derivation that
 * already resolves Region/Segment/Audience/Product_Interest correctly for a
 * B2C audience (verified: Student/Professional already in AUDIENCE_MAP, and
 * solutionFromPath() already maps freelancers/coaches/consultants to the
 * closest real Zoho picklist value, "Professional" — Zoho's live Audience
 * picklist has no separate Freelancer/Coach value). No new pipeline, no new
 * scoring: this is a straight extension of the B2B path, gated differently.
 *
 * Trigger, deliberately narrow and NON-behavioral (no message counting, no
 * "buying intent" detection):
 *   - NOT a B2B page/audience (isB2bContext false) — B2B keeps its existing
 *     form-based flow entirely untouched; this function is never reached for
 *     it.
 *   - SalesIQ's OWN pre-chat form already captured an email. This never reads
 *     or extracts an email from message text — that would be exactly the kind
 *     of new NLP/scoring logic this is deliberately avoiding.
 *   - hasSubstance(session.text) — the SAME existing export the page-context
 *     tiebreak already uses, so "hi" with a captured email still never
 *     creates a lead.
 *
 * Homepage and /agents/, having no solution match at all, fall through
 * isB2bContext() to false — i.e. eligible — exactly matching "home page is
 * b2c." The Individual/Enterprise toggle on the homepage Hero is client-only
 * React state today (never reaches custom_info), so this cannot yet tell an
 * Enterprise-toggle homepage visitor apart from an Individual one; both
 * default through the email-domain heuristic in buildBotLeadPayload the same
 * way a B2C page with an ambiguous audience already does. Wiring the toggle
 * into custom_info is a separate, small frontend change if that distinction
 * turns out to matter in practice.
 *
 * Runs off the response path via after(), like touchVisitor below — unlike
 * the B2B form-completion reply, nothing in the visitor-facing response
 * depends on this having finished, and it runs on every ordinary B2C turn
 * rather than once at form completion, so it must never add to reply latency.
 */
async function captureB2cLead(session: BotSession): Promise<void> {
  if (isB2bContext(session)) return;
  const email = session.visitor.email;
  if (!email) return;
  if (!hasSubstance(session.text)) return;

  const resolved = await queueBotLead({
    conversationId: session.conversationId,
    avuid: session.avuid,
    intent: "general_inquiry",
    name: session.visitor.name,
    email,
    countryCode: resolveCountry(session),
    pagePath: resolvePage(session),
    utmSource: session.context?.utm_source ?? null,
    utmCampaign: session.context?.utm_campaign ?? null,
  });

  // Only push when the turn actually changed something Zoho would see. This
  // function runs on EVERY B2C message, so pushing unconditionally meant one
  // Zoho write per message — seven for a five-message chat on the 2026-08-06
  // smoke test, all but the first re-sending identical data. See
  // queueBotLead() and migration 0022 for the requeue rule.
  if (resolved && resolved.requeued) {
    await syncLeadToZoho("bot_leads", resolved.leadId);
  }
}

/**
 * Quick-reply chips.
 *
 * B2B pages offer the two actions and nothing else — every informational chip
 * was removed deliberately, to keep the conversation on the one path that
 * matters. An earlier version offered a third, page-specific explainer
 * ("How screening works" and friends); those are gone, and so is the generic
 * "What is GrowQR?", which said nothing to someone already reading a solution
 * page.
 *
 * Consumer pages keep the generic set: there the visitor may genuinely not
 * know what the product is, and "Pricing" points at a real published price.
 *
 * "Pricing" must never appear for a B2B visitor: it routes to the individual
 * plan table (₹699 / ₹1,999 / ₹4,999), the wrong product for an institute or
 * recruiter, who are quoted per cohort or seat. That was a real reported
 * defect on /solutions/institutes.
 */
/** The escalation chip. Its text is a human_request keyword, so clicking it works. */
export const HANDOFF_CHIP = "Connect with human";

const B2B_SUGGESTIONS = ["Enquire now", "Talk to our team"];

/**
 * Fixed, on-brand redirect for a question the AI flagged off_topic (rule 2b
 * in lib/ai/answer.ts's system prompt) — politics, current events, other
 * companies, general trivia. ADDED 2026-08-03: this used to fall through to
 * the same "I'm not sure I have a good answer, could you rephrase / connect
 * with our team" miss flow as a genuine KB gap, which reads oddly for
 * something that was never going to be in the KB no matter how it's
 * rephrased. Deliberately NOT model-generated text — off_topic only asks the
 * model to classify, never to phrase the reply (see that prompt rule), so
 * this is guaranteed on-brand and never needs the hallucination guards.
 */
const OFF_TOPIC_REPLY =
  "That's outside what I can help with. I'm here for questions about GrowQR, so ask me anything about our platform, plans, or how it works!";

/**
 * Per-page chips for the B2C solution pages.
 *
 * Two rules these encode, both from live defects:
 *
 *  1. NO enquiry/sales CTA. "Enquire now" and "Talk to sales" are enterprise
 *     motions; a student or freelancer has no reason to use either. This
 *     applies to every market, India and US alike.
 *  2. NO "What is GrowQR?". Someone already reading /solutions/students has
 *     self-selected; offering the generic definition wastes the slot.
 *
 * Chips are contextual to what the visitor on that page actually wants.
 */
const SOLUTION_SUGGESTIONS: Record<string, string[]> = {
  students: ["How does it help students?", "Career guidance"],
  freelancers: ["Find opportunities", "Build my portfolio"],
  coaches: ["Grow my audience", "Manage clients"],
  professionals: ["Career growth", "Upskill"],
};

/**
 * Chips, drastically reduced. Two rules, both deliberate:
 *
 *  1. AT MOST 2, ever.
 *  2. Only when we know the page. With no page context there is nothing a chip
 *     could be "highly relevant" to, so we show NONE rather than falling back
 *     to a generic set. The old default — "What is GrowQR?" / "Pricing" /
 *     "Book a demo" — is deleted outright: it was generic by construction, it
 *     leaked onto solution pages, and it made the widget read as a menu.
 *
 * When in doubt, no chips.
 */
function suggestionsFor(session: BotSession): string[] {
  if (isB2bContext(session)) return B2B_SUGGESTIONS.slice(0, 2);
  const solution = session.context?.solution;
  const chips = solution ? SOLUTION_SUGGESTIONS[solution] : undefined;
  return chips ? chips.slice(0, 2) : [];
}

/** Only attach `suggestions` when there is actually something to show. */
function withChips(session: BotSession): { suggestions?: string[] } {
  const chips = suggestionsFor(session);
  return chips.length ? { suggestions: chips } : {};
}

const B2B_CONTEXT_PREFIX = "b2b_qualify_";
const b2bContextId = (intent: BotIntent) => `${B2B_CONTEXT_PREFIX}${intent}`;
const intentFromContextId = (contextId: string | null): BotIntent | null => {
  if (!contextId?.startsWith(B2B_CONTEXT_PREFIX)) return null;
  const intent = contextId.slice(B2B_CONTEXT_PREFIX.length);
  return isB2bIntent(intent as BotIntent) ? (intent as BotIntent) : null;
};

/**
 * The four qualification intents — human_request/pricing/fallback never open
 * a form, and neither does general_inquiry: that value is only ever produced
 * by captureB2cLead() directly calling queueBotLead(), never routed through
 * b2bQualifyContext.
 */
type B2bIntent = Exclude<
  BotIntent,
  "pricing" | "fallback" | "human_request" | "change_email" | "general_inquiry"
>;

/**
 * Is this an address we'd be happy to file as a business lead? Reuses the
 * CRM's own consumer-domain list rather than a second copy — the two must
 * agree, since this decides whether we ASK for a work email and that same
 * function decides what Company the lead gets.
 */
function isWorkEmail(email: string | null): boolean {
  return Boolean(email && emailDomainHeuristic(email).segment === "B2B");
}

const B2B_INTENT_INTRO: Record<B2bIntent, string> = {
  demo_request: "Happy to help with your enquiry. A couple of quick questions first.",
  recruiter_inquiry: "Let's get you set up with the right recruiting solution.",
  university_inquiry: "Let's get your institute connected with the right team.",
  enterprise_inquiry: "Let's get your team set up with the right solution.",
};

/**
 * PLATFORM CONSTRAINT, checked before this was written: a webhook bot's
 * `context` questions support only `name`, `replies` and `input` — the shape
 * confirmed from Zoho's own SIQ Scripts sample. There is NO documented key for
 * a default value, a pre-filled answer, or an optional/skippable question
 * (both webhook help pages re-read 2026-08-01; neither enumerates one).
 *
 * So "don't ask twice" can only mean OMITTING the question, which is fully
 * supported because we build the array ourselves. Values SalesIQ's pre-chat
 * form already captured are read from session.visitor at completion time
 * instead — see handleContextCompletion.
 *
 * Name is always skipped when known: the pre-chat name and the demo name mean
 * the same thing. Email is skipped only when the captured address is a work
 * domain — a personal address is not what a B2B lead should be filed under,
 * and this is not hypothetical: a real session had SalesIQ holding
 * siya@growqr.mil.com while the visitor typed sahil@growqr.ai into the form.
 */
function b2bQualifyContext(intent: BotIntent, intro: string, session: BotSession): BotResponse {
  const knownName = session.visitor.name;
  const knownEmail = isWorkEmail(session.visitor.email) ? session.visitor.email : null;

  const questions: BotQuestion[] = [
    question("use_case", `${intro} What are you hoping to solve?`),
  ];
  if (!knownName) questions.push(question("name", "Your name"));
  if (!knownEmail) {
    questions.push(question("email", "Your work email", { validate: { format: "email" } }));
  }
  questions.push(question("company", "Company name"));
  // These four strings are NOT free choices — they must match
  // TEAM_SIZE_EMPLOYEES in lib/crm/derive.ts exactly, EN DASHES INCLUDED, or
  // teamSizeToEmployees() returns null and No_of_Employees never reaches Zoho.
  // The previous ASCII-hyphen options ("1-10", "11-50", …) shared zero keys
  // with that map, so every bot lead had a blank employee count while the team
  // size sat visible in the Description. Same vocabulary as the enterprise
  // contact modal, so both flows map through one table.
  questions.push(
    question("team_size", "Team size (optional)", {
      input: { type: "select", options: ["1–50", "51–200", "201–1,000", "1,000+"] },
    }),
  );

  return {
    action: "context",
    context_id: b2bContextId(intent),
    // No top-level `replies` on a context response — confirmed by both the
    // documented sample (only action/context_id/questions) and a real
    // SalesIQ parse failure. Intro folded into the first question instead.
    questions,
  };
}

// ── Change email, for when we skipped asking ────────────────────────────────

const CHANGE_EMAIL_CONTEXT_ID = "change_email";

function changeEmailContext(): BotResponse {
  return {
    action: "context",
    context_id: CHANGE_EMAIL_CONTEXT_ID,
    questions: [
      question("email", "Sure, what email should we use instead?", {
        validate: { format: "email" },
      }),
    ],
  };
}

// ── Self-identify, for channels with no website context ─────────────────────
//
// $zoho.salesiq.visitor.info() is a browser JS API — confirmed via Zoho's
// docs this session that it cannot run on Instagram/Facebook/WhatsApp, only
// the website. session.context is the practical proxy for "no website
// context reached us" (no documented `channel` field exists to check
// instead). Rather than send those visitors straight to the generic
// rephrase-or-suggestions fallback, ask them to self-identify once — the
// same four audiences the qualification flow already knows how to route.
const SELF_IDENTIFY_CONTEXT_ID = "audience_self_identify";
const SELF_IDENTIFY_OPTIONS = ["Student / Professional", "Recruiter", "University", "Enterprise"];

function selfIdentifyContext(): BotResponse {
  return {
    action: "context",
    context_id: SELF_IDENTIFY_CONTEXT_ID,
    questions: [
      question("audience", "Quick one so I point you the right way. Which describes you?", {
        input: { type: "select", options: SELF_IDENTIFY_OPTIONS },
      }),
    ],
  };
}

async function handleContextCompletion(
  session: BotSession,
  payload: RawSalesIqPayload,
): Promise<BotResponse> {
  // TEMPORARY — the exact wire shape of a completed context's `answers` was
  // never confirmed (see answerString() above). Log the raw payload once so
  // we can finally lock down CONTEXT_SCHEMA.ts / WEBHOOK_CONTRACT.md against
  // real data instead of a third guess. Remove once confirmed.
  log.warn(`${session.conversationId} RAW context completion payload`, {
    contextId: payload.context_id,
    answers: (payload as Record<string, unknown>).answers,
  });

  const answers = parseContextAnswers(payload);
  const intent = intentFromContextId(payload.context_id ?? null);

  // The form may legitimately not contain name/email — b2bQualifyContext omits
  // those questions when SalesIQ's pre-chat form already captured them, since
  // the platform offers no way to pre-fill a question (see that function).
  // Fall back to the session, which is where those captured values live.
  const formEmail = answerString(answers?.email);
  const email = formEmail ?? session.visitor.email ?? undefined;
  const name = answerString(answers?.name) ?? session.visitor.name ?? null;

  if (!answers || !email || !intent) {
    log.warn(`${session.conversationId} context completed without usable data`, {
      hasAnswers: Boolean(answers),
      hasEmail: Boolean(email),
      contextId: payload.context_id,
    });
    await logEvent({ conversationId: session.conversationId, eventType: "handoff_requested" });
    return {
      action: "forward",
      replies: [
        "I wasn't able to capture those details cleanly, so let me connect you with our team instead.",
      ],
    };
  }

  // FIXED (2026-08-03): email precedence. captureB2cLead() may already have
  // filed this same conversation as a general_inquiry lead keyed on
  // session.visitor.email (whatever SalesIQ's pre-chat form captured). If the
  // visitor then reaches this B2B qualification form and it asks for (and
  // gets) a DIFFERENT address — the normal case, since b2bQualifyContext only
  // asks when the captured one isn't a work email — resolve_bot_lead's
  // conversation-match branch would otherwise keep the OLDER address
  // (enrichment only fills gaps, never overwrites an existing value), so the
  // visitor's explicit correction was silently discarded and the lead stayed
  // filed under the wrong email.
  //
  // changeLeadEmail() already exists for exactly this rename: it renames the
  // Zoho Lead in place via updateLead(id, ...), never upsertLead-by-Email, so
  // reusing it here cannot strand the old record behind a second one the way
  // teaching resolve_bot_lead to overwrite the email column would. A no-op
  // when there's no earlier lead for this conversation (the common case).
  if (formEmail && session.visitor.email && formEmail.toLowerCase() !== session.visitor.email.toLowerCase()) {
    await changeLeadEmail({ conversationId: session.conversationId, email: formEmail });
  }

  const resolved = await queueBotLead({
    conversationId: session.conversationId,
    avuid: session.avuid,
    intent,
    useCase: answerString(answers.use_case) ?? null,
    name,
    email,
    company: answerString(answers.company) ?? null,
    designation: answerString(answers.designation) ?? null,
    teamSize: answerString(answers.team_size) ?? null,
    countryCode: resolveCountry(session),
    pagePath: resolvePage(session),
    utmSource: session.context?.utm_source ?? null,
    utmCampaign: session.context?.utm_campaign ?? null,
  });

  if (resolved) {
    // Fast path: process this one lead now, off the response path. The
    // daily cron sweep remains the durability layer for anything this
    // misses (cold shutdown, after() unsupported in some runtime edge case).
    //
    // Unlike the B2C path this fires once, at form completion, so `requeued`
    // is all but always true here — it is checked anyway because a resubmitted
    // form with identical answers is a real thing a visitor can do, and that
    // resubmission has nothing new for Zoho.
    const { leadId, requeued } = resolved;
    if (requeued) {
      after(async () => {
        try {
          await syncLeadToZoho("bot_leads", leadId);
        } catch (error) {
          log.error(`${session.conversationId} after() sync hook failed:`, error);
        }
      });
    }
  }

  // CHANGED per feedback (2026-08-01): the bot used to proactively offer
  // "just say 'change email' if you'd rather" whenever it had silently reused
  // a captured address. Reported as confusing in testing — removed. Whatever
  // email came in first (typed into the form, or captured by SalesIQ's
  // pre-chat) is used without comment, same as every other field.
  //
  // The underlying change_email intent/handler is untouched: a visitor who
  // types "change email" unprompted still reaches it. This only removes the
  // bot VOLUNTEERING it.
  //
  // The chatbot's job ends at qualification: slot scheduling and meeting
  // booking live outside it (currently Cal.com, linked from the site
  // directly — see the "Book a Call" project for its planned replacement),
  // so every B2B intent — demo_request included — ends here with a
  // confirmation reply rather than continuing into a booking flow.
  // demo_request gets its own reply text because "Enquiry Request" (see
  // BOT_INTENT_LABELS) is the state sales cares about seeing on this lead;
  // queueBotLead() above already recorded intent, conversation id and page
  // path, which is what marks it as such.
  if (intent === "demo_request") {
    return {
      action: "reply",
      replies: ["Thanks! Our team has received your request and will reach out shortly."],
    };
  }

  return {
    action: "reply",
    replies: ["Thanks, that's everything I need. Our team will follow up shortly."],
  };
}

async function handleChangeEmailCompletion(
  session: BotSession,
  payload: RawSalesIqPayload,
): Promise<BotResponse> {
  const email = answerString(parseContextAnswers(payload)?.email);
  if (!email) {
    return {
      action: "reply",
      replies: ["I didn't catch that address, could you type it again?"],
    };
  }

  const changed = await changeLeadEmail({ conversationId: session.conversationId, email });
  return {
    action: "reply",
    replies: [
      changed
        ? `Done, we'll use ${email} from now on.`
        : `Thanks, I'll pass ${email} on to our team.`,
    ],
    ...withChips(session),
  };
}

async function handleSelfIdentifyCompletion(
  session: BotSession,
  payload: RawSalesIqPayload,
): Promise<BotResponse> {
  // TEMPORARY — see the matching log in handleContextCompletion() above.
  log.warn(`${session.conversationId} RAW self-identify completion payload`, {
    contextId: payload.context_id,
    answers: (payload as Record<string, unknown>).answers,
  });

  const answers = parseContextAnswers(payload);
  const audience = answerString(answers?.audience);

  const routes: Partial<Record<string, BotIntent>> = {
    Recruiter: "recruiter_inquiry",
    University: "university_inquiry",
    Enterprise: "enterprise_inquiry",
  };

  const intent = audience ? routes[audience] : undefined;
  if (intent) {
    return b2bQualifyContext(intent, B2B_INTENT_INTRO[intent as keyof typeof B2B_INTENT_INTRO], session);
  }

  // "Student / Professional" or an unparseable answer: not a B2B lead,
  // answer directly rather than opening a qualification flow with nothing
  // to qualify.
  return { action: "reply", replies: [resolveIsLive(session) ? PRICING_REPLY_LIVE : PRICING_REPLY_NOT_LIVE] };
}

/**
 * Log the AI attempt off the response path. Every outcome is recorded —
 * served, declined, rejected, timed out — because the rejection breakdown is
 * the only way to tell "the model is behaving" from "the model is trying to
 * invent things and the guards are catching it". §8.1.
 *
 * after() is guarded, not just its callback: it THROWS outside a request
 * scope, and analytics must never be why a reply fails to send.
 */
function logAiOutcome(session: BotSession, outcome: AiOutcome): void {
  const eventType: BotEventType = outcome.answer
    ? "ai_answered"
    : outcome.rejection === "timeout"
      ? "ai_timeout"
      : outcome.rejection === "api_error" || outcome.rejection === "misconfigured"
        ? "ai_error"
        : outcome.rejection === "model_declined" ||
            outcome.rejection === "off_topic" ||
            outcome.rejection?.startsWith("confidence_")
          ? "ai_declined"
          : "ai_rejected";

  try {
    after(async () => {
      try {
        await logEvent({
          conversationId: session.conversationId,
          eventType,
          status: outcome.answer ? "ok" : "failed",
          payload: {
            // Telemetry shape per the agreed spec: question, mode, latency_ms,
            // sources_used, accepted, fallback_reason — plus a few extra
            // diagnostic fields (model/tokens/confidence) kept from before,
            // since they cost nothing to log and have already been useful for
            // telling "the model is behaving" from "the guards are catching
            // something" while triaging real production events this session.
            question: session.text,
            mode: outcome.mode,
            latency_ms: outcome.latencyMs,
            sources_used: outcome.sourceIds,
            accepted: outcome.rejection === null,
            fallback_reason: outcome.rejection,
            source: outcome.source,
            model: outcome.model,
            prompt_tokens: outcome.usage?.prompt_tokens ?? null,
            completion_tokens: outcome.usage?.completion_tokens ?? null,
            total_tokens: outcome.usage?.total_tokens ?? null,
            confidence: outcome.confidence,
            used_zoho_docs: outcome.usedZohoDocs,
            // Telemetry ADDED 2026-08-03, no retrieval/prompt behavior changed —
            // raw data for the two review cases (retrieval quality, conversational
            // declines) called out in the AI testing strategy. Logged on every
            // attempt, not just suspected misses: there's no ground truth to
            // detect a "bad" retrieval automatically, so the plan is to accumulate
            // 50-100 real conversations here first and only then decide whether
            // retrieval weights or the prompt actually need adjusting.
            top_5_articles: (outcome.retrievedKb ?? []).map((a) => ({ id: a.id, title: a.title })),
            scores: (outcome.retrievedKb ?? []).map((a) => a.score),
            chosen_article: outcome.sourceIds,
            model_reason: outcome.rejection,
            raw_mode: outcome.rawMode ?? null,
            retrieved_articles: (outcome.retrievedKb ?? []).map((a) => a.title),
          },
        });
      } catch (error) {
        log.error(`${session.conversationId} AI event log failed:`, error);
      }
    });
  } catch (error) {
    log.error(`${session.conversationId} could not schedule AI event log:`, error);
  }
}

/**
 * The single AI attempt for this turn — tried FIRST for every content
 * question (see routeMessage()'s "AI-first content answering" comment for
 * why), on EVERY qualifying turn, not just the conversation's first miss
 * (CHANGED 2026-08-03 — see that comment for the reasoning: a multi-question
 * real conversation deserves AI's best attempt on each question, not just the
 * first one). Returns null when AI has nothing to offer this turn — a
 * decline, or the call itself failing/timing out — and the caller falls
 * through to the deterministic KB/FAQ safety net. Never throws; logs every
 * real attempt off the response path.
 */
async function tryAiFirst(session: BotSession): Promise<BotResponse | null> {
  const outcome = await tryAiAnswer({
    question: session.text,
    solution: session.context?.solution ?? null,
    audience: session.context?.audience ?? null,
    isLiveMarket: resolveIsLive(session),
    // Defense-in-depth only (2026-08-03) — the market_availability check
    // above already handles every phrasing this detects, so this should
    // never matter in practice. Named so the prompt can tell "the visitor's
    // OWN market" apart from a country mentioned in their question, since
    // isLiveMarket alone carries no country to compare against. See
    // lib/bot/market.ts's module doc for the incident this guards against.
    visitorCountry: resolveCountry(session),
    conversationId: session.conversationId,
  });

  // Caller only invokes this when isAiEnabled() already returned true, so
  // outcome.rejection can never be "disabled" here.
  logAiOutcome(session, outcome);

  // Off-topic is a classification, not a content gap: skip the deterministic
  // KB/FAQ safety net (there is nothing there for "who is modi" no matter how
  // it's rephrased) and skip logUnanswered (this must never pollute the KB
  // backlog that table exists to track) — reply with the fixed redirect
  // immediately instead of falling through to the miss/handoff flow below.
  if (outcome.rejection === "off_topic") {
    log.info(`${session.conversationId} ai flagged off-topic → dedicated redirect`);
    return { action: "reply", replies: [OFF_TOPIC_REPLY], ...withChips(session) };
  }

  if (!outcome.answer) {
    log.info(`${session.conversationId} ai declined (${outcome.rejection}) → deterministic safety net`);
    return null;
  }

  log.info(
    `${session.conversationId} intent=ai_answer source=${outcome.source} mode=${outcome.mode} ` +
      `latency=${outcome.latencyMs}ms tokens=${outcome.usage?.total_tokens ?? 0} ` +
      `sources=${outcome.sourceIds.join(",")}`,
  );
  // The row is still written below, flagged answered_by='ai' — an AI answer
  // here means the deterministic matcher never even ran, and that's exactly
  // the KB-backlog signal worth keeping visible: AI is carrying a question
  // the KB has no article for yet.
  await logUnanswered({
    conversationId: session.conversationId,
    question: session.text,
    pagePath: resolvePage(session),
    countryCode: resolveCountry(session),
    answeredBy: "ai",
  });
  return { action: "reply", replies: [outcome.answer], ...withChips(session) };
}

/**
 * The final tail: nothing answered — not acts, not keyword intents, not
 * AI-first, not the deterministic KB/FAQ safety net. This is also where
 * "AI is uncertain → offer human support instead of guessing" lands: a
 * decline here is a real content gap or a genuinely unclear message, and
 * escalation is the honest response to either. Purely deterministic from
 * here: log the miss once, then either a rephrase prompt (first miss) or
 * human handoff (second).
 */
async function handleFallback(session: BotSession): Promise<BotResponse> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("bot_unanswered")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", session.conversationId);

  const isFirstMiss = (count ?? 0) === 0;

  await logUnanswered({
    conversationId: session.conversationId,
    question: session.text,
    pagePath: resolvePage(session),
    countryCode: resolveCountry(session),
  });

  if (isFirstMiss && !session.context) {
    // No website context reached us — likely a social channel, see the
    // self-identify comment above. Ask once instead of a generic rephrase.
    return selfIdentifyContext();
  }

  if (isFirstMiss) {
    // FIXED (2026-08-01): this text says "pick one below", but withChips()
    // can legitimately return none — no page-specific chip, not a B2B page.
    // A real conversation hit exactly that: no chips rendered, the visitor
    // typed "what to pic?", and only THEN got forwarded to a human. The chip
    // that should have been there from the start is the escalation itself, so
    // it is guaranteed here rather than left to suggestionsFor(). Still capped
    // at 2 total, per the chips policy — the handoff chip's slot is reserved
    // FIRST (BUG FIXED 2026-08-03: appending it and slicing afterward silently
    // dropped it whenever suggestionsFor() already returned 2, which is every
    // solution page and every B2B page — exactly the case this was meant to
    // guarantee).
    const chips = [...suggestionsFor(session).slice(0, 1), HANDOFF_CHIP];
    return {
      action: "reply",
      replies: ["I'm not sure I have a good answer for that. Could you rephrase, or pick one below?"],
      suggestions: [...new Set(chips)],
    };
  }

  // CHANGED (2026-08-02): this used to force a transfer here — action:
  // "forward" with no button, no chip, no chance to decline. Every other
  // handoff in this file is opt-in (the decline act offers the same chip and
  // waits for a click); a second miss auto-transferring was the one place
  // that wasn't. Offer instead. If they click it, "connect with human" is a
  // human_request keyword (see detectIntent below), which forwards with its
  // own handoff_requested log — this branch no longer logs one preemptively
  // for an offer that may not be accepted.
  return {
    action: "reply",
    replies: ["Still not finding a good answer for that. Would you like me to connect you with our team?"],
    suggestions: [HANDOFF_CHIP],
  };
}

export async function routeMessage(payload: RawSalesIqPayload): Promise<BotResponse> {
  const session = parseSession(payload);

  // TEMPORARY (2026-08-03) — diagnostic only, no behavioral effect. Added to
  // settle whether Zoho forwards updated custom_info for messages sent after
  // a visitor navigates mid-conversation (reported: bot kept answering with
  // stale B2C context after a page change). Our own code already re-parses
  // custom_info fresh on every webhook call and the website already re-calls
  // $zoho.salesiq.visitor.info() on every route change (ZohoSalesIQ.tsx) — no
  // caching bug found on our side — so this line exists purely to confirm
  // what Zoho's payload actually carries turn-to-turn. Safe to delete once
  // that's confirmed either way from the logs.
  log.info(`${session.conversationId} page=${resolvePage(session)} avuid=${session.avuid ?? "none"}`);

  // avuid is the visitor key the whole dedupe chain prefers. It was confirmed
  // present on a real website payload, but not yet on EVERY website turn, so
  // its absence is logged loudly rather than assumed impossible — dedupe still
  // works without it, just degraded to email + conversation matching.
  if (!session.avuid) {
    log.warn(`${session.conversationId} payload carries no avuid`, {
      visitorKeys: Object.keys(payload.visitor ?? {}).join(","),
    });
  }

  // Visit tracking runs off the response path — analytics must never spend
  // any of SalesIQ's 5-second budget.
  //
  // after() itself is guarded, not just its callback: it THROWS when called
  // outside a request scope ("`after` was called outside a request scope"),
  // which would abort the whole response and show the visitor an error. Visit
  // tracking is the least important thing this function does and must never be
  // the reason a reply fails to send.
  try {
    after(async () => {
      try {
        await touchVisitor({
          avuid: session.avuid,
          conversationId: session.conversationId,
          pagePath: resolvePage(session),
          countryCode: resolveCountry(session),
          email: session.visitor.email,
        });
      } catch (error) {
        log.error(`${session.conversationId} touchVisitor hook failed:`, error);
      }
    });
  } catch (error) {
    log.error(`${session.conversationId} could not schedule visit tracking:`, error);
  }

  if (payload.handler === "context" && payload.context_id?.startsWith(B2B_CONTEXT_PREFIX)) {
    return handleContextCompletion(session, payload);
  }
  if (payload.handler === "context" && payload.context_id === CHANGE_EMAIL_CONTEXT_ID) {
    return handleChangeEmailCompletion(session, payload);
  }
  if (payload.handler === "context" && payload.context_id === SELF_IDENTIFY_CONTEXT_ID) {
    return handleSelfIdentifyCompletion(session, payload);
  }

  if (!session.text) {
    // Trigger events (visitor landing) with no message yet — nothing to route.
    return { action: "reply", replies: [] };
  }

  // B2C organic-chat lead capture — see captureB2cLead() above. Off the
  // response path, same guard pattern as touchVisitor above it: after()
  // throws outside a request scope, and this must never be why a reply fails.
  try {
    after(async () => {
      try {
        await captureB2cLead(session);
      } catch (error) {
        log.error(`${session.conversationId} captureB2cLead hook failed:`, error);
      }
    });
  } catch (error) {
    log.error(`${session.conversationId} could not schedule captureB2cLead:`, error);
  }

  const pageHint = {
    solution: session.context?.solution,
    audience: session.context?.audience,
  };

  // Conversational acts come first: greetings, thanks, acknowledgements and
  // goodbyes are not inquiries, and letting them fall through caused two real
  // defects (see lib/bot/smalltalk.ts) — "bye" opening a qualification form,
  // and "thanks" being answered with "I'm not sure I have a good answer for
  // that" while writing a bot_unanswered row.
  //
  // Nothing below this point runs for an act: no KB lookup, no intent
  // detection, no page-context tiebreak, and crucially no logUnanswered — the
  // KB backlog must reflect real gaps, not politeness.
  const act = detectAct(session.text);
  if (act) {
    log.info(`${session.conversationId} act=${act}`);

    // FIXED (2026-08-03): "no" / "nope" / "nothing" in reply to the bot's own
    // "anything else?" is satisfaction, not dissatisfaction — this used to
    // hardcode a human-handoff offer for every decline, which read as "the
    // bot thinks I'm unhappy" to a visitor who was simply done. Genuine
    // dissatisfaction has its own signal (the WEAK_HUMAN_REQUEST phrases in
    // lib/bot/intents.ts — "not helpful", "confused", "wrong", ...) or an
    // explicit ask (STRONG_HUMAN_REQUEST); a bare decline is neither, so it
    // now falls through to the same actReply() branch as every other act and
    // gets the warm, non-escalating closing line already authored in
    // lib/bot/smalltalk.ts's REPLIES.decline — no chip, per actKeepsChips().

    // Greetings are page-agnostic: actReply() gets the SAME inputs regardless
    // of solution, so /solutions/coaches and / produce identical text. Nothing
    // below this return runs — no intents, no matcher, no page context, and
    // no chips.
    return {
      action: "reply",
      replies: [actReply(act, `${session.conversationId}:${session.text}`)],
    };
  }

  // Deliberate ordering. An EXPLICIT keyword intent ("book a demo", "pricing",
  // an ask for a human) is what the visitor actually asked for and always
  // wins. Only these four intents are ever detected this way (see the module
  // doc in lib/bot/intents.ts) — everything else, including what used to be
  // audience-inferred B2B "inquiries", now goes to the AI-first block below.
  const keywordIntent = detectIntent(session.text);

  // Checked before human_request: this is the escape hatch for the email we
  // chose on the visitor's behalf when the qualification form skipped the
  // question, so it must reach the form rather than a person.
  if (keywordIntent === "change_email") {
    log.info(`${session.conversationId} intent=change_email`);
    return changeEmailContext();
  }

  // Condition 1 of the escalation policy: an explicit ask for a person. Wins
  // over everything — the KB has a "How do I contact the GrowQR team?" article
  // that would otherwise answer this with text instead of actually connecting
  // them. Only a STRONG signal ("talk to a human", "real person", ...)
  // auto-forwards, though — it's the one reading of the message and there is
  // nothing else to lose by acting on it immediately.
  //
  // A WEAK signal ("need help", "support", bare "human", "confused", "wrong",
  // dissatisfaction phrases) is not that unambiguous: "need help about the
  // pricing" is a topic ask, not a request for a person, and forwarding on it
  // with no chip and no chance to decline was a real defect (2026-08-02, same
  // class of bug already fixed for the fallback tail below). So a weak signal
  // only offers the handoff — same opt-in pattern as the decline act and the
  // second-miss fallback. Clicking the chip sends "Connect with human" back,
  // which is a STRONG keyword, so the next turn forwards for real.
  if (keywordIntent === "human_request") {
    if (isStrongHumanRequest(session.text)) {
      log.info(`${session.conversationId} intent=human_request → forward`);
      await logEvent({ conversationId: session.conversationId, eventType: "handoff_requested" });
      return {
        action: "forward",
        replies: ["Sure, connecting you with our team now."],
      };
    }
    log.info(`${session.conversationId} intent=human_request (weak) → offer`);
    return {
      action: "reply",
      replies: ["Would you like me to connect you with our team?"],
      suggestions: [HANDOFF_CHIP],
    };
  }

  if (keywordIntent === "pricing") {
    // A B2B visitor asking about price must NOT get the individual plan table
    // — institutes/recruiters/enterprises are quoted per cohort or seat. Real
    // defect: an institute visitor clicked the "Pricing" chip on
    // /solutions/institutes and was shown ₹699/₹1,999 consumer plans.
    if (isB2bContext(session)) {
      const enterprise = findAnswer("how much does growqr cost for enterprises");
      if (enterprise) {
        log.info(`${session.conversationId} intent=pricing (b2b) article="${enterprise.title}"`);
        return { action: "reply", replies: [enterprise.text], ...withChips(session) };
      }
    }
    return {
      action: "reply",
      replies: [resolveIsLive(session) ? PRICING_REPLY_LIVE : PRICING_REPLY_NOT_LIVE],
      ...withChips(session),
    };
  }

  // demo_request is the only B2B qualification intent still triggered by a
  // keyword (2026-08-03) — recruiter_inquiry/university_inquiry/
  // enterprise_inquiry no longer auto-open the form from free text, and
  // neither does page context alone (see the module doc in lib/bot/intents.ts
  // and the AI-first block below). A recruiter/institute/enterprise visitor
  // describing their need now gets an AI-composed answer grounded in the
  // relevant KB article; they still reach the form via an explicit "book a
  // demo" or "talk to our team", same as everyone else.
  if (keywordIntent === "demo_request") {
    log.info(`${session.conversationId} intent=demo_request (keyword)`);
    return b2bQualifyContext("demo_request", B2B_INTENT_INTRO.demo_request, session);
  }

  // Deterministic market-availability check, BEFORE AI (2026-08-03, see
  // lib/bot/market.ts's module doc for the full incident): "is it live in the
  // USA?" has exactly one right answer, computable directly from
  // LIVE_COUNTRIES — the same lookup the landing pages already use — so there
  // is nothing for the model to infer, and nothing to get wrong the way the
  // AI's market=live/not_live exception did when the visitor's own market
  // didn't match the country they actually named. Runs for every visitor,
  // including one asking about their own country by name — same correct
  // answer either way.
  const marketAvailability = marketAvailabilityFor(session.text);
  if (marketAvailability) {
    log.info(
      `${session.conversationId} intent=market_availability country=${marketAvailability.code} ` +
        `live=${marketAvailability.isLive}`,
    );
    return { action: "reply", replies: [marketAvailability.reply], ...withChips(session) };
  }

  // ── AI-first content answering ──────────────────────────────────────────
  //
  // Everything that isn't a greeting/thanks/farewell, pricing, a demo
  // request, or an escalation is a content question, and content questions go
  // to the AI first: retrieve the top few relevant KB articles + page
  // context, hand the visitor's message and that context to the model, and
  // let it compose the reply (or ask a clarifying question, or decline).
  // Users phrase the same question in far more ways than aliases/regexes can
  // enumerate, and this session's own history proved it — a steady stream of
  // one-off pattern/stopword fixes for individual phrasings that only ever
  // fixed the ONE case someone happened to test. The goal is real
  // conversations, not golden-set coverage.
  //
  // Tried on EVERY qualifying turn now (2026-08-03), not just the first miss
  // of the conversation — a visitor who asks three different content
  // questions in one chat should get AI's best attempt on all three, not just
  // the first. The deterministic matcher below (findAnswer/findFaq/aliases)
  // is NOT deleted — it is the fallback: tried when AI is disabled, declines
  // (answered=false — genuinely not in the sources), or the call itself
  // fails/times out. If AI is uncertain and the deterministic safety net also
  // has nothing, handleFallback offers a human rather than guessing.
  if (isAiEnabled()) {
    const aiResponse = await tryAiFirst(session);
    if (aiResponse) return aiResponse;
  }

  const answer = findAnswer(session.text, pageHint);
  if (answer) {
    log.info(
      `${session.conversationId} intent=kb_answer article="${answer.title}" score=${answer.score}`,
    );
    return {
      action: "reply",
      replies: [answer.text],
      ...withChips(session),
    };
  }

  // FAQs: the tier between the Answer Hub and the final fallback. These are
  // the 11 published SalesIQ FAQs, human-authored and verified. Checked here
  // so a real authored answer always beats a generated one.
  const faq = findFaq(session.text);
  if (faq) {
    log.info(`${session.conversationId} intent=faq_answer faq="${faq.question}" score=${faq.score}`);
    return {
      action: "reply",
      replies: [faq.text],
      ...withChips(session),
    };
  }

  log.info(`${session.conversationId} intent=fallback`);
  return handleFallback(session);
}
