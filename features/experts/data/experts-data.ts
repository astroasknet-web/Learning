/* ══════════════════════════════════════════════════════════════════════════
   Experts — shared expert data
   Used by both the Experts V2 listing page and the Expert Detail page.
   ══════════════════════════════════════════════════════════════════════════ */

import { personas } from "@/lib/personas";

/** Audience/expertise persona — one of the cards in the ProblemStatement
 *  "Different Ambitions" rail. Drives the "Expertise: …" badge on the
 *  detail page; the label is resolved from the shared `personas` list. */
export type PersonaId = (typeof personas)[number]["id"];

export interface WorkExperience {
  company: string;
  position: string;
  duration: string;
  achievements: string[];
}

export interface Education {
  degree: string;
  school?: string;
  year: string;
}

export interface Review {
  name: string;
  role: string;
  image: string;
  /** CSS object-position for the avatar crop (e.g. "center 20%"). Defaults to centered. */
  imagePosition?: string;
  rating: number;
  text: string;
}

export interface ExpertSocial {
  label: string;
  href: string;
  icon: "linkedin" | "twitter" | "website" | "dribbble" | "instagram" | "youtube" | "github";
}

export interface WhatYouGetItem {
  title: string;
  description: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

/** Countries an expert can be based in — drives the flag badge and the
 *  country filter on the listing page. Flag ids are @iconify/circle-flags. */
export const COUNTRIES = {
  IN: { name: "India", flag: "circle-flags:in" },
  US: { name: "United States", flag: "circle-flags:us" },
  RU: { name: "Russia", flag: "circle-flags:ru" },
} as const;
export type CountryCode = keyof typeof COUNTRIES;

/** Light gradient rendered behind every portrait. For transparent (cut-out)
 *  PNGs it provides a soft, enhancing colour shade; for photos that already
 *  carry their own background it sits underneath and is simply not visible.
 *  Per-expert overrides via `cardBg`. */
export const DEFAULT_EXPERT_SHADE =
  "bg-gradient-to-b from-zinc-100 to-zinc-200";

export interface Expert {
  slug: string;
  name: string;
  /** Home country — shown as a flag badge and used for country filtering. */
  country: CountryCode;
  /** City / region shown on the detail page next to the country flag.
   *  Falls back to the country name when omitted. */
  location?: string;
  /** Primary audience this expert serves — maps to a ProblemStatement
   *  persona card. Renders as the "Expertise: …" badge on the detail page. */
  persona?: PersonaId;
  displayName?: string;
  /** Expert's calendar/notification email. Falls back to the shared GrowQR account if omitted. */
  email?: string;
  role: string;
  tag: string;
  rqScore: number;
  image: string;
  cardBg?: string;
  /** CSS object-position for the portrait crop (e.g. "65% top"). Defaults to top. */
  imagePosition?: string;
  bio: string;
  headline: string;
  intro: string;
  verified: boolean;
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  sessionDuration: string;
  price: string;
  socials: ExpertSocial[];
  about: string;
  expertise: string[];
  skills: string[];
  education: Education[];
  workExperience: WorkExperience[];
  certifications?: string[];
  industries: string[];
  languages: string[];
  awards: string[];
  reviews: Review[];
  whatYouGet: WhatYouGetItem[];
  /** Per-expert FAQs. Falls back to the shared sessionFaqs when omitted. */
  faq?: FaqItem[];
  /** Hero highlight badge stats (3–4). Falls back to derived stats if omitted. */
  stats?: { value: string; label: string }[];
  /** AI agents (1–4) this expert contributes knowledge/guidance to. Values are
   *  agent `name`s resolved against the canonical roster in `lib/data` — so the
   *  avatar (pfp) and role always come from the single source of truth. Drives
   *  the "Supports" row on the detail page; the section hides when omitted. */
  supports?: string[];
  /** Organisations this expert has trained / worked with — shown as a trust band on the detail page. */
  trustedBy?: string[];
  /** Optional override for the trust-band label (defaults to "Trusted By"). */
  trustedByLabel?: string;
  /** When true, the expert is kept in the data (booking backend still works)
   *  but is hidden from all public listings, the sitemap, and static pages. */
  hidden?: boolean;
}

export const experts: Expert[] = [
  {
    slug: "ruchi-sharma",
    country: "IN",
    location: "Chandigarh, India",
    persona: "students",
    name: "Dr. Ruchi Sharma",
    email: "ruchi@growqr.ai",
    role: "Chief Academic Partnership Officer, GrowQR",
    tag: "Education & Career Mentor",
    stats: [
      { value: "10+", label: "Years in Acad." },
      { value: "30+", label: "Conf. Papers" },
      { value: "25+", label: "Books/Chapters" },
      { value: "3", label: "Patents" },
    ],
    rqScore: 96,
    supports: ["RQ-Sage", "RQ-Lyra", "RQ-Kai"],
    image: "/experts/portraits/ruchi.webp",
    bio: "Educator, researcher & mentor helping individuals navigate careers, leadership & communication.",
    headline: "Clarity, Confidence & Career One Conversation at a Time",
    intro:
      "An exclusive one-on-one space where academic insight, leadership experience, and communication expertise come together to help you navigate careers, education, and life with greater clarity, confidence, and purpose.",
    verified: true,
    yearsExperience: 10,
    rating: 4.9,
    reviewCount: 87,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/dr-ruchi-sharma-bb3aa216/", icon: "linkedin" },
      { label: "Instagram", href: "https://www.instagram.com/dr.ruchi15/", icon: "instagram" },
    ],
    about:
      "Dr. Ruchi Sharma is an educator, researcher, and communication strategist with 10+ years across higher education and academic leadership. Currently Chief Academic Partnership Officer at GrowQR and Asst. Professor (ODL) at Guru Nanak Dev University, she bridges intellectual inquiry with practical career outcomes through mentoring, research, and digital pedagogy.",
    expertise: [
      "Digital Humanities",
      "Career Mentoring",
      "Higher Education Leadership",
      "Professional Communication",
      "Academic Research & Publishing",
      "Curriculum Design",
    ],
    skills: [
      "Academic Partnership Development",
      "Curriculum Design",
      "Instructional Development",
      "Research Leadership",
      "Communication, Training & Capacity Building",
      "Educational Innovation",
    ],
    education: [
      {
        degree: "Ph.D. in English Literature: Narratives of Land and Nation (Alexis Wright)",
        school: "IIS University, Jaipur",
        year: "2021",
      },
      { degree: "M.A. English Literature (Gold Medalist)", school: "IIS University, Jaipur", year: "2013" },
      { degree: "B.A. English (Hons.)", school: "IIS University, Jaipur", year: "2010" },
      { degree: "Diploma in Mass Communication & Video Production", school: "IIS University, Jaipur", year: "2009" },
    ],
    workExperience: [
      {
        company: "GrowQR",
        position: "Chief Academic Partnership Officer",
        duration: "2025 – Present",
        achievements: [
          "Building academic alliances and AI-enabled career identity platforms across Indian institutions.",
        ],
      },
      {
        company: "Oceantrail Press",
        position: "Author & Illustrator",
        duration: "2025 – Present",
        achievements: [],
      },
      {
        company: "Guru Nanak Dev University, Amritsar",
        position: "Assistant Professor (ODL)",
        duration: "2025 – Present",
        achievements: [],
      },
      {
        company: "Guru Nanak Dev University, Amritsar",
        position: "Assistant Professor (Dept. of English)",
        duration: "2023 – 2025",
        achievements: [],
      },
      {
        company: "Chitkara University, H.P.",
        position: "Asst. Professor & Sr. Manager, Intl. Affairs",
        duration: "2021 – 2023",
        achievements: [],
      },
      {
        company: "Chitkara University, Punjab",
        position: "Assistant Professor",
        duration: "2019 – 2021",
        achievements: [],
      },
      {
        company: "St. Xavier's College, Jaipur",
        position: "Assistant Professor",
        duration: "2014 – 2019",
        achievements: [],
      },
      {
        company: "IIS University · A3LOGICS · SEO Nexpider",
        position: "Visiting Faculty & Industry Roles",
        duration: "2009 – 2014",
        achievements: [],
      },
    ],
    certifications: [
      "Innovation Ambassador – MIC / AICTE",
      "Cambridge BEC (Cambridge ESOL)",
      "Digital Humanities – Leiden University",
      "Faculty Development – NEP 2020 & OBE",
    ],
    industries: [
      "Higher Education",
      "EdTech & AI Learning",
      "Career Development",
      "Cultural Heritage",
      "Research & Publishing",
      "International Education",
    ],
    languages: ["English", "Hindi"],
    awards: [
      "Women Icon Award – India Prime, 2022",
      "Researcher of the Year – IIS University, Jaipur, 2013–14",
      "Gold Medal – M.A. English Literature, IIS University, 2012–13",
      "Best Paper Award – Jaipur Engineering College & Research Centre, 2016",
    ],
    reviews: [
      {
        name: "Bhuvin Singla",
        role: "Software Analyst · SmartData Enterprises",
        image: "/experts/testimonials/bhuvin.webp",
        rating: 5,
        text: "Dr. Sharma helped me cut through the noise and map a clear career path. Her guidance was practical, honest, and exactly what I needed to move forward with confidence.",
      },
      {
        name: "Bhavani Singh",
        role: "Teaching Assistant · Woxsen University",
        image: "/experts/testimonials/bhavani.webp",
        rating: 5,
        text: "Her mentorship reshaped how I approach teaching and research. The session gave me clarity, structure, and renewed motivation for my academic journey.",
      },
      {
        name: "Dr. Tulika Anand",
        role: "Assistant Professor · Guru Nanak University",
        image: "/experts/testimonials/tulika.webp",
        rating: 5,
        text: "A genuinely insightful session. Dr. Sharma's advice on research and publishing was specific and actionable. I left with a concrete plan and real direction.",
      },
    ],
    whatYouGet: [
      { title: "Career Clarity", description: "A concrete roadmap aligned to your strengths and goals." },
      { title: "Research Direction", description: "Guidance on academic writing, publishing, and scholarly positioning." },
      { title: "Leadership Insight", description: "Strategies to communicate and lead with confidence." },
      { title: "Personal Branding", description: "Craft your professional identity for maximum impact." },
      { title: "Higher Ed Navigation", description: "Expert advice on admissions, PhD journeys, and academic careers." },
      { title: "Actionable Next Steps", description: "Leave every session with a clear, practical plan." },
    ],
    faq: [
      {
        q: "Who is this session for?",
        a: "Students, research scholars, educators, early-career professionals, and emerging leaders seeking guidance on academic growth, career transitions, leadership, communication, personal branding, and professional decision-making, and anyone curious about Digital Humanities and interdisciplinary career paths.",
      },
      {
        q: "How should I prepare?",
        a: "Reflect on your goals, current challenges, and what you wish to achieve. Bring your résumé, LinkedIn profile, or research proposal if relevant. The clearer your aspirations, the more actionable the guidance.",
      },
      {
        q: "What outcomes can I expect?",
        a: "Clarity, direction, and renewed confidence: a concrete action plan, fresh perspectives, and practical next steps tailored to your academic, professional, or personal journey.",
      },
    ],
  },
  {
    slug: "amandeep-singh-bhateja",
    country: "IN",
    location: "Rajasthan, India",
    persona: "coaches",
    name: "Amandeep Singh Bhateja",
    displayName: "Amandeep Singh",
    email: "amandeep.singh@growqr.ai",
    role: "Director – Business Growth & Global Academic Alliances",
    tag: "NLP Trainer & Life Coach",
    stats: [
      { value: "10+", label: "Years Exp." },
      { value: "200+", label: "People Coached" },
      { value: "5+", label: "Countries" },
      { value: "99%", label: "MBA (Leadership)" },
    ],
    rqScore: 92,
    supports: ["RQ-Kai", "RQ-Sage", "RQ-Nova"],
    trustedBy: ["Mahindra", "Nagarro", "Sishutirth Shantiniketan"],
    trustedByLabel: "Collaborated With",
    image: "/experts/portraits/aman.webp",
    bio: "NLP Trainer, Life Coach & Hypnotist. 200+ people coached. One mission: meaningful, lasting change.",
    headline: "Decode Yourself. Design Your Life.",
    intro:
      "Most people aren't stuck because of circumstances. They're stuck in patterns. You don't need more information; you need a shift. Using NLP and EI refined across 200+ sessions, we'll find what's holding you back and build a path.",
    verified: true,
    yearsExperience: 10,
    rating: 4.9,
    reviewCount: 200,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://linkedin.com/in/amandeepsinghbhateja", icon: "linkedin" },
    ],
    about:
      "From DR Congo boardrooms to Berlin classrooms, Amandeep has spent 10+ years helping people rewire how they think and act. Accredited NLP Trainer, Life Coach, and Hypnotist, now building the future of career identity at GrowQR.",
    expertise: [
      "NLP & Behavioral Coaching",
      "Emotional Intelligence",
      "Career Counselling",
      "Academic Partnerships",
      "Leadership Development",
      "Communication Training",
    ],
    skills: [
      "NLP Techniques & Hypnosis",
      "Psychometric & EI Assessment",
      "Workshop Design & Facilitation",
      "Stakeholder & Institutional Engagement",
      "Cross-cultural Communication",
      "AI & Automation (Excel/BMC)",
    ],
    education: [
      {
        degree: "MBA – Innovation Management",
        school: "University of Europe for Applied Sciences, Berlin",
        year: "2024",
      },
    ],
    workExperience: [
      {
        company: "GrowQR",
        position: "Director – Business Growth & Global Academic Alliances",
        duration: "May 2026 – Present",
        achievements: [
          "Spearheading institutional partnerships, academic alliance development, and field outreach for India's first Agentic AI career platform; managing BD, marketing, sales, and legal compliance.",
        ],
      },
      {
        company: "Independent",
        position: "NLP Trainer, Behavioural Mentor & Well-Being Specialist",
        duration: "2022 – Present",
        achievements: [
          "Coached 200+ students and professionals across India & Germany; delivered training for Nagarro (ATCS), Mahindra Pride Classroom, and Nandi Foundation.",
        ],
      },
      {
        company: "Independent",
        position: "Coordinator – International Recruitment & Global Partnerships",
        duration: "2026",
        achievements: [
          "Managing end-to-end international admissions, global agent networks, and university-to-university MoU partnerships.",
        ],
      },
      {
        company: "Independent",
        position: "Team Captain – Workforce & Operations Mentorship",
        duration: "2024 – 2026",
        achievements: [
          "Mentored multicultural teams across 3 countries; maintained 99% workflow accuracy through coaching and performance support.",
        ],
      },
      {
        company: "Independent",
        position: "Project Manager / Behavioural Leadership Mentor",
        duration: "2011 – 2017",
        achievements: [
          "Led 500+ workers; resolved team conflicts and implemented structured communication systems in DR Congo.",
        ],
      },
      {
        company: "Independent",
        position: "Director – Operations & People Development",
        duration: "2004 – 2009",
        achievements: [
          "Managed 100+ staff; improved employee support systems, mentored professionals in communication and behavioural development.",
        ],
      },
    ],
    certifications: [
      "Certified NLP Trainer (AANLP)",
      "Advanced Life Coach Certification (ECNLP)",
      "Certified Hypnotist (ECNLP)",
      "AI & Automation in Excel (Skill Nation)",
    ],
    industries: [
      "Education & EdTech",
      "HR & Talent Development",
      "Corporate Training",
      "Government & Skill Development",
      "Logistics & Operations",
      "International Recruitment",
    ],
    languages: ["English", "Hindi", "Punjabi", "French", "Lingala"],
    awards: [
      "Leadership Excellence: Scored 99% in MBA (Leadership) module, University of Europe for Applied Sciences (2024)",
      "Coached 200+ students and professionals across 5+ countries on career clarity, EI, and behavioural development",
      "Delivered psychology-based programs for marquee organisations including Nagarro (ATCS), Mahindra, and Nandi Foundation",
    ],
    reviews: [
      {
        name: "Darshana Sharma",
        role: "ATCS",
        image: "/experts/testimonials/DarshanaSharma.webp",
        rating: 5,
        text: "Amandeep helped me understand myself better and overcome negative thinking. His guidance gave me clarity about my strengths, weaknesses, and personal growth. I became more confident, self-aware, and learned how to focus on my own happiness while building healthier relationships with others.",
      },
      {
        name: "Advocate Ritu Thakur",
        role: "Advocate, Supreme Court of India",
        image: "/experts/testimonials/Advocateritu.webp",
        rating: 5,
        text: "Amandeep's friendly and supportive approach helped me navigate personal challenges with greater clarity and confidence. His guidance gave me comfort, hope, and the courage to make better life decisions. Through our sessions, I gained self-awareness, a clearer vision for my future, and a stronger sense of self-worth.",
      },
      {
        name: "Nireesh Kumari",
        role: "ATCS, Nagarro",
        image: "/experts/testimonials/NireeshKumari.webp",
        rating: 5,
        text: "My sessions with Amandeep helped me clear doubts, overcome fears, and gain much-needed clarity during a challenging phase. His practical exercises and thoughtful guidance helped me become more focused, confident, and solution-oriented. I would highly recommend his support to anyone seeking direction, clarity, and personal growth.",
      },
    ],
    whatYouGet: [
      { title: "Mindset Clarity", description: "Identify and rewire limiting beliefs that block your progress using NLP." },
      { title: "Career Direction", description: "Leave with a concrete next step mapped to your strengths and goals." },
      { title: "Emotional Mastery", description: "Tools to regulate emotions, build resilience, and lead under pressure." },
      { title: "Communication Edge", description: "Sharpen how you speak, listen, and influence across any context." },
      { title: "Confidence Blueprint", description: "A personalised framework to build lasting self-belief and presence." },
      { title: "Action Plan", description: "A clear, prioritised plan you can implement immediately after the session." },
    ],
  },
  {
    slug: "bibin-babu",
    hidden: true,
    country: "IN",
    location: "Delhi, India",
    persona: "startups",
    name: "Bibin Babu",
    displayName: "Bibin Babu",
    email: "bibin@growqr.ai",
    role: "Founder & CEO, GrowQR",
    tag: "Startup Founder & Advisor",
    stats: [
      { value: "10+", label: "Years Building" },
      { value: "5+", label: "Ventures Built" },
      { value: "50+", label: "Startups Mentored" },
    ],
    rqScore: 95,
    supports: ["RQ-Rita", "RQ-Vera", "RQ-Kai"],
    trustedBy: ["Paycio", "Colexion", "BlocSpaze"],
    trustedByLabel: "Collaborated With",
    image: "/experts/portraits/bibinpfp.png",
    bio: "Founder, investor & ecosystem builder helping people navigate careers, startups & emerging tech.",
    headline: "Build the Career You Deserve, Not the One You're Told to Follow",
    intro:
      "Careers aren't built on resumes and titles. They're built on potential, opportunity, and execution. Let's help you think bigger, decide sharper, and build a path that fits your strengths.",
    verified: true,
    yearsExperience: 10,
    rating: 4.9,
    reviewCount: 100,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/iambibinbabu/", icon: "linkedin" },
    ],
    about:
      "Bibin Babu is a serial entrepreneur and investor who has built multiple ventures over the past decade, including one of Asia's largest licensed NFT marketplaces, and backed high-growth startups. Now Founder of GrowQR, he's building an AI-powered career platform on one belief: talent exists everywhere, and opportunity should too.",
    expertise: [
      "Startup Building & Entrepreneurship",
      "Career Strategy & Growth",
      "Fundraising & Investor Readiness",
      "Emerging Technologies & AI",
      "Digital Transformation",
      "Leadership & Decision Making",
    ],
    skills: [
      "Startup Leadership",
      "Business Strategy",
      "Artificial Intelligence",
      "Digital Transformation",
      "Ecosystem Building",
      "Investor Relations",
    ],
    education: [
      {
        degree: "International Relations & Affairs",
        school: "University of South Wales",
        year: "2019",
      },
      {
        degree: "MBA – Human Resource & Marketing",
        school: "Lovely Professional University",
        year: "2016",
      },
      {
        degree: "B.Tech – Information Technology",
        school: "Lovely Professional University",
        year: "2014",
      },
    ],
    workExperience: [
      {
        company: "GrowQR",
        position: "Founder & CEO",
        duration: "2023 – Present",
        achievements: [
          "Building an AI-powered career platform designed to help people discover opportunities beyond traditional credentials.",
        ],
      },
      {
        company: "Independent",
        position: "Angel Investor",
        duration: "2021 – Present",
        achievements: [
          "Investing in and supporting high-growth startups across emerging technology and consumer sectors.",
        ],
      },
      {
        company: "Paycio",
        position: "Co-Founder",
        duration: "2023 – Present",
        achievements: [],
      },
      {
        company: "Colexion",
        position: "Co-Founder & COO (Ex)",
        duration: "2021 – 2023",
        achievements: [
          "Helped build one of Asia's largest licensed NFT marketplaces as Co-Founder & COO.",
        ],
      },
      {
        company: "BlocSpaze",
        position: "Founder & Ex-CEO",
        duration: "2018 – 2021",
        achievements: [
          "Founded and led a blockchain venture contributing to India's emerging Web3 ecosystem.",
        ],
      },
      {
        company: "Innowork",
        position: "Founder",
        duration: "2016 – 2019",
        achievements: [],
      },
      {
        company: "Confederation of Young Leaders (CYL)",
        position: "Director General",
        duration: "2015 – 2018",
        achievements: [],
      },
    ],
    industries: [
      "Education & EdTech",
      "Artificial Intelligence",
      "Startups & Venture Building",
      "Blockchain & Web3",
      "Digital Transformation",
      "Innovation & Entrepreneurship",
    ],
    languages: ["English", "Hindi", "Malayalam", "Punjabi"],
    awards: [
      "Global Indian Leader",
      "BW 30 Under 30",
      "Top Whiz Kid",
      "Smart Citizen Award",
      "Top 10 Crypto Entrepreneurs",
    ],
    reviews: [],
    whatYouGet: [
      { title: "Career Strategy", description: "A clear path to grow beyond titles and credentials." },
      { title: "Founder Perspective", description: "Honest, first-hand insight from a proven builder." },
      { title: "Growth Roadmap", description: "Concrete steps from where you are to where you want to be." },
      { title: "Decision Frameworks", description: "Mental models for sharper decisions under uncertainty." },
      { title: "Startup Insights", description: "Real lessons on building, fundraising, and scaling." },
      { title: "Action Plan", description: "A prioritised set of next steps to act on immediately." },
    ],
    faq: [
      {
        q: "Who is this session for?",
        a: "Founders, aspiring entrepreneurs, students, and professionals seeking clarity on career growth, startup building, fundraising, leadership, and high-stakes decision-making, and anyone wanting to build a path based on potential and execution rather than resumes and job titles.",
      },
      {
        q: "How should I prepare?",
        a: "Reflect on where you are, where you want to go, and the decisions or challenges you're currently facing. Bring your résumé, startup idea, pitch, or growth questions if relevant. The clearer your goals, the more actionable and tailored the guidance.",
      },
      {
        q: "What outcomes can I expect?",
        a: "A sharper sense of direction, an honest founder's perspective on your path, practical decision frameworks, and a concrete action plan: clarity on the next steps that will create real momentum in your career or venture.",
      },
    ],
  },
  {
    slug: "kanika-mishra",
    country: "IN",
    location: "Noida, India",
    persona: "enterprises",
    name: "Kanika Mishra",
    email: "kanika@growqr.ai",
    role: "Chief Operating Officer, GrowQR",
    tag: "Leadership & Growth Expert",
    stats: [
      { value: "16+", label: "Years Exp." },
      { value: "150K+", label: "Trained" },
      { value: "50+", label: "Countries" },
      { value: "1000+", label: "Sessions" },
    ],
    rqScore: 95,
    supports: ["RQ-Eva", "RQ-Kai", "RQ-Rohan"],
    trustedBy: ["RUDSETI", "Nagarro", "Pearson"],
    trustedByLabel: "Collaborated With",
    image: "/experts/portraits/kanika.webp",
    bio: "COO, leadership architect, and facilitator who has impacted 150,000+ learners.",
    headline: "Leadership, Communication & Career Growth",
    intro:
      "Leadership isn't a title, it's a capability. Drawing on 16+ years of experience across corporate, government, education, and entrepreneurship, I help individuals strengthen communication, leadership, confidence, career direction, and influence.",
    verified: true,
    yearsExperience: 16,
    rating: 4.9,
    reviewCount: 150000,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/kanikamishra23/", icon: "linkedin" },
    ],
    about:
      "Kanika Mishra is a strategic leader, learning architect, entrepreneur, and NLP Master Practitioner with 16+ years of experience across corporate, government, academic, and social sectors. Having trained and assessed over 150,000 individuals and travelled across 50+ countries, she brings a rare blend of leadership expertise, communication mastery, behavioural transformation, and global perspective to every conversation.",
    expertise: [
      "Leadership Development",
      "Communication Mastery",
      "Career Growth",
      "Emotional Intelligence",
      "Public Speaking",
      "Behavioural Change",
    ],
    skills: [
      "Executive Coaching",
      "Public Speaking",
      "Facilitation",
      "Strategic Thinking",
      "Stakeholder Management",
      "Capability Building",
    ],
    education: [
      {
        degree: "M.A. English Literature (20th-Century Canadian & Contemporary Australian Literature)",
        school: "IGNOU",
        year: "2014",
      },
      {
        degree: "B.Tech, Biotechnology",
        school: "Rajasthan Technical University",
        year: "2010",
      },
      {
        degree: "Certificate in Urdu Language & Literary Studies",
        school: "Jamia Millia Islamia, New Delhi",
        year: "",
      },
    ],
    workExperience: [
      {
        company: "GrowQR",
        position: "Chief Operating Officer & Leadership Architect",
        duration: "2026–Present",
        achievements: [
          "Leading organizational strategy, operations, partnerships, and capability-building initiatives",
          "Driving execution excellence and scalable growth across functions",
        ],
      },
      {
        company: "Kalaneeti",
        position: "Founder",
        duration: "2019–Present",
        achievements: [
          "Built a platform dedicated to promoting indigenous Indian art forms and artisan livelihoods",
          "Established international market access, including exports to Australia",
        ],
      },
      {
        company: "Independent",
        position: "Leadership Facilitator & Learning Architect",
        duration: "2010–Present",
        achievements: [
          "Trained and assessed 150,000+ learners, professionals, educators, and workforce participants",
          "Designed and delivered leadership, communication, employability, and behavioural development programs",
        ],
      },
      {
        company: "Independent",
        position: "Faculty & Teacher Development Specialist",
        duration: "2022–Present",
        achievements: [
          "Trained Principals, Vice Principals, PGTs, TGTs, and educators",
        ],
      },
      {
        company: "Independent",
        position: "Consultant – Leadership & Communication",
        duration: "13+ Years",
        achievements: [
          "Facilitated programs for Mahindra, Nagarro, RMSI, and RUDSETI",
        ],
      },
    ],
    certifications: [
      "NLP Master Practitioner",
      "Leadership & Behavioural Development Programs",
      "Experiential Learning & Facilitation Methodologies",
    ],
    industries: [
      "Education",
      "Government",
      "Technology",
      "Skill Development",
      "Corporate Learning",
      "Social Impact",
    ],
    languages: ["English", "Hindi", "French", "Urdu"],
    awards: [
      "Nari Tejaswini Samman (2026)",
      "Inspiring Leader Award (2026)",
      "75 Women of Excellence Award (2025)",
      "Education Excellence Award",
      "Certificate of Leadership (IIM Lucknow Collaboration)",
    ],
    reviews: [
      {
        name: "Prateek Sharma",
        role: "Software Engineer",
        image: "/experts/testimonials/kanika/prateeksharma.jpeg",
        rating: 5,
        text: "Kanika blends behavioural science with practical leadership like few others. I walked away with sharper communication, more presence, and a clear path to grow.",
      },
      {
        name: "Sumitkumar Sharma",
        role: "Consumer Insights & Analytics Manager",
        image: "/experts/testimonials/kanika/sumitsharma.jpeg",
        rating: 5,
        text: "Kanika's coaching made communication feel natural and actionable. Her sessions were engaging, practical, and had a lasting impact on my confidence.",
      },
      {
        name: "Jai Bhateja",
        role: "Pharma Commercialization & Consumer Insights Leader",
        image: "/experts/testimonials/kanika/jaybhateja.jpeg",
        rating: 5,
        text: "Kanika helped me strengthen both communication and self-awareness. Every session brought clarity, confidence, and a fresh perspective.",
      },
    ],
    whatYouGet: [
      { title: "Leadership Clarity", description: "Navigate challenges confidently." },
      { title: "Executive Presence", description: "Communicate with impact." },
      { title: "Strategic Thinking", description: "Make better decisions." },
      { title: "Emotional Intelligence", description: "Lead people effectively." },
      { title: "Career Growth", description: "Unlock new opportunities." },
      { title: "Practical Roadmap", description: "Turn ideas into action." },
    ],
  },
  {
    slug: "khyati-kochhar",
    hidden: false,
    country: "IN",
    location: "Rajasthan, India",
    persona: "professionals",
    name: "Dr. Khyati Kochhar",
    email: "khyatikochhar@banasthali.in",
    role: "Assistant Professor | Researcher | Finance Educator",
    tag: "Finance Educator & Mentor",
    stats: [
      { value: "14+", label: "Years Teaching" },
    
      { value: "1000+", label: "Students Mentored" },
      { value: "30+", label: "Publications" },
    ],
    rqScore: 93,
    supports: ["RQ-Sage", "RQ-Lyra", "RQ-Mira"],
    trustedBy: ["Banasthali University", "SRM University"],
    trustedByLabel: "Worked With",
    image: "/experts/portraits/khyati.webp",
    bio: "Academician, researcher, and mentor with 14+ years of teaching and research experience in management, economics, finance, and law.",
    headline: "Smarter Money Decisions in the AI Era",
    intro:
      "Practical budgeting techniques enhanced by AI-powered tools and digital finance solutions. The session will explore how technology can simplify expense tracking, goal setting, saving, and financial decision-making.",
    verified: true,
    yearsExperience: 14,
    rating: 4.9,
    reviewCount: 41,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/dr-khyati-kochhar-54b55553/", icon: "linkedin" },
    ],
    about:
      "Dr. Khyati Kochhar is an accomplished academician, researcher, and mentor with more than 14 years of teaching and research experience in management, economics, finance, and law.",
    expertise: [
      "Financial Management",
      "Financial Literacy",
      "Personal Finance",
      "Wealth Management",
      "Management Education",
      "Academic Research",
      "Research Methodology",
      "PhD Supervision",
      "Academic Writing & Publications",
    ],
    skills: [
      "Teaching & Learning Innovation",
      "Research Supervision",
      "PhD Mentoring",
      "Financial Planning",
      "Wealth Management",
      "Public Speaking",
      "Professional Training",
      "Student Mentoring",
    ],
    education: [
      { degree: "PhD in Management", school: "Banasthali Vidyapith", year: "2017" },
      { degree: "MA Economics", school: "Shobhit University", year: "2014" },
      { degree: "MBA Finance & Marketing", school: "SRM University", year: "2012" },
      { degree: "BA Economics (Hons.)", school: "Banasthali Vidyapith", year: "2010" },
    ],
    workExperience: [
      {
        company: "Banasthali University",
        position: "Assistant Professor",
        duration: "Jul 2013 – Present",
        achievements: [
          "14+ years teaching and researching across management, economics, finance, and law.",
          "Guided 12+ research scholars and mentored 1000+ students in financial literacy and career growth.",
        ],
      },
      {
        company: "SRM University",
        position: "Assistant Professor",
        duration: "Aug 2012 – May 2013",
        achievements: [],
      },
    ],
    certifications: [
      "Research Methodology Certification",
      "Faculty Development Certification",
      "Case Study Development Certification",
      "Financial Literacy Certification",
    ],
    industries: [
      "Higher Education",
      "Academic Research",
      "Financial Services",
      "Skill Development",
      "Capacity Building",
    ],
    languages: ["English", "Hindi"],
    awards: [
      "Excellence in Personal Finance Research (2026)",
      "Promotion of Financial Literacy Among Women (2025)",
      "Best Assistant Professor of the Year (2020)",
    ],
    reviews: [
      {
        name: "Nandita Mittal",
        role: "Co-Founder · AmPower",
        image: "/experts/testimonials/khyati/nandita.jpeg",
        rating: 5,
        text: "I had the opportunity to work with Dr Khyati for three years at Banasthali Vidyapith, and it was truly a rewarding experience. She is an exceptional educator with a deep understanding of finance and a genuine passion for empowering others through financial literacy.",
      },
      {
        name: "Dr Kanika Gupta",
        role: "Assistant Professor · North Cap University",
        image: "/experts/testimonials/khyati/kanika-gupta.jpeg",
        rating: 5,
        text: "I have had the privilege of working closely with Dr Khyati for five years at Banasthali Vidyapith and have remained professionally connected with her for over eight years. Throughout this time, I have admired her strong work ethic, integrity, and unwavering commitment to excellence.",
      },
      {
        name: "Dr Hitesh Sharma",
        role: "Assistant Professor · Banasthali Vidyapith",
        image: "/experts/testimonials/khyati/hitesh.jpeg",
        rating: 5,
        text: "It has been a pleasure working with Dr Khyati Kochhar at Banasthali Vidyapith. She possesses excellent financial acumen and demonstrates a strong understanding of budgeting, financial planning, and analytical decision-making.",
      },
    ],
    whatYouGet: [
      { title: "Smart Budgeting", description: "Build a practical budget and expense-tracking system that fits your life." },
      { title: "AI-Powered Tools", description: "Use modern financial technologies to simplify money management." },
      { title: "Goal Setting", description: "Turn financial goals into clear, achievable saving plans." },
      { title: "Smarter Decisions", description: "Frameworks for confident, informed financial choices." },
      { title: "Financial Literacy", description: "Foundational money skills for students, professionals, and entrepreneurs." },
      { title: "Action Plan", description: "A clear, personalised plan you can start applying right away." },
    ],
    faq: [
      {
        q: "Who is this session for?",
        a: "Students, professionals, and entrepreneurs who want to budget smarter, build better saving habits, and make confident financial decisions, including anyone curious about using AI-powered tools to manage money.",
      },
      {
        q: "How should I prepare?",
        a: "Come with your current financial goals and one money challenge you'd like to solve, for example expense tracking, saving, or planning. The more specific you are, the more practical the guidance.",
      },
      {
        q: "What outcomes can I expect?",
        a: "A clearer budgeting approach, practical tools to simplify your finances, and a concrete action plan to track expenses, save consistently, and make smarter financial decisions.",
      },
    ],
  },
  {
    slug: "kharanshu-sharma",
    country: "IN",
    location: "Bengaluru",
    persona: "professionals",
    name: "Kharanshu Sharma",
    email: "kharanshu@growqr.ai",
    role: "Senior Program Manager, NTT DATA Inc.",
    tag: "Program & Strategy Expert",
    stats: [
      { value: "10+", label: "Years Exp." },
      { value: "6", label: "Certifications" },
      { value: "6+", label: "Industries" },
    ],
    rqScore: 91,
    supports: ["RQ-Scout", "RQ-Kai", "RQ-Nova"],
    trustedBy: ["NTT DATA Inc.", "Dell Technologies", "VMware by Broadcom"],
    trustedByLabel: "Worked With",
    image: "/experts/portraits/karanshu.webp",
    bio: "Sr. Program Manager with 10+ years in IT services, business strategy and global GTM execution.",
    headline: "Program Leadership, Strategy & Career Acceleration",
    intro:
      "Careers grow on strategy, not chance. With 10+ years leading global IT service portfolios at NTT DATA, Dell and VMware, I help students and professionals master program management, executive communication and confident career growth.",
    verified: true,
    yearsExperience: 10,
    rating: 4.9,
    reviewCount: 100,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/kharanshusharma09", icon: "linkedin" },
    ],
    about:
      "Kharanshu Sharma is a Senior Program Manager with 10+ years of experience driving strategic service portfolios and enterprise infrastructure programs across Cloud, Data Center, Network, Security and Digital Workplace domains. He blends strategic vision with tactical execution, managing end-to-end service lifecycles, P&L and GTM strategy while aligning C-suite priorities with cross-functional teams to deliver measurable business outcomes.",
    expertise: [
      "Program & Portfolio Management",
      "Business Strategy",
      "Service Lifecycle Management",
      "GTM & Portfolio Strategy",
      "AI & Digital Transformation",
      "Enterprise Governance",
    ],
    skills: [
      "Program & Portfolio Management",
      "Business Strategy & Critical Thinking",
      "Leadership",
      "Global GTM & Portfolio Expansion",
      "Stakeholder Management",
      "Cross-Functional & C-Suite Communication",
    ],
    education: [
      {
        degree: "Post-Graduate, Renewable Energy",
        school: "Ministry of Power",
        year: "2018",
      },
      {
        degree: "B.Tech (Hons.), Mechanical Engineering",
        school: "Rajasthan Technical University",
        year: "2012",
      },
    ],
    workExperience: [
      {
        company: "NTT DATA Inc.",
        position: "Senior Program Manager",
        duration: "2025–Present",
        achievements: [],
      },
      {
        company: "Norwin Technologies",
        position: "Project Manager (Dell Portfolio)",
        duration: "2024–2025",
        achievements: [],
      },
      {
        company: "VMware by Broadcom",
        position: "Project Manager",
        duration: "2023–2024",
        achievements: [],
      },
      {
        company: "Dell Technologies",
        position: "Project Manager",
        duration: "2022–2023",
        achievements: [],
      },
      {
        company: "FLOVEL Energy Pvt. Ltd.",
        position: "Senior Engineer, Project Management",
        duration: "2021–2022",
        achievements: [],
      },
      {
        company: "MECAMIDI HPP India Pvt. Ltd.",
        position: "Assistant Engineer, Project Management",
        duration: "2019–2021",
        achievements: [],
      },
    ],
    certifications: [
      "Project Management (IIM)",
      "Project Management Professional (PMP)",
      "ITIL",
      "Certified Scrum Master (CSM)",
      "Six Sigma Black Belt",
      "Google People Management Essentials",
    ],
    industries: [
      "IT Infrastructure & Cloud",
      "Renewable Energy & Hydro",
      "Product Management",
      "Digital Transformation",
      "Higher Education & EdTech",
      "Career Development",
    ],
    languages: ["English", "Hindi"],
    awards: [
      "Expert Award, NTT Data",
      "Guest Expert Speaker Award, Manipal University",
      "Achievement Award, Vivekananda Institute of Technology",
    ],
    reviews: [
      {
        name: "Akanksha Lahoti",
        role: "IT Services",
        image: "",
        rating: 5,
        text: "Kharanshu helped me untangle a stalled program in a single session. His resource reallocation advice was so practical we recovered our timeline within a month.",
      },
      {
        name: "Saurav Bakshi",
        role: "Project Manager",
        image: "",
        rating: 5,
        text: "His clarity on career strategy is rare. He helped me map my move from delivery into portfolio management and coached me to speak to leadership with confidence.",
      },
      {
        name: "Himanshu Gupta",
        role: "Engineering Lead",
        image: "",
        rating: 5,
        text: "Every conversation with Kharanshu sharpens your thinking. I left with a unified execution plan for my team and a much stronger grip on stakeholder buy-in.",
      },
    ],
    whatYouGet: [
      { title: "Global Insight", description: "Decode the global business landscape" },
      { title: "Project Performance", description: "Deliver programs on time and budget" },
      { title: "Risk Mitigation", description: "Spot and manage risks before they grow" },
      { title: "Resource Strategy", description: "Actionable resource reallocation plans" },
      { title: "Leadership Growth", description: "A clear strategy to cultivate leadership" },
      { title: "Unified Execution", description: "Align teams behind a single approach" },
    ],
    faq: [
      {
        q: "Who is this session for?",
        a: "Professionals, project managers, program managers, and aspiring leaders looking to grow their strategic and leadership capabilities.",
      },
      {
        q: "How should I prepare?",
        a: "Come with your current challenges, goals, or career questions to get the most value from the session.",
      },
      {
        q: "What outcomes can I expect?",
        a: "Greater clarity on leadership, execution, stakeholder management, and career progression.",
      },
    ],
  },
  {
    slug: "ankur-bansal",
    country: "IN",
    location: "Jaipur, Rajasthan, India",
    persona: "enterprises",
    name: "CA (Dr.) Ankur Bansal",
    email: "bansal.ankur1987@gmail.com",
    role: "Managing Partner, Bansal AV & Associates",
    tag: "Financial Strategy Expert",
    stats: [
      { value: "15+", label: "Years Experience" },
      { value: "50+", label: "Valuations" },
      { value: "1000+", label: "Credit Profiles" },
    ],
    rqScore: 93,
    supports: ["RQ-Rohan", "RQ-Sage", "RQ-Eva"],
    image: "/experts/portraits/ankur.webp",
    bio: "Chartered Accountant helping leaders make smarter financial decisions.",
    headline: "Financial Intelligence for Smarter Decisions",
    intro:
      "Deep expertise in valuation, taxation, audit, and financial analysis — helping professionals and businesses strengthen financial strategy, manage risk, and identify smarter investment opportunities.",
    verified: true,
    yearsExperience: 15,
    rating: 4.9,
    reviewCount: 0,
    sessionDuration: "30 min",
    price: "₹999",
    socials: [],
    about:
      "CA (Dr.) Ankur Bansal is a Chartered Accountant, IBBI-Registered Valuer (SFA), forensic auditor, and financial strategist with 15+ years of post-qualification experience across audit, taxation, valuation, financial due diligence, and investment analysis. Having advised corporates, financial institutions, government bodies, and public sector organisations, he brings a practical, data-driven approach to financial decision-making. His sessions blend technical expertise with business insight, enabling professionals and organizations to improve financial intelligence, manage risk, and create sustainable value.",
    expertise: [
      "Financial Intelligence",
      "Business Valuation",
      "Audit & Assurance",
      "Tax Planning",
      "Forensic Audit",
      "Investment Analysis",
    ],
    skills: [
      "Strategic Financial Planning",
      "Financial Modelling",
      "Risk Assessment",
      "Public Speaking",
      "Executive Coaching",
      "Financial Advisory",
    ],
    education: [
      { degree: "Ph.D. (Accounts)", school: "University of Rajasthan, Jaipur", year: "2019" },
      { degree: "Master of Business Administration", school: "Rajasthan", year: "2020" },
      { degree: "Forensic Accounting & Fraud Detection", school: "ICAI", year: "2020" },
      { degree: "Chartered Accountant (CA)", school: "ICAI", year: "2011" },
      { degree: "Master in Commerce", school: "University of Rajasthan", year: "2012" },
      { degree: "Diploma in Banking & Finance", school: "IIBF, Mumbai", year: "2012" },
      { degree: "IBBI Registered Valuer (SFA)", year: "2020" },
    ],
    workExperience: [
      {
        position: "Managing Partner",
        company: "Bansal AV & Associates",
        duration: "2011 – Present",
        achievements: [
          "Audit, assurance, taxation, and valuation advisory across corporates, financial institutions, government bodies, and PSUs",
          "Forensic analysis of financials to identify loopholes and irregularities in financial fraud",
          "Financial modelling, complex asset valuation, financial due diligence, investment analysis, and credit assessment",
          "Statutory and internal audits for government organisations, public sector banks, and private companies",
          "Loss assessment under Fire & Miscellaneous categories per IRDAI guidelines",
        ],
      },
      {
        position: "Board of Studies Member & Guest Faculty",
        company: "Manipal University, Jaipur",
        duration: "2023 – Present",
        achievements: [
          "Speaker at ICAI and ICSI",
          "Delivers training sessions for students and educators",
          "Participates in academic developmental and course structuring programs",
        ],
      },
    ],
    certifications: [
      "Registered Valuer: Securities or Financial Assets (IBBI)",
      "Forensic Auditor (ICAI)",
      "Surveyor & Loss Assessor: Fire & Misc. Category (IRDAI)",
    ],
    industries: [
      "Banking & Insurance",
      "Government",
      "Manufacturing",
      "Education",
      "Technology",
      "Healthcare",
    ],
    languages: ["English", "Hindi"],
    awards: [
      "Guest Expert Speaker Award, Manipal University",
    ],
    trustedBy: ["TATA AIA Life Insurance", "HDFC Bank"],
    trustedByLabel: "Worked With",
    reviews: [],
    whatYouGet: [
      { title: "Financial Clarity", description: "Make informed financial decisions with confidence." },
      { title: "Investment Insights", description: "Evaluate opportunities objectively with expert guidance." },
      { title: "Risk Assessment", description: "Identify and mitigate financial risks before they escalate." },
      { title: "Business Valuation", description: "Understand enterprise value and what drives it." },
      { title: "Tax & Compliance", description: "Stay compliant and manage your tax position strategically." },
      { title: "Strategic Thinking", description: "Strengthen long-term financial planning for sustainable growth." },
    ],
    faq: [
      {
        q: "Who is this session for?",
        a: "Founders, finance professionals, business owners, and individuals looking to strengthen their financial decision-making, understand valuations, or navigate audits and taxation with clarity.",
      },
      {
        q: "How should I prepare?",
        a: "Come with your specific financial question, challenge, or goal. The more context you share, whether it's a valuation query, investment decision, or tax planning need, the more targeted the session will be.",
      },
      {
        q: "What outcomes can I expect?",
        a: "A clearer understanding of your financial position, actionable guidance on investments or audits, and practical frameworks for making better financial decisions.",
      },
    ],
  },
  {
    slug: "poulomi-mitra",
    country: "IN",
    location: "Kolkata, India",
    persona: "enterprises",
    name: "Dr. Poulomi Mitra",
    email: "poulomi.mitra14@gmail.com",
    role: "Academic Leader | Communication Strategist",
    tag: "Leadership Expert",
    stats: [
      { value: "15+", label: "Years Exp." },
      { value: "5+", label: "Institutions" },
    ],
    rqScore: 91,
    supports: ["RQ-Kai", "RQ-Sage", "RQ-Eva"],
    trustedBy: ["Brainware University", "Maha Jibon NGO"],
    trustedByLabel: "Worked With",
    image: "/experts/portraits/poulomi.webp",
    bio: "Academic leader helping professionals grow into confident, influential leaders.",
    headline: "From Expertise to Leadership",
    intro:
      "Leadership is built on more than expertise. Drawing on 15+ years in academia, corporate communication, and leadership development, I help professionals strengthen influence, communication, and decision-making to lead with confidence and impact.",
    verified: true,
    yearsExperience: 15,
    rating: 4.9,
    reviewCount: 0,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/dr-poulomi-mitra-100b2a69/", icon: "linkedin" },
    ],
    about:
      "Dr. Poulomi Mitra is an academic leader, communication strategist, corporate trainer, researcher, author, and social impact advocate with over 15 years of experience across higher education. As Associate Professor and former Head of the Department of English & Literary Studies at Brainware University, she has led academic administration, curriculum development, industry engagement, and communication initiatives. Her expertise spans leadership development, business communication, employability, research, and professional growth, enabling individuals and institutions to build confident leaders, effective communicators, and future-ready professionals.",
    expertise: [
      "Leadership Development",
      "Business Communication",
      "Corporate Training",
      "Curriculum Development",
      "Research & Publication",
      "Career Readiness",
    ],
    skills: [
      "Leadership Facilitation",
      "Public Speaking",
      "Academic Administration",
      "Strategic Communication",
      "Industry Grooming",
      "Research",
    ],
    education: [
      { degree: "Ph.D.", school: "Visva-Bharati University", year: "2019" },
      { degree: "M.A. English", school: "University of Calcutta", year: "2001" },
    ],
    workExperience: [
      {
        position: "Associate Professor & HoD",
        company: "Brainware University",
        duration: "2022 – Present",
        achievements: [
          "Led academic administration, curriculum development, industry engagement, and communication initiatives.",
        ],
      },
      {
        position: "Assistant Professor",
        company: "Techno India University",
        duration: "2019 – 2022",
        achievements: [],
      },
      {
        position: "Assistant Teacher",
        company: "Garden High School, India",
        duration: "2015 – 2019",
        achievements: [],
      },
      {
        position: "Assistant Professor",
        company: "St. Xavier's College, Jaipur",
        duration: "2013 – 2014",
        achievements: [],
      },
      {
        position: "Assistant Professor",
        company: "National Defence Academy, Khadakwasla",
        duration: "2012 – 2013",
        achievements: [],
      },
    ],
    industries: [
      "Higher Education",
      "Corporate Learning",
      "Research",
      "Social Impact",
    ],
    languages: ["English", "Hindi", "Bengali"],
    awards: [],
    reviews: [],
    whatYouGet: [
      { title: "Leadership Mindset", description: "Transition confidently from expert to leader." },
      { title: "Executive Presence", description: "Build influence and credibility in any room." },
      { title: "Emotional Intelligence", description: "Lead with empathy, resilience, and self-awareness." },
      { title: "Communication Impact", description: "Inspire and persuade through effective communication." },
      { title: "Better Decisions", description: "Navigate complexity and uncertainty with confidence." },
      { title: "Actionable Growth", description: "Translate ideas and insights into real results." },
    ],
    faq: [
      {
        q: "Who is this session for?",
        a: "Academics, professionals, and mid-career leaders looking to strengthen leadership presence, communication, emotional intelligence, and decision-making as they grow in their roles.",
      },
      {
        q: "How should I prepare?",
        a: "Reflect on a leadership challenge you're currently facing or a communication goal you want to work on. The more specific you are, the more actionable the session.",
      },
      {
        q: "What outcomes can I expect?",
        a: "Clearer leadership direction, stronger communication frameworks, and a practical plan to grow your influence and impact in your professional environment.",
      },
    ],
  },
  {
    slug: "surja-baladhikari",
    hidden: true,
    country: "IN",
    location: "Kolkata, India",
    persona: "enterprises",
    name: "Dr. Surja Kanta Baladhikari",
    email: "surjakanta@gmail.com",
    role: "Assistant Professor of Law, WBNUJS",
    tag: "Legal Expert",
    stats: [
      { value: "9+", label: "Years Experience" },
      { value: "4+", label: "Institutions" },
    ],
    rqScore: 91,
    supports: ["RQ-Kai", "RQ-Sage", "RQ-Theo"],
    trustedBy: ["Central Detective Training Institute", "State Police Academies"],
    trustedByLabel: "Worked With",
    image: "/experts/portraits/surja.webp",
    bio: "Helping organizations build safe, ethical and inclusive workplaces.",
    headline: "Building Safe, Ethical & Inclusive Workplaces",
    intro:
      "Strong workplaces are built on trust, respect, and legal awareness. Drawing on experience in legal education, criminology, and workplace policy, I help organizations strengthen POSH compliance, ethical leadership, and inclusive workplace culture.",
    verified: true,
    yearsExperience: 9,
    rating: 4.9,
    reviewCount: 0,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/dr-surja-kanta-baladhikari-2446785b/", icon: "linkedin" },
    ],
    about:
      "Dr. Surja Kanta Baladhikari is a legal academic, researcher, and workplace culture expert specializing in criminology, victimology, legal awareness, and organizational ethics. With experience across leading universities, government institutions, and legal training programs, he helps organizations translate legal compliance into everyday workplace practice. His sessions combine legal expertise with practical application to strengthen POSH compliance, leadership accountability, gender sensitivity, and professional conduct while fostering workplaces built on trust, dignity, and respect.",
    expertise: [
      "Workplace Ethics",
      "POSH Compliance",
      "Legal Awareness",
      "Gender Sensitization",
      "Employee Development",
      "Legal Policy",
    ],
    skills: [
      "Training & Facilitation",
      "Public Speaking",
      "Research & Teaching",
      "Legal Advisory",
      "Policy Implementation",
      "Workplace Culture",
    ],
    education: [
      { degree: "Ph.D.", school: "NLSIU", year: "2023" },
      { degree: "LL.M.", school: "WBNUJS", year: "2015" },
      { degree: "B.A. LL.B. (Hons.)", school: "University of Calcutta", year: "2013" },
      { degree: "PG Diploma in Cyber Laws", year: "2016" },
    ],
    workExperience: [
      {
        position: "Assistant Professor (Grade I)",
        company: "WBNUJS",
        duration: "Present",
        achievements: [],
      },
      {
        position: "Researcher",
        company: "WBNUJS",
        duration: "",
        achievements: [],
      },
      {
        position: "Assistant Professor",
        company: "Sister Nivedita University",
        duration: "",
        achievements: [],
      },
      {
        position: "Assistant Professor",
        company: "Amity University",
        duration: "",
        achievements: [],
      },
    ],
    industries: [
      "Legal Education",
      "Higher Education",
      "Government Training",
      "Research",
    ],
    languages: ["English", "Bengali"],
    awards: [],
    reviews: [],
    whatYouGet: [
      { title: "POSH Clarity", description: "Understand rights and responsibilities under POSH law." },
      { title: "Legal Confidence", description: "Apply workplace laws effectively in your organization." },
      { title: "Ethical Leadership", description: "Build accountability, dignity, and trust across teams." },
      { title: "Safe Workplace", description: "Foster a culture of respect and inclusion." },
      { title: "Complaint Handling", description: "Navigate inquiry and redressal processes confidently." },
      { title: "Culture Building", description: "Strengthen your organization's workplace culture from within." },
    ],
    faq: [
      {
        q: "Who is this session for?",
        a: "HR professionals, managers, legal teams, and organizational leaders seeking clarity on POSH compliance, workplace ethics, gender sensitization, and building legally sound, inclusive workplaces.",
      },
      {
        q: "How should I prepare?",
        a: "Come with your specific compliance challenges, policy questions, or workplace culture concerns. The more context you share, the more targeted and actionable the guidance.",
      },
      {
        q: "What outcomes can I expect?",
        a: "A clearer understanding of your legal obligations, practical frameworks for POSH compliance and ethical leadership, and concrete steps to build a safer, more inclusive workplace.",
      },
    ],
  },
  {
    slug: "meenakshi-panghal",
    hidden: true,
    country: "US",
    location: "Denver, USA",
    persona: "students",
    name: "Meenakshi Panghal",
    email: "meenakshi.panghaal@gmail.com",
    role: "International Student Success Advisor",
    tag: "Study Abroad & US Education Expert",
    stats: [
      { value: "900+", label: "Students Supported" },
      { value: "3+", label: "Years Experience" },
      { value: "8+", label: "Campus Programs" },
    ],
    rqScore: 88,
    supports: ["RQ-Kai", "RQ-Scout", "RQ-Lyra"],
    image: "/experts/portraits/meenakshi.png",
    bio: "Helping students confidently navigate studying and thriving in the U.S.",
    headline: "Study Abroad & International Student Success",
    intro:
      "Every study abroad journey deserves the right guidance. Drawing on first-hand experience within the U.S. higher education system, I help students navigate admissions, campus life, assistantships, on-campus employment, and career opportunities with clarity and confidence.",
    verified: true,
    yearsExperience: 3,
    rating: 4.9,
    reviewCount: 0,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/meenakshi-panghal/", icon: "linkedin" },
    ],
    about:
      "Meenakshi Panghal helps aspiring international students confidently navigate every stage of their study abroad journey—from choosing universities and strengthening applications to adapting to campus life and preparing for internships and careers. As a Graduate Assistant in the Office of International Affairs at Southern Illinois University Edwardsville, she combines first-hand experience with practical guidance to help students make informed decisions, avoid common pitfalls, and succeed academically and personally.",
    expertise: [
      "Study Abroad Guidance",
      "International Student Success",
      "US University Systems",
      "Academic Advising",
      "Student Transition Coaching",
      "Career Readiness",
    ],
    skills: [
      "Student Advising",
      "Cross-cultural Communication",
      "University Systems Navigation",
      "Academic Planning",
      "Program Coordination",
      "Stakeholder Support",
    ],
    education: [
      { degree: "M.S. Computer Science", school: "Southern Illinois University Edwardsville", year: "2024–2026" },
      { degree: "B.Tech Computer Science", school: "Chitkara University", year: "2020–2024" },
    ],
    workExperience: [
      {
        company: "Southern Illinois University Edwardsville",
        position: "Graduate Assistant — Office of International Affairs",
        duration: "2024–Present",
        achievements: [
          "Supporting 900+ international students through admissions, campus integration, and career readiness programs.",
          "Coordinating 8+ campus programs focused on international student success and cross-cultural engagement.",
        ],
      },
      {
        company: "Kimmel Hub, SIUE",
        position: "Student Engagement Intern",
        duration: "2023–2024",
        achievements: [],
      },
      {
        company: "National Chung Cheng University",
        position: "Research Intern",
        duration: "2023",
        achievements: [],
      },
    ],
    industries: [
      "Higher Education",
      "International Affairs",
      "Student Services",
      "Education",
    ],
    languages: ["English", "Hindi"],
    awards: [
      "International Student Ambassador (2024)",
      "International Student Mentor of the Semester (Spring 2024)",
    ],
    reviews: [],
    whatYouGet: [
      { title: "Application Strategy", description: "Build a stronger study abroad plan." },
      { title: "University Insights", description: "Know what to expect before arriving." },
      { title: "On-Campus Employment", description: "Discover campus opportunities." },
      { title: "Campus Success", description: "Adapt faster to university life." },
      { title: "Career Readiness", description: "Prepare for internships and growth." },
      { title: "Honest Guidance", description: "Learn from lived experience." },
    ],
    faq: [
      {
        q: "Who is this session for?",
        a: "Students planning to study in the U.S. or already enrolled in American universities who need guidance on admissions, campus life, on-campus employment, assistantships, or career readiness.",
      },
      {
        q: "How should I prepare?",
        a: "Come with your specific questions or challenges — whether it's choosing universities, understanding assistantships, navigating campus resources, or planning internships. The more specific you are, the more actionable the guidance.",
      },
      {
        q: "What outcomes can I expect?",
        a: "A clearer roadmap for your study abroad journey, practical strategies for campus integration and employment, and the confidence to make informed decisions at every stage.",
      },
    ],
  },
  {
    slug: "dinesh-kumar-soni",
    country: "RU",
    location: "Moscow, Russia",
    name: "Dinesh Kumar Soni",
    email: "sonydinesh.moscow@gmail.com",
    role: "Artist • Mentor • Adolescent Counsellor",
    tag: "Art & Human Development",
    stats: [
      { value: "18+", label: "Years Experience" },
      { value: "1000+", label: "Learners Mentored" },
      { value: "Art", label: "Psychology · Mentoring" },
    ],
    rqScore: 93,
    supports: ["RQ-Kai", "RQ-Sage", "RQ-Lyra"],
    image: "/experts/portraits/dinesh.png",
    imagePosition: "65% top",
    bio: "Helping people grow through art, psychology, and meaningful conversations.",
    headline: "Transforming lives through art, reflection, and the science of human growth.",
    intro:
      "Discover how art becomes a powerful medium for self-discovery, emotional wellbeing, and purposeful growth. Through creative conversations and reflective mentoring, gain clarity, confidence, and practical direction for life and career.",
    verified: true,
    yearsExperience: 18,
    rating: 5.0,
    reviewCount: 0,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [],
    about:
      "Dinesh Kumar Soni is a self-taught artist, mentor, and adolescent counsellor who combines art, psychology, and mentoring to help people discover clarity, confidence, and lasting personal growth. With 18+ years of experience across government, academic, and social sectors, he has empowered individuals through experiential learning, behavioural development, and creative expression.\n\nBelieving that true success begins with inner wellbeing, he champions the philosophy that happy hearts create meaningful achievements. His approach blends artistic exploration with practical mentoring to strengthen emotional intelligence, communication, self-awareness, and lifelong growth. Through art-led interventions and reflective conversations, he helps individuals overcome limiting beliefs and move towards purposeful living.",
    expertise: [
      "Art-Based Behavioural Transformation",
      "Emotional Intelligence",
      "Adolescent Counselling",
      "Personal Development",
      "Communication Mastery",
      "Leadership Development",
    ],
    skills: [
      "Mentoring & Coaching",
      "Behavioural Development",
      "Art-Based Facilitation",
      "Public Speaking",
      "Experiential Learning",
      "Creative Confidence Building",
    ],
    education: [
      { degree: "M.A. Psychology (Gold Medal)", year: "2021" },
      { degree: "M.Sc. Botany", year: "1999" },
      { degree: "Diploma in Guidance & Counselling", year: "2016" },
      { degree: "NET–JRF Life Sciences", year: "2008" },
    ],
    workExperience: [
      {
        position: "Independent Artist, Mentor & Counsellor",
        company: "Independent",
        duration: "2008–Present",
        achievements: [
          "Art-led mentoring, counselling, and personal-development facilitation across schools, colleges, and social sectors.",
        ],
      },
      {
        position: "Educator & Behavioural Facilitator",
        company: "Government & Academic Institutions",
        duration: "2008–Present",
        achievements: [],
      },
      {
        position: "Art-Based Learning & Personal Development Facilitator",
        company: "Independent",
        duration: "2008–Present",
        achievements: [],
      },
    ],
    certifications: [
      "UNESCO MGIEP, The Social Emotional Educator: A Primer",
    ],
    industries: [
      "Education",
      "Schools & Colleges",
      "Government",
      "NGOs",
      "Corporate Learning & Development",
      "Youth Development",
      "Counselling & Wellbeing",
      "Arts & Creative Sector",
      "Community Development",
    ],
    languages: ["English", "Hindi", "Russian (Elementary)"],
    awards: [
      "Photography Award, 6th International Art Festival & Competition, London (2019)",
      "Innovation & Experimentation Award, 2016",
      "Gold Medal, M.A. Psychology (2021)",
      "Sketch Art Exhibition, Sergiev Posad, Russia (2026)",
    ],
    trustedBy: ["Akshara International School", "KVS India"],
    trustedByLabel: "Worked With",
    reviews: [
      {
        name: "Pritika Sood",
        role: "Vice Principal · Akshara International School",
        image: "/experts/testimonials/dinesh/pritika.png",
        rating: 5,
        text: "An exceptional artist, photographer and counsellor, Mr. Dinesh has been a constant source of my inspiration in my professional journey. As vice principal of Akshara International School, I sincerely appreciate his mentorship, creativity, and unwavering support.",
      },
      {
        name: "Monika Girish Parmar",
        role: "Employee · KVS India",
        image: "/experts/testimonials/dinesh/monika.png",
        imagePosition: "center 20%",
        rating: 5,
        text: "A highly skilled mentor with strong artistic vision who has inspire creativity in me and many more. Mr. dinesh is a caring counsellor who understand well and simple, effective guidance for personal growth.",
      },
      {
        name: "Irina Chulkova",
        role: "Educationist · Moscow, Russia",
        image: "/experts/testimonials/dinesh/irina.png",
        rating: 5,
        text: "Dinesh Kumar Soni is a truly transformative mentor. As an artist, he brings a unique, intuitive vision to personal counselling, creating a safe space for deep healing and self-discovery. His empathetic guidance and profound insights don't just solve problems; they inspire you to clear away emotional clutter and rebuild your life with confidence. I highly recommend Dinesh to anyone ready for genuine personal growth.",
      },
    ],
    whatYouGet: [
      { title: "Emotional Clarity", description: "Understand yourself better." },
      { title: "Creative Confidence", description: "Express yourself authentically." },
      { title: "Mindset Shift", description: "Break limiting patterns." },
      { title: "Personal Growth", description: "Build resilience and purpose." },
      { title: "Communication Skills", description: "Express with confidence." },
      { title: "Practical Roadmap", description: "Turn insights into action." },
    ],
    faq: [
      { q: "Do I need artistic skills?", a: "No. Art is used as a tool for self-expression and growth." },
      { q: "Who are your programs for?", a: "Students, educators, professionals, leaders, and organizations." },
      { q: "What topics do you cover?", a: "Emotional intelligence, communication, leadership, mindset, and personal growth." },
      { q: "Do you offer one-on-one mentoring?", a: "Yes." },
      { q: "Do you work with adolescents?", a: "Yes, adolescent mentoring is a core area of expertise." },
      { q: "Can programs be customized?", a: "Yes, all programs can be tailored to specific needs." },
      { q: "What languages do you work in?", a: "English, Hindi, Russian (Elementary)" },
      { q: "What outcomes can participants expect?", a: "Greater confidence, self-awareness, communication skills, and personal effectiveness." },
    ],
  },
  {
    slug: "chandrika-das",
    hidden: true,
    country: "IN",
    location: "Jaipur, India",
    persona: "students",
    name: "Chandrika Das",
    email: "chandrika.das1210@gmail.com",
    role: "Researcher, Educator & Literary Translator",
    tag: "Researcher, Translator",
    stats: [
      { value: "10+", label: "Years Experience" },
      { value: "4+", label: "Fellowships" },
      { value: "7+", label: "Research Papers" },
    ],
    rqScore: 91,
    supports: ["RQ-Mira", "RQ-Sage", "RQ-Lyra"],
    image: "/experts/portraits/chandrika.png",
    bio: "Educator, researcher and translator bringing scholarship and stories to global audiences.",
    headline: "Academia and Global Fellowship Mentorship",
    intro:
      "Get personalised guidance on translation, research planning, Fulbright or other international fellowship applications, academic CVs and statement of purpose. If you're applying abroad, I can help you create a clear strategy and actionable next steps.",
    verified: true,
    yearsExperience: 10,
    rating: 5.0,
    reviewCount: 0,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/chandrika-das-0a706417a/", icon: "linkedin" },
    ],
    about:
      "I am a researcher, educator, and literary translator currently pursuing a PhD in Translation Studies at the English and Foreign Languages University (EFLU), Hyderabad. My research explores how stories move across languages, cultures, and artistic traditions, with a particular interest in literary and intersemiotic translation. I've recently won the PEN X SALT award — an international literary translation prize instituted by English PEN and the South Asian Literature in Translation (UofChicago).",
    expertise: [
      "Literary Translation",
      "Academic Writing",
      "Mentorship",
      "Cross-cultural communication",
    ],
    skills: [
      "Curriculum Design",
      "Language Pedagogy",
      "Academic Writing",
      "Manuscript Review",
      "Qualitative research",
      "Literary Translation",
    ],
    education: [
      { degree: "PhD (Translation Studies)", school: "The EFL University, Hyderabad", year: "2026" },
      { degree: "M.A. English", school: "University of Rajasthan", year: "2015" },
      { degree: "B.A. English (Hons.)", school: "Maharani College, Jaipur", year: "2013" },
    ],
    workExperience: [
      {
        company: "IIS University, Jaipur",
        position: "Assistant Professor",
        duration: "2025 – 2026",
        achievements: [],
      },
      {
        company: "University of Texas at Austin",
        position: "FLTA",
        duration: "2023 – 2024",
        achievements: [],
      },
      {
        company: "St. Xavier's College, Jaipur",
        position: "Assistant Professor",
        duration: "2017 – 2018",
        achievements: [],
      },
      {
        company: "Kanoria Mahila Mahavidyalaya, Jaipur",
        position: "Assistant Professor",
        duration: "2016 – 2017",
        achievements: [],
      },
    ],
    industries: ["Higher Education", "Publishing"],
    languages: ["English", "Hindi"],
    awards: [
      "PEN X SALT Award — English PEN & South Asian Literature in Translation (University of Chicago)",
    ],
    trustedBy: ["University of Texas at Austin", "IIS University"],
    trustedByLabel: "Collaborated With",
    reviews: [],
    whatYouGet: [
      { title: "Application Strategy", description: "A roadmap based on your goals." },
      { title: "CV and SoP Review", description: "Detailed and line by line suggestions." },
      { title: "Translation Mentorship", description: "Guidance on translation techniques." },
      { title: "Live Q and A", description: "Anything related to academia." },
    ],
  },
  {
    slug: "jude-francis-weston",
    country: "IN",
    location: "New Delhi, India",
    persona: "students",
    name: "Jude Francis Weston",
    email: "jude.weston007@gmail.com",
    role: "Senior Sub Editor & Multimedia Producer, The Hindu",
    tag: "Podcasting & Communication Specialist",
    stats: [
      { value: "100+", label: "Podcast Episodes" },
      { value: "7+", label: "Years Exp." },
      { value: "5+", label: "Industries" },
    ],
    rqScore: 91,
    supports: ["RQ-Nova", "RQ-Drape", "RQ-Kai"],
    image: "/experts/portraits/jude.webp",
    bio: "Media professional helping students and creators master podcasting, storytelling, and communication skills.",
    headline: "Podcasting, Storytelling & Communication",
    intro:
      "Whether you're starting a podcast, creating content, or looking to communicate with greater confidence, I'll help you master the art of storytelling. Producing expert-led podcasts and mentoring aspiring creators, these sessions focus on practical skills you can apply immediately.",
    verified: true,
    yearsExperience: 7,
    rating: 5.0,
    reviewCount: 0,
    sessionDuration: "30 min",
    price: "₹2,000",
    socials: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/jude-weston-640487120/", icon: "linkedin" },
    ],
    about:
      "Jude Weston is a podcast producer, communication specialist, and storyteller with experience producing expert-led podcasts spanning public policy, science, business, education, and current affairs. He has worked end-to-end on podcast production, from research and scripting to recording, editing, publishing, and audience engagement. His sessions combine practical industry insights with hands-on learning that participants can immediately apply.",
    expertise: [
      "Podcasting",
      "Storytelling",
      "Communication Skills",
      "Interviewing",
      "Scriptwriting",
      "Public Speaking",
      "Content Strategy",
      "Creative Direction",
    ],
    skills: [
      "Podcast Production",
      "Audio Editing",
      "Video Editing",
      "Digital Storytelling",
      "Editorial Judgement",
    ],
    education: [
      { degree: "PG Diploma in Broadcast Journalism", school: "IIJNM, Bangalore", year: "2018" },
      { degree: "B.Com", school: "St. Xavier's College", year: "2015" },
    ],
    workExperience: [
      {
        company: "The Hindu",
        position: "Senior Sub Editor & Podcast Producer",
        duration: "2023 – Present",
        achievements: [],
      },
      {
        company: "Newslaundry",
        position: "Multimedia Producer",
        duration: "2020 – 2023",
        achievements: [],
      },
      {
        company: "IVM Podcasts",
        position: "Junior Producer",
        duration: "2019 – 2019",
        achievements: [],
      },
    ],
    industries: ["Media", "Journalism", "Content Creation", "Digital Media", "Communications"],
    languages: ["English"],
    awards: ["WAN-IFRA Digital Media Awards 2025"],
    trustedBy: ["The Hindu", "Newslaundry", "IVM Podcasts"],
    trustedByLabel: "Collaborated With",
    reviews: [
      {
        name: "Twinkle",
        role: "Student",
        image: "",
        rating: 5,
        text: "Had a great and insightful workshop with you, Jude! Thank you for your guidance. Your words have given me so much clarity.",
      },
      {
        name: "Pushpa",
        role: "Student",
        image: "",
        rating: 5,
        text: "The session was practical and engaging. I finally understood how to structure a podcast.",
      },
    ],
    whatYouGet: [
      { title: "Podcast Strategy", description: "Plan and launch your podcast with confidence." },
      { title: "Storytelling", description: "Turn ideas into engaging narratives." },
      { title: "Interviewing Skills", description: "Leading to meaningful conversations." },
      { title: "Content Creation", description: "Creating content that connects." },
      { title: "Practical Workflow", description: "Industry-tested production techniques." },
    ],
  },
];

export function getExpertBySlug(slug: string): Expert | undefined {
  return experts.find((e) => e.slug === slug);
}

/** Experts shown on public-facing surfaces (listings, sitemap, static pages).
 *  Excludes any expert flagged `hidden` while keeping the booking backend able
 *  to resolve them via `getExpertBySlug`. */
export const visibleExperts: Expert[] = experts.filter((e) => !e.hidden);

/* ─── Booking helpers (single source of truth for the booking backend) ───── */

/** Session length in minutes, parsed from `sessionDuration` (e.g. "30 min" → 30). */
export function sessionMinutes(expert: Pick<Expert, "sessionDuration">): number {
  return parseInt(expert.sessionDuration, 10) || 30;
}

/** Parse a price label like "₹999" / "$90" into a number (digits only). 0 if unparseable. */
export function parsePriceINR(price: string): number {
  const n = parseInt(price.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Booking amount (INR) for an expert slug, computed server-side. */
export function getSessionAmountINR(slug: string): number {
  const expert = getExpertBySlug(slug);
  return expert ? parsePriceINR(expert.price) : 0;
}

/* ─── Shared session benefits & FAQs (same for every expert) ─────────────── */
export type BenefitIcon =
  | "guidance"
  | "career"
  | "insights"
  | "strategy"
  | "problem"
  | "steps";

export const sessionBenefits: { icon: BenefitIcon; title: string; description: string }[] = [
  {
    icon: "guidance",
    title: "Personalized Guidance",
    description: "Tailored to your exact situation.",
  },
  {
    icon: "career",
    title: "Career Advice",
    description: "Clarity on your next move.",
  },
  {
    icon: "insights",
    title: "Industry Insights",
    description: "How the best teams operate.",
  },
  {
    icon: "strategy",
    title: "Strategic Recommendations",
    description: "Where to focus, what to skip.",
  },
  {
    icon: "problem",
    title: "Problem Solving",
    description: "Tackle your hardest challenge.",
  },
  {
    icon: "steps",
    title: "Actionable Next Steps",
    description: "A plan you can start today.",
  },
];

export const sessionFaqs = [
  {
    q: "Who is this session for?",
    a: "Anyone serious about making progress: founders, operators, designers, and career-switchers alike. Whether you're just starting out or scaling fast, the session adapts to where you are.",
  },
  {
    q: "How should I prepare?",
    a: "Come with your goal and your biggest current challenge. The more specific you can be, the more value you'll get. Sharing context or materials ahead of time is welcome but never required.",
  },
  {
    q: "What outcomes can I expect?",
    a: "Clarity, direction, and momentum. You'll walk away with a concrete plan, honest feedback, and the confidence to take your next step, backed by someone who's been where you want to go.",
  },
];
