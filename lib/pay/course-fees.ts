/**
 * Fees set by the owner, in rupees, charged once per course. The key is the category name in lib/market/data/courses.json.
 * Seeding only creates missing products, so a price changed in the console is never overwritten by these numbers.
 */
export const COURSE_FEE_RUPEES: Record<string, number> = {
  "Blockchain & Web3": 799,
  "AI & Machine Learning": 699,
  "Data, Analytics & BI": 599,
  "Business, Management & Product": 499,
  "Digital & Office Productivity": 399,
  "Software Development": 499,
  "Cloud, DevOps & Infrastructure": 599,
  "Digital Marketing & Growth": 499,
  "Cybersecurity": 499,
  "Design & Creative": 599,
  "Finance, Accounting & Investing": 399,
  "Communication & Career Skills": 499,
  "Entrepreneurship & Freelancing": 399,
  "Test Prep & Study Skills": 399,
  "Content & Personal Branding": 499,
  "Foreign Languages": 699,
  "Health & Wellness": 499,
  "Digital Safety & Life Skills": 299,
  "University Programmes (BBA, BCA, MCA, MBA)": 299,
};

/**
 * Other fees set by the owner. They are saved as products but kept OFF sale: what each one unlocks (and which free pages, if any,
 * move behind it) is still to be decided, so nothing can be bought yet.
 */
export const EXAM_PRODUCTS: Array<{ sku: string; title: string; description: string; rupees: number }> = [
  { sku: "writing-studio", title: "Writing Clinic (Writing studio)", description: "Essay checks and writing practice.", rupees: 499 },
];

/**
 * Exam preparation, one product per exam (sku `course-exam-<key>`). Notes, chapter tests and mock tests open only for a buyer. `onSale: false` keeps an exam
 * on the page as "coming soon" until its material exists (GMAT has no lessons yet), with its price saved.
 */
export const EXAM_PREP: Array<{ key: string; slug: string; title: string; rupees: number; onSale: boolean; hub: string; blurb: string }> = [
  { key: "jee", slug: "exam-jee", title: "JEE (Main & Advanced) preparation", rupees: 999, onSale: true, hub: "jee", blurb: "Chapter notes, worked examples and chapter tests in Mathematics, Physics and Chemistry, plus a full JEE Main mock test." },
  { key: "neet", slug: "exam-neet", title: "NEET UG preparation", rupees: 999, onSale: true, hub: "neet", blurb: "Chapter notes, worked examples and chapter tests in Physics, Chemistry and Biology, plus a full NEET mock test." },
  { key: "upsc", slug: "exam-upsc", title: "UPSC Civil Services (Prelims) preparation", rupees: 1599, onSale: true, hub: "upsc-prelims", blurb: "Full-length General Studies Paper I and CSAT Paper II mock tests with worked explanations." },
  { key: "ssc-cgl", slug: "exam-ssc-cgl", title: "SSC CGL preparation", rupees: 899, onSale: true, hub: "ssc-cgl", blurb: "Quantitative Aptitude, Reasoning, English and General Awareness study material, plus Tier 1 and Tier 2 mock tests." },
  { key: "cat-quant", slug: "exam-cat-quant", title: "CAT Quantitative Aptitude preparation", rupees: 599, onSale: true, hub: "cat-quant", blurb: "Module-by-module Quantitative Aptitude notes, formulas, shortcuts and practice for CAT." },
  { key: "sat-math", slug: "exam-sat-math", title: "SAT Math preparation", rupees: 1299, onSale: true, hub: "sat", blurb: "Algebra, Advanced Math, Problem-Solving and Data Analysis, and Geometry and Trigonometry, with formulas, shortcuts and practice." },
  { key: "gre", slug: "exam-gre", title: "GRE Quantitative Reasoning preparation", rupees: 1599, onSale: true, hub: "gre-maths", blurb: "The full GRE Quant course: Arithmetic, Algebra, Geometry and Data Analysis, with practice." },
  { key: "gmat", slug: "exam-gmat", title: "GMAT Quantitative Reasoning preparation", rupees: 1599, onSale: false, hub: "gmat-maths", blurb: "GMAT Quantitative Reasoning study material. Coming soon." },
  { key: "ielts", slug: "exam-ielts", title: "IELTS preparation", rupees: 1299, onSale: true, hub: "ielts", blurb: "Reading and Writing lessons and strategies, plus Writing and Speaking practice tests. (The full Reading and Listening test sets are a separate product.)" },
  { key: "ap-calculus", slug: "exam-ap-calculus", title: "AP Calculus AB preparation", rupees: 1299, onSale: true, hub: "ap-calculus-ab", blurb: "Limits, differentiation and integration with notes, worked examples and chapter mock tests for AP Calculus AB." },
];

/** Maths Olympiad (IMO) is sold one class at a time: Class 1 to 5 Rs 499, Class 6 to 8 Rs 599, Class 9 to 12 Rs 799. Nothing in it is free. */
export const imoFeeRupees = (classNumber: number): number => (classNumber <= 5 ? 499 : classNumber <= 8 ? 599 : 799);
export const imoSlug = (classNumber: number): string => `imo-class-${classNumber}`;

/**
 * Studios sold as one course each. They are not in the course catalogue, but they are bought, entitled and refunded exactly like a catalogue course
 * (sku `course-<slug>`, kind `course`, see lib/pay/course-access.ts). The fee is the owner's to change in the console; seeding never overwrites it.
 * `onSale: false` saves the product and its price but keeps it off sale, as with EXAM_PRODUCTS.
 */
export const STUDIO_COURSES: Array<{ slug: string; title: string; description: string; rupees: number; onSale: boolean }> = [
  ...EXAM_PREP.map((e) => ({ slug: e.slug, title: e.title, description: e.blurb, rupees: e.rupees, onSale: e.onSale })),
  ...Array.from({ length: 12 }, (_, i) => ({
    slug: imoSlug(i + 1),
    title: `Class ${i + 1} Maths Olympiad (IMO)`,
    description: `Class ${i + 1} IMO preparation: every chapter with lessons, in-lesson checks and chapter tests, plus unlimited full-syllabus mock tests sectioned like the real olympiad, with worked explanations.`,
    rupees: imoFeeRupees(i + 1),
    onSale: true,
  })),
  {
    slug: "mathematics-speed-enhancement",
    title: "Mathematics Speed Enhancement Studio",
    description: "One continuous course in 15 levels (A to O) that builds speed and accuracy in mental calculation, with a placement check, timed practice and spaced review. Level A, Module 1 is free.",
    rupees: 699,
    onSale: true,
  },
  {
    slug: "ai-reading-studio",
    title: "English Reading Studio",
    description: "Skill-by-skill reading analysis, charts, a personalised 7-day plan, ten learning levels with mastery checks, delayed recall and timed reading. The starting assessment, overall score and Level A lesson are free.",
    rupees: 599,
    onSale: true,
  },
  {
    slug: "indian-competitive-reading",
    title: "Indian Competitive Exams Reading Tests",
    description: "30 essay-based reading comprehension tests for SSC, CDS, CAT, UPSC and CTET, with exam-style questions, explanations that quote the essay and full English Reading Studio analytics. Three tests are free.",
    rupees: 499,
    onSale: true,
  },
  {
    slug: "mathematics-studio",
    title: "Mathematics Studio",
    description: "One performance engine across every maths test you take on GrowQR (GRE Quant mocks, the Mathematics Speed studio and more): topic-by-topic mastery, evidence-based weakness detection, interactive charts, a personalised practice plan and your full history. A free summary stays open to everyone.",
    rupees: 599,
    onSale: true,
  },
  {
    slug: "english-writing-studio",
    title: "English Writing Studio",
    description: "Exam writing practice for IELTS, SAT, GRE and GMAT: timed prompts, an instant score on every criterion and unlimited essay checks. A free taste of 2 checks a month stays open to everyone.",
    rupees: 499,
    onSale: true,
  },
  {
    slug: "vedic-mathematics",
    title: "Vedic Mathematics & Speed Calculation",
    description: "30 modules in three levels: mental arithmetic, the 16 Sutras and 13 Sub-Sutras, with worked examples, practice and test banks, in English and Hindi. Module 1 is free. Pro, Silver and Gold plans open the whole course too.",
    rupees: 799,
    onSale: true,
  },
  {
    slug: "ielts-practice-tests",
    title: "IELTS Practice Tests: Reading and Listening",
    description: "All 30 full-length IELTS Reading tests and all 30 Listening tests, timed and marked on the server with an indicative band and an explanation for every answer. The first 3 tests of each stay free.",
    rupees: 1599,
    onSale: true,
  },
];

/**
 * Services delivered by GrowQR staff, sold one at a time (sku `service-<key>`, kind `consulting`, so a purchase alerts staff, see lib/pay/fulfil.ts).
 * Silver and Gold include some of them (lib/market/plan-services.ts); the fee here is what one costs on its own.
 */
export const SERVICE_PRODUCTS: Array<{ key: string; title: string; description: string; rupees: number }> = [
  { key: "career-counselling", title: "Career counselling session (30 minutes, online)", description: "A 1:1 online session with an expert on your career direction, course and skill choices, or to clear academic doubts.", rupees: 799 },
  { key: "overseas-counselling", title: "Overseas education counselling (1:1 session)", description: "A 1:1 session on country and university choice, admission requirements, budget and scholarships, and your application plan.", rupees: 1499 },
  { key: "resume-review", title: "Expert resume review", description: "An expert reviews your resume and sends back specific changes.", rupees: 999 },
  { key: "mock-visa-interview", title: "Mock visa interview", description: "A practice visa interview with an expert and feedback on your answers.", rupees: 799 },
  { key: "expert-shortlist", title: "Overseas universities shortlist by experts", description: "A shortlist of overseas universities chosen by our experts to fit your documents and qualifications. For registered students.", rupees: 2499 },
];

/** Resume Studio Pro, sold on its own once (sku `resume-studio-pro`) and opened by any paid plan while it is active. */
export const RESUME_STUDIO_PRO_RUPEES = 199;
