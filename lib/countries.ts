/**
 * Country name/alias → ISO-2 code, and the reverse display-name lookup.
 *
 * Neutral top-level module, not under lib/bot or lib/ai: lib/ai/retrieval.ts
 * already documents the rule this follows — the AI layer imports nothing from
 * lib/bot, so anything both layers need (lib/bot/market.ts's deterministic
 * "is it live in <country>" replies, and lib/ai/answer.ts naming the
 * visitor's own country in the prompt context) has to live above either.
 *
 * NOT exhaustive — covers the 13 LIVE_COUNTRIES (lib/currency.ts) plus a
 * practical set of commonly-asked-about markets. Extend on evidence, same
 * discipline as golden-set.ts's `passing: false` backlog: don't hand-guess
 * every country on earth, add one when a real question needs it.
 */

/** lowercase name/alias → ISO-2 code. */
export const COUNTRY_ALIASES: Record<string, string> = {
  // ── The 13 live markets (lib/currency.ts's LIVE_COUNTRIES) ───────────────
  india: "IN",
  "united arab emirates": "AE",
  uae: "AE",
  emirates: "AE",
  turkey: "TR",
  turkiye: "TR",
  "sri lanka": "LK",
  nepal: "NP",
  thailand: "TH",
  brazil: "BR",
  argentina: "AR",
  malta: "MT",
  norway: "NO",
  sweden: "SE",
  switzerland: "CH",
  // Deliberately NOT included: bare "georgia" — collides with the US state,
  // and lib/currency.ts's own LIVE_COUNTRIES comment already flags this
  // ambiguity for the country. Needs a qualifier ("the country of Georgia")
  // this simple matcher doesn't attempt to parse; falls through to the AI
  // layer's own (weaker) judgment instead.

  // ── Common non-live markets people actually ask about ────────────────────
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  america: "US",
  uk: "GB",
  "united kingdom": "GB",
  britain: "GB",
  england: "GB",
  canada: "CA",
  australia: "AU",
  germany: "DE",
  france: "FR",
  singapore: "SG",
  pakistan: "PK",
  bangladesh: "BD",
  philippines: "PH",
  nigeria: "NG",
  kenya: "KE",
  "south africa": "ZA",
  mexico: "MX",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  japan: "JP",
  china: "CN",
  russia: "RU",
  indonesia: "ID",
  vietnam: "VN",
  egypt: "EG",
  "saudi arabia": "SA",
  qatar: "QA",
  kuwait: "KW",
  bahrain: "BH",
  oman: "OM",
  israel: "IL",
  "new zealand": "NZ",
  ireland: "IE",
  malaysia: "MY",
  "south korea": "KR",
  korea: "KR",
  // Deliberately NOT included: bare "us" — collides with the pronoun. "USA"/
  // "United States"/"America" cover the phrasings people actually type.
};

/** Longest alias first, so "united arab emirates" matches before any shorter substring could. */
const ALIAS_ENTRIES = Object.entries(COUNTRY_ALIASES).sort((a, b) => b[0].length - a[0].length);

/** ISO-2 code → the display name used in a reply and in the AI prompt context. */
export const COUNTRY_DISPLAY_NAME: Record<string, string> = {
  IN: "India",
  AE: "the UAE",
  TR: "Turkey",
  GE: "Georgia",
  LK: "Sri Lanka",
  NP: "Nepal",
  TH: "Thailand",
  BR: "Brazil",
  AR: "Argentina",
  MT: "Malta",
  NO: "Norway",
  SE: "Sweden",
  CH: "Switzerland",
  US: "the US",
  GB: "the UK",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  SG: "Singapore",
  PK: "Pakistan",
  BD: "Bangladesh",
  PH: "the Philippines",
  NG: "Nigeria",
  KE: "Kenya",
  ZA: "South Africa",
  MX: "Mexico",
  ES: "Spain",
  IT: "Italy",
  NL: "the Netherlands",
  JP: "Japan",
  CN: "China",
  RU: "Russia",
  ID: "Indonesia",
  VN: "Vietnam",
  EG: "Egypt",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
  IL: "Israel",
  NZ: "New Zealand",
  IE: "Ireland",
  MY: "Malaysia",
  KR: "South Korea",
};

/**
 * Finds a country named in free text, or null. Whole-word matched (`\b`) on
 * both sides so e.g. "chad" inside another word can't misfire, checked
 * longest-alias-first so multi-word names win over any shorter overlap.
 */
export function detectNamedCountry(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [name, code] of ALIAS_ENTRIES) {
    const pattern = new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`);
    if (pattern.test(lower)) return code;
  }
  return null;
}

/** ISO-2 code → display name, falling back to the raw code if unmapped. Null in, null out. */
export function countryDisplayName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_DISPLAY_NAME[code.toUpperCase()] ?? code;
}
