/**
 * The site navigation: one list of menus, grouped by what a visitor is trying to do (learn, build a career, study abroad, find help, or buy for a team).
 * Every link here is a page that exists in this application (a test checks that each internal link resolves to a route, and that field keys and country
 * slugs are real). Nothing is listed that is not built, and no figure (counts, prices) is written into a label, so a label can never go out of date.
 */
import { CLASSROOM_URL } from "@/lib/links";
import { personas } from "@/lib/personas";
import { COUNTRIES, RESUME_SCORE_URL, SCORE_URL, AGENT } from "./data";

export type IconKey =
  | "qr" | "passport" | "bot" | "studio" | "briefcase" | "gig" | "tracker" | "rocket" | "book" | "path" | "ebook"
  | "globe" | "shield" | "student" | "pro" | "coach" | "free" | "startup" | "recruit" | "enterprise" | "institute"
  | "experts" | "events" | "community" | "blog" | "about" | "contact" | "vision" | "post" | "spark" | "money" | "doc" | "help" | "mic";

export type NavLink = {
  label: string;
  desc?: string;
  href: string;
  icon: IconKey;
  external?: boolean;
  badge?: string;
  /** The page needs a signed-in account: a guest is sent to log in first, and the menu says so. */
  account?: boolean;
};
export type NavGroup = { title: string; links: NavLink[]; /** Shown as compact chips instead of rows. */ chips?: boolean; /** Rows for the first N links, chips for the rest (a main link followed by shortcuts). */ chipsFrom?: number };
export type NavMenu = { id: "learn" | "careers" | "abroad" | "resources" | "solutions"; label: string; groups: NavGroup[]; footer?: NavLink };

const PERSONA_ICON: Record<string, IconKey> = { students: "student", professionals: "pro", coaches: "coach", freelancers: "free", startups: "startup", recruiters: "recruit", enterprises: "enterprise", institutes: "institute" };
const PERSONA_DESC: Record<string, string> = {
  students: "Show what fits, before graduation",
  professionals: "A role that fits who you are",
  coaches: "Grow your practice with agents",
  freelancers: "Win better clients and gigs",
  startups: "Build the founding team faster",
  recruiters: "Shortlist on proof, not adjectives",
  enterprises: "Workforce intelligence at scale",
  institutes: "Place more students, prove outcomes",
};
const persona = (type: "individual" | "enterprise"): NavLink[] => personas.filter((p) => p.type === type).map((p) => ({ label: p.navLabel, desc: PERSONA_DESC[p.id], href: p.link, icon: PERSONA_ICON[p.id] ?? "student" }));

/** Fields shown as shortcuts in Learn. `cat` is the category key in lib/market/data/courses.json. */
export const FIELD_SHORTCUTS: Array<{ label: string; cat: string }> = [
  { label: "AI & Machine Learning", cat: "ai" },
  { label: "Data & Analytics", cat: "data" },
  { label: "Software Development", cat: "dev" },
  { label: "Cloud & DevOps", cat: "cloud" },
  { label: "Cybersecurity", cat: "cyber" },
  { label: "Design & Creative", cat: "design" },
  { label: "Digital Marketing", cat: "marketing" },
  { label: "Blockchain & Web3", cat: "blockchain" },
];

export const ABROAD_COUNTRIES = COUNTRIES.map((c) => ({ label: c.name, slug: c.name.toLowerCase() }));

export const MENUS: NavMenu[] = [
  {
    id: "learn",
    label: "Learn",
    groups: [
      {
        title: "Courses",
        chipsFrom: 1,
        links: [
          { label: "All courses", desc: "Self-paced, with a hands-on project, certificate and badge", href: "/courses", icon: "book" },
          ...FIELD_SHORTCUTS.map((f) => ({ label: f.label, href: `/courses?cat=${f.cat}`, icon: "book" as IconKey })),
        ],
      },
      {
        title: "Studios",
        links: [
          { label: "Maths Speed Studio", desc: "15 levels of faster, more accurate calculation", href: "/math-speed", icon: "spark", badge: "Free placement check" },
          { label: "Vedic Mathematics", desc: "30 modules of mental-maths shortcuts, in English and Hindi", href: "/vedic-math", icon: "book", badge: "Module 1 free" },
          { label: "English Writing Studio", desc: "IELTS, SAT, GRE and GMAT writing, scored instantly", href: "/writing-clinic", icon: "studio", badge: "Free checks" },
        ],
      },
      {
        title: "Exams and practice",
        links: [
          { label: "Exam preparation", desc: "JEE, NEET, UPSC, SSC, CAT, SAT, GRE, IELTS and more", href: "/exam-prep", icon: "path" },
          { label: "Practice tests", desc: "IELTS and GRE, marked instantly", href: "/practice-tests", icon: "tracker" },
          { label: "IELTS", desc: "Reading, listening, writing and speaking", href: "/ielts", icon: "globe" },
          { label: "School, Class 1 to 12", desc: "Chapters and tests by class", href: "/school", icon: "student" },
          { label: "Maths Olympiad", desc: "IMO practice", href: "/olympiad/imo", icon: "spark" },
          { label: "Online classes", desc: "Live classes with verified teachers", href: CLASSROOM_URL, icon: "path", external: true },
          { label: "E-books", desc: "Study guides on MathStudy.in", href: "https://mathstudy.in/", icon: "ebook", external: true },
        ],
      },
    ],
    footer: { label: "Compare plans", desc: "Courses, studios and expert help from Free upward", href: "/pricing", icon: "money" },
  },
  {
    id: "careers",
    label: "Careers",
    groups: [
      {
        title: "Opportunities",
        links: [
          { label: "Internships", desc: "Verified employers, no application fees", href: SCORE_URL, icon: "briefcase", badge: "Verified" },
          { label: "Application tracker", desc: "See every stage and employer response", href: "/applications", icon: "tracker", account: true },
          { label: "GrowQR Internship", desc: "Join the GrowQR team as an intern", href: "/growqr-internship", icon: "rocket" },
        ],
      },
      {
        title: "Resume and profile",
        links: [
          { label: "QR Score", desc: "A free resume score out of 100 in seconds", href: RESUME_SCORE_URL, icon: "qr", badge: "Free" },
          { label: "Resume Studio", desc: "Rebuild your resume from a template, with live scoring", href: "/studio", icon: "studio", account: true },
          { label: "Skill Passport", desc: "Scored, proctored proof any employer can scan", href: "/passport", icon: "passport", account: true },
        ],
      },
      {
        title: "Practice and guidance",
        links: [
          { label: "Interview practice", desc: "Mock interviews with instant feedback", href: "/ai-interviewer", icon: "mic" },
          { label: "Roleplay coach", desc: "Rehearse hard conversations", href: "/ai-roleplay-coach", icon: "coach" },
          { label: "Resume expert", desc: "Line-by-line resume feedback", href: "/ai-resume-expert", icon: "doc" },
          { label: "All AI agents", desc: "Specialised agents with human experts in the loop", href: "/agents", icon: "bot" },
          { label: "Expert sessions", desc: "Book a human expert", href: "/experts", icon: "experts" },
        ],
      },
    ],
    footer: { label: "Get a free resume score", desc: "PDF, Word or pasted text. A grade and focus areas in seconds", href: RESUME_SCORE_URL, icon: "qr" },
  },
  {
    id: "abroad",
    label: "Study Abroad",
    groups: [
      {
        title: "Explore",
        links: [
          { label: "Find universities", desc: "Compare universities, costs and visas", href: "/study-abroad", icon: "globe" },
          { label: "Overseas packages", desc: "Expert help from shortlist to settling in", href: "/overseas-packages", icon: "spark", badge: "New" },
        ],
      },
      {
        title: "Countries",
        chips: true,
        links: ABROAD_COUNTRIES.map((c) => ({ label: c.label, href: `/study-abroad/${c.slug}`, icon: "globe" as IconKey })),
      },
      {
        title: "Plan your application",
        links: [
          { label: "Plan my application", desc: "Your profile, shortlist and next steps", href: "/abroad", icon: "path", account: true },
          { label: "University matches", desc: "Safe, target and reach universities for your profile", href: "/abroad/matches", icon: "institute", account: true },
          { label: "Scholarships and funds", desc: "What it costs and how to pay for it", href: "/abroad/funds", icon: "money", account: true },
          { label: "Documents", desc: "What to prepare, and your checklist", href: "/abroad/documents", icon: "doc", account: true },
          { label: "Visa guidance", desc: "Requirements and steps by country", href: "/abroad/visa", icon: "shield", account: true },
          { label: "Education loans", desc: "Compare loan options", href: "/abroad/loans", icon: "money", account: true },
          { label: "Visa interview practice", desc: "Rehearse the questions", href: "/abroad/interview", icon: "mic", account: true },
        ],
      },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    groups: [
      {
        title: "Learn from us",
        links: [
          { label: "Blog", desc: "Guides on careers, skills and study abroad", href: "/blog", icon: "blog" },
          { label: "Expert sessions", desc: "Book a human expert session", href: "/experts", icon: "experts" },
          { label: "Events", desc: "Workshops and live sessions", href: "/events", icon: "events" },
          { label: "Community", desc: "Learn alongside other ambitious people", href: "/community", icon: "community" },
        ],
      },
      {
        title: "Help and company",
        links: [
          { label: "Contact", desc: "Talk to the team", href: "/contact", icon: "contact" },
          { label: "Pricing", desc: "Free, Pro, Silver and Gold", href: "/pricing", icon: "money" },
          { label: "About", desc: "Who we are", href: "/about", icon: "about" },
          { label: "Vision", desc: "Where GrowQR is headed", href: "/vision", icon: "vision" },
        ],
      },
    ],
  },
  {
    id: "solutions",
    label: "Solutions",
    groups: [
      { title: "For individuals", links: persona("individual") },
      { title: "For organisations", links: persona("enterprise") },
      { title: "Hiring", links: [{ label: "Post a role", desc: "Reach screened, scored candidates", href: "/employer/post", icon: "post", account: true }, { label: "Enterprise", desc: "Autonomous HR and workforce intelligence", href: "/enterprise", icon: "enterprise" }] },
    ],
  },
];

/** Support sits beside the search bar in the header (and at the top of the phone menu), not inside a menu. */
export const SUPPORT_LINK: NavLink = { label: "Support", desc: "Raise a ticket and track the reply", href: "/support", icon: "help" };

export const AGENT_LIST = (Object.keys(AGENT) as (keyof typeof AGENT)[]).map((k) => ({ key: k, ...AGENT[k] }));

/** Every link in the menus, flat. */
export const ALL_LINKS: Array<NavLink & { menu: string }> = MENUS.flatMap((m) => m.groups.flatMap((g) => g.links.map((l) => ({ ...l, menu: m.label }))));

/** The command palette's own entries: the pages above (once each), and Study in <country>. Courses are searched live from the catalogue. */
export type Hit = { label: string; sub: string; href: string; external?: boolean; group: string; icon: IconKey };
export const INDEX: Hit[] = (() => {
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const l of ALL_LINKS) {
    if (seen.has(l.href) || l.href.startsWith("/courses?cat=") || l.href.startsWith("/study-abroad/")) continue; // fields and countries get their own entries below
    seen.add(l.href);
    out.push({ label: l.label, sub: l.desc ?? "", href: l.href, external: l.external, group: l.menu, icon: l.icon });
  }
  out.push({ label: SUPPORT_LINK.label, sub: SUPPORT_LINK.desc ?? "", href: SUPPORT_LINK.href, group: "Help", icon: SUPPORT_LINK.icon });
  for (const c of ABROAD_COUNTRIES) out.push({ label: `Study in ${c.label}`, sub: "Universities, costs and visas", href: `/study-abroad/${c.slug}`, group: "Study Abroad", icon: "globe" });
  for (const f of FIELD_SHORTCUTS) out.push({ label: `${f.label} courses`, sub: "Browse the field", href: `/courses?cat=${f.cat}`, group: "Learn", icon: "book" });
  return out;
})();

/** Where each role goes first after signing in, and which of the account-menu links it may see. Navigation hides links, the server still decides access. */
export const ACCOUNT_LINKS: Record<string, NavLink[]> = {
  student: [
    { label: "My learning", href: "/my-courses", icon: "book" },
    { label: "Dashboard", href: "/account", icon: "student" },
    { label: "Skill Passport", href: "/passport", icon: "passport" },
    { label: "Billing", href: "/billing", icon: "money" },
    { label: "Support", href: "/support", icon: "help" },
  ],
  employer: [{ label: "Dashboard", href: "/employer", icon: "briefcase" }, { label: "Post a role", href: "/employer/post", icon: "post" }, { label: "Support", href: "/support", icon: "help" }],
  teacher: [{ label: "Dashboard", href: "/teacher", icon: "student" }, { label: "Support", href: "/support", icon: "help" }],
  parent: [{ label: "Dashboard", href: "/parent", icon: "student" }, { label: "Support", href: "/support", icon: "help" }],
  // Staff accounts get their account page only: no admin or console links are ever put in the public menu.
  admin: [{ label: "My account", href: "/account", icon: "student" }],
  counselor: [{ label: "My account", href: "/account", icon: "student" }],
};
