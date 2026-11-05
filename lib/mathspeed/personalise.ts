import type { Ctx } from "./types";

/**
 * Personalisation changes only how a question is dressed: the currency symbol, the first names and the theme of word problems.
 * The numbers, the skills and the journey are identical for every student in every country.
 */
const NAMES: Record<string, readonly string[]> = {
  IN: ["Asha", "Ravi", "Meera", "Kabir", "Isha", "Arjun", "Nisha", "Dev"],
  US: ["Emma", "Liam", "Maya", "Noah", "Ava", "Ethan", "Zoe", "Leo"],
  GB: ["Olivia", "Harry", "Amelia", "Jack", "Isla", "Oscar", "Grace", "Alfie"],
  AE: ["Layla", "Omar", "Noor", "Yusuf", "Mariam", "Khalid", "Hana", "Zayed"],
  NG: ["Ada", "Tunde", "Ngozi", "Emeka", "Funmi", "Chidi", "Sade", "Kunle"],
  NP: ["Sita", "Bikash", "Anju", "Rohan", "Pema", "Suman", "Maya", "Dawa"],
  AU: ["Chloe", "Jack", "Mia", "Lucas", "Ruby", "Oliver", "Ella", "Max"],
};
const CURRENCY: Record<string, string> = { IN: "₹", US: "$", GB: "£", AE: "AED ", NG: "₦", NP: "Rs ", AU: "$" };

export const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "IN", name: "India" }, { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" }, { code: "AE", name: "United Arab Emirates" },
  { code: "NG", name: "Nigeria" }, { code: "NP", name: "Nepal" }, { code: "AU", name: "Australia" }, { code: "XX", name: "Another country" },
];

export const AGE_BANDS = [
  { id: "under-12", label: "Under 12", theme: "child" },
  { id: "12-15", label: "12 to 15", theme: "teen" },
  { id: "16-18", label: "16 to 18", theme: "teen" },
  { id: "19-plus", label: "19 and over", theme: "adult" },
] as const;
export type AgeBand = (typeof AGE_BANDS)[number]["id"];

export const PACES = [
  { id: "steady", label: "Steady", blurb: "About 10 minutes a day", perDay: 10 },
  { id: "regular", label: "Regular", blurb: "About 20 minutes a day", perDay: 20 },
  { id: "intensive", label: "Intensive", blurb: "About 40 minutes a day", perDay: 40 },
] as const;
export type Pace = (typeof PACES)[number]["id"];

/** Languages: only English has lessons today. The rest are shown so the choice is honest about what exists. */
export const LANGUAGES = [{ id: "en", label: "English", available: true }, { id: "hi", label: "Hindi (coming)", available: false }, { id: "ar", label: "Arabic (coming)", available: false }, { id: "es", label: "Spanish (coming)", available: false }] as const;

export const DEFAULT_CTX: Ctx = { currency: "₹", names: NAMES.IN, theme: "teen" };

export function ctxFor(country: string, ageBand: string): Ctx {
  const c = country.toUpperCase();
  const band = AGE_BANDS.find((b) => b.id === ageBand);
  return { currency: CURRENCY[c] ?? "$", names: NAMES[c] ?? NAMES.US, theme: band?.theme ?? "teen" };
}

/** Minutes ahead of UTC, to decide which calendar day a practice session belongs to (approximate: no daylight saving). */
const TZ_MINUTES: Record<string, number> = { IN: 330, NP: 345, AE: 240, NG: 60, GB: 0, US: -300, AU: 600 };
export const tzOffsetMinutes = (country: string): number => TZ_MINUTES[country.toUpperCase()] ?? 0;
/** YYYY-MM-DD for the student's local day. */
export const localDay = (country: string, now: Date = new Date()): string => new Date(now.getTime() + tzOffsetMinutes(country) * 60_000).toISOString().slice(0, 10);
