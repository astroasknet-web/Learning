import { dictionaries, recommendations } from "./data";
import { clampInt, containsAny, findAll, years as yearsIn } from "./text";
import { nowYear, rx } from "./php";
import type { Segmented } from "./segmenter";

/** Career stage and years of experience, which drive N/A redistribution (port of Score\CareerStage and DomainDetector). */
export type Stage = "student" | "fresher" | "experienced" | "senior";

export interface Career {
  stage: Stage;
  yearsExperience: number;
  academiaTransition: boolean;
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";

export function inferCareer(seg: Segmented, fullText: string): Career {
  const dict = dictionaries();
  const experienceBlock = seg.sections["experience"] ?? "";
  const eduBlock = seg.sections["education"] ?? fullText;

  // Experience years come ONLY from the experience section; education dates must never count as work experience.
  const years = experienceBlock !== "" ? experienceYears(experienceBlock) : 0;
  const isStudent = containsAny(eduBlock, dict.student_markers) && years === 0;
  const academia = containsAny(fullText, [
    "postdoc", "post-doctoral", "faculty", "lecturer", "professor",
    "research fellow", "phd candidate", "pursuing phd", "academic researcher",
    "teaching assistant", "research assistant", "into academia", "academic career",
  ]);

  let stage: Stage;
  if (isStudent && years < 1) stage = "student";
  else if (years < 2) stage = "fresher";
  else if (years < 10) stage = "experienced";
  else stage = "senior";

  return { stage, yearsExperience: years, academiaTransition: academia };
}

function experienceYears(text: string): number {
  const now = nowYear();
  const re = rx(
    "((?:" + MONTHS + ")[a-z]*\\.?\\s*)?((?:19|20)\\d{2})\\s*[-–—to]+\\s*((?:present|current|now|till date|ongoing)|(?:(?:" + MONTHS + ")[a-z]*\\.?\\s*)?(?:19|20)\\d{2})",
    "gi",
  );
  const ongoingStarts: number[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  for (const x of text.matchAll(re)) {
    const start = parseInt(x[2], 10);
    starts.push(start);
    const ym = x[3].match(/(?:19|20)\d{2}/);
    if (ym) ends.push(parseInt(ym[0], 10));
    else ongoingStarts.push(start); // "... - present"
  }
  if (ongoingStarts.length) return clampInt(now - Math.min(...ongoingStarts), 0, 50);
  if (starts.length && ends.length) return clampInt(Math.max(...ends) - Math.min(...starts), 0, 50);

  const ys = yearsIn(text).filter((y) => y >= now - 45);
  if (!ys.length) return 0;
  const ongoing = /\b(present|current|till date|now)\b/i.test(text);
  return clampInt((ongoing ? now : Math.max(...ys)) - Math.min(...ys), 0, 50);
}

export interface Domain {
  key: string;
  label: string;
  hits: number;
}

/** Detects the candidate's career domain from the whole resume (deterministic keyword scoring, no AI). */
export function detectDomain(text: string): Domain {
  const domains = recommendations().domains as unknown as Record<string, { label?: string; keywords?: string[] }>;
  let best = "general";
  let bestHits = 0;
  let bestLabel = domains["general"]?.label ?? "career readiness";
  for (const [key, def] of Object.entries(domains)) {
    if (key === "general") continue;
    const hits = findAll(text, def.keywords ?? []).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = key;
      bestLabel = def.label ?? key;
    }
  }
  return { key: best, label: bestLabel, hits: bestHits };
}
