/**
 * YugtyLearning home page content. Course names, counts and categories come from the real catalogue file (lib/market/data/courses.json).
 * The "mission" animation uses illustrative sample scores, labelled as such on the page.
 */
export const BRAND = { name: "YugtyLearning", tagline: "Learn it. Practise it. Prove it." };

export type Item = { name: string; text: string; href: string };

export const STUDIOS: (Item & { size: "l" | "m" | "s"; tag: string })[] = [
  { name: "Courses", text: "Self-paced courses in data, AI, software, design, marketing and more, each with a project and a certificate.", href: "/courses", size: "l", tag: "COURSES" },
  { name: "Maths Speed Studio", text: "15 levels with a placement check, timed practice and daily review.", href: "/math-speed", size: "l", tag: "15 LEVELS" },
  { name: "Mathematics Studio", text: "One analytics engine across GRE, JEE, IMO and more.", href: "/math-studio", size: "m", tag: "ANALYTICS" },
  { name: "English Reading Studio", text: "Skill-by-skill reading analysis, charts and levels.", href: "/reading-studio", size: "m", tag: "READING" },
  { name: "English Writing Studio", text: "IELTS, SAT, GRE and GMAT writing, scored instantly.", href: "/writing-clinic", size: "m", tag: "WRITING" },
  { name: "Vedic Mathematics", text: "30 modules of mental-maths shortcuts, in English and Hindi.", href: "/vedic-math", size: "m", tag: "30 MODULES" },
  { name: "Maths Olympiad (IMO)", text: "Classes 1 to 12, with chapter tests and full mock tests.", href: "/olympiad/imo", size: "s", tag: "IMO" },
  { name: "Practice tests", text: "IELTS and GRE, timed and marked instantly.", href: "/practice-tests", size: "s", tag: "TIMED" },
  { name: "School, Class 1 to 12", text: "Chapters and tests, class by class.", href: "/school", size: "s", tag: "K-12" },
  { name: "Online classes", text: "Live classes with verified teachers. Join and follow your classes in one place.", href: "/my-classes", size: "s", tag: "LIVE" },
  { name: "Exam preparation", text: "Structured preparation tracks and mock tests for the exams that matter.", href: "/exam-prep", size: "s", tag: "EXAMS" },
];

export const EXAMS = ["JEE", "NEET", "UPSC", "SSC", "CAT", "SAT", "GRE", "GMAT", "IELTS"];

/** Career paths: ordered course slugs from the catalogue (see lib/market/courses.ts PATHS). */
export const PATHS: { title: string; tag: string; slugs: string[] }[] = [
  { title: "Data Analyst", tag: "Turn numbers into decisions", slugs: ["basic-microsoft-excel", "sql-for-data-business", "data-analytics-python-sql", "business-analytics-power-bi"] },
  { title: "Web Developer", tag: "Build and ship real products", slugs: ["git-github", "front-end-development", "api-development", "dsa-for-interviews"] },
  { title: "AI Engineer", tag: "From Python to generative AI", slugs: ["python-foundations", "machine-learning-python", "deep-learning-neural-networks", "generative-ai-llm-development"] },
  { title: "UI/UX Designer", tag: "Design products people love", slugs: ["graphic-design-canva", "ui-ux-design-figma", "photoshop-illustrator"] },
  { title: "Digital Marketer", tag: "Grow audiences and revenue", slugs: ["digital-marketing-foundations", "seo", "performance-marketing-ads", "social-media-marketing"] },
  { title: "Interview Ready", tag: "Communicate and get hired", slugs: ["spoken-english", "business-communication", "corporate-readiness-interview"] },
];

export const FEATURED = ["python-foundations", "front-end-development", "data-analytics-python-sql", "ui-ux-design-figma", "prompt-engineering", "corporate-readiness-interview"];

export const QUICK = ["Python", "Excel", "Data analytics", "IELTS", "Spoken English", "UI/UX"];

export const FAQS: [string, string][] = [
  ["Do I need to pay to start?", "No. The Free plan needs no card, and you can explore the courses and get your free resume score."],
  ["Which exams can I prepare for?", "JEE, NEET, UPSC, SSC, CAT, SAT, GRE, GMAT and IELTS, with practice tests."],
  ["Is there live teaching?", "Yes. Online classes are taught live by verified teachers, and you follow them from My classes."],
  ["Can parents and teachers use it too?", "Yes. Teachers manage classrooms and parents see their child's progress, each from their own account."],
];

export type LearnGoal = {
  id: string;
  label: string;
  metric: string;
  start: number;
  end: number;
  decimals: number;
  suffix: string;
  sections: [string, string, string, string];
  doors: [string, string, string];
};

/** The score scales are the real ones (IELTS band 0 to 9, GRE 260 to 340, GMAT Focus 205 to 805, CAT percentile). Start and end values are illustrative. */
export const LEARN_GOALS: LearnGoal[] = [
  { id: "ielts", label: "IELTS", metric: "BAND", start: 5.5, end: 7.5, decimals: 1, suffix: "", sections: ["Listening", "Reading", "Writing", "Speaking"], doors: ["Study abroad", "Visa-ready English", "Global careers"] },
  { id: "gre", label: "GRE", metric: "SCORE", start: 292, end: 321, decimals: 0, suffix: "", sections: ["Verbal", "Quantitative", "Analytical writing", "Full mock test"], doors: ["Graduate school", "Scholarships", "Global research"] },
  { id: "gmat", label: "GMAT", metric: "SCORE", start: 545, end: 665, decimals: 0, suffix: "", sections: ["Quantitative", "Verbal", "Data insights", "Full mock test"], doors: ["MBA applications", "Scholarships", "Leadership roles"] },
  { id: "cat", label: "CAT", metric: "PERCENTILE", start: 72, end: 96, decimals: 0, suffix: "", sections: ["Verbal and reading", "Data and logic", "Quantitative", "Full mock test"], doors: ["Top B-schools", "Interview ready", "Management careers"] },
  { id: "school", label: "School", metric: "MARKS", start: 54, end: 90, decimals: 0, suffix: "%", sections: ["Maths", "English", "Sciences", "Class tests"], doors: ["Better marks", "Entrance exams", "Study abroad"] },
  { id: "career", label: "Career", metric: "READINESS", start: 38, end: 91, decimals: 0, suffix: "", sections: ["Courses", "Tech skills", "AI interviews", "Portfolio"], doors: ["New skills", "Better roles", "Global opportunities"] },
];

export const LEARN_FUEL = ["Online courses", "Live classes", "E-books", "Mock tests"];
export const LEARN_LEGS: [number, number][] = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 1],
];
