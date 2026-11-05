/**
 * Staff-delivered services a plan includes, and how many. Pure data, shared by the value stack, the dashboard and the claim code (lib/pay/services.ts).
 * `per` is the window the count renews in: a month is the last 30 days, a year the last 365. The fee of one on its own is in SERVICE_PRODUCTS (lib/pay/course-fees.ts).
 */
export type ServiceKey = "career-counselling" | "overseas-counselling" | "resume-review" | "mock-visa-interview" | "expert-shortlist";
export type Window = "month" | "year";
export interface Allowance { count: number; per: Window }

export const PLAN_SERVICES: Record<"pro" | "silver" | "gold", Partial<Record<ServiceKey, Allowance>>> = {
  pro: {},
  silver: { "career-counselling": { count: 1, per: "month" } },
  gold: {
    "career-counselling": { count: 1, per: "month" },
    "overseas-counselling": { count: 1, per: "year" },
    "resume-review": { count: 1, per: "year" },
    "mock-visa-interview": { count: 2, per: "year" },
    "expert-shortlist": { count: 1, per: "year" },
  },
};

export const WINDOW_DAYS: Record<Window, number> = { month: 30, year: 365 };

/** What a student sees against each service: its name and what the service is, in plain words. */
export const SERVICE_LABEL: Record<ServiceKey, { name: string; what: string }> = {
  "career-counselling": { name: "Career counselling session", what: "30 minutes, online, 1:1 with an expert: career direction, course and skill choices, or clearing academic doubts" },
  "overseas-counselling": { name: "Overseas education counselling", what: "1:1 session on country and university choice, admission requirements, budget and scholarships, and your application plan" },
  "resume-review": { name: "Expert resume review", what: "An expert reviews your resume and sends back specific changes" },
  "mock-visa-interview": { name: "Mock visa interview", what: "A practice visa interview with an expert and feedback on your answers" },
  "expert-shortlist": { name: "Overseas universities shortlist by experts", what: "A shortlist chosen by our experts to fit your documents and qualifications" },
};

/** IELTS Reading and Listening tests a student can open: the first FREE_IELTS_TESTS of each are free, Silver opens 10, Gold (or buying the set) all 30. */
export const FREE_IELTS_TESTS = 3;
export const SILVER_IELTS_TESTS = 10;
export const ALL_IELTS_TESTS = 30;
