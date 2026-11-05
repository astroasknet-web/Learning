/**
 * Single source of truth for the 8 persona records. Consumed by:
 *  - ProblemStatementV2 (4×2 portrait grid + ambition copy)
 *  - Navbar dropdown (8 persona playbook links)
 *  - UseCases sub-pages (via their persona `id`)
 *
 * Image files on disk keep their historical singular names
 * (`/personas/seeker.jpg`, `/personas/expert.jpg`, …) — we just point
 * the new plural IDs at them. That avoids a filesystem rename while
 * still giving us the public-facing plural URLs the brief specifies.
 *
 * Order is deliberate: individuals → organisations, each row flowing
 * from "earliest stage" to "most established". Don't reorder casually —
 * grid layout and dropdown order are driven straight off this array.
 */
export type Persona = {
  /** URL slug under /solutions/{id} and the canonical reference ID. */
  id: string;
  /** Audience group — drives the Hero toggle / Navbar "Use Cases" dropdown.
   *  "individual" = job-seeker side (Students, Professionals, Coaches,
   *  Freelancers); "enterprise" = organisation side (Startups, Recruiters,
   *  Enterprises, Institutes). */
  type: "individual" | "enterprise";
  /** Uppercase card label, e.g. "INDIVIDUALS". */
  label: string;
  /** Title-case label used in navigation menus. */
  navLabel: string;
  /** First-person "I want…" line shown on Problem cards. */
  ambition: string;
  /** "A squad that…" outcome line shown on Use Case sub-pages. */
  outcome: string;
  /** Portrait path under /public. */
  image: string;
  /** Object-position hint for the 4:5 crop — keeps faces anchored near
   *  the top so no chins get sheared off. */
  objectPosition?: string;
  /** Full href to the persona's playbook page. */
  link: string;
};

export const personas: Persona[] = [
  // ─── Row 1 — individuals ───────────────────────────────────────────
  {
    id: "students",
    type: "individual",
    label: "Students",
    navLabel: "Students",
    ambition: "My degree is ready. Am I?",
    outcome: "A Squad That Shows you What Fits.",
    image: "/personas/student.jpg",
    objectPosition: "center 18%",
    link: "/solutions/students",
  },
  {
    id: "professionals",
    type: "individual",
    label: "Professionals",
    navLabel: "Professionals",
    ambition: "I Want a Job That Fits Who I Am, Not Just Any Job.",
    outcome: "A Squad That Finds the Role for you.",
    image: "/personas/seeker.jpg",
    objectPosition: "center 20%",
    link: "/solutions/professionals",
  },
  {
    id: "coaches",
    type: "individual",
    label: "Coaches",
    navLabel: "Coaches",
    ambition: "I Want Clients Who Value My Work and Pay What It’s Worth.",
    outcome: "A Squad That Fills Your Calendar with the Right Clients.",
    image: "/personas/expert.jpg",
    objectPosition: "center 20%",
    link: "/solutions/coaches",
  },
  {
    id: "freelancers",
    type: "individual",
    label: "Freelancers",
    navLabel: "Freelancers",
    ambition: "I Want Gigs That Respect My Skills and Yes, My Rates Too.",
    outcome: "A Squad That Wins you Better-Paying Gigs.",
    image: "/personas/freelancer.jpg",
    objectPosition: "center 20%",
    link: "/solutions/freelancers",
  },

  // ─── Row 2 — organisations ─────────────────────────────────────────
  {
    id: "startups",
    type: "enterprise",
    label: "Startups",
    navLabel: "Startups",
    ambition: "I Want to Build the Right Team from Day One.",
    outcome: "A Squad That Helps you Build the Right Team.",
    image: "/personas/startups.jpg",
    objectPosition: "center 20%",
    link: "/solutions/startups",
  },
  {
    id: "recruiters",
    type: "enterprise",
    label: "Recruiters",
    navLabel: "Recruiters",
    ambition: "I Want to Find the Right Candidate, Fast.",
    outcome: "A Squad That Finds the Right Hire Faster.",
    image: "/personas/recruiter.jpg",
    objectPosition: "center 20%",
    link: "/solutions/recruiters",
  },
  {
    id: "enterprises",
    type: "enterprise",
    label: "Enterprises",
    navLabel: "Enterprises",
    ambition: "I Want to Keep My Best People Happy.",
    outcome: "A Squad That Helps you Keep Your Best People.",
    image: "/personas/enterprise.jpg",
    objectPosition: "center 20%",
    link: "/solutions/enterprises",
  },
  {
    id: "institutes",
    type: "enterprise",
    label: "Institutes",
    navLabel: "Institutes",
    ambition: "Degrees are delivered. Careers are not.",
    outcome: "A Squad That Gets Every Student Placement-Ready.",
    image: "/personas/institute.jpg",
    objectPosition: "center 18%",
    link: "/solutions/institutes",
  },
];
