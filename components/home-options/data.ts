/** Real content from qrscore.mathstudy.in + the site's own agent roster (lib/data.ts). */

export const SCORE_URL = "/internships";
export const RESUME_SCORE_URL = "/resume-score";

export const AGENT = {
  mira: { name: "RQ-Mira", role: "Resume Expert", image: "/agents/2.png", color: "#7F77DD" },
  sage: { name: "RQ-Sage", role: "Skill Trainer", image: "/agents/4.png", color: "#BA7517" },
  lyra: { name: "RQ-Lyra", role: "Learning Curator", image: "/agents/6.png", color: "#D85A30" },
  scout: { name: "RQ-Scout", role: "Opportunity Finder", image: "/agents/3.png", color: "#16A34A" },
  vera: { name: "RQ-Vera", role: "Interviewer", image: "/agents/1.png", color: "#D4537E" },
  kai: { name: "RQ-Kai", role: "Roleplay Coach", image: "/agents/7.png", color: "#378ADD" },
  nova: { name: "RQ-Nova", role: "Brand Builder", image: "/agents/5.png", color: "#525252" },
  atlas: { name: "RQ-Atlas", role: "Pathway Guide", image: "/agents/12.png", color: "#0D9488" },
} as const;
export type AgentKey = keyof typeof AGENT;

export type Internship = {
  id: string;
  title: string;
  company: string;
  place: string;
  remote: boolean;
  stipend: number;
  weeks: number;
  skills: string[];
  need: number; // QR Score at which the role is "unlocked"
  tone: string;
};

export const INTERNSHIPS: Internship[] = [
  { id: "ml", title: "Machine Learning Intern", company: "Synapse AI", place: "Remote", remote: true, stipend: 25000, weeks: 12, skills: ["Python", "scikit-learn", "Statistics", "Git"], need: 85, tone: "#7F77DD" },
  { id: "be", title: "Backend Developer Intern", company: "CodeForge Systems", place: "Hyderabad", remote: false, stipend: 22000, weeks: 16, skills: ["Node.js", "SQL", "REST APIs", "Git"], need: 80, tone: "#0D9488" },
  { id: "fe", title: "Frontend Developer Intern", company: "Northwind Labs", place: "Remote", remote: true, stipend: 18000, weeks: 12, skills: ["React", "CSS", "Git", "JavaScript"], need: 70, tone: "#378ADD" },
  { id: "me", title: "Mechanical Design Intern", company: "Vahan Motors", place: "Chennai", remote: false, stipend: 14000, weeks: 12, skills: ["SolidWorks", "CAD", "GD&T"], need: 60, tone: "#BA7517" },
  { id: "gd", title: "Graphic Design Intern", company: "Inkwell Studio", place: "Remote", remote: true, stipend: 9000, weeks: 8, skills: ["Photoshop", "Illustrator", "Branding"], need: 55, tone: "#D4537E" },
  { id: "cs", title: "Content & SEO Intern", company: "Bloom Media", place: "Remote", remote: true, stipend: 8000, weeks: 12, skills: ["Writing", "SEO", "Research"], need: 45, tone: "#16A34A" },
];

export const COUNTRIES = [
  { name: "USA", count: 9, city: "New York", lat: 40.7, lon: -74 },
  { name: "UK", count: 9, city: "London", lat: 51.5, lon: -0.1 },
  { name: "Canada", count: 8, city: "Toronto", lat: 43.7, lon: -79.4 },
  { name: "Germany", count: 8, city: "Berlin", lat: 52.5, lon: 13.4 },
  { name: "Australia", count: 8, city: "Sydney", lat: -33.9, lon: 151.2 },
  { name: "France", count: 9, city: "Paris", lat: 48.9, lon: 2.35 },
  { name: "UAE", count: 7, city: "Dubai", lat: 25.2, lon: 55.3 },
] as const;

export const PASSPORT = [
  { key: "Education", v: 57, note: "Google Data Analytics and Johns Hopkins Data Science, 2021" },
  { key: "Experience", v: 93, note: "Founder and developer, Vidaara.org (2023 to now)" },
  { key: "Skills", v: 93, note: "Node.js, MySQL, Flutter, LLM tooling" },
  { key: "Projects", v: 73, note: "Vidaara, Classroom, Ganak, Ankora and more" },
  { key: "Impact", v: 66, note: "66,000+ questions, 40+ students supported" },
] as const;

/** Coarse land mask: band top-latitude -> longitude spans. Used for the dotted globe. */
export const LAND: Record<number, [number, number][]> = {
  70: [[-120, -65], [-60, -20], [100, 115], [138, 150]],
  60: [[-168, -62], [-55, -22], [-24, -13], [5, 32], [32, 180], [-180, -169]],
  50: [[-165, -95], [-80, -55], [-10, 2], [5, 140], [156, 164]],
  40: [[-125, -52], [-9, 28], [36, 47], [54, 146]],
  30: [[-124, -76], [-10, 36], [36, 122], [126, 142]],
  20: [[-115, -97], [-90, -74], [-17, 122]],
  10: [[-100, -60], [-17, 51], [72, 92], [97, 109], [120, 127]],
  0: [[-80, -50], [-12, 42], [95, 105], [109, 119], [131, 150]],
  "-10": [[-80, -35], [9, 40], [100, 115], [140, 150]],
  "-20": [[-75, -38], [12, 40], [44, 50], [122, 146]],
  "-30": [[-70, -40], [14, 36], [43, 48], [114, 153]],
  "-40": [[-73, -55], [16, 32], [115, 152], [172, 178]],
  "-50": [[-75, -65], [166, 175], [144, 148]],
};
