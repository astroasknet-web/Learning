/**
 * Pathname → {solution, audience} for the website context sent to SalesIQ.
 * Client-side only (no "use client" needed, this is a pure function).
 *
 * Not a guess: these are the real directory names under app/solutions/, and
 * the audience semantics (Recruiters→Recruiter, Institutes→Institute,
 * Enterprises/Startups→Enterprise) are the ones already codified in
 * lib/crm/derive.ts's SOLUTION_AUDIENCES map — same meaning, just keyed by
 * URL slug instead of the hidden form field derive.ts reads. The
 * "everything else on /solutions/* is Professional" default mirrors
 * deriveWaitlistAudience()'s own documented convention in that file. The
 * same Professional default extends to the /ai-* individual agent pages and
 * to /enterprise/* + /agents?mode=enterprise for the Enterprise case — see
 * the comments at each rule below.
 */

const SOLUTION_SLUGS = new Set([
  "students",
  "professionals",
  "freelancers",
  "coaches",
  "consultants",
  "institutes",
  "recruiters",
  "enterprises",
  "startups",
]);

const SOLUTION_AUDIENCE: Partial<Record<string, string>> = {
  students: "Student",
  recruiters: "Recruiter",
  institutes: "Institute",
  enterprises: "Enterprise",
  startups: "Enterprise",
  // professionals, freelancers, coaches, consultants: Professional (default below)
};

export function solutionFromPath(pathname: string): { solution: string | null; audience: string | null } {
  // Callers may pass a bare path or path+query (e.g. "/agents?mode=enterprise")
  // — everything below except the /agents check matches against the path
  // only, so split it off up front rather than relying on each regex to
  // tolerate a trailing "?...".
  const [path, query] = pathname.split("?");

  // /enterprise/* is the enterprise agent family (ai-recruiter,
  // workforce-analyst, attrition-predictor, …) — nine pages that are
  // unambiguously B2B Enterprise but live outside /solutions/. Without this
  // they resolved to {null, null}, which meant the bot offered them consumer
  // "Pricing" chips (the ₹699/₹1,999 individual table) and CRM leads from
  // those pages carried no Audience. Mapped to the existing "enterprises"
  // slug rather than a new one, so every downstream consumer — chips,
  // isB2bContext, the AI prompt's page context — keeps working unchanged.
  if (/^\/enterprise(\/|$)/.test(path)) {
    return { solution: "enterprises", audience: "Enterprise" };
  }

  const match = path.match(/^\/solutions\/([a-z-]+)/);
  const slug = match?.[1];
  if (slug && SOLUTION_SLUGS.has(slug)) {
    return { solution: slug, audience: SOLUTION_AUDIENCE[slug] ?? "Professional" };
  }

  // /ai-* — the seven individual AI agent landing pages (ai-resume-expert,
  // ai-interviewer, ai-brand-builder, ai-learning-curator,
  // ai-opportunity-finder, ai-roleplay-coach, ai-skill-trainer). Same
  // audience as the professionals-family /solutions/* pages: an individual
  // exploring a personal AI agent is the same B2C visitor, just one page
  // family over. Reuses the existing "professionals" bucket rather than a
  // new one, so chips/isB2bContext/CRM derivation keep working unchanged —
  // same convention already documented for the bot's own audience fallback
  // (lib/crm/payload.ts botLeadAudience()).
  if (/^\/ai-/.test(path)) {
    return { solution: "professionals", audience: "Professional" };
  }

  // /agents has an Individual/Business toggle (components/agents/directory/
  // AgentsDirectory.tsx) that swaps its roster without changing the path —
  // otherwise invisible to this function, since a bare "/agents" can't tell
  // the two states apart. Reflected as an explicit "?mode=enterprise" /
  // "?mode=individual" query param on that same route instead of a second
  // page. Scoped to exactly this path: an arbitrary "mode" param elsewhere
  // has no defined meaning and must not be guessed at.
  if (path === "/agents" && new URLSearchParams(query ?? "").get("mode") === "enterprise") {
    return { solution: "enterprises", audience: "Enterprise" };
  }

  return { solution: null, audience: null };
}
