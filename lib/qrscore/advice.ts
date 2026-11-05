import { phpRound } from "./php";

/**
 * Plain-language "what to work on", chosen from the weakest of the five areas (port of Score\Advice).
 * It says WHAT to improve and never HOW the score is computed: no check names, weights or points.
 */
const TEXT: Record<number, [string, string]> = {
  1: ["Make your education details complete", "Name each qualification clearly with the institution, location, year you finished, and your grade or CGPA."],
  2: ["Make your experience measurable", "For every role show the dates, your job title, and bullets that start with an action verb and end with a result or number."],
  3: ["Sharpen your skills section", "List the tools and skills the job asks for, grouped clearly, and show them in use inside your experience and projects."],
  4: ["Show what you have built", "Add two or three projects: what you made, the tools you used and what came of it. Link to the work if you can."],
  5: ["Improve impact and presentation", "Quantify your achievements, cut filler words, and keep a clean one or two pages with consistent formatting."],
};

export interface Area {
  id?: number;
  pct?: number | null;
  applicable?: boolean;
}

export interface AdviceItem {
  title: string;
  text: string;
}

export function adviceFromAreas(areas: Area[], limit = 3): AdviceItem[] {
  const weak = new Map<number, number>();
  for (const a of areas) {
    const id = Math.trunc(a.id ?? 0);
    if (TEXT[id] && (a.applicable ?? true) && a.pct !== null && a.pct !== undefined && a.pct < 85) weak.set(id, a.pct);
  }
  // asort(): ascending by value, stable (ties keep their original order)
  const ids = Array.from(weak.entries()).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const out = ids.slice(0, limit).map((id) => ({ title: TEXT[id][0], text: TEXT[id][1] }));
  if (!out.length) out.push({ title: "Polish and tailor", text: "Your resume is in good shape. Adjust the wording of your top bullets to match each job you apply to." });
  return out;
}

export function adviceFromResult(result: { sections?: Array<{ id?: number; applicable?: boolean; points_per_section?: number; section_score?: number }> }, limit = 3): AdviceItem[] {
  const areas: Area[] = (result.sections ?? []).map((s) => {
    const pts = s.points_per_section ?? 20;
    return { id: s.id ?? 0, applicable: !!s.applicable, pct: s.applicable ? phpRound(((s.section_score ?? 0) / Math.max(1, pts)) * 100) : null };
  });
  return adviceFromAreas(areas, limit);
}
