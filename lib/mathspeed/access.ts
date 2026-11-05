import { accessFor, buyHref, courseFee, type Access } from "../pay/course-access";
import { COURSE_SLUG } from "./curriculum";
import type { SessionKind } from "./plan";

/**
 * Who may study what. The studio is one paid course (product `course-mathematics-speed-enhancement`, the same pattern as every other course).
 * Free for everyone who is signed in as a student: enrolment, the placement diagnostic, and the sample, which is Level A Module 1.
 * Everything else needs the course: bought, or used from a plan, while it is active. See lib/pay/course-access.ts.
 */
export const FREE_MODULE = "A-01";

export const courseAccess = (userId: number): Promise<Access> => accessFor(userId, COURSE_SLUG);
export const hasCourse = async (userId: number): Promise<boolean> => (await courseAccess(userId)) !== null;
export const buyLink = (): string => buyHref(COURSE_SLUG);
export const courseFeeNow = () => courseFee(COURSE_SLUG);

/** Whether a session of this kind and reference may be started without the course. */
export function freeSession(kind: SessionKind, ref: string): boolean {
  if (kind === "diagnostic") return true;
  return (kind === "practice" || kind === "drill") && ref.toUpperCase() === FREE_MODULE;
}

export const moduleIsFree = (key: string): boolean => key.toUpperCase() === FREE_MODULE;
