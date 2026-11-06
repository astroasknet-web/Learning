import { STANDARD_LEGAL } from "@/components/standard-footer/defaults";
import type { FooterConfig } from "@/components/standard-footer/types";
import { SITE_URL } from "@/lib/seo";

/**
 * Footer settings for Yugty Learning. The layout is the standard footer used by every Yugty web application
 * (components/standard-footer); only the values below are specific to this app.
 *
 * The app family panel lists all six Yugty sites (home, AI, Overseas, Learning, Jobs, Technology). Override a URL with NEXT_PUBLIC_APP_URL_HOME, _AI, _OVERSEAS, _LEARNING, _JOBS or _TECHNOLOGY.
 */
const env = (k: string) => (process.env[k] ?? "").trim();

export const FOOTER: FooterConfig = {
  brand: { name: "Yugty Learning", logoSrc: "/yugty-logo.svg", logoAlt: "Yugty Learning", tagline: "Courses, exam preparation, practice studios and live classes, with progress you can see." },
  siteUrl: SITE_URL,
  cta: {
    eyebrow: "Learn. Practise. Progress.",
    title: "Learn something that changes everything.",
    text: "Courses, exam preparation, practice studios and live classes that work together. Start free, no card needed.",
    primary: { label: "Browse courses", href: "/courses" },
    secondary: { label: "Exam preparation", href: "/exam-prep" },
    tertiary: { label: "See plans", href: "/pricing" },
  },
  appsTitle: "One family. One account.",
  apps: [
    { key: "home", name: "Yugti", href: env("NEXT_PUBLIC_APP_URL_HOME") || "https://yugti.com", icon: "Home", external: true },
    { key: "ai", name: "Yugti AI", href: env("NEXT_PUBLIC_APP_URL_AI") || "https://yugti.ai", icon: "Sparkles", external: true },
    { key: "overseas", name: "Overseas Education", href: env("NEXT_PUBLIC_APP_URL_OVERSEAS") || "https://yugtioverseaseducation.com", icon: "Globe", external: true },
    { key: "learning", name: "Learning", href: "/", icon: "GraduationCap" },
    { key: "jobs", name: "Jobs", href: env("NEXT_PUBLIC_APP_URL_JOBS") || "https://yugtijobs.com", icon: "Briefcase", external: true },
    { key: "technology", name: "Technology", href: env("NEXT_PUBLIC_APP_URL_TECHNOLOGY") || "https://yugtitechnology.com", icon: "Code2", external: true },
  ],
  newsletter: { label: "Get news and updates", button: "Join", endpoint: "/api/newsletter", source: "footer" },
  columns: [
    { title: "Learn", links: [
      { href: "/courses", label: "All courses" },
      { href: "/exam-prep", label: "Exam preparation" },
      { href: "/school", label: "School classes" },
      { href: "/vedic-math", label: "Vedic Mathematics" },
      { href: "/olympiad/imo", label: "Maths Olympiad (IMO)" },
    ] },
    { title: "Practise", links: [
      { href: "/math-speed", label: "Math Speed Studio" },
      { href: "/math-studio", label: "Mathematics Studio" },
      { href: "/reading-studio", label: "English Reading Studio" },
      { href: "/writing-clinic", label: "English Writing Studio" },
      { href: "/practice-tests", label: "Practice tests" },
    ] },
    { title: "Classroom", links: [
      { href: "/my-courses", label: "My courses" },
      { href: "/my-classes", label: "My classes" },
      { href: "/teacher", label: "For teachers" },
      { href: "/parent", label: "For parents" },
      { href: "/login", label: "Student login" },
    ] },
    { title: "Company", links: [
      { href: "/support", label: "Support" },
      { href: "/contact", label: "Contact us" },
      { href: "/pricing", label: "Plans and pricing" },
      { href: "/signup", label: "Create an account" },
    ] },
  ],
  // Add the real Yugty accounts here; icons only show when a URL is set.
  social: [
    { label: "LinkedIn", href: "", icon: "linkedin" },
    { label: "X", href: "", icon: "x" },
    { label: "Instagram", href: "", icon: "instagram" },
    { label: "YouTube", href: "", icon: "youtube" },
    { label: "Facebook", href: "", icon: "facebook" },
  ],
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "hello@yourdomain.com",
  share: { title: "Know someone who should try Yugty Learning?", text: "Yugty Learning: courses, exam prep and practice studios for students", subject: "Have a look at Yugty Learning" },
  // The Editorial Policy page is part of the standard footer; add it here once this app publishes one.
  legal: STANDARD_LEGAL.filter((l) => l.href !== "/editorial-policy"),
};
