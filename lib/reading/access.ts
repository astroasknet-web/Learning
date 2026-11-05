import { accessFor, buyHref, courseFee, type Access } from "../pay/course-access";

/**
 * Who may use what in the English Reading Studio. The studio has three TRACKS and each is sold as its own product through the existing payment system,
 * so purchase, verification, refund and plan behaviour are exactly the existing course rules. Premium is granted only by a verified payment recorded
 * by the payment system (an entitlement), never by anything the browser claims.
 *
 *  - skills        The skills pathway: ten levels, practice, mastery, recall, timed reading, the 7-day plan.      product `ai-reading-studio`
 *  - indian        Essay reading tests for SSC, CDS, CAT, UPSC, CTET (30 tests).                                   product `indian-competitive-reading`
 *  - international IELTS Reading practice tests (existing product; Silver opens 10, Gold or the set opens all).     product `ielts-practice-tests`
 *
 * Detailed analytics (skill-by-skill analysis, charts, explanations, history, reports) open for a student who holds ANY track.
 */
export const READING_SLUG = "ai-reading-studio";
export const INDIAN_SLUG = "indian-competitive-reading";
export const INTERNATIONAL_SLUG = "ielts-practice-tests";

export type Track = "skills" | "indian" | "international";
export const TRACKS: Array<{ id: Track; name: string; short: string; slug: string; blurb: string; href: string }> = [
  { id: "skills", name: "Reading Skills Pathway", short: "Skills", slug: READING_SLUG, blurb: "Ten levels from foundations to mastery, with practice, mastery checks, timed reading and a 7-day plan.", href: "/reading-studio/levels/A" },
  { id: "indian", name: "Indian Competitive Exams", short: "SSC, CDS, CAT, UPSC, CTET", slug: INDIAN_SLUG, blurb: "30 essay-based reading tests with exam-style questions, instant explanations and full analytics.", href: "/reading-tests" },
  { id: "international", name: "International Exams", short: "IELTS reading", slug: INTERNATIONAL_SLUG, blurb: "IELTS Academic Reading practice tests, scored with a band and an explanation for every answer.", href: "/practice-tests/ielts-reading" },
];
export const isTrack = (s: string): s is Track => TRACKS.some((t) => t.id === s);
export const trackInfo = (t: Track) => TRACKS.find((x) => x.id === t)!;

/** Whether the person holds the track by purchase or plan. A product that is not in the shop at all counts as open, as everywhere in the portal. */
const holds = (a: Access): boolean => a !== null;

export interface TrackAccess { skills: boolean; indian: boolean; international: boolean; international_limit_open: boolean; analytics: boolean }

export async function trackAccess(userId: number): Promise<TrackAccess> {
  const [s, i, n] = await Promise.all([accessFor(userId, READING_SLUG), accessFor(userId, INDIAN_SLUG), accessFor(userId, INTERNATIONAL_SLUG)]);
  // "free" means the product is not for sale at all; that opens the track but must not count as having paid for analytics
  const paid = (a: Access) => a === "purchase" || a === "plan";
  return { skills: holds(s), indian: holds(i), international: paid(n), international_limit_open: holds(n), analytics: paid(s) || paid(i) || paid(n) };
}

export const readingAccess = (userId: number): Promise<Access> => accessFor(userId, READING_SLUG);
/** The skills pathway (levels, practice, mastery, recall, timed, fresh). */
export const hasPremium = async (userId: number): Promise<boolean> => holds(await readingAccess(userId));
export const hasTrack = async (userId: number, t: Track): Promise<boolean> => (await trackAccess(userId))[t === "international" ? "international_limit_open" : t];
/** Detailed analytics for any result: held by anyone with a paid track. */
export const hasAnalytics = async (userId: number): Promise<boolean> => (await trackAccess(userId)).analytics || (await hasPremium(userId));

export const buyLink = (t: Track = "skills"): string => buyHref(trackInfo(t).slug);
export const feeNow = (t: Track = "skills") => courseFee(trackInfo(t).slug);

/** What a student without the package may do. Used by the pages and, again, by the server routes. */
export const FREE_FEATURES = ["Starting assessment with an overall score", "Basic reading-speed result (an estimate)", "Strongest and weakest skill summary", "Level A lesson", "Three free Indian competitive exam essay tests"] as const;
export const PREMIUM_FEATURES = [
  "Skill-by-skill analysis with the questions behind each score",
  "Full explanations for every answer, including the tempting wrong options",
  "Interactive charts: profile, skills, difficulty, timing, speed and comprehension, skill-by-difficulty",
  "A personalised 7-day improvement plan",
  "Level practice, mastery checks and all ten levels",
  "Delayed-recall sessions and timed reading",
  "Complete progress history and downloadable reports",
] as const;
