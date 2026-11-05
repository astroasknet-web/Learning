/**
 * Deterministic "is GrowQR live in <country>?" replies — the SAME plain
 * boolean lookup the landing pages use (isLiveCountry() in lib/currency.ts,
 * surfaced client-side via regionForCountry()/useIsLive() in
 * CurrencyProvider.tsx), applied to a country NAMED in the visitor's message
 * rather than the visitor's own geolocated one.
 *
 * Why this exists: the landing pages never face this ambiguity — there is no
 * page where a visitor picks an arbitrary country to check, only their own
 * server-detected one (detectRegion() reads Vercel's x-vercel-ip-country
 * header once, and every component downstream just reads the resulting
 * boolean). The chat bot is different: a visitor can TYPE any country's name.
 * Before this, lib/ai/answer.ts's market=live/not_live prompt flag only ever
 * described the VISITOR's own location — never whatever country they named —
 * and nothing cross-checked the two. Live-confirmed 2026-08-03: a visitor
 * whose own market was live asked "is it live in the USA?" and the model
 * answered "GrowQR is available in the US and you can sign up at growqr.ai,"
 * which is false (the US is not in LIVE_COUNTRIES).
 *
 * Since LIVE_COUNTRIES is a small, complete, authoritative list, there is
 * nothing to infer for this question shape — the same isLiveCountry() lookup
 * the site already uses settles it outright. Checked in routeMessage() BEFORE
 * the AI-first block, so this bug class doesn't reach the model at all rather
 * than depending on a prompt instruction to catch it.
 */
import { isLiveCountry } from "@/lib/currency";
import { detectNamedCountry, countryDisplayName } from "@/lib/countries";

/**
 * Requires an availability-shaped verb/phrase alongside the country name —
 * naming a country alone ("I studied in India", "my recruiter is in the US")
 * must never hijack an unrelated message.
 *
 * Deliberately excludes "support" — lib/bot/intents.ts's WEAK_HUMAN_REQUEST
 * already claims bare "support" as an ask to connect with a person, and that
 * keyword check runs before this one in routeMessage(). "do you support
 * India" is genuinely ambiguous between the two readings; ceding it to the
 * existing, already-shipped human_request behavior rather than fighting over
 * precedence for one overloaded word.
 */
const AVAILABILITY_PATTERN =
  /\b(live|launch(?:ed|ing)?|available|availability|operat\w*|work(?:s|ing)?|sign\s*up|do you (?:sell|serve)|is (?:it|growqr) in)\b/i;

export interface NamedCountryAvailability {
  code: string;
  isLive: boolean;
  reply: string;
}

/**
 * Deterministic reply for "is GrowQR live/available in <country>?" — the
 * exact isLiveCountry() lookup the landing pages already use, phrased as a
 * chat reply instead of a page's CTA/badge. Returns null when the message
 * doesn't both name a recognized country AND ask an availability question,
 * so it's a no-op for everything else (including a visitor asking about
 * their OWN country by name — same correct answer either way, just phrased
 * through this path instead of the AI's market=live/not_live exception).
 */
export function marketAvailabilityFor(text: string): NamedCountryAvailability | null {
  if (!AVAILABILITY_PATTERN.test(text)) return null;

  const code = detectNamedCountry(text);
  if (!code) return null;

  const name = countryDisplayName(code) ?? code;
  const isLive = isLiveCountry(code);
  const reply = isLive
    ? `Yes, GrowQR is live in ${name}. You can sign up at growqr.ai.`
    : `GrowQR isn't live in ${name} yet. You can join the waitlist at growqr.ai and we'll email you when it opens.`;

  return { code, isLive, reply };
}
