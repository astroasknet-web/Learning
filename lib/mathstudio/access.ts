import { accessFor, buyHref, courseFee, type Access } from "../pay/course-access";

/**
 * Who sees the full Mathematics Studio. The premium analytics are one product (`course-mathematics-studio`, the same pattern as every other course),
 * so purchase, verification, refund and plan behaviour are exactly the existing course rules. Premium is granted only by a verified payment recorded
 * by the payment system (an entitlement), never by anything the browser claims.
 *
 * Free for every signed-in student: the overall performance summary, correct/incorrect counts, a limited number of topics in detail, a couple of
 * recommendations, the basic progress trend and a preview of the plan. Everything else is behind the product.
 */
export const STUDIO_SLUG = "mathematics-studio";

export const studioAccess = (userId: number): Promise<Access> => accessFor(userId, STUDIO_SLUG);
export const hasPremium = async (userId: number): Promise<boolean> => (await studioAccess(userId)) !== null;
export const buyLink = (): string => buyHref(STUDIO_SLUG);
export const feeNow = () => courseFee(STUDIO_SLUG);

export const FREE_FEATURES = [
  "Overall mathematics performance score",
  "Accuracy, correct and incorrect counts",
  "Your three weakest topics named",
  "A basic progress trend",
  "A preview of your improvement plan",
] as const;
export const PREMIUM_FEATURES = [
  "Every topic's mastery with the evidence behind it",
  "Full weakness diagnosis with likely causes",
  "Interactive charts: mastery over time, speed vs accuracy, a weakness heatmap and more",
  "A prioritised, personalised practice plan with targets and revisit dates",
  "Question-level analysis of every test you have taken",
  "Mastery progression and topic-movement tracking",
  "Complete history and downloadable reports",
] as const;
