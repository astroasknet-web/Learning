/** Course picks each plan includes. Kept apart from lib/pay/plans.ts (which needs the database) so pages and tests that only do arithmetic can read it. */
export const PLAN_COURSE_QUOTA = { pro: 1, silver: 2, gold: 3 } as const;
