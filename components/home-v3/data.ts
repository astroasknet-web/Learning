/**
 * Homepage v3 content. Every href points at a route that exists in this repo,
 * or at mathstudy.in for e-books. The verticals are the six from the brief.
 */
import type { LucideIcon } from "lucide-react";
import { BookOpen, Briefcase, Calculator, FileText, GraduationCap, Globe2, PenLine, Video } from "lucide-react";
import { CLASSROOM_URL } from "@/lib/links";

export type VerticalKey = "internships" | "resume" | "courses" | "abroad" | "classes" | "ebooks" | "math" | "writing";

export type Vertical = {
  key: VerticalKey;
  name: string;
  headline: string;
  blurb: string;
  cta: string;
  href: string;
  external?: boolean;
  icon: LucideIcon;
};

export const EBOOKS_URL = "https://mathstudy.in/";

export const APP_SIGNUP_URL = "https://app.growqr.ai/signup";

/**
 * Portal pages (Resume Studio, internships, courses, study abroad) need DATABASE_URL on the server.
 * While that is not connected, every portal link goes to the GrowQR app sign-up. Set to true to use the real routes.
 */
export const PORTAL_READY = true;
export const portal = (href: string): string => (PORTAL_READY ? href : APP_SIGNUP_URL);

export const VERTICALS: Vertical[] = [
  { key: "internships", name: "Internships", headline: "Turn knowledge into real-world experience.", blurb: "Verified employers, no application fees, and every stage of your application in one place.", cta: "Explore Internships", href: portal("/internships"), icon: Briefcase },
  { key: "resume", name: "Resume Studio", headline: "Create a resume that opens doors.", blurb: "Pick a template, edit it with live scoring, and export a clean, ATS-aware resume.", cta: "Build My Resume", href: portal("/studio"), icon: FileText },
  { key: "courses", name: "Courses", headline: "Learn skills that move your career forward.", blurb: "Skill-based courses and career paths, with lessons, checks and progress tracking.", cta: "Explore Courses", href: portal("/courses"), icon: GraduationCap },
  { key: "abroad", name: "Overseas Education", headline: "Turn your international study ambitions into a plan.", blurb: "Compare destinations and universities, understand requirements and prepare your application.", cta: "Explore Study Abroad", href: portal("/study-abroad"), icon: Globe2 },
  { key: "classes", name: "Online Classes", headline: "Learn live, interact, and grow with expert guidance.", blurb: "Live classes with verified teachers, plus homework, quizzes and progress tracking.", cta: "Find Your Classes", href: CLASSROOM_URL, external: true, icon: Video },
  { key: "math", name: "Math Speed Enhancement Studio", headline: "Get faster and more accurate at calculation.", blurb: "One course in 15 levels with a placement check, timed practice and daily review. Level A, Module 1 is free.", cta: "Try Math Speed Studio", href: "/math-speed", icon: Calculator },
  { key: "writing", name: "English Writing Studio", headline: "Practise IELTS, SAT, GRE and GMAT writing.", blurb: "Write against the clock and get an instant score on every criterion, with exam-style prompts. Start free.", cta: "Open Writing Studio", href: "/writing-clinic", icon: PenLine },
  { key: "ebooks", name: "E-Books", headline: "Your next breakthrough could be one chapter away.", blurb: "Study guides and learning resources from our MathStudy library.", cta: "Explore E-Books", href: EBOOKS_URL, external: true, icon: BookOpen },
];

export type Goal = { id: string; label: string; vertical: VerticalKey; title: string; why: string; steps: string[]; cta: string; href: string; external?: boolean };

/** Rules-based guide. Each goal maps to one recommended route, so there is no model behind it and it is labelled that way. */
export const GOALS: Goal[] = [
  { id: "abroad", label: "I want to study abroad", vertical: "abroad", title: "Start with the destination map", why: "Compare countries and universities first, then build your application documents.", steps: ["Pick a country and shortlist universities", "Check admission requirements", "Prepare your resume and documents"], cta: "Start My Study Abroad Journey", href: portal("/study-abroad") },
  { id: "resume", label: "I want to build my resume", vertical: "resume", title: "Open Resume Studio", why: "Choose a template, edit with live scoring, and export when it reads well.", steps: ["Choose a template", "Fill in your experience", "Check the score and export"], cta: "Create Your Resume", href: portal("/studio") },
  { id: "intern", label: "I want an internship", vertical: "internships", title: "Browse verified internships", why: "Roles come from verified employers with no application fees.", steps: ["Browse and filter roles", "Strengthen your resume if needed", "Apply and track each stage"], cta: "Find Your Next Opportunity", href: portal("/internships") },
  { id: "skill", label: "I want to learn a new skill", vertical: "courses", title: "Find a course or career path", why: "Courses give you structured lessons and checks you can complete at your pace.", steps: ["Choose a field", "Start a course", "Add the skill to your resume"], cta: "Explore Learning", href: portal("/courses") },
  { id: "classes", label: "I need online classes", vertical: "classes", title: "Open the live classroom", why: "Join live classes with verified teachers, with homework and progress tracking.", steps: ["Browse courses and teachers", "Enrol", "Join live"], cta: "Find Your Classes", href: CLASSROOM_URL, external: true },
  { id: "ebooks", label: "I want study materials and e-books", vertical: "ebooks", title: "Open the MathStudy library", why: "Study guides and learning resources, available on MathStudy.", steps: ["Browse the library", "Pick your subject", "Study at your pace"], cta: "Explore the Library", href: EBOOKS_URL, external: true },
];

export const LIBRARY_TOPICS = ["Exam preparation", "Academic references", "Professional development", "Study guides"] as const;
